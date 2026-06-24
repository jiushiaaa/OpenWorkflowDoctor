import { applyPatchOperations } from "./patch.js";
import { formatPatchDiff } from "./patch-diff.js";
import { diagnoseWorkflow } from "./risk-rules.js";
import { summarizeWorkflow } from "./summary.js";
import { verifyPatch } from "./verifier.js";
import { createWorkflowViewModel } from "./view-model.js";
import type {
  AiPatchProposalCandidate,
  AiPatchProposalInput,
  AiPatchProposalValidationResult,
  DoctorReport,
  NodeIR,
  PatchConflict,
  PatchConflictCode,
  PatchConflictSeverity,
  PatchOperation,
  PatchProposal,
  VerificationGate,
  VerificationReport,
  VerificationStatus,
  WorkflowIR
} from "./types.js";

export const AI_PATCH_CAPABILITY_MANIFEST: AiPatchProposalInput["capabilityManifest"] = {
  allowedOperationTypes: ["insert_error_branch", "insert_branch_route", "insert_node_after", "update_node_parameters"],
  allowedSyntheticNodeTypes: [
    "openworkflowdoctor.error.handler",
    "openworkflowdoctor.flow.stop",
    "openworkflowdoctor.audit.log",
    "openworkflowdoctor.guard.dedupe"
  ],
  allowedParameterUpdates: [
    {
      key: "timeout",
      minimum: 1000,
      maximum: 120000
    }
  ],
  unsupportedOperationTypes: ["insert_node_before"]
};

export function buildAiPatchProposalInput(
  report: DoctorReport,
  options: {
    request: string;
    provider?: unknown;
    humanReview?: unknown;
    reviewPacketArtifacts?: unknown;
    rawWorkflowJson?: unknown;
  }
): AiPatchProposalInput {
  const nodeIds = new Map(report.workflow.nodes.map((node, index) => [node.id, `node-${index + 1}`]));
  const issueIds = new Map(report.issues.map((issue, index) => [issue.id, `issue-${index + 1}`]));
  const inputWithoutFingerprint = {
    schemaVersion: "openworkflowdoctor.ai-patch-input.v1" as const,
    inputFingerprint: "",
    request: redactUnsafeText(options.request).slice(0, 1000),
    workflow: {
      alias: "workflow" as const,
      nodeCount: report.workflow.nodes.length,
      edgeCount: report.workflow.edges.length,
      riskCounts: { ...report.summary.riskCounts }
    },
    graph: {
      nodes: report.workflow.nodes.map((node) => ({
        id: nodeIds.get(node.id) ?? "node-unknown",
        type: summarizeNodeType(node.type),
        typeFamily: node.typeFamily
      })),
      edges: report.workflow.edges.map((edge, index) => ({
        id: `edge-${index + 1}`,
        sourceNodeId: nodeIds.get(edge.sourceNodeId) ?? "node-unknown",
        targetNodeId: nodeIds.get(edge.targetNodeId) ?? "node-unknown",
        sourceOutput: edge.sourceOutput,
        sourceOutputIndex: edge.sourceOutputIndex
      }))
    },
    issues: report.issues.map((issue) => ({
      id: issueIds.get(issue.id) ?? "issue-unknown",
      severity: issue.severity,
      ...(issue.nodeId ? { nodeId: nodeIds.get(issue.nodeId) ?? "node-unknown" } : {}),
      title: issue.title,
      explanation: issue.explanation,
      suggestedFix: issue.suggestedFix
    })),
    deterministicPatch: {
      summary: report.proposal.summary,
      operationTypes: report.proposal.operations.map((operation) => operation.type),
      risksAddressed: report.proposal.risksAddressed.map((issueId) => issueIds.get(issueId) ?? "issue-unknown"),
      expectedImpact: report.proposal.operations.map((operation, index) => `Operation ${index + 1} proposes ${operation.type}.`)
    },
    capabilityManifest: AI_PATCH_CAPABILITY_MANIFEST
  };
  const inputFingerprint = `aip1-${fnv1a64Hex(stableStringify(inputWithoutFingerprint))}`;

  return {
    ...inputWithoutFingerprint,
    inputFingerprint
  };
}

export function validateAiPatchProposalCandidate(
  input: AiPatchProposalInput,
  workflow: WorkflowIR,
  candidate: AiPatchProposalCandidate
): AiPatchProposalValidationResult {
  const conflicts: PatchConflict[] = [...candidate.conflicts];
  const operations: PatchOperation[] = [];
  const usedNewNodeIds = new Map<string, number>();
  const currentIssueIds = new Set(input.issues.map((issue) => issue.id));
  const diagnosedIssues = diagnoseWorkflow(workflow);
  const issueIdMap = Object.fromEntries(
    input.issues
      .map((issue, index) => [issue.id, diagnosedIssues[index]?.id])
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
  const realIssueIds = new Set(diagnosedIssues.map((issue) => issue.id));
  const nodeIdMap = Object.fromEntries(
    input.graph.nodes
      .map((node, index) => [node.id, workflow.nodes[index]?.id])
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );

  if (candidate.inputFingerprint !== input.inputFingerprint) {
    conflicts.push(createConflict("stale_report", "blocker", [], "AI proposal was generated for a stale review input."));
  }

  candidate.proposal.risksAddressed.forEach((issueId) => {
    if (!currentIssueIds.has(issueId) && !realIssueIds.has(issueId)) {
      conflicts.push(createConflict("semantic_validation_failed", "blocker", [], `Risk ${issueId} is not present in current diagnostics.`, { issueId }));
    }
  });

  candidate.proposal.operations.forEach((operation, index) => {
    if (!AI_PATCH_CAPABILITY_MANIFEST.allowedOperationTypes.includes(operation.type)) {
      conflicts.push(createConflict("unsupported_operation", "blocker", [index], `Operation ${operation.type} is not AI-allowed in v0.4.`));
      return;
    }

    const targetNodeId = nodeIdMap[operation.targetNodeId];
    if (!targetNodeId) {
      conflicts.push(createConflict("unmapped_ai_reference", "blocker", [index], `Target ${operation.targetNodeId} is not in the AI-safe node map.`, { targetNodeId: operation.targetNodeId }));
      return;
    }
    if (!workflow.nodes.some((node) => node.id === targetNodeId)) {
      conflicts.push(createConflict("target_missing", "blocker", [index], `Target ${targetNodeId} is not in the current workflow.`, { targetNodeId }));
      return;
    }

    if (operation.type === "update_node_parameters") {
      const mappedOperation: PatchOperation = {
        ...operation,
        targetNodeId
      };
      const parameterConflict = validateParameterUpdate(mappedOperation, index);
      if (parameterConflict) {
        conflicts.push(parameterConflict);
        return;
      }
      operations.push(mappedOperation);
      return;
    }

    if (operation.type === "insert_node_before") {
      conflicts.push(createConflict("unsupported_operation", "blocker", [index], "AI cannot insert nodes before existing nodes in v0.4.", { targetNodeId }));
      return;
    }

    const nodeConflict = validateNewNode(operation.newNode, index, usedNewNodeIds);
    if (nodeConflict) {
      conflicts.push(nodeConflict);
    }
    usedNewNodeIds.set(operation.newNode.id, index);

    if (operation.type === "insert_branch_route" && branchRouteExists(workflow, targetNodeId, operation.sourceOutputIndex)) {
      conflicts.push(createConflict("branch_route_exists", "blocker", [index], `Branch route ${targetNodeId} main[${operation.sourceOutputIndex}] already exists.`, { targetNodeId }));
    }

    operations.push({
      ...operation,
      targetNodeId
    });
  });

  const conflictStatus = createPatchConflictSummary(conflicts);
  const proposal: PatchProposal = {
    ...candidate.proposal,
    operations,
    risksAddressed: candidate.proposal.risksAddressed.map((issueId) => issueIdMap[issueId] ?? issueId)
  };

  return {
    proposal,
    conflicts,
    canPreview: conflictStatus !== "blocker",
    patchSource: {
      kind: "ai-assisted",
      generatedAt: candidate.createdAt,
      inputFingerprint: candidate.inputFingerprint,
      ...(candidate.modelLabel ? { modelLabel: candidate.modelLabel } : {}),
      validation: {
        schema: "pass",
        semantic: conflictStatus === "blocker" ? "fail" : conflictStatus === "hold" ? "hold" : "pass",
        conflictStatus
      },
      safetyNotes: [...candidate.safetyNotes]
    }
  };
}

export function createAiPatchDoctorReport(
  baseReport: DoctorReport,
  input: AiPatchProposalInput,
  candidate: AiPatchProposalCandidate
): DoctorReport {
  const validation = validateAiPatchProposalCandidate(input, baseReport.workflow, candidate);
  if (!validation.canPreview) {
    throw new Error("AI PatchProposal has blocking conflicts.");
  }

  const patchedWorkflow = applyPatchOperations(baseReport.workflow, validation.proposal.operations);
  const patchedIssues = diagnoseWorkflow(patchedWorkflow);
  const patchDiff = formatPatchDiff(baseReport.workflow, validation.proposal.operations);
  const verification = addAiVerificationGates(
    verifyPatch({
      original: baseReport.workflow,
      patched: patchedWorkflow,
      operations: validation.proposal.operations
    }),
    validation
  );

  return {
    workflow: baseReport.workflow,
    summary: baseReport.summary,
    view: baseReport.view,
    issues: baseReport.issues,
    proposal: validation.proposal,
    patchDiff,
    patchedWorkflow,
    patchedSummary: summarizeWorkflow(patchedWorkflow),
    patchedView: createWorkflowViewModel(patchedWorkflow, patchedIssues),
    patchedIssues,
    verification,
    acceptanceRecommendation: recommendAcceptance(baseReport.summary.recommendedStatus, verification),
    patchSource: validation.patchSource
  };
}

export function createPatchConflictSummary(conflicts: PatchConflict[]): "none" | PatchConflictSeverity {
  if (conflicts.some((conflict) => conflict.severity === "blocker")) {
    return "blocker";
  }
  if (conflicts.some((conflict) => conflict.severity === "hold")) {
    return "hold";
  }
  if (conflicts.some((conflict) => conflict.severity === "info")) {
    return "info";
  }
  return "none";
}

function validateParameterUpdate(operation: Extract<PatchOperation, { type: "update_node_parameters" }>, index: number): PatchConflict | null {
  for (const [key, value] of Object.entries(operation.parameters)) {
    if (key !== "timeout") {
      return createConflict("unsupported_parameter", "blocker", [index], `AI cannot update parameter ${key} in v0.4.`, { targetNodeId: operation.targetNodeId });
    }
    if (!Number.isInteger(value) || Number(value) < 1000 || Number(value) > 120000) {
      return createConflict("semantic_validation_failed", "blocker", [index], "AI timeout updates must be integers from 1000 to 120000.", { targetNodeId: operation.targetNodeId });
    }
  }
  return null;
}

function validateNewNode(node: NodeIR, index: number, usedNewNodeIds: Map<string, number>): PatchConflict | null {
  if (!AI_PATCH_CAPABILITY_MANIFEST.allowedSyntheticNodeTypes.includes(node.type)) {
    return createConflict("unsupported_node_type", "blocker", [index], `AI cannot create node type ${node.type} in v0.4.`);
  }
  if (usedNewNodeIds.has(node.id)) {
    return createConflict("duplicate_new_node_id", "blocker", [usedNewNodeIds.get(node.id) ?? index, index], `AI proposed duplicate new node id ${node.id}.`);
  }
  return null;
}

function branchRouteExists(workflow: WorkflowIR, targetNodeId: string, sourceOutputIndex: number): boolean {
  return workflow.edges.some(
    (edge) =>
      edge.sourceNodeId === targetNodeId &&
      edge.sourceOutput === "main" &&
      edge.sourceOutputIndex === sourceOutputIndex
  );
}

function addAiVerificationGates(
  report: VerificationReport,
  validation: AiPatchProposalValidationResult
): VerificationReport {
  const aiGates: VerificationGate[] = [
    {
      id: "ai_proposal_schema_valid",
      title: "AI proposal schema is valid",
      status: "pass",
      explanation: "AI proposal passed strict schema validation before preview."
    },
    {
      id: "ai_proposal_semantic_valid",
      title: "AI proposal semantic validation is valid",
      status: validation.patchSource.validation?.semantic ?? "fail",
      explanation: "AI proposal was checked against current WorkflowIR targets, allowlists, and parameter bounds."
    },
    {
      id: "ai_proposal_source_recorded",
      title: "AI proposal source is recorded",
      status: validation.patchSource.kind === "ai-assisted" ? "pass" : "fail",
      explanation: "Review Packet can record AI-assisted provenance without secrets."
    },
    {
      id: "ai_proposal_no_blocking_conflicts",
      title: "AI proposal has no blocking conflicts",
      status: validation.conflicts.some((conflict) => conflict.severity === "blocker") ? "fail" : "pass",
      explanation:
        validation.conflicts.length === 0
          ? "No deterministic AI proposal conflicts were detected."
          : `${validation.conflicts.length} deterministic AI proposal conflict(s) were detected.`
    }
  ];
  const checkedGates = [...report.checkedGates, ...aiGates];
  const status = summarizeStatus(checkedGates);

  return {
    ...report,
    status,
    checkedGates,
    passedScenarios: checkedGates.filter((gate) => gate.status === "pass").map((gate) => gate.id),
    failedScenarios: checkedGates.filter((gate) => gate.status === "fail").map((gate) => gate.id),
    warnings: checkedGates.filter((gate) => gate.status === "hold").map((gate) => gate.explanation),
    requiredRemediation: checkedGates
      .filter((gate) => gate.status !== "pass")
      .map((gate) => `Review verifier gate ${gate.id}.`)
  };
}

function createConflict(
  code: PatchConflictCode,
  severity: PatchConflictSeverity,
  operationIndexes: number[],
  explanation: string,
  options: { targetNodeId?: string; issueId?: string } = {}
): PatchConflict {
  return {
    id: `ai-conflict-${code}-${operationIndexes.join("-") || "proposal"}`,
    severity,
    operationIndexes,
    ...(options.targetNodeId ? { targetNodeId: options.targetNodeId } : {}),
    ...(options.issueId ? { issueId: options.issueId } : {}),
    code,
    explanation
  };
}

function summarizeStatus(gates: VerificationGate[]): VerificationStatus {
  if (gates.some((gate) => gate.status === "fail")) {
    return "fail";
  }
  if (gates.some((gate) => gate.status === "hold")) {
    return "hold";
  }
  return "pass";
}

function recommendAcceptance(summaryStatus: VerificationStatus, verification: VerificationReport): VerificationStatus {
  if (summaryStatus === "fail" || verification.status === "fail") {
    return "fail";
  }
  if (summaryStatus === "hold" || verification.status === "hold") {
    return "hold";
  }
  return "pass";
}

function summarizeNodeType(type: string): string {
  const n8nBaseType = /^n8n-nodes-base\.([a-z0-9-]+)/i.exec(type);
  if (n8nBaseType?.[1]) {
    return `n8n-nodes-base.${n8nBaseType[1].toLowerCase()}`;
  }
  if (type.startsWith("openworkflowdoctor.")) {
    return type;
  }
  return "unknown";
}

function redactUnsafeText(value: string): string {
  return value
    .replace(/sk-[a-z0-9_-]+/gi, "[redacted]")
    .replace(/bearer\s+[a-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/token=[^&\s]+/gi, "token=[redacted]");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function fnv1a64Hex(value: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;

  for (const character of value) {
    hash ^= BigInt(character.codePointAt(0) ?? 0);
    hash = (hash * prime) & mask;
  }

  return hash.toString(16).padStart(16, "0");
}
