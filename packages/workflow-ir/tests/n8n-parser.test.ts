import { describe, expect, test } from "vitest";
import branchWorkflow from "./fixtures/refund-branch-workflow.json";
import { parseN8nWorkflow } from "../src/index";

describe("parseN8nWorkflow", () => {
  test("parses workflow identity, nodes, parameter summaries, and branch edges", () => {
    const workflow = parseN8nWorkflow(branchWorkflow);

    expect(workflow.name).toBe("Refund Workflow");
    expect(workflow.nodes).toHaveLength(5);
    expect(workflow.edges).toEqual([
      {
        id: "webhook:main:0:lookup",
        sourceNodeId: "webhook",
        targetNodeId: "lookup",
        sourceOutput: "main",
        sourceOutputIndex: 0
      },
      {
        id: "lookup:main:0:branch",
        sourceNodeId: "lookup",
        targetNodeId: "branch",
        sourceOutput: "main",
        sourceOutputIndex: 0
      },
      {
        id: "branch:main:0:approval",
        sourceNodeId: "branch",
        targetNodeId: "approval",
        sourceOutput: "main",
        sourceOutputIndex: 0
      },
      {
        id: "branch:main:1:refund",
        sourceNodeId: "branch",
        targetNodeId: "refund",
        sourceOutput: "main",
        sourceOutputIndex: 1
      }
    ]);
    expect(workflow.nodes.find((node) => node.id === "refund")).toMatchObject({
      name: "Stripe Refund",
      type: "n8n-nodes-base.stripe",
      typeFamily: "known"
    });
    expect(workflow.nodes.find((node) => node.id === "refund")?.parameters).toContainEqual({
      key: "operation",
      valueType: "string",
      preview: "refund"
    });
  });

  test("handles missing connections safely", () => {
    const workflow = parseN8nWorkflow({
      name: "No Connections",
      nodes: [
        {
          id: "node-1",
          name: "Only Node",
          type: "custom.unknown",
          parameters: {}
        }
      ]
    });

    expect(workflow.edges).toEqual([]);
    expect(workflow.nodes[0]).toMatchObject({
      id: "node-1",
      type: "custom.unknown",
      typeFamily: "unknown"
    });
  });

  test("redacts sensitive parameter previews recursively", () => {
    const workflow = parseN8nWorkflow({
      name: "Sensitive Workflow",
      nodes: [
        {
          id: "http",
          name: "HTTP Request",
          type: "n8n-nodes-base.httpRequest",
          parameters: {
            apiKey: "sk_live_should_not_leak",
            headers: {
              Authorization: "Bearer secret-token",
              "x-request-id": "={{$json.requestId}}"
            },
            headerParameters: [
              {
                name: "X-Api-Key",
                value: "nested-secret"
              }
            ],
            url: "https://api.example.test/orders"
          }
        }
      ],
      connections: {}
    });

    const parameters = workflow.nodes[0]!.parameters;

    expect(parameters).toContainEqual({
      key: "apiKey",
      valueType: "string",
      preview: "[redacted]",
      redacted: true
    });
    expect(parameters.find((parameter) => parameter.key === "headers")).toMatchObject({
      preview: JSON.stringify({
        Authorization: "[redacted]",
        "x-request-id": "={{$json.requestId}}"
      }),
      redacted: true
    });
    expect(parameters.find((parameter) => parameter.key === "headerParameters")?.preview).toContain("[redacted]");
    expect(parameters.find((parameter) => parameter.key === "headerParameters")?.preview).not.toContain("nested-secret");
    expect(parameters).toContainEqual({
      key: "url",
      valueType: "string",
      preview: "https://api.example.test/orders"
    });
  });

  test("redacts credential-like values across common n8n parameter shapes", () => {
    const workflow = parseN8nWorkflow({
      name: "Secret Shapes",
      nodes: [
        {
          id: "http",
          name: "HTTP Request",
          type: "n8n-nodes-base.httpRequest",
          parameters: {
            credentials: {
              id: "cred_123",
              name: "Production Stripe"
            },
            headerParameters: [
              {
                name: "Authorization",
                value: "Bearer array-secret"
              },
              "Bearer loose-array-secret"
            ],
            auth: {
              nested: {
                bearerToken: "nested-bearer-secret"
              }
            },
            queryParameters: [
              {
                name: "api_key",
                value: "query-secret"
              }
            ],
            jsonBody: {
              customer: "cus_123",
              password: "body-password"
            },
            xApiKey: "custom-api-key",
            privateToken: "custom-private-token",
            clientSecret: "custom-client-secret"
          }
        }
      ],
      connections: {}
    });

    const serialized = JSON.stringify(workflow);

    expect(serialized).toContain("[redacted]");
    expect(serialized).not.toContain("cred_123");
    expect(serialized).not.toContain("Production Stripe");
    expect(serialized).not.toContain("array-secret");
    expect(serialized).not.toContain("loose-array-secret");
    expect(serialized).not.toContain("nested-bearer-secret");
    expect(serialized).not.toContain("query-secret");
    expect(serialized).not.toContain("body-password");
    expect(serialized).not.toContain("custom-api-key");
    expect(serialized).not.toContain("custom-private-token");
    expect(serialized).not.toContain("custom-client-secret");
    expect(serialized).toContain("cus_123");
  });

  test("redacts secret-bearing URLs and expression strings under non-sensitive keys", () => {
    const workflow = parseN8nWorkflow({
      name: "URL Secret Workflow",
      nodes: [
        {
          id: "http",
          name: "HTTP Request",
          type: "n8n-nodes-base.httpRequest",
          parameters: {
            url: "https://api.example.test/orders?access_token=url-secret&customer=cus_123",
            options: {
              note: "={{ { Authorization: 'Bearer expression-secret' } }}"
            },
            headerParameters: ["Basic loose-basic-secret"],
            privateKeyValue: "-----BEGIN PRIVATE KEY-----\nprivate-key-secret\n-----END PRIVATE KEY-----"
          }
        }
      ],
      connections: {}
    });

    const serialized = JSON.stringify(workflow);

    expect(serialized).toContain("[redacted]");
    expect(serialized).not.toContain("url-secret");
    expect(serialized).toContain("customer=cus_123");
    expect(serialized).not.toContain("expression-secret");
    expect(serialized).not.toContain("loose-basic-secret");
    expect(serialized).not.toContain("private-key-secret");
  });

  test("generates unique fallback ids when exported nodes are missing ids", () => {
    const workflow = parseN8nWorkflow({
      name: "Missing IDs",
      nodes: [
        {
          name: "Task",
          type: "custom.task",
          parameters: {}
        },
        {
          name: "Task",
          type: "custom.task",
          parameters: {}
        }
      ],
      connections: {}
    });

    expect(workflow.nodes.map((node) => node.id)).toEqual(["task", "task-2"]);
  });

  test("does not guess connection targets when node names are duplicated", () => {
    const workflow = parseN8nWorkflow({
      name: "Duplicate Names",
      nodes: [
        {
          id: "start",
          name: "Start",
          type: "n8n-nodes-base.webhook",
          parameters: {}
        },
        {
          id: "first-shared",
          name: "Shared",
          type: "custom.one",
          parameters: {}
        },
        {
          id: "second-shared",
          name: "Shared",
          type: "custom.two",
          parameters: {}
        }
      ],
      connections: {
        Start: {
          main: [[{ node: "Shared", type: "main", index: 0 }]]
        }
      }
    });

    expect(workflow.edges).toEqual([]);
  });

  test("ignores malformed connections while preserving unknown nodes and disconnected subgraphs", () => {
    const workflow = parseN8nWorkflow({
      name: "Malformed Connections",
      nodes: [
        {
          id: "start",
          name: "Start",
          type: "n8n-nodes-base.webhook",
          parameters: {}
        },
        {
          id: "unknown",
          name: "Mystery Node",
          type: "vendor.customMystery",
          parameters: {}
        },
        {
          id: "orphan",
          name: "Disconnected",
          type: "custom.orphan",
          parameters: {}
        }
      ],
      connections: {
        Start: {
          main: [{ node: "Mystery Node", type: "main", index: 0 }],
          error: "bad"
        }
      }
    });

    expect(workflow.nodes.find((node) => node.id === "unknown")).toMatchObject({
      typeFamily: "unknown"
    });
    expect(workflow.edges).toEqual([]);
    expect(workflow.nodes.map((node) => node.id)).toContain("orphan");
  });

  test("parses branch nodes with multiple outputs", () => {
    const workflow = parseN8nWorkflow({
      name: "Switch Workflow",
      nodes: [
        { id: "switch", name: "Switch", type: "n8n-nodes-base.switch", parameters: {} },
        { id: "a", name: "A", type: "custom.a", parameters: {} },
        { id: "b", name: "B", type: "custom.b", parameters: {} },
        { id: "c", name: "C", type: "custom.c", parameters: {} }
      ],
      connections: {
        Switch: {
          main: [
            [{ node: "A", type: "main", index: 0 }],
            [{ node: "B", type: "main", index: 1 }],
            [{ node: "C", type: "main", index: 2 }]
          ]
        }
      }
    });

    expect(workflow.edges.map((edge) => `${edge.sourceOutput}[${edge.sourceOutputIndex}]->${edge.targetNodeId}`)).toEqual([
      "main[0]->a",
      "main[1]->b",
      "main[2]->c"
    ]);
  });
});
