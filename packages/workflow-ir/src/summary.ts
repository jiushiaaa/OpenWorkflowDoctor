import { getSinkNodes, getSourceNodes } from "./graph.js";
import { diagnoseWorkflow } from "./risk-rules.js";
import type { NodeIR, RiskSeverity, VerificationStatus, WorkflowIR, WorkflowSummary } from "./types.js";

const SEVERITIES: RiskSeverity[] = ["low", "medium", "high", "critical"];

export function summarizeWorkflow(workflow: WorkflowIR): WorkflowSummary {
  const issues = diagnoseWorkflow(workflow);
  const riskCounts = countRisks(issues);
  const entryNodes = getSourceNodes(workflow).map((node) => node.name);
  const terminalNodes = getSinkNodes(workflow).map((node) => node.name);
  const sideEffectNodes = workflow.nodes.filter(isSideEffectNode).map((node) => node.name);

  return {
    workflowName: workflow.name,
    overview:
      workflow.nodes.length === 0
        ? `${workflow.name} has no parsed workflow nodes.`
        : buildOverview(workflow, entryNodes, terminalNodes, sideEffectNodes),
    entryNodes,
    terminalNodes,
    sideEffectNodes,
    riskCounts,
    recommendedStatus: recommendStatus(workflow, riskCounts)
  };
}

function buildOverview(
  workflow: WorkflowIR,
  entryNodes: string[],
  terminalNodes: string[],
  sideEffectNodes: string[]
): string {
  const entryText = entryNodes.length > 0 ? entryNodes.join(" or ") : "no detected entry node";
  const terminalText = terminalNodes.length > 0 ? terminalNodes.join(" or ") : "no detected terminal node";

  return `${workflow.name} starts from ${entryText} and can end at ${terminalText}. It has ${workflow.nodes.length} nodes, ${workflow.edges.length} edges, and ${sideEffectNodes.length} high-risk side effect node${sideEffectNodes.length === 1 ? "" : "s"}.`;
}

function countRisks(issues: ReturnType<typeof diagnoseWorkflow>): Record<RiskSeverity, number> {
  const counts: Record<RiskSeverity, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0
  };

  for (const issue of issues) {
    counts[issue.severity] += 1;
  }

  return counts;
}

function recommendStatus(workflow: WorkflowIR, riskCounts: Record<RiskSeverity, number>): VerificationStatus {
  if (workflow.nodes.length === 0) {
    return "fail";
  }
  if (riskCounts.critical > 0 || riskCounts.high > 0 || riskCounts.medium > 0) {
    return "hold";
  }
  return "pass";
}

function isSideEffectNode(node: NodeIR): boolean {
  if (isControlFlowNode(node)) {
    return false;
  }
  const haystack = `${node.name} ${node.type}`.toLowerCase();
  return ["stripe", "payment", "refund", "gmail", "email", "postgres", "mysql", "database", "crm", "update", "delete"].some(
    (needle) => haystack.includes(needle)
  );
}

function isControlFlowNode(node: NodeIR): boolean {
  const haystack = `${node.name} ${node.type}`.toLowerCase();
  return ["n8n-nodes-base.if", "n8n-nodes-base.switch", "manualtrigger"].some((needle) => haystack.includes(needle));
}

export const workflowSummarySeverities = SEVERITIES;
