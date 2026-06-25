import { buildAdjacencyMap, getIsolatedNodes } from "./graph.js";
import type { NodeIR, RiskIssue, RiskSeverity, WorkflowIR } from "./types.js";

type RiskFactoryInput = {
  node: NodeIR;
  severity: RiskSeverity;
  title: string;
  explanation: string;
  suggestedFix: string;
  evidence: string[];
};

export function diagnoseWorkflow(workflow: WorkflowIR): RiskIssue[] {
  const issues: RiskIssue[] = [];
  const adjacency = buildAdjacencyMap(workflow);

  if (workflow.source?.sourceKind === "dify-dsl") {
    issues.push(...diagnoseDifyWorkflow(workflow));
  }

  for (const node of getIsolatedNodes(workflow)) {
    issues.push(
      createNodeIssue("isolated_node", {
        node,
        severity: "medium",
        title: "Node is isolated",
        explanation: "This node has no incoming or outgoing edges, so it will not run in this workflow path.",
        suggestedFix: "Remove the node or connect it to the intended workflow path.",
        evidence: ["No incoming edges", "No outgoing edges"]
      })
    );
  }

  for (const node of workflow.nodes) {
    for (const outputIndex of getMissingControlOutputIndexes(workflow, node)) {
      issues.push({
        id: `control_branch_without_route:${node.id}:${outputIndex}`,
        severity: "medium",
        nodeId: node.id,
        title: "Control branch has no route",
        explanation: "One branch output from this control-flow node has no downstream route.",
        suggestedFix: "Connect every meaningful branch to a clear success, fallback, or stop path.",
        evidence: [`Missing output index: ${outputIndex}`]
      });
    }

    if (
      isWebhookNode(node) &&
      !hasParameterLike(node, ["dedupe", "duplicate", "requestid", "idempotency"]) &&
      !hasDirectDedupeGuard(workflow, node.id)
    ) {
      issues.push(
        createNodeIssue("webhook_without_dedupe", {
          node,
          severity: "high",
          title: "Webhook has no dedupe guard",
          explanation: "Webhook retries or duplicate requests could replay the same business action.",
          suggestedFix: "Capture a request id or idempotency key and reject duplicate requests before side effects.",
          evidence: [`Node type: ${node.type}`]
        })
      );
    }

    if (isHttpNode(node) && !hasParameterLike(node, ["timeout"])) {
      issues.push(
        createNodeIssue("http_without_timeout", {
          node,
          severity: "medium",
          title: "HTTP request has no timeout",
          explanation: "A request without a timeout can hang the workflow and delay downstream actions.",
          suggestedFix: "Set an explicit timeout and add a fallback path for failed requests.",
          evidence: [`Parameters: ${parameterKeys(node).join(", ") || "none"}`]
        })
      );
    }

    if (isHighRiskSideEffectNode(node)) {
      issues.push(
        createNodeIssue("high_risk_side_effect_node", {
          node,
          severity: "high",
          title: "High-risk side effect node",
          explanation: "This node appears to mutate external state or send an external notification.",
          suggestedFix: "Add explicit review, retry, idempotency, and error handling around this node.",
          evidence: [`Node name: ${node.name}`, `Node type: ${node.type}`]
        })
      );

      if (!hasErrorBranch(workflow, node.id)) {
        issues.push(
          createNodeIssue("missing_error_branch", {
            node,
            severity: "high",
            title: "High-risk node has no error branch",
            explanation: "Failures from this side effect node are not routed to an explicit fallback path.",
            suggestedFix: "Add an error branch that records the failure and prevents silent partial completion.",
            evidence: [`Outgoing nodes: ${(adjacency.outgoing.get(node.id) ?? []).join(", ") || "none"}`]
          })
        );
      }

      if (!isRecordKeepingNode(node) && !hasSuccessAuditTrail(workflow, node.id)) {
        issues.push(
          createNodeIssue("side_effect_without_audit_trail", {
            node,
            severity: "medium",
            title: "Side effect has no success audit trail",
            explanation: "Successful external side effects are not followed by an explicit audit or record step.",
            suggestedFix: "Add a downstream audit log, send log, or durable status update after the side effect succeeds.",
            evidence: [`Success-route downstream nodes: ${successDownstreamNodeNames(workflow, node.id).join(", ") || "none"}`]
          })
        );
      }
    }

    if (isPaymentNode(node) && !hasParameterLike(node, ["idempotency", "idempotencykey"])) {
      issues.push(
        createNodeIssue("payment_without_idempotency", {
          node,
          severity: "critical",
          title: "Payment action has no idempotency guard",
          explanation: "A duplicate execution could repeat a payment, refund, or other financial side effect.",
          suggestedFix: "Generate and pass an idempotency key before this payment action.",
          evidence: [`Parameters: ${parameterKeys(node).join(", ") || "none"}`]
        })
      );
    }

    if (isEmailNode(node) && !hasParameterLike(node, ["sendlog", "sentlog", "deliverylog", "messageid"])) {
      issues.push(
        createNodeIssue("email_without_send_log", {
          node,
          severity: "high",
          title: "Email action has no send log guard",
          explanation: "A retry could send duplicate notifications without a record of prior sends.",
          suggestedFix: "Check a send log before sending and record the provider message id after success.",
          evidence: [`Parameters: ${parameterKeys(node).join(", ") || "none"}`]
        })
      );
    }

    if (isDatabaseUpdateNode(node) && !hasErrorBranch(workflow, node.id)) {
      issues.push(
        createNodeIssue("database_update_without_fallback", {
          node,
          severity: "high",
          title: "Database update has no fallback",
          explanation: "A failed database update can leave downstream systems with inconsistent state.",
          suggestedFix: "Add an error branch that records the failed update and stops dependent side effects.",
          evidence: [`Node name: ${node.name}`, `Node type: ${node.type}`]
        })
      );
    }
  }

  return issues;
}

function diagnoseDifyWorkflow(workflow: WorkflowIR): RiskIssue[] {
  const issues: RiskIssue[] = [];
  const sourceDiagnostics = workflow.source?.diagnostics ?? [];

  for (const diagnostic of sourceDiagnostics) {
    issues.push({
      id: createDifyDiagnosticIssueId(diagnostic.code, diagnostic.nodeId, diagnostic.evidence),
      severity: diagnostic.severity,
      ...(diagnostic.nodeId ? { nodeId: diagnostic.nodeId } : {}),
      title: createDifyDiagnosticTitle(diagnostic.code),
      explanation: diagnostic.message,
      suggestedFix: createDifyDiagnosticFix(diagnostic.code),
      evidence: diagnostic.evidence
    });
  }

  if (!workflow.nodes.some((node) => node.type === "dify.start")) {
    issues.push(createWorkflowIssue("dify_missing_start_node", "high", "Missing Dify start node", "This Dify workflow has no start node in WorkflowIR.", "Add or restore a Dify start node before relying on this flow.", ["No dify.start node found"]));
  }

  if (!workflow.nodes.some((node) => node.type === "dify.end" || node.type === "dify.answer")) {
    issues.push(createWorkflowIssue("dify_missing_terminal_node", "high", "Missing Dify terminal node", "This Dify workflow has no end or answer node in WorkflowIR.", "Add a clear terminal end or answer path.", ["No dify.end or dify.answer node found"]));
  }

  for (const node of workflow.nodes) {
    if (isDifySideEffectNode(node)) {
      issues.push(
        createNodeIssue("dify_side_effect_node", {
          node,
          severity: "high",
          title: "Dify node may perform external side effects",
          explanation: "This Dify tool, HTTP, or plugin-style node may call external systems if executed in Dify.",
          suggestedFix: "Review this node manually and add idempotency, timeout, and fallback behavior in the source workflow.",
          evidence: [`Node type: ${node.type}`]
        })
      );
    }

    if (hasParameterKeyOrPreviewLike(node, ["uploadfileid", "uploadedid", "fileid", "localfile"])) {
      issues.push(
        createNodeIssue("dify_file_upload_id_reference", {
          node,
          severity: "medium",
          title: "Dify file default references workspace upload id",
          explanation: "A file or file-list default appears to reference a Dify workspace-private uploaded file id.",
          suggestedFix: "Clear file defaults and ask the destination workspace user to upload fresh files.",
          evidence: node.parameters.map((parameter) => `${parameter.key}: ${parameter.preview}`)
        })
      );
    }

    if (node.type === "dify.code") {
      issues.push(
        createNodeIssue("dify_code_node_present", {
          node,
          severity: "medium",
          title: "Dify code node requires review",
          explanation: "Code nodes can hide complex behavior that static graph checks cannot fully verify.",
          suggestedFix: "Review code logic manually before accepting workflow changes.",
          evidence: [`Node name: ${node.name}`]
        })
      );

      if (
        hasParameterKeyOrPreviewLike(node, ["fetch", "http", "request", "filesystem", "fs", "eval", "secret", "token"]) ||
        node.parameters.some((parameter) => parameter.redacted)
      ) {
        issues.push(
          createNodeIssue("dify_code_node_unsafe_reference", {
            node,
            severity: "high",
            title: "Dify code node references unsafe capability",
            explanation: "The code node appears to reference network, filesystem, eval, token, or secret-related behavior.",
            suggestedFix: "Manually inspect the source code and isolate side effects behind explicit review paths.",
            evidence: node.parameters.map((parameter) => `${parameter.key}: ${parameter.preview}`)
          })
        );
      }
    }

    if (node.type === "dify.retrieval" && hasParameterLike(node, ["dataset", "knowledge", "resource"])) {
      issues.push(
        createNodeIssue("dify_retrieval_external_resource", {
          node,
          severity: "medium",
          title: "Dify retrieval references external resources",
          explanation: "Knowledge retrieval may depend on Dify workspace datasets that OpenWorkflowDoctor does not fetch or verify.",
          suggestedFix: "Confirm referenced datasets exist and are safe in the destination Dify workspace.",
          evidence: node.parameters.map((parameter) => `${parameter.key}: ${parameter.preview}`)
        })
      );
    }

    if (isDifyConditionNode(node) && !hasDifyFallbackRoute(workflow, node.id)) {
      issues.push(
        createNodeIssue("dify_condition_without_fallback", {
          node,
          severity: "medium",
          title: "Dify condition has no fallback route",
          explanation: "This condition node does not expose an obvious default, false, or fallback route.",
          suggestedFix: "Add a fallback/default branch or confirm all cases are intentionally terminal.",
          evidence: workflow.edges
            .filter((edge) => edge.sourceNodeId === node.id)
            .map((edge) => `${edge.sourceOutput}[${edge.sourceOutputIndex}] -> ${edge.targetNodeId}`)
        })
      );
    }
  }

  return issues;
}

function createNodeIssue(ruleId: string, input: RiskFactoryInput): RiskIssue {
  return {
    id: `${ruleId}:${input.node.id}`,
    severity: input.severity,
    nodeId: input.node.id,
    title: input.title,
    explanation: input.explanation,
    suggestedFix: input.suggestedFix,
    evidence: input.evidence
  };
}

function createWorkflowIssue(
  id: string,
  severity: RiskSeverity,
  title: string,
  explanation: string,
  suggestedFix: string,
  evidence: string[]
): RiskIssue {
  return {
    id,
    severity,
    title,
    explanation,
    suggestedFix,
    evidence
  };
}

function createDifyDiagnosticIssueId(code: string, nodeId: string | undefined, evidence: string[]): string {
  if (code === "dify_edge_unknown_target") {
    const source = evidence.find((item) => item.startsWith("Source: "))?.replace("Source: ", "") || "unknown";
    const target = evidence.find((item) => item.startsWith("Target: "))?.replace("Target: ", "") || "unknown";
    return `${code}:${source}:${target}`;
  }
  return nodeId ? `${code}:${nodeId}` : code;
}

function createDifyDiagnosticTitle(code: string): string {
  switch (code) {
    case "dify_missing_node_id":
      return "Dify node is missing id";
    case "dify_missing_node_data":
      return "Dify node is missing data";
    case "dify_duplicate_node_id":
      return "Dify node id is duplicated";
    case "dify_unknown_node_type":
      return "Dify node type is unknown";
    case "dify_edge_unknown_source":
    case "dify_edge_unknown_target":
      return "Dify edge references an unknown node";
    case "dify_secret_env_materialized":
      return "Dify secret environment variable is materialized";
    case "dify_unsupported_dsl_version":
      return "Unsupported Dify DSL version";
    case "dify_unsupported_app_mode":
      return "Unsupported Dify app mode";
    default:
      return "Dify import warning";
  }
}

function createDifyDiagnosticFix(code: string): string {
  switch (code) {
    case "dify_secret_env_materialized":
      return "Clear the secret value in the source DSL and configure it inside the target Dify workspace.";
    case "dify_edge_unknown_source":
    case "dify_edge_unknown_target":
      return "Reconnect or remove the broken edge in the Dify workflow.";
    case "dify_unsupported_dsl_version":
      return "Review the DSL version manually before relying on automated diagnostics.";
    case "dify_unsupported_app_mode":
      return "Import only workflow, chatflow, or advanced-chat Dify apps for v0.6.";
    default:
      return "Review the source Dify DSL and re-export a valid workflow.";
  }
}

function hasErrorBranch(workflow: WorkflowIR, nodeId: string): boolean {
  return workflow.edges.some((edge) => edge.sourceNodeId === nodeId && edge.sourceOutput === "error");
}

function hasDirectDedupeGuard(workflow: WorkflowIR, nodeId: string): boolean {
  const downstreamNodeIds = workflow.edges
    .filter((edge) => edge.sourceNodeId === nodeId && edge.sourceOutput !== "error")
    .map((edge) => edge.targetNodeId);
  const downstreamNodes = workflow.nodes.filter((node) => downstreamNodeIds.includes(node.id));

  return downstreamNodes.some(
    (node) => includesAnyNodeIdentity(node, ["dedupe", "duplicate", "idempotency"]) || hasParameterLike(node, ["dedupe", "duplicate", "requestid", "idempotency"])
  );
}

function getMissingControlOutputIndexes(workflow: WorkflowIR, node: NodeIR): number[] {
  const expectedOutputCount = expectedControlOutputCount(node);
  if (expectedOutputCount === 0) {
    return [];
  }

  const connectedIndexes = new Set(
    workflow.edges
      .filter((edge) => edge.sourceNodeId === node.id && edge.sourceOutput === "main")
      .map((edge) => edge.sourceOutputIndex)
  );
  const missingIndexes: number[] = [];

  for (let outputIndex = 0; outputIndex < expectedOutputCount; outputIndex += 1) {
    if (!connectedIndexes.has(outputIndex)) {
      missingIndexes.push(outputIndex);
    }
  }

  return missingIndexes;
}

function expectedControlOutputCount(node: NodeIR): number {
  if (includesAnyNodeIdentity(node, ["n8n-nodes-base.if"])) {
    return 2;
  }
  if (includesAnyNodeIdentity(node, ["n8n-nodes-base.switch"])) {
    return Math.max(2, getNumericParameter(node, ["rules", "outputs", "numberOfOutputs"]) ?? 0);
  }
  return 0;
}

function hasSuccessAuditTrail(workflow: WorkflowIR, nodeId: string): boolean {
  return successDownstreamNodes(workflow, nodeId).some(isAuditTrailNode);
}

function successDownstreamNodeNames(workflow: WorkflowIR, nodeId: string): string[] {
  return successDownstreamNodes(workflow, nodeId).map((node) => node.name);
}

function successDownstreamNodes(workflow: WorkflowIR, nodeId: string): NodeIR[] {
  const nodesById = new Map(workflow.nodes.map((node) => [node.id, node]));
  const visited = new Set<string>([nodeId]);
  const queue = workflow.edges
    .filter((edge) => edge.sourceNodeId === nodeId && edge.sourceOutput !== "error")
    .map((edge) => edge.targetNodeId);
  const result: NodeIR[] = [];

  while (queue.length > 0) {
    const currentNodeId = queue.shift();
    if (!currentNodeId || visited.has(currentNodeId)) {
      continue;
    }

    visited.add(currentNodeId);
    const currentNode = nodesById.get(currentNodeId);
    if (currentNode) {
      result.push(currentNode);
    }

    queue.push(
      ...workflow.edges
        .filter((edge) => edge.sourceNodeId === currentNodeId && edge.sourceOutput !== "error")
        .map((edge) => edge.targetNodeId)
    );
  }

  return result;
}

function isWebhookNode(node: NodeIR): boolean {
  return includesAnyNodeIdentity(node, ["webhook"]);
}

function isHttpNode(node: NodeIR): boolean {
  return includesAnyNodeIdentity(node, ["httprequest", "http request"]);
}

function isPaymentNode(node: NodeIR): boolean {
  if (isControlFlowNode(node) || isRecordKeepingNode(node)) {
    return false;
  }
  return includesAnyNodeIdentity(node, ["stripe", "payment", "refund", "charge"]);
}

function isEmailNode(node: NodeIR): boolean {
  if (isRecordKeepingNode(node)) {
    return false;
  }
  return includesAnyNodeIdentity(node, ["gmail", "email", "send email"]);
}

function isDatabaseUpdateNode(node: NodeIR): boolean {
  if (isRecordKeepingNode(node)) {
    return false;
  }
  return includesAnyNodeIdentity(node, ["postgres", "mysql", "database", "crm", "update"]);
}

function isHighRiskSideEffectNode(node: NodeIR): boolean {
  return isPaymentNode(node) || isEmailNode(node) || isDatabaseUpdateNode(node) || includesAnyNodeIdentity(node, ["delete"]);
}

function isControlFlowNode(node: NodeIR): boolean {
  return includesAnyNodeIdentity(node, ["n8n-nodes-base.if", "n8n-nodes-base.switch", "manualtrigger", "dify.condition"]);
}

function isAuditTrailNode(node: NodeIR): boolean {
  return includesAnyNodeIdentity(node, ["audit", "log", "record", "status", "ledger"]);
}

function isRecordKeepingNode(node: NodeIR): boolean {
  return includesAnyNodeIdentity(node, [
    "audit",
    "log",
    "record",
    "failure",
    "status",
    "ledger",
    "error handler",
    "openworkflowdoctor.error.handler",
    " output ",
    " stop",
    "openworkflowdoctor.flow.stop"
  ]);
}

function isDifySideEffectNode(node: NodeIR): boolean {
  return (
    node.type === "dify.tool" ||
    node.type === "dify.http-request" ||
    includesAnyNodeIdentity(node, ["plugin", "http", "tool"])
  );
}

function isDifyConditionNode(node: NodeIR): boolean {
  return node.type.startsWith("dify.condition.");
}

function hasDifyFallbackRoute(workflow: WorkflowIR, nodeId: string): boolean {
  const outputs = workflow.edges
    .filter((edge) => edge.sourceNodeId === nodeId)
    .map((edge) => edge.sourceOutput.toLowerCase());
  return outputs.some((output) => ["default", "fallback", "false", "else"].includes(output));
}

function includesAnyNodeIdentity(node: NodeIR, needles: string[]): boolean {
  const haystack = `${node.name} ${node.type}`.toLowerCase();

  return needles.some((needle) => haystack.includes(needle.toLowerCase()));
}

function hasParameterLike(node: NodeIR, needles: string[]): boolean {
  const normalizedKeys = parameterKeys(node).map(normalize);
  return needles.some((needle) => normalizedKeys.some((key) => key.includes(normalize(needle))));
}

function hasParameterKeyOrPreviewLike(node: NodeIR, needles: string[]): boolean {
  const haystack = node.parameters
    .flatMap((parameter) => [parameter.key, parameter.preview])
    .map(normalize);
  return needles.some((needle) => haystack.some((value) => value.includes(normalize(needle))));
}

function parameterKeys(node: NodeIR): string[] {
  return node.parameters.map((parameter) => parameter.key);
}

function getNumericParameter(node: NodeIR, keys: string[]): number | undefined {
  const match = node.parameters.find((parameter) => keys.some((key) => normalize(parameter.key) === normalize(key)));
  if (!match || match.valueType !== "number") {
    return undefined;
  }

  const parsed = Number(match.preview);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}
