import { describe, expect, test } from "vitest";
import branchWorkflow from "./fixtures/refund-branch-workflow.json";
import isolatedWorkflow from "./fixtures/isolated-workflow.json";
import {
  applyPatchOperations,
  createRuleBasedPatchProposal,
  diagnoseWorkflow,
  parseN8nWorkflow,
  verifyPatch
} from "../src/index";

describe("createRuleBasedPatchProposal", () => {
  test("creates structured payment and notification patch operations from a natural-language request", () => {
    const workflow = parseN8nWorkflow(branchWorkflow);
    const proposal = createRuleBasedPatchProposal(workflow, "帮我修复支付和通知相关风险");

    expect(proposal.summary).toBe("Proposed 2 deterministic fixes for payment and notification risks.");
    expect(proposal.operations).toEqual([
      {
        type: "update_node_parameters",
        targetNodeId: "refund",
        parameters: {
          idempotencyKey: "={{$json.requestId}}"
        }
      },
      {
        type: "insert_node_after",
        targetNodeId: "webhook",
        newNode: {
          id: "webhook-dedupe-check",
          name: "Webhook Dedupe Check",
          type: "openworkflowdoctor.guard.dedupe",
          typeFamily: "unknown",
          parameters: [
            {
              key: "dedupeKey",
              valueType: "string",
              preview: "={{$json.requestId}}"
            }
          ]
        }
      }
    ]);
    expect(proposal.risksAddressed).toEqual(["payment_without_idempotency:refund", "webhook_without_dedupe:webhook"]);
    expect(proposal.expectedImpact).toEqual([
      "Adds an idempotency key to Stripe Refund.",
      "Adds a duplicate request guard after Webhook Trigger."
    ]);
    expect(proposal.requiresHumanReview).toBe(true);

    const patched = applyPatchOperations(workflow, proposal.operations);
    const report = verifyPatch({ original: workflow, patched, operations: proposal.operations });
    expect(report.status).toBe("hold");
  });

  test("generates deterministic non-colliding node ids for proposed insertions", () => {
    const workflow = parseN8nWorkflow({
      name: "Existing Guard",
      nodes: [
        {
          id: "webhook",
          name: "Webhook Trigger",
          type: "n8n-nodes-base.webhook",
          parameters: {}
        },
        {
          id: "webhook-dedupe-check",
          name: "Existing Dedupe Check",
          type: "openworkflowdoctor.guard.dedupe",
          parameters: {}
        }
      ],
      connections: {}
    });

    const proposal = createRuleBasedPatchProposal(workflow, "帮我修复通知风险");

    expect(proposal.operations).toEqual([
      {
        type: "insert_node_after",
        targetNodeId: "webhook",
        newNode: {
          id: "webhook-dedupe-check-1",
          name: "Webhook Dedupe Check",
          type: "openworkflowdoctor.guard.dedupe",
          typeFamily: "unknown",
          parameters: [
            {
              key: "dedupeKey",
              valueType: "string",
              preview: "={{$json.requestId}}"
            }
          ]
        }
      }
    ]);
    expect(() => applyPatchOperations(workflow, proposal.operations)).not.toThrow();
  });

  test("returns an empty proposal when the request does not match supported deterministic fixes", () => {
    const workflow = parseN8nWorkflow(isolatedWorkflow);
    const proposal = createRuleBasedPatchProposal(workflow, "帮我优化布局");

    expect(proposal).toEqual({
      summary: "No deterministic fixes matched the request.",
      operations: [],
      risksAddressed: [],
      expectedImpact: [],
      risksIntroduced: [],
      requiresHumanReview: true
    });
  });

  test("proposes a success audit log for high-risk side effects without audit trails", () => {
    const workflow = parseN8nWorkflow({
      name: "Refund With Error Handling",
      nodes: [
        {
          id: "refund",
          name: "Stripe Refund",
          type: "n8n-nodes-base.stripe",
          parameters: {
            resource: "charge",
            operation: "refund",
            idempotencyKey: "={{$json.requestId}}"
          }
        },
        {
          id: "failure",
          name: "Record Refund Failure",
          type: "n8n-nodes-base.postgres",
          parameters: {}
        }
      ],
      connections: {
        "Stripe Refund": {
          error: [
            [
              {
                node: "Record Refund Failure",
                type: "main",
                index: 0
              }
            ]
          ]
        }
      }
    });

    const proposal = createRuleBasedPatchProposal(workflow, "帮我补退款成功后的审计记录");

    expect(proposal.operations).toEqual([
      {
        type: "insert_node_after",
        targetNodeId: "refund",
        newNode: {
          id: "refund-success-audit-log",
          name: "Stripe Refund Success Audit Log",
          type: "openworkflowdoctor.audit.log",
          typeFamily: "unknown",
          parameters: [
            {
              key: "auditEvent",
              valueType: "string",
              preview: "stripe_refund_success"
            },
            {
              key: "correlationId",
              valueType: "string",
              preview: "={{$json.requestId}}"
            }
          ]
        }
      }
    ]);
    expect(proposal.risksAddressed).toEqual(["side_effect_without_audit_trail:refund"]);
    expect(proposal.expectedImpact).toEqual(["Adds a success audit log after Stripe Refund."]);

    const patched = applyPatchOperations(workflow, proposal.operations);
    const patchedIssueIds = diagnoseWorkflow(patched).map((issue) => issue.id);
    expect(patchedIssueIds).not.toContain("side_effect_without_audit_trail:refund");
    expect(patchedIssueIds).not.toContain("missing_error_branch:refund");
  });

  test("proposes timeout parameters for HTTP requests without timeouts", () => {
    const workflow = parseN8nWorkflow({
      name: "Lookup Order",
      nodes: [
        {
          id: "lookup",
          name: "Lookup Order",
          type: "n8n-nodes-base.httpRequest",
          parameters: {
            url: "https://api.example.test/orders/{{$json.orderId}}",
            method: "GET"
          }
        }
      ],
      connections: {}
    });

    const proposal = createRuleBasedPatchProposal(workflow, "帮我修复 HTTP 超时风险");

    expect(proposal.operations).toEqual([
      {
        type: "update_node_parameters",
        targetNodeId: "lookup",
        parameters: {
          timeout: 30000
        }
      }
    ]);
    expect(proposal.risksAddressed).toEqual(["http_without_timeout:lookup"]);
    expect(proposal.expectedImpact).toEqual(["Adds a 30000ms timeout to Lookup Order."]);

    const patched = applyPatchOperations(workflow, proposal.operations);
    expect(diagnoseWorkflow(patched).map((issue) => issue.id)).not.toContain("http_without_timeout:lookup");
  });

  test("proposes an error branch for high-risk side effects without fallback paths", () => {
    const workflow = parseN8nWorkflow({
      name: "Refund Without Error Branch",
      nodes: [
        {
          id: "refund",
          name: "Stripe Refund",
          type: "n8n-nodes-base.stripe",
          parameters: {
            idempotencyKey: "={{$json.requestId}}"
          }
        }
      ],
      connections: {}
    });

    const proposal = createRuleBasedPatchProposal(workflow, "帮我补错误分支和失败处理");

    expect(proposal.operations).toEqual([
      {
        type: "insert_error_branch",
        targetNodeId: "refund",
        newNode: {
          id: "refund-error-handler",
          name: "Stripe Refund Error Handler",
          type: "openworkflowdoctor.error.handler",
          typeFamily: "unknown",
          parameters: [
            {
              key: "errorAction",
              valueType: "string",
              preview: "record_failure"
            },
            {
              key: "correlationId",
              valueType: "string",
              preview: "={{$json.requestId}}"
            }
          ]
        }
      }
    ]);
    expect(proposal.risksAddressed).toEqual(["missing_error_branch:refund"]);
    expect(proposal.expectedImpact).toEqual(["Adds an explicit error handler for Stripe Refund."]);

    const patched = applyPatchOperations(workflow, proposal.operations);
    expect(diagnoseWorkflow(patched).map((issue) => issue.id)).not.toContain("missing_error_branch:refund");
  });

  test("proposes a stop route for missing control-flow branch outputs", () => {
    const workflow = parseN8nWorkflow({
      name: "Incomplete Approval Branch",
      nodes: [
        {
          id: "branch",
          name: "IF refund amount > 500",
          type: "n8n-nodes-base.if",
          parameters: {}
        },
        {
          id: "approval",
          name: "Manual Approval",
          type: "n8n-nodes-base.manualTrigger",
          parameters: {}
        }
      ],
      connections: {
        "IF refund amount > 500": {
          main: [
            [
              {
                node: "Manual Approval",
                type: "main",
                index: 0
              }
            ]
          ]
        }
      }
    });

    const proposal = createRuleBasedPatchProposal(workflow, "帮我补全分支路由和 fallback");

    expect(proposal.operations).toEqual([
      {
        type: "insert_branch_route",
        targetNodeId: "branch",
        sourceOutputIndex: 1,
        newNode: {
          id: "branch-output-1-stop",
          name: "IF refund amount > 500 Output 1 Stop",
          type: "openworkflowdoctor.flow.stop",
          typeFamily: "unknown",
          parameters: [
            {
              key: "reason",
              valueType: "string",
              preview: "No-op stop route for previously unconnected branch output 1."
            }
          ]
        }
      }
    ]);
    expect(proposal.risksAddressed).toEqual(["control_branch_without_route:branch:1"]);
    expect(proposal.expectedImpact).toEqual(["Adds a stop route for IF refund amount > 500 output 1."]);

    const patched = applyPatchOperations(workflow, proposal.operations);
    expect(diagnoseWorkflow(patched).map((issue) => issue.id)).not.toContain("control_branch_without_route:branch:1");
  });

  test("combines all supported deterministic fixes for comprehensive repair requests", () => {
    const workflow = parseN8nWorkflow(branchWorkflow);
    const proposal = createRuleBasedPatchProposal(workflow, "请全面修复所有支持的可靠性问题");

    expect(proposal.summary).toBe("Proposed 5 deterministic fixes for all supported risks.");
    expect(proposal.operations.map((operation) => operation.type)).toEqual([
      "update_node_parameters",
      "insert_node_after",
      "insert_node_after",
      "update_node_parameters",
      "insert_error_branch"
    ]);
    expect(proposal.risksAddressed).toEqual([
      "payment_without_idempotency:refund",
      "webhook_without_dedupe:webhook",
      "side_effect_without_audit_trail:refund",
      "http_without_timeout:lookup",
      "missing_error_branch:refund"
    ]);

    const patched = applyPatchOperations(workflow, proposal.operations);
    const patchedIssueIds = diagnoseWorkflow(patched).map((issue) => issue.id);
    expect(patchedIssueIds).not.toEqual(
      expect.arrayContaining([
        "payment_without_idempotency:refund",
        "webhook_without_dedupe:webhook",
        "side_effect_without_audit_trail:refund",
        "http_without_timeout:lookup",
        "missing_error_branch:refund"
      ])
    );
  });
});
