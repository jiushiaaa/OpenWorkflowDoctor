import { describe, expect, test } from "vitest";
import branchWorkflow from "./fixtures/refund-branch-workflow.json";
import {
  applyPatchOperations,
  createRuleBasedPatchProposal,
  parseN8nWorkflow,
  verifyPatch,
  type PatchOperation,
  type WorkflowIR
} from "../src/index";

describe("verifyPatch", () => {
  test("returns hold when a patch improves payment safety but leaves high-risk issues", () => {
    const original = parseN8nWorkflow(branchWorkflow);
    const operations: PatchOperation[] = [
      {
        type: "update_node_parameters",
        targetNodeId: "refund",
        parameters: {
          idempotencyKey: "={{$json.requestId}}"
        }
      }
    ];
    const patched = applyPatchOperations(original, operations);

    const report = verifyPatch({ original, patched, operations });

    expect(report.status).toBe("hold");
    expect(report.checkedGates).toContainEqual({
      id: "patch_has_operations",
      title: "Patch contains reviewable operations",
      status: "pass",
      explanation: "Patch includes 1 structured operation."
    });
    expect(report.checkedGates).toContainEqual({
      id: "critical_risk_count",
      title: "Critical risks are not increased",
      status: "pass",
      explanation: "Critical risk count changed from 1 to 0."
    });
    expect(report.checkedGates).toContainEqual({
      id: "remaining_repairable_high_risks",
      title: "No repairable high or critical risks remain",
      status: "hold",
      explanation: "Patched workflow still has repairable high or critical risks."
    });
    expect(report.passedScenarios).toContain("critical_risk_count");
    expect(report.warnings).toContain("Patched workflow still has repairable high or critical risks.");
    expect(report.requiredRemediation).toContain("Resolve remaining repairable high and critical risk issues before accepting.");
  });

  test("fails when a patch introduces a new critical issue even if total critical count is unchanged", () => {
    const original = parseN8nWorkflow(branchWorkflow);
    const operations: PatchOperation[] = [
      {
        type: "update_node_parameters",
        targetNodeId: "refund",
        parameters: {
          idempotencyKey: "={{$json.requestId}}"
        }
      },
      {
        type: "insert_node_after",
        targetNodeId: "approval",
        newNode: {
          id: "new-payment",
          name: "Stripe Charge",
          type: "n8n-nodes-base.stripe",
          typeFamily: "known",
          parameters: []
        }
      }
    ];
    const patched = applyPatchOperations(original, operations);

    const report = verifyPatch({ original, patched, operations });

    expect(report.status).toBe("fail");
    expect(report.checkedGates).toContainEqual({
      id: "critical_risk_count",
      title: "Critical risks are not increased",
      status: "fail",
      explanation: "Critical risk count changed from 1 to 1, with introduced critical issues: payment_without_idempotency:new-payment."
    });
  });

  test("holds for human confirmation when supported repairs leave only inherent side-effect review", () => {
    const original = parseN8nWorkflow(branchWorkflow);
    const proposal = createRuleBasedPatchProposal(original, "请全面修复所有支持的可靠性问题");
    const patched = applyPatchOperations(original, proposal.operations);

    const report = verifyPatch({ original, patched, operations: proposal.operations });

    expect(report.status).toBe("hold");
    expect(report.checkedGates).toContainEqual({
      id: "remaining_repairable_high_risks",
      title: "No repairable high or critical risks remain",
      status: "pass",
      explanation: "Patched workflow has no repairable high or critical risks."
    });
    expect(report.checkedGates).toContainEqual({
      id: "side_effect_human_review",
      title: "Remaining side effects need human confirmation",
      status: "hold",
      explanation: "Patched workflow still contains high-risk side effect nodes that require human acceptance."
    });
    expect(report.warnings).toEqual(["Patched workflow still contains high-risk side effect nodes that require human acceptance."]);
    expect(report.requiredRemediation).toEqual(["Human reviewer must confirm the remaining side-effect nodes are expected before accepting."]);
  });

  test("returns fail when a patch removes all workflow nodes", () => {
    const original = parseN8nWorkflow(branchWorkflow);
    const patched: WorkflowIR = {
      name: "Broken Workflow",
      nodes: [],
      edges: []
    };

    const report = verifyPatch({ original, patched, operations: [] });

    expect(report.status).toBe("fail");
    expect(report.checkedGates).toContainEqual({
      id: "workflow_has_nodes",
      title: "Workflow still has nodes",
      status: "fail",
      explanation: "Patched workflow has no nodes."
    });
    expect(report.failedScenarios).toContain("workflow_has_nodes");
  });
});
