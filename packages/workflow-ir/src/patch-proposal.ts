import { diagnoseWorkflow } from "./risk-rules.js";
import type { NodeIR, PatchOperation, PatchProposal, RiskIssue, WorkflowIR } from "./types.js";

type ProposalAccumulator = {
  operations: PatchOperation[];
  risksAddressed: string[];
  expectedImpact: string[];
};

export function createRuleBasedPatchProposal(workflow: WorkflowIR, request: string): PatchProposal {
  const normalizedRequest = normalizeRequest(request);
  const comprehensiveRequest = mentionsComprehensiveRepair(normalizedRequest);
  const issues = diagnoseWorkflow(workflow);
  const accumulator: ProposalAccumulator = {
    operations: [],
    risksAddressed: [],
    expectedImpact: []
  };

  if (comprehensiveRequest || mentionsPayment(normalizedRequest)) {
    addPaymentFixes(workflow, issues, accumulator);
  }

  if (comprehensiveRequest || mentionsNotification(normalizedRequest) || mentionsPayment(normalizedRequest)) {
    addWebhookDedupeFixes(workflow, issues, accumulator);
  }

  if (comprehensiveRequest || mentionsAuditTrail(normalizedRequest)) {
    addAuditTrailFixes(workflow, issues, accumulator);
  }

  if (comprehensiveRequest || mentionsHttpTimeout(normalizedRequest)) {
    addHttpTimeoutFixes(workflow, issues, accumulator);
  }

  if (comprehensiveRequest || mentionsErrorHandling(normalizedRequest)) {
    addErrorBranchFixes(workflow, issues, accumulator);
  }

  if (comprehensiveRequest || mentionsBranchRouting(normalizedRequest)) {
    addBranchRouteFixes(workflow, issues, accumulator);
  }

  if (accumulator.operations.length === 0) {
    return {
      summary: "No deterministic fixes matched the request.",
      operations: [],
      risksAddressed: [],
      expectedImpact: [],
      risksIntroduced: [],
      requiresHumanReview: true
    };
  }

  return {
    summary: `Proposed ${accumulator.operations.length} deterministic fixes for ${
      comprehensiveRequest ? "all supported" : describeRequestScope(normalizedRequest)
    } risks.`,
    operations: accumulator.operations,
    risksAddressed: accumulator.risksAddressed,
    expectedImpact: accumulator.expectedImpact,
    risksIntroduced: [],
    requiresHumanReview: true
  };
}

function addPaymentFixes(workflow: WorkflowIR, issues: RiskIssue[], accumulator: ProposalAccumulator): void {
  for (const issue of issues.filter((candidate) => candidate.id.startsWith("payment_without_idempotency:"))) {
    if (!issue.nodeId || accumulator.risksAddressed.includes(issue.id)) {
      continue;
    }

    const node = findNode(workflow, issue.nodeId);
    accumulator.operations.push({
      type: "update_node_parameters",
      targetNodeId: issue.nodeId,
      parameters: {
        idempotencyKey: "={{$json.requestId}}"
      }
    });
    accumulator.risksAddressed.push(issue.id);
    accumulator.expectedImpact.push(`Adds an idempotency key to ${node?.name ?? issue.nodeId}.`);
  }
}

function addWebhookDedupeFixes(workflow: WorkflowIR, issues: RiskIssue[], accumulator: ProposalAccumulator): void {
  for (const issue of issues.filter((candidate) => candidate.id.startsWith("webhook_without_dedupe:"))) {
    if (!issue.nodeId || accumulator.risksAddressed.includes(issue.id)) {
      continue;
    }

    const node = findNode(workflow, issue.nodeId);
    accumulator.operations.push({
      type: "insert_node_after",
      targetNodeId: issue.nodeId,
      newNode: createDedupeNode(
        issue.nodeId,
        createUniqueNodeId(workflow, `${issue.nodeId}-dedupe-check`, accumulator.operations)
      )
    });
    accumulator.risksAddressed.push(issue.id);
    accumulator.expectedImpact.push(`Adds a duplicate request guard after ${node?.name ?? issue.nodeId}.`);
  }
}

function addAuditTrailFixes(workflow: WorkflowIR, issues: RiskIssue[], accumulator: ProposalAccumulator): void {
  for (const issue of issues.filter((candidate) => candidate.id.startsWith("side_effect_without_audit_trail:"))) {
    if (!issue.nodeId || accumulator.risksAddressed.includes(issue.id)) {
      continue;
    }

    const node = findNode(workflow, issue.nodeId);
    accumulator.operations.push({
      type: "insert_node_after",
      targetNodeId: issue.nodeId,
      newNode: createAuditTrailNode(
        node ?? issue.nodeId,
        createUniqueNodeId(workflow, `${issue.nodeId}-success-audit-log`, accumulator.operations)
      )
    });
    accumulator.risksAddressed.push(issue.id);
    accumulator.expectedImpact.push(`Adds a success audit log after ${node?.name ?? issue.nodeId}.`);
  }
}

function addHttpTimeoutFixes(workflow: WorkflowIR, issues: RiskIssue[], accumulator: ProposalAccumulator): void {
  for (const issue of issues.filter((candidate) => candidate.id.startsWith("http_without_timeout:"))) {
    if (!issue.nodeId || accumulator.risksAddressed.includes(issue.id)) {
      continue;
    }

    const node = findNode(workflow, issue.nodeId);
    accumulator.operations.push({
      type: "update_node_parameters",
      targetNodeId: issue.nodeId,
      parameters: {
        timeout: 30000
      }
    });
    accumulator.risksAddressed.push(issue.id);
    accumulator.expectedImpact.push(`Adds a 30000ms timeout to ${node?.name ?? issue.nodeId}.`);
  }
}

function addErrorBranchFixes(workflow: WorkflowIR, issues: RiskIssue[], accumulator: ProposalAccumulator): void {
  for (const issue of issues.filter((candidate) => candidate.id.startsWith("missing_error_branch:"))) {
    if (!issue.nodeId || accumulator.risksAddressed.includes(issue.id)) {
      continue;
    }

    const node = findNode(workflow, issue.nodeId);
    accumulator.operations.push({
      type: "insert_error_branch",
      targetNodeId: issue.nodeId,
      newNode: createErrorHandlerNode(
        node ?? issue.nodeId,
        createUniqueNodeId(workflow, `${issue.nodeId}-error-handler`, accumulator.operations)
      )
    });
    accumulator.risksAddressed.push(issue.id);
    accumulator.expectedImpact.push(`Adds an explicit error handler for ${node?.name ?? issue.nodeId}.`);
  }
}

function addBranchRouteFixes(workflow: WorkflowIR, issues: RiskIssue[], accumulator: ProposalAccumulator): void {
  for (const issue of issues.filter((candidate) => candidate.id.startsWith("control_branch_without_route:"))) {
    if (!issue.nodeId || accumulator.risksAddressed.includes(issue.id)) {
      continue;
    }

    const outputIndex = parseBranchOutputIndex(issue.id);
    if (outputIndex === undefined) {
      continue;
    }

    const node = findNode(workflow, issue.nodeId);
    accumulator.operations.push({
      type: "insert_branch_route",
      targetNodeId: issue.nodeId,
      sourceOutputIndex: outputIndex,
      newNode: createStopRouteNode(
        node ?? issue.nodeId,
        outputIndex,
        createUniqueNodeId(workflow, `${issue.nodeId}-output-${outputIndex}-stop`, accumulator.operations)
      )
    });
    accumulator.risksAddressed.push(issue.id);
    accumulator.expectedImpact.push(`Adds a stop route for ${node?.name ?? issue.nodeId} output ${outputIndex}.`);
  }
}

function createDedupeNode(targetNodeId: string, nodeId: string): NodeIR {
  return {
    id: nodeId,
    name: "Webhook Dedupe Check",
    type: "openworkflowdoctor.guard.dedupe",
    typeFamily: "unknown",
    parameters: [
      {
        key: "dedupeKey",
        valueType: "string",
        preview: "={{$json.requestId}}"
      }
    ]
  };
}

function createStopRouteNode(target: NodeIR | string, outputIndex: number, nodeId: string): NodeIR {
  const targetName = typeof target === "string" ? target : target.name;

  return {
    id: nodeId,
    name: `${targetName} Output ${outputIndex} Stop`,
    type: "openworkflowdoctor.flow.stop",
    typeFamily: "unknown",
    parameters: [
      {
        key: "reason",
        valueType: "string",
        preview: `No-op stop route for previously unconnected branch output ${outputIndex}.`
      }
    ]
  };
}

function createErrorHandlerNode(target: NodeIR | string, nodeId: string): NodeIR {
  const targetName = typeof target === "string" ? target : target.name;

  return {
    id: nodeId,
    name: `${targetName} Error Handler`,
    type: "openworkflowdoctor.error.handler",
    typeFamily: "unknown",
    parameters: [
      {
        key: "errorAction",
        valueType: "string",
        preview: "record_failure"
      },
      {
        key: "correlationId",
        valueType: "string",
        preview: "={{$json.requestId}}"
      }
    ]
  };
}

function createAuditTrailNode(target: NodeIR | string, nodeId: string): NodeIR {
  const targetName = typeof target === "string" ? target : target.name;

  return {
    id: nodeId,
    name: `${targetName} Success Audit Log`,
    type: "openworkflowdoctor.audit.log",
    typeFamily: "unknown",
    parameters: [
      {
        key: "auditEvent",
        valueType: "string",
        preview: createAuditEventName(targetName)
      },
      {
        key: "correlationId",
        valueType: "string",
        preview: "={{$json.requestId}}"
      }
    ]
  };
}

function findNode(workflow: WorkflowIR, nodeId: string): NodeIR | undefined {
  return workflow.nodes.find((node) => node.id === nodeId);
}

function createUniqueNodeId(
  workflow: WorkflowIR,
  preferredId: string,
  operations: PatchOperation[]
): string {
  const usedNodeIds = new Set(workflow.nodes.map((node) => node.id));

  for (const operation of operations) {
    if ("newNode" in operation) {
      usedNodeIds.add(operation.newNode.id);
    }
  }

  if (!usedNodeIds.has(preferredId)) {
    return preferredId;
  }

  let suffix = 1;
  while (usedNodeIds.has(`${preferredId}-${suffix}`)) {
    suffix += 1;
  }

  return `${preferredId}-${suffix}`;
}

function normalizeRequest(request: string): string {
  return request.toLowerCase().replace(/\s+/g, "");
}

function mentionsPayment(request: string): boolean {
  return ["支付", "退款", "stripe", "payment", "refund"].some((needle) => request.includes(needle));
}

function mentionsNotification(request: string): boolean {
  return ["通知", "邮件", "email", "gmail", "notification"].some((needle) => request.includes(needle));
}

function mentionsAuditTrail(request: string): boolean {
  return ["审计", "记录", "日志", "audit", "log", "record", "ledger"].some((needle) => request.includes(needle));
}

function mentionsHttpTimeout(request: string): boolean {
  return ["超时", "timeout", "httptimeout", "http超时"].some((needle) => request.includes(needle));
}

function mentionsErrorHandling(request: string): boolean {
  return ["错误分支", "错误处理", "失败处理", "errorbranch", "errorhandling", "fallback"].some((needle) =>
    request.includes(needle)
  );
}

function mentionsBranchRouting(request: string): boolean {
  return ["分支", "路由", "branch", "route", "fallback"].some((needle) => request.includes(needle));
}

function mentionsComprehensiveRepair(request: string): boolean {
  return ["全面", "全部", "所有", "完整", "comprehensive", "all", "full"].some((needle) =>
    request.includes(needle)
  );
}

function describeRequestScope(request: string): string {
  const scopes: string[] = [];
  if (mentionsPayment(request)) {
    scopes.push("payment");
  }
  if (mentionsNotification(request)) {
    scopes.push("notification");
  }
  if (mentionsAuditTrail(request)) {
    scopes.push("audit");
  }
  if (mentionsHttpTimeout(request)) {
    scopes.push("timeout");
  }
  if (mentionsErrorHandling(request)) {
    scopes.push("error handling");
  }
  if (mentionsBranchRouting(request)) {
    scopes.push("branch routing");
  }
  return scopes.join(" and ") || "matched";
}

function createAuditEventName(targetName: string): string {
  return `${targetName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "")}_success`;
}

function parseBranchOutputIndex(issueId: string): number | undefined {
  const outputIndex = Number(issueId.split(":").at(-1));
  return Number.isInteger(outputIndex) && outputIndex >= 0 ? outputIndex : undefined;
}
