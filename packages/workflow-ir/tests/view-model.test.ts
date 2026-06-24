import { describe, expect, test } from "vitest";
import branchWorkflow from "./fixtures/refund-branch-workflow.json";
import { createWorkflowViewModel, diagnoseWorkflow, parseN8nWorkflow } from "../src/index";

describe("createWorkflowViewModel", () => {
  test("creates UI-ready graph nodes with deterministic layout and risk metadata", () => {
    const workflow = parseN8nWorkflow(branchWorkflow);
    const issues = diagnoseWorkflow(workflow);
    const viewModel = createWorkflowViewModel(workflow, issues);

    expect(viewModel.nodes).toEqual([
      {
        id: "webhook",
        label: "Webhook Trigger",
        type: "n8n-nodes-base.webhook",
        position: { x: 0, y: 0 },
        issueCount: 1,
        highestSeverity: "high"
      },
      {
        id: "lookup",
        label: "Lookup Order",
        type: "n8n-nodes-base.httpRequest",
        position: { x: 260, y: 0 },
        issueCount: 1,
        highestSeverity: "medium"
      },
      {
        id: "branch",
        label: "IF refund amount > 500",
        type: "n8n-nodes-base.if",
        position: { x: 520, y: 0 },
        issueCount: 0
      },
      {
        id: "approval",
        label: "Manual Approval",
        type: "n8n-nodes-base.manualTrigger",
        position: { x: 780, y: 0 },
        issueCount: 0
      },
      {
        id: "refund",
        label: "Stripe Refund",
        type: "n8n-nodes-base.stripe",
        position: { x: 780, y: 140 },
        issueCount: 4,
        highestSeverity: "critical"
      }
    ]);
    expect(viewModel.edges).toEqual([
      { id: "webhook:main:0:lookup", source: "webhook", target: "lookup", label: "main[0]" },
      { id: "lookup:main:0:branch", source: "lookup", target: "branch", label: "main[0]" },
      { id: "branch:main:0:approval", source: "branch", target: "approval", label: "main[0]" },
      { id: "branch:main:1:refund", source: "branch", target: "refund", label: "main[1]" }
    ]);
  });

  test("creates an empty view model for workflows without nodes", () => {
    const workflow = parseN8nWorkflow({ name: "Empty", nodes: [], connections: {} });
    const viewModel = createWorkflowViewModel(workflow, []);

    expect(viewModel).toEqual({
      nodes: [],
      edges: []
    });
  });
});
