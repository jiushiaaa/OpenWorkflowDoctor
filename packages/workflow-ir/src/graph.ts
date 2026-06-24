import type { NodeIR, WorkflowAdjacencyMap, WorkflowIR } from "./types.js";

export function buildAdjacencyMap(workflow: WorkflowIR): WorkflowAdjacencyMap {
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();

  for (const node of workflow.nodes) {
    incoming.set(node.id, []);
    outgoing.set(node.id, []);
  }

  for (const edge of workflow.edges) {
    outgoing.get(edge.sourceNodeId)?.push(edge.targetNodeId);
    incoming.get(edge.targetNodeId)?.push(edge.sourceNodeId);
  }

  return { incoming, outgoing };
}

export function getSourceNodes(workflow: WorkflowIR): NodeIR[] {
  const adjacency = buildAdjacencyMap(workflow);
  return workflow.nodes.filter((node) => (adjacency.incoming.get(node.id) ?? []).length === 0);
}

export function getSinkNodes(workflow: WorkflowIR): NodeIR[] {
  const adjacency = buildAdjacencyMap(workflow);
  return workflow.nodes.filter((node) => (adjacency.outgoing.get(node.id) ?? []).length === 0);
}

export function getIsolatedNodes(workflow: WorkflowIR): NodeIR[] {
  const adjacency = buildAdjacencyMap(workflow);
  return workflow.nodes.filter(
    (node) =>
      (adjacency.incoming.get(node.id) ?? []).length === 0 &&
      (adjacency.outgoing.get(node.id) ?? []).length === 0
  );
}

export function getDownstreamNodes(workflow: WorkflowIR, nodeId: string): NodeIR[] {
  const adjacency = buildAdjacencyMap(workflow);
  return walkNodeIds(workflow, nodeId, adjacency.outgoing);
}

export function getUpstreamNodes(workflow: WorkflowIR, nodeId: string): NodeIR[] {
  const adjacency = buildAdjacencyMap(workflow);
  return walkNodeIds(workflow, nodeId, adjacency.incoming);
}

function walkNodeIds(workflow: WorkflowIR, startNodeId: string, map: Map<string, string[]>): NodeIR[] {
  const nodesById = new Map(workflow.nodes.map((node) => [node.id, node]));
  const visited = new Set<string>([startNodeId]);
  const result: NodeIR[] = [];
  const queue = [...(map.get(startNodeId) ?? [])];

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

    queue.push(...(map.get(currentNodeId) ?? []));
  }

  return result;
}
