import { describe, expect, test } from "vitest";
import branchWorkflow from "./fixtures/refund-branch-workflow.json";
import { parseN8nWorkflow, summarizeWorkflow } from "../src/index";

describe("summarizeWorkflow", () => {
  test("explains the purpose and safety shape of a refund workflow", () => {
    const workflow = parseN8nWorkflow(branchWorkflow);
    const summary = summarizeWorkflow(workflow);

    expect(summary).toEqual({
      workflowName: "Refund Workflow",
      overview:
        "Refund Workflow starts from Webhook Trigger and can end at Manual Approval or Stripe Refund. It has 5 nodes, 4 edges, and 1 high-risk side effect node.",
      entryNodes: ["Webhook Trigger"],
      terminalNodes: ["Manual Approval", "Stripe Refund"],
      sideEffectNodes: ["Stripe Refund"],
      riskCounts: {
        low: 0,
        medium: 2,
        high: 3,
        critical: 1
      },
      recommendedStatus: "hold"
    });
  });

  test("returns a stable empty summary for malformed or empty workflows", () => {
    const workflow = parseN8nWorkflow({ name: "Empty", nodes: "bad", connections: null });
    const summary = summarizeWorkflow(workflow);

    expect(summary).toEqual({
      workflowName: "Empty",
      overview: "Empty has no parsed workflow nodes.",
      entryNodes: [],
      terminalNodes: [],
      sideEffectNodes: [],
      riskCounts: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0
      },
      recommendedStatus: "fail"
    });
  });
});
