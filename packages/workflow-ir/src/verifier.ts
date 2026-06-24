import { diagnoseWorkflow } from "./risk-rules.js";
import type { PatchOperation, RiskIssue, VerificationGate, VerificationReport, VerificationStatus, WorkflowIR } from "./types.js";

export type VerifyPatchInput = {
  original: WorkflowIR;
  patched: WorkflowIR;
  operations: PatchOperation[];
};

export function verifyPatch(input: VerifyPatchInput): VerificationReport {
  const originalIssues = diagnoseWorkflow(input.original);
  const patchedIssues = diagnoseWorkflow(input.patched);
  const gates: VerificationGate[] = [
    verifyPatchHasOperations(input.operations),
    verifyWorkflowHasNodes(input.patched),
    verifyCriticalRiskCount(originalIssues, patchedIssues),
    verifyNoRemainingRepairableHighRisks(patchedIssues),
    verifyRemainingSideEffectsNeedHumanReview(patchedIssues)
  ];

  return {
    status: summarizeStatus(gates),
    checkedGates: gates,
    passedScenarios: gates.filter((gate) => gate.status === "pass").map((gate) => gate.id),
    failedScenarios: gates.filter((gate) => gate.status === "fail").map((gate) => gate.id),
    warnings: gates.filter((gate) => gate.status === "hold").map((gate) => gate.explanation),
    requiredRemediation: gates
      .filter((gate) => gate.status !== "pass")
      .map((gate) => remediationForGate(gate.id))
  };
}

function verifyPatchHasOperations(operations: PatchOperation[]): VerificationGate {
  if (operations.length === 0) {
    return {
      id: "patch_has_operations",
      title: "Patch contains reviewable operations",
      status: "hold",
      explanation: "Patch does not include structured operations."
    };
  }

  return {
    id: "patch_has_operations",
    title: "Patch contains reviewable operations",
    status: "pass",
    explanation: `Patch includes ${operations.length} structured operation${operations.length === 1 ? "" : "s"}.`
  };
}

function verifyWorkflowHasNodes(workflow: WorkflowIR): VerificationGate {
  if (workflow.nodes.length === 0) {
    return {
      id: "workflow_has_nodes",
      title: "Workflow still has nodes",
      status: "fail",
      explanation: "Patched workflow has no nodes."
    };
  }

  return {
    id: "workflow_has_nodes",
    title: "Workflow still has nodes",
    status: "pass",
    explanation: `Patched workflow has ${workflow.nodes.length} node${workflow.nodes.length === 1 ? "" : "s"}.`
  };
}

function verifyCriticalRiskCount(
  originalIssues: ReturnType<typeof diagnoseWorkflow>,
  patchedIssues: ReturnType<typeof diagnoseWorkflow>
): VerificationGate {
  const originalCriticalCount = countIssuesByMinimumSeverity(originalIssues, "critical");
  const patchedCriticalCount = countIssuesByMinimumSeverity(patchedIssues, "critical");
  const originalIssueIds = new Set(originalIssues.map((issue) => issue.id));
  const introducedCriticalIssueIds = patchedIssues
    .filter((issue) => issue.severity === "critical" && !originalIssueIds.has(issue.id))
    .map((issue) => issue.id);
  const status: VerificationStatus =
    patchedCriticalCount <= originalCriticalCount && introducedCriticalIssueIds.length === 0
      ? "pass"
      : "fail";
  const introducedCriticalExplanation =
    introducedCriticalIssueIds.length > 0
      ? `, with introduced critical issues: ${introducedCriticalIssueIds.join(", ")}`
      : "";

  return {
    id: "critical_risk_count",
    title: "Critical risks are not increased",
    status,
    explanation: `Critical risk count changed from ${originalCriticalCount} to ${patchedCriticalCount}${introducedCriticalExplanation}.`
  };
}

function verifyNoRemainingRepairableHighRisks(patchedIssues: ReturnType<typeof diagnoseWorkflow>): VerificationGate {
  const repairableHighRiskCount = countIssuesByMinimumSeverity(getRepairableIssues(patchedIssues), "high");
  if (repairableHighRiskCount > 0) {
    return {
      id: "remaining_repairable_high_risks",
      title: "No repairable high or critical risks remain",
      status: "hold",
      explanation: "Patched workflow still has repairable high or critical risks."
    };
  }

  return {
    id: "remaining_repairable_high_risks",
    title: "No repairable high or critical risks remain",
    status: "pass",
    explanation: "Patched workflow has no repairable high or critical risks."
  };
}

function verifyRemainingSideEffectsNeedHumanReview(patchedIssues: ReturnType<typeof diagnoseWorkflow>): VerificationGate {
  const sideEffectReviewCount = patchedIssues.filter((issue) => issue.id.startsWith("high_risk_side_effect_node:")).length;
  if (sideEffectReviewCount > 0) {
    return {
      id: "side_effect_human_review",
      title: "Remaining side effects need human confirmation",
      status: "hold",
      explanation: "Patched workflow still contains high-risk side effect nodes that require human acceptance."
    };
  }

  return {
    id: "side_effect_human_review",
    title: "Remaining side effects need human confirmation",
    status: "pass",
    explanation: "Patched workflow has no remaining side-effect nodes requiring human confirmation."
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

function countIssuesByMinimumSeverity(
  issues: RiskIssue[],
  minimumSeverity: "high" | "critical"
): number {
  const rank = new Map([
    ["low", 1],
    ["medium", 2],
    ["high", 3],
    ["critical", 4]
  ]);
  const minimumRank = rank.get(minimumSeverity) ?? 0;

  return issues.filter((issue) => (rank.get(issue.severity) ?? 0) >= minimumRank).length;
}

function getRepairableIssues(issues: RiskIssue[]): RiskIssue[] {
  return issues.filter((issue) => !issue.id.startsWith("high_risk_side_effect_node:"));
}

function remediationForGate(gateId: string): string {
  switch (gateId) {
    case "patch_has_operations":
      return "Provide at least one structured PatchOperation before verification.";
    case "workflow_has_nodes":
      return "Restore the workflow graph before accepting the patch.";
    case "critical_risk_count":
      return "Reduce critical risks to the original count or lower before accepting.";
    case "remaining_repairable_high_risks":
      return "Resolve remaining repairable high and critical risk issues before accepting.";
    case "side_effect_human_review":
      return "Human reviewer must confirm the remaining side-effect nodes are expected before accepting.";
    default:
      return `Review verifier gate ${gateId}.`;
  }
}
