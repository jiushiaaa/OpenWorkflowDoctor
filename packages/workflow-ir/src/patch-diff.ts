import { formatRedactedValue, sanitizeNode } from "./redaction.js";
import type { NodeIR, PatchDiffLine, PatchOperation, WorkflowIR } from "./types.js";

export function formatPatchDiff(workflow: WorkflowIR, operations: PatchOperation[]): PatchDiffLine[] {
  return operations.map((operation, index) => formatPatchOperation(workflow, operation, index));
}

function formatPatchOperation(
  workflow: WorkflowIR,
  operation: PatchOperation,
  index: number
): PatchDiffLine {
  const targetNodeName = getNodeName(workflow, operation.targetNodeId);

  switch (operation.type) {
    case "insert_node_before":
      return {
        id: createDiffId(index, operation),
        marker: "+",
        operationType: operation.type,
        targetNodeId: operation.targetNodeId,
        targetNodeName,
        title: `Add ${operation.newNode.name} before ${targetNodeName}`,
        details: createNodeInsertionDetails(operation.newNode, "incoming")
      };
    case "insert_node_after":
      return {
        id: createDiffId(index, operation),
        marker: "+",
        operationType: operation.type,
        targetNodeId: operation.targetNodeId,
        targetNodeName,
        title: `Add ${operation.newNode.name} after ${targetNodeName}`,
        details: createNodeInsertionDetails(operation.newNode, "outgoing")
      };
    case "insert_error_branch":
      return {
        id: createDiffId(index, operation),
        marker: "+",
        operationType: operation.type,
        targetNodeId: operation.targetNodeId,
        targetNodeName,
        title: `Add ${operation.newNode.name} as error branch for ${targetNodeName}`,
        details: createErrorBranchInsertionDetails(targetNodeName, operation.newNode)
      };
    case "insert_branch_route":
      return {
        id: createDiffId(index, operation),
        marker: "+",
        operationType: operation.type,
        targetNodeId: operation.targetNodeId,
        targetNodeName,
        title: `Add ${operation.newNode.name} to ${targetNodeName} output ${operation.sourceOutputIndex}`,
        details: createBranchRouteInsertionDetails(targetNodeName, operation.sourceOutputIndex, operation.newNode)
      };
    case "update_node_parameters":
      return {
        id: createDiffId(index, operation),
        marker: "~",
        operationType: operation.type,
        targetNodeId: operation.targetNodeId,
        targetNodeName,
        title: `Update parameters on ${targetNodeName}`,
        details: Object.entries(operation.parameters).map(
          ([key, value]) => `Set ${key} to ${formatRedactedValue(key, value)}`
        )
      };
  }
}

function createBranchRouteInsertionDetails(
  targetNodeName: string,
  sourceOutputIndex: number,
  node: NodeIR
): string[] {
  const safeNode = sanitizeNode(node);
  const details = [`Create node ${safeNode.id} with type ${safeNode.type}`];

  for (const parameter of safeNode.parameters) {
    details.push(`Set ${parameter.key} to ${parameter.preview}`);
  }

  details.push(`Route ${targetNodeName} main[${sourceOutputIndex}] output to ${safeNode.name}`);
  return details;
}

function createErrorBranchInsertionDetails(targetNodeName: string, node: NodeIR): string[] {
  const safeNode = sanitizeNode(node);
  const details = [`Create node ${safeNode.id} with type ${safeNode.type}`];

  for (const parameter of safeNode.parameters) {
    details.push(`Set ${parameter.key} to ${parameter.preview}`);
  }

  details.push(`Route ${targetNodeName} error output to ${safeNode.name}`);
  return details;
}

function createNodeInsertionDetails(
  node: NodeIR,
  rewiredDirection: "incoming" | "outgoing"
): string[] {
  const safeNode = sanitizeNode(node);
  const details = [`Create node ${safeNode.id} with type ${safeNode.type}`];

  for (const parameter of safeNode.parameters) {
    details.push(`Set ${parameter.key} to ${parameter.preview}`);
  }

  details.push(
    rewiredDirection === "incoming"
      ? `Route existing incoming edges through ${safeNode.name}`
      : `Route existing outgoing edges through ${safeNode.name}`
  );

  return details;
}

function createDiffId(index: number, operation: PatchOperation): string {
  return `patch-${index}-${operation.type}-${operation.targetNodeId}`;
}

function getNodeName(workflow: WorkflowIR, nodeId: string): string {
  return workflow.nodes.find((node) => node.id === nodeId)?.name ?? nodeId;
}
