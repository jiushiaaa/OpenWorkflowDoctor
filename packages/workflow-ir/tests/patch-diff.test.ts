import { describe, expect, test } from "vitest";
import branchWorkflow from "./fixtures/refund-branch-workflow.json";
import { createRuleBasedPatchProposal, formatPatchDiff, parseN8nWorkflow } from "../src/index";

describe("formatPatchDiff", () => {
  test("formats reviewable diff lines for deterministic patch operations", () => {
    const workflow = parseN8nWorkflow(branchWorkflow);
    const proposal = createRuleBasedPatchProposal(workflow, "帮我修复支付和通知相关风险");
    const diff = formatPatchDiff(workflow, proposal.operations);

    expect(diff).toEqual([
      {
        id: "patch-0-update_node_parameters-refund",
        marker: "~",
        operationType: "update_node_parameters",
        targetNodeId: "refund",
        targetNodeName: "Stripe Refund",
        title: "Update parameters on Stripe Refund",
        details: ["Set idempotencyKey to ={{$json.requestId}}"]
      },
      {
        id: "patch-1-insert_node_after-webhook",
        marker: "+",
        operationType: "insert_node_after",
        targetNodeId: "webhook",
        targetNodeName: "Webhook Trigger",
        title: "Add Webhook Dedupe Check after Webhook Trigger",
        details: [
          "Create node webhook-dedupe-check with type openworkflowdoctor.guard.dedupe",
          "Set dedupeKey to ={{$json.requestId}}",
          "Route existing outgoing edges through Webhook Dedupe Check"
        ]
      }
    ]);
  });

  test("falls back to node ids for missing patch targets", () => {
    const workflow = parseN8nWorkflow({ name: "Empty", nodes: [], connections: {} });
    const diff = formatPatchDiff(workflow, [
      {
        type: "update_node_parameters",
        targetNodeId: "missing",
        parameters: {
          enabled: true
        }
      }
    ]);

    expect(diff[0]).toMatchObject({
      targetNodeName: "missing",
      title: "Update parameters on missing",
      details: ["Set enabled to true"]
    });
  });

  test("redacts sensitive update parameter values in readable patch diff details", () => {
    const workflow = parseN8nWorkflow(branchWorkflow);
    const diff = formatPatchDiff(workflow, [
      {
        type: "update_node_parameters",
        targetNodeId: "refund",
        parameters: {
          apiKey: "sk_live_patch_secret",
          url: "https://api.example.test/refunds?access_token=url-secret&safe=1"
        }
      }
    ]);

    const serialized = JSON.stringify(diff);

    expect(serialized).toContain("[redacted]");
    expect(serialized).not.toContain("sk_live_patch_secret");
    expect(serialized).not.toContain("url-secret");
    expect(serialized).toContain("safe=1");
  });

  test("formats explicit error branch insertions", () => {
    const workflow = parseN8nWorkflow(branchWorkflow);
    const diff = formatPatchDiff(workflow, [
      {
        type: "insert_error_branch",
        targetNodeId: "refund",
        newNode: {
          id: "refund-error-handler",
          name: "Stripe Refund Error Handler",
          type: "openworkflowdoctor.error.handler",
          typeFamily: "unknown",
          parameters: []
        }
      }
    ]);

    expect(diff).toEqual([
      {
        id: "patch-0-insert_error_branch-refund",
        marker: "+",
        operationType: "insert_error_branch",
        targetNodeId: "refund",
        targetNodeName: "Stripe Refund",
        title: "Add Stripe Refund Error Handler as error branch for Stripe Refund",
        details: [
          "Create node refund-error-handler with type openworkflowdoctor.error.handler",
          "Route Stripe Refund error output to Stripe Refund Error Handler"
        ]
      }
    ]);
  });

  test("formats missing control-flow branch route insertions", () => {
    const workflow = parseN8nWorkflow(branchWorkflow);
    const diff = formatPatchDiff(workflow, [
      {
        type: "insert_branch_route",
        targetNodeId: "branch",
        sourceOutputIndex: 1,
        newNode: {
          id: "branch-output-1-stop",
          name: "IF refund amount > 500 Output 1 Stop",
          type: "openworkflowdoctor.flow.stop",
          typeFamily: "unknown",
          parameters: []
        }
      }
    ]);

    expect(diff).toEqual([
      {
        id: "patch-0-insert_branch_route-branch",
        marker: "+",
        operationType: "insert_branch_route",
        targetNodeId: "branch",
        targetNodeName: "IF refund amount > 500",
        title: "Add IF refund amount > 500 Output 1 Stop to IF refund amount > 500 output 1",
        details: [
          "Create node branch-output-1-stop with type openworkflowdoctor.flow.stop",
          "Route IF refund amount > 500 main[1] output to IF refund amount > 500 Output 1 Stop"
        ]
      }
    ]);
  });
});
