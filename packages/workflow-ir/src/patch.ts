import { createParameterSummary, sanitizeNode } from "./redaction.js";
import { patchOperationSchema } from "./structured-output.js";
import type { EdgeIR, NodeIR, NodeParameterSummary, PatchOperation, WorkflowIR } from "./types.js";

export function applyPatchOperations(workflow: WorkflowIR, operations: PatchOperation[]): WorkflowIR {
  const validOperations = operations.map(validatePatchOperation);
  return validOperations.reduce((currentWorkflow, operation) => applyPatchOperation(currentWorkflow, operation), cloneWorkflow(workflow));
}

function applyPatchOperation(workflow: WorkflowIR, operation: PatchOperation): WorkflowIR {
  assertTargetExists(workflow, operation.targetNodeId);

  switch (operation.type) {
    case "insert_node_before":
      return insertNodeBefore(workflow, operation.targetNodeId, operation.newNode);
    case "insert_node_after":
      return insertNodeAfter(workflow, operation.targetNodeId, operation.newNode);
    case "insert_error_branch":
      return insertErrorBranch(workflow, operation.targetNodeId, operation.newNode);
    case "insert_branch_route":
      return insertBranchRoute(workflow, operation.targetNodeId, operation.sourceOutputIndex, operation.newNode);
    case "update_node_parameters":
      return updateNodeParameters(workflow, operation.targetNodeId, operation.parameters);
  }
}

function insertNodeBefore(workflow: WorkflowIR, targetNodeId: string, newNode: NodeIR): WorkflowIR {
  assertNewNodeDoesNotExist(workflow, newNode.id);

  const incomingEdges = workflow.edges.filter((edge) => edge.targetNodeId === targetNodeId);
  const remainingEdges = workflow.edges.filter((edge) => edge.targetNodeId !== targetNodeId);
  const rewiredIncomingEdges = incomingEdges.map((edge) => ({
    ...edge,
    id: createEdgeId(edge.sourceNodeId, edge.sourceOutput, edge.sourceOutputIndex, newNode.id),
    targetNodeId: newNode.id
  }));

  return {
    ...workflow,
    nodes: [...workflow.nodes, cloneNode(newNode)],
    edges: [
      ...remainingEdges,
      ...rewiredIncomingEdges,
      {
        id: createEdgeId(newNode.id, "main", 0, targetNodeId),
        sourceNodeId: newNode.id,
        targetNodeId,
        sourceOutput: "main",
        sourceOutputIndex: 0
      }
    ]
  };
}

function insertNodeAfter(workflow: WorkflowIR, targetNodeId: string, newNode: NodeIR): WorkflowIR {
  assertNewNodeDoesNotExist(workflow, newNode.id);

  const successOutgoingEdges = workflow.edges.filter(
    (edge) => edge.sourceNodeId === targetNodeId && edge.sourceOutput !== "error"
  );
  const remainingEdges = workflow.edges.filter(
    (edge) => edge.sourceNodeId !== targetNodeId || edge.sourceOutput === "error"
  );
  const rewiredOutgoingEdges = successOutgoingEdges.map((edge) => ({
    ...edge,
    id: createEdgeId(newNode.id, edge.sourceOutput, edge.sourceOutputIndex, edge.targetNodeId),
    sourceNodeId: newNode.id
  }));

  return {
    ...workflow,
    nodes: [...workflow.nodes, cloneNode(newNode)],
    edges: [
      ...remainingEdges,
      {
        id: createEdgeId(targetNodeId, "main", 0, newNode.id),
        sourceNodeId: targetNodeId,
        targetNodeId: newNode.id,
        sourceOutput: "main",
        sourceOutputIndex: 0
      },
      ...rewiredOutgoingEdges
    ]
  };
}

function insertErrorBranch(workflow: WorkflowIR, targetNodeId: string, newNode: NodeIR): WorkflowIR {
  assertNewNodeDoesNotExist(workflow, newNode.id);

  const existingErrorIndexes = workflow.edges
    .filter((edge) => edge.sourceNodeId === targetNodeId && edge.sourceOutput === "error")
    .map((edge) => edge.sourceOutputIndex);
  const sourceOutputIndex =
    existingErrorIndexes.length === 0 ? 0 : Math.max(...existingErrorIndexes) + 1;

  return {
    ...workflow,
    nodes: [...workflow.nodes, cloneNode(newNode)],
    edges: [
      ...workflow.edges.map(cloneEdge),
      {
        id: createEdgeId(targetNodeId, "error", sourceOutputIndex, newNode.id),
        sourceNodeId: targetNodeId,
        targetNodeId: newNode.id,
        sourceOutput: "error",
        sourceOutputIndex
      }
    ]
  };
}

function insertBranchRoute(
  workflow: WorkflowIR,
  targetNodeId: string,
  sourceOutputIndex: number,
  newNode: NodeIR
): WorkflowIR {
  assertNewNodeDoesNotExist(workflow, newNode.id);
  if (
    workflow.edges.some(
      (edge) =>
        edge.sourceNodeId === targetNodeId &&
        edge.sourceOutput === "main" &&
        edge.sourceOutputIndex === sourceOutputIndex
    )
  ) {
    throw new Error(`Patch branch route already exists: ${targetNodeId} main[${sourceOutputIndex}]`);
  }

  return {
    ...workflow,
    nodes: [...workflow.nodes, cloneNode(newNode)],
    edges: [
      ...workflow.edges.map(cloneEdge),
      {
        id: createEdgeId(targetNodeId, "main", sourceOutputIndex, newNode.id),
        sourceNodeId: targetNodeId,
        targetNodeId: newNode.id,
        sourceOutput: "main",
        sourceOutputIndex
      }
    ]
  };
}

function updateNodeParameters(
  workflow: WorkflowIR,
  targetNodeId: string,
  parameters: Record<string, unknown>
): WorkflowIR {
  return {
    ...workflow,
    nodes: workflow.nodes.map((node) =>
      node.id === targetNodeId
        ? {
            ...node,
            parameters: mergeParameterSummaries(node.parameters, parameters)
          }
        : cloneNode(node)
    ),
    edges: workflow.edges.map(cloneEdge)
  };
}

function mergeParameterSummaries(
  existingParameters: NodeParameterSummary[],
  newParameters: Record<string, unknown>
): NodeParameterSummary[] {
  const summaries = new Map(existingParameters.map((parameter) => [parameter.key, { ...parameter }]));

  for (const [key, value] of Object.entries(newParameters)) {
    summaries.set(key, createParameterSummary(key, value));
  }

  return [...summaries.values()];
}

function validatePatchOperation(operation: PatchOperation): PatchOperation {
  const result = patchOperationSchema.safeParse(operation);
  if (!result.success) {
    throw new Error("Invalid PatchOperation.");
  }
  return result.data as PatchOperation;
}

function assertTargetExists(workflow: WorkflowIR, targetNodeId: string): void {
  if (!workflow.nodes.some((node) => node.id === targetNodeId)) {
    throw new Error(`Patch target node not found: ${targetNodeId}`);
  }
}

function assertNewNodeDoesNotExist(workflow: WorkflowIR, nodeId: string): void {
  if (workflow.nodes.some((node) => node.id === nodeId)) {
    throw new Error(`Patch node already exists: ${nodeId}`);
  }
}

function cloneWorkflow(workflow: WorkflowIR): WorkflowIR {
  return {
    ...workflow,
    nodes: workflow.nodes.map(cloneNode),
    edges: workflow.edges.map(cloneEdge)
  };
}

function cloneNode(node: NodeIR): NodeIR {
  return sanitizeNode(node);
}

function cloneEdge(edge: EdgeIR): EdgeIR {
  return { ...edge };
}

function createEdgeId(sourceNodeId: string, sourceOutput: string, sourceOutputIndex: number, targetNodeId: string): string {
  return `${sourceNodeId}:${sourceOutput}:${sourceOutputIndex}:${targetNodeId}`;
}
