import { buildAdjacencyMap } from "./graph.js";
import type { RiskIssue, RiskSeverity, WorkflowIR, WorkflowViewModel, WorkflowViewNode } from "./types.js";

const HORIZONTAL_SPACING = 260;
const VERTICAL_SPACING = 140;

const SEVERITY_RANK: Record<RiskSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

export function createWorkflowViewModel(workflow: WorkflowIR, issues: RiskIssue[]): WorkflowViewModel {
  const issuesByNodeId = groupIssuesByNodeId(issues);
  const positions = createNodePositions(workflow);

  return {
    nodes: workflow.nodes.map((node) => {
      const nodeIssues = issuesByNodeId.get(node.id) ?? [];
      const highestSeverity = getHighestSeverity(nodeIssues);
      const viewNode: WorkflowViewNode = {
        id: node.id,
        label: node.name,
        type: node.type,
        position: positions.get(node.id) ?? { x: 0, y: 0 },
        issueCount: nodeIssues.length
      };

      if (highestSeverity) {
        viewNode.highestSeverity = highestSeverity;
      }

      return viewNode;
    }),
    edges: workflow.edges.map((edge) => ({
      id: edge.id,
      source: edge.sourceNodeId,
      target: edge.targetNodeId,
      label: `${edge.sourceOutput}[${edge.sourceOutputIndex}]`
    }))
  };
}

function groupIssuesByNodeId(issues: RiskIssue[]): Map<string, RiskIssue[]> {
  const result = new Map<string, RiskIssue[]>();

  for (const issue of issues) {
    if (!issue.nodeId) {
      continue;
    }

    const nodeIssues = result.get(issue.nodeId) ?? [];
    nodeIssues.push(issue);
    result.set(issue.nodeId, nodeIssues);
  }

  return result;
}

function getHighestSeverity(issues: RiskIssue[]): RiskSeverity | undefined {
  return issues.reduce<RiskSeverity | undefined>((current, issue) => {
    if (!current || SEVERITY_RANK[issue.severity] > SEVERITY_RANK[current]) {
      return issue.severity;
    }
    return current;
  }, undefined);
}

function createNodePositions(workflow: WorkflowIR): Map<string, { x: number; y: number }> {
  const adjacency = buildAdjacencyMap(workflow);
  const depthByNodeId = new Map<string, number>();

  for (const node of workflow.nodes) {
    calculateDepth(node.id, adjacency.incoming, depthByNodeId);
  }

  const rowByDepth = new Map<number, number>();
  const positions = new Map<string, { x: number; y: number }>();

  for (const node of workflow.nodes) {
    const depth = depthByNodeId.get(node.id) ?? 0;
    const row = rowByDepth.get(depth) ?? 0;
    positions.set(node.id, {
      x: depth * HORIZONTAL_SPACING,
      y: row * VERTICAL_SPACING
    });
    rowByDepth.set(depth, row + 1);
  }

  return positions;
}

function calculateDepth(nodeId: string, incoming: Map<string, string[]>, depthByNodeId: Map<string, number>): number {
  const cachedDepth = depthByNodeId.get(nodeId);
  if (cachedDepth !== undefined) {
    return cachedDepth;
  }

  const parents = incoming.get(nodeId) ?? [];
  if (parents.length === 0) {
    depthByNodeId.set(nodeId, 0);
    return 0;
  }

  const depth = Math.max(...parents.map((parentId) => calculateDepth(parentId, incoming, depthByNodeId))) + 1;
  depthByNodeId.set(nodeId, depth);
  return depth;
}
