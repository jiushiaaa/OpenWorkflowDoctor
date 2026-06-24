import { describe, expect, test } from "vitest";
import branchWorkflow from "./fixtures/refund-branch-workflow.json";
import { applyPatchOperations, parseN8nWorkflow, type NodeIR } from "../src/index";

const approvalNode: NodeIR = {
  id: "risk-review",
  name: "Risk Review",
  type: "openworkflowdoctor.approval",
  typeFamily: "unknown",
  parameters: [
    {
      key: "reason",
      valueType: "string",
      preview: "Review high-risk refund"
    }
  ]
};

describe("applyPatchOperations", () => {
  test("inserts a review node before a target node and rewires incoming edges", () => {
    const workflow = parseN8nWorkflow(branchWorkflow);
    const patched = applyPatchOperations(workflow, [
      {
        type: "insert_node_before",
        targetNodeId: "refund",
        newNode: approvalNode
      }
    ]);

    expect(patched.nodes.map((node) => node.id)).toContain("risk-review");
    expect(patched.edges).toEqual(
      expect.arrayContaining([
        {
          id: "branch:main:1:risk-review",
          sourceNodeId: "branch",
          targetNodeId: "risk-review",
          sourceOutput: "main",
          sourceOutputIndex: 1
        },
        {
          id: "risk-review:main:0:refund",
          sourceNodeId: "risk-review",
          targetNodeId: "refund",
          sourceOutput: "main",
          sourceOutputIndex: 0
        }
      ])
    );
    expect(patched.edges.some((edge) => edge.id === "branch:main:1:refund")).toBe(false);
    expect(workflow.nodes.map((node) => node.id)).not.toContain("risk-review");
  });

  test("updates node parameter summaries without mutating the original workflow", () => {
    const workflow = parseN8nWorkflow(branchWorkflow);
    const patched = applyPatchOperations(workflow, [
      {
        type: "update_node_parameters",
        targetNodeId: "refund",
        parameters: {
          idempotencyKey: "={{$json.requestId}}"
        }
      }
    ]);

    expect(patched.nodes.find((node) => node.id === "refund")?.parameters).toContainEqual({
      key: "idempotencyKey",
      valueType: "string",
      preview: "={{$json.requestId}}"
    });
    expect(workflow.nodes.find((node) => node.id === "refund")?.parameters).not.toContainEqual({
      key: "idempotencyKey",
      valueType: "string",
      preview: "={{$json.requestId}}"
    });
  });

  test("redacts sensitive parameter values added by patch operations", () => {
    const workflow = parseN8nWorkflow({
      name: "Secret Patch",
      nodes: [
        {
          id: "http",
          name: "HTTP Request",
          type: "n8n-nodes-base.httpRequest",
          parameters: {}
        }
      ],
      connections: {}
    });

    const patched = applyPatchOperations(workflow, [
      {
        type: "update_node_parameters",
        targetNodeId: "http",
        parameters: {
          apiKey: "sk_live_should_not_leak"
        }
      }
    ]);

    expect(patched.nodes.find((node) => node.id === "http")?.parameters).toContainEqual({
      key: "apiKey",
      valueType: "string",
      preview: "[redacted]",
      redacted: true
    });
    expect(JSON.stringify(patched)).not.toContain("sk_live_should_not_leak");
  });

  test("rejects invalid patch operation shapes before applying them", () => {
    const workflow = parseN8nWorkflow(branchWorkflow);

    expect(() =>
      applyPatchOperations(workflow, [
        {
          type: "raw_json_mutation",
          targetNodeId: "refund",
          json: {
            nodes: []
          }
        } as unknown as Parameters<typeof applyPatchOperations>[1][number]
      ])
    ).toThrow("Invalid PatchOperation.");
  });

  test("redacts sensitive update parameter values before they enter patched workflow IR", () => {
    const workflow = parseN8nWorkflow(branchWorkflow);
    const patched = applyPatchOperations(workflow, [
      {
        type: "update_node_parameters",
        targetNodeId: "refund",
        parameters: {
          headers: {
            Authorization: "Bearer patch-secret"
          },
          url: "https://api.example.test/refunds?refresh_token=query-secret&safe=1"
        }
      }
    ]);

    const serialized = JSON.stringify(patched);

    expect(serialized).toContain("[redacted]");
    expect(serialized).not.toContain("patch-secret");
    expect(serialized).not.toContain("query-secret");
    expect(serialized).toContain("safe=1");
  });

  test("inserts a node after success routes without rewiring error branches", () => {
    const workflow = parseN8nWorkflow({
      name: "Refund With Error Branch",
      nodes: [
        {
          id: "refund",
          name: "Stripe Refund",
          type: "n8n-nodes-base.stripe",
          parameters: {}
        },
        {
          id: "success",
          name: "Update Order Status",
          type: "n8n-nodes-base.postgres",
          parameters: {}
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
          main: [
            [
              {
                node: "Update Order Status",
                type: "main",
                index: 0
              }
            ]
          ],
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

    const patched = applyPatchOperations(workflow, [
      {
        type: "insert_node_after",
        targetNodeId: "refund",
        newNode: {
          id: "refund-success-audit-log",
          name: "Refund Success Audit Log",
          type: "openworkflowdoctor.audit.log",
          typeFamily: "unknown",
          parameters: []
        }
      }
    ]);

    expect(patched.edges).toEqual(
      expect.arrayContaining([
        {
          id: "refund:main:0:refund-success-audit-log",
          sourceNodeId: "refund",
          targetNodeId: "refund-success-audit-log",
          sourceOutput: "main",
          sourceOutputIndex: 0
        },
        {
          id: "refund-success-audit-log:main:0:success",
          sourceNodeId: "refund-success-audit-log",
          targetNodeId: "success",
          sourceOutput: "main",
          sourceOutputIndex: 0
        },
        {
          id: "refund:error:0:failure",
          sourceNodeId: "refund",
          targetNodeId: "failure",
          sourceOutput: "error",
          sourceOutputIndex: 0
        }
      ])
    );
  });

  test("adds an explicit error branch without changing existing success routes", () => {
    const workflow = parseN8nWorkflow({
      name: "Refund Without Error Branch",
      nodes: [
        {
          id: "refund",
          name: "Stripe Refund",
          type: "n8n-nodes-base.stripe",
          parameters: {}
        },
        {
          id: "success",
          name: "Update Order Status",
          type: "n8n-nodes-base.postgres",
          parameters: {}
        }
      ],
      connections: {
        "Stripe Refund": {
          main: [
            [
              {
                node: "Update Order Status",
                type: "main",
                index: 0
              }
            ]
          ]
        }
      }
    });

    const patched = applyPatchOperations(workflow, [
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

    expect(patched.nodes.map((node) => node.id)).toContain("refund-error-handler");
    expect(patched.edges).toEqual(
      expect.arrayContaining([
        {
          id: "refund:main:0:success",
          sourceNodeId: "refund",
          targetNodeId: "success",
          sourceOutput: "main",
          sourceOutputIndex: 0
        },
        {
          id: "refund:error:0:refund-error-handler",
          sourceNodeId: "refund",
          targetNodeId: "refund-error-handler",
          sourceOutput: "error",
          sourceOutputIndex: 0
        }
      ])
    );
  });

  test("adds a route for a missing control-flow output", () => {
    const workflow = parseN8nWorkflow({
      name: "Incomplete Branch",
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

    const patched = applyPatchOperations(workflow, [
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

    expect(patched.nodes.map((node) => node.id)).toContain("branch-output-1-stop");
    expect(patched.edges).toEqual(
      expect.arrayContaining([
        {
          id: "branch:main:0:approval",
          sourceNodeId: "branch",
          targetNodeId: "approval",
          sourceOutput: "main",
          sourceOutputIndex: 0
        },
        {
          id: "branch:main:1:branch-output-1-stop",
          sourceNodeId: "branch",
          targetNodeId: "branch-output-1-stop",
          sourceOutput: "main",
          sourceOutputIndex: 1
        }
      ])
    );
  });

  test("rejects patch operations that reference a missing target node", () => {
    const workflow = parseN8nWorkflow(branchWorkflow);

    expect(() =>
      applyPatchOperations(workflow, [
        {
          type: "insert_node_after",
          targetNodeId: "missing-node",
          newNode: approvalNode
        }
      ])
    ).toThrow("Patch target node not found: missing-node");
  });

  test("rejects replayed insert patches without duplicating node ids", () => {
    const workflow = parseN8nWorkflow(branchWorkflow);
    const operations = [
      {
        type: "insert_node_after" as const,
        targetNodeId: "webhook",
        newNode: {
          id: "webhook-dedupe-check",
          name: "Webhook Dedupe Check",
          type: "openworkflowdoctor.guard.dedupe",
          typeFamily: "unknown" as const,
          parameters: []
        }
      }
    ];
    const patched = applyPatchOperations(workflow, operations);

    expect(() => applyPatchOperations(patched, operations)).toThrow(
      "Patch node already exists: webhook-dedupe-check"
    );
    expect(new Set(patched.nodes.map((node) => node.id)).size).toBe(patched.nodes.length);
  });
});
