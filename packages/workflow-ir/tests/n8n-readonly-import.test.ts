import { describe, expect, test } from "vitest";
import { importN8nReadonlyWorkflow } from "../src/index";

describe("importN8nReadonlyWorkflow", () => {
  test("converts an n8n API workflow payload into secret-safe WorkflowIR", () => {
    const imported = importN8nReadonlyWorkflow({
      id: "wf_123",
      name: "Production Refunds",
      active: true,
      updatedAt: "2026-06-25T01:00:00.000Z",
      versionId: "version-1",
      pinData: {
        Webhook: [{ json: { token: "pinned-secret" } }]
      },
      staticData: {
        accessToken: "static-secret"
      },
      executionData: {
        data: "execution-secret"
      },
      nodes: [
        {
          id: "webhook",
          name: "Webhook",
          type: "n8n-nodes-base.webhook",
          webhookId: "webhook-secret-id",
          credentials: {
            httpHeaderAuth: {
              id: "cred_abc",
              name: "Production Header Credential"
            }
          },
          parameters: {
            path: "refunds",
            webhookUrl: "https://n8n.example.test/webhook/secret-webhook-url",
            url: "https://api.example.test/orders?customer=cus_123"
          }
        },
        {
          id: "custom",
          name: "Custom Community Node",
          type: "community.customNode",
          credentials: {
            customApi: {
              id: "cred_custom",
              name: "Custom API Key"
            }
          },
          parameters: {}
        }
      ],
      connections: {
        Webhook: {
          main: [[{ node: "Custom Community Node", type: "main", index: 0 }]]
        }
      }
    });

    expect(imported.workflow).toMatchObject({
      id: "wf_123",
      name: "Production Refunds"
    });
    expect(imported.workflow.edges).toHaveLength(1);
    expect(imported.workflow.nodes.find((node) => node.id === "custom")?.typeFamily).toBe("unknown");
    expect(imported.workflow.nodes.find((node) => node.id === "webhook")?.credentialSummary).toEqual({
      credentialReferencePresent: true,
      credentialTypes: ["httpHeaderAuth"],
      credentialCount: 1
    });
    expect(imported.workflow.nodes.find((node) => node.id === "custom")?.credentialSummary).toEqual({
      credentialReferencePresent: true,
      credentialTypes: ["customApi"],
      credentialCount: 1
    });
    expect(imported.metadata).toEqual({
      externalWorkflowId: "wf_123",
      workflowName: "Production Refunds",
      active: true,
      upstreamUpdatedAt: "2026-06-25T01:00:00.000Z",
      upstreamVersionId: "version-1",
      tags: []
    });

    const serialized = JSON.stringify(imported);
    expect(serialized).toContain("[redacted]");
    expect(serialized).not.toContain("cred_abc");
    expect(serialized).not.toContain("Production Header Credential");
    expect(serialized).not.toContain("cred_custom");
    expect(serialized).not.toContain("Custom API Key");
    expect(serialized).not.toContain("webhook-secret-id");
    expect(serialized).not.toContain("secret-webhook-url");
    expect(serialized).not.toContain("pinned-secret");
    expect(serialized).not.toContain("static-secret");
    expect(serialized).not.toContain("execution-secret");
  });

  test("extracts safe tag names from n8n workflow metadata", () => {
    const imported = importN8nReadonlyWorkflow({
      id: "wf_tags",
      name: "Tagged Workflow",
      nodes: [],
      connections: {},
      tags: [
        { id: "tag-secret-id", name: "Production" },
        { name: "Finance" },
        "Ignored Raw Tag"
      ]
    });

    expect(imported.metadata.tags).toEqual(["Production", "Finance"]);
    expect(JSON.stringify(imported)).not.toContain("tag-secret-id");
  });
});
