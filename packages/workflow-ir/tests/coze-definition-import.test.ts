import { describe, expect, test } from "vitest";
import {
  buildAiPatchProposalInput,
  cozeDefinitionSourceAdapter,
  createDoctorReportFromWorkflow,
  createDoctorReviewPacket,
  diagnoseWorkflow,
  importCozeDefinitionWorkflow,
  parseDoctorReviewPacket
} from "../src/index";

const cozeCanvas = {
  nodes: [
    {
      id: "100001",
      type: "1",
      data: {
        nodeMeta: {
          title: "Start"
        },
        outputs: [
          {
            name: "query",
            type: "string",
            defaultValue: "safe"
          }
        ]
      }
    },
    {
      id: "llm",
      type: "3",
      data: {
        nodeMeta: {
          title: "Answer Customer"
        },
        inputs: {
          llmParam: [
            {
              name: "systemPrompt",
              input: {
                type: "string",
                value: {
                  type: "literal",
                  content: "SECRET_COZE_PROMPT_SHOULD_NOT_LEAK"
                }
              }
            }
          ],
          settingOnError: {
            switch: true,
            processType: 3,
            timeoutMs: 30000,
            retryTimes: 1
          }
        },
        outputs: [
          {
            name: "answer",
            type: "string"
          }
        ]
      }
    },
    {
      id: "plugin",
      type: "4",
      data: {
        nodeMeta: {
          title: "Call CRM"
        },
        inputs: {
          apiParam: [
            {
              name: "pluginID",
              input: {
                type: "string",
                value: {
                  type: "literal",
                  content: "SECRET_COZE_PLUGIN_ID_SHOULD_NOT_LEAK"
                }
              }
            },
            {
              name: "Authorization",
              input: {
                type: "string",
                value: {
                  type: "literal",
                  content: "Bearer SECRET_COZE_TOKEN_SHOULD_NOT_LEAK"
                }
              }
            }
          ],
          pluginFrom: {
            plugin_id: "SECRET_COZE_PLUGIN_ID_SHOULD_NOT_LEAK",
            api_id: "SECRET_COZE_API_ID_SHOULD_NOT_LEAK"
          }
        }
      }
    },
    {
      id: "http",
      type: "45",
      data: {
        nodeMeta: {
          title: "Signed HTTP"
        },
        inputs: {
          apiInfo: {
            method: "POST",
            url: "https://api.example.test/hook?signature=SECRET_COZE_SIGNED_URL_SHOULD_NOT_LEAK"
          },
          headers: [
            {
              name: "X-API-Key",
              input: {
                type: "string",
                value: {
                  type: "literal",
                  content: "SECRET_COZE_API_KEY_SHOULD_NOT_LEAK"
                }
              }
            }
          ],
          auth: {
            authOpen: true,
            authType: "custom",
            authData: {
              bearerTokenData: [
                {
                  name: "token",
                  input: {
                    type: "string",
                    value: {
                      type: "literal",
                      content: "SECRET_COZE_HTTP_BEARER_SHOULD_NOT_LEAK"
                    }
                  }
                }
              ]
            }
          },
          setting: {
            retryTimes: 0
          }
        }
      }
    },
    {
      id: "code",
      type: "5",
      data: {
        nodeMeta: {
          title: "Risky Code"
        },
        inputs: {
          code: "fetch('https://api.example.test?token=SECRET_COZE_CODE_TOKEN_SHOULD_NOT_LEAK')",
          language: 5
        }
      }
    },
    {
      id: "knowledge",
      type: "6",
      data: {
        nodeMeta: {
          title: "Knowledge"
        },
        inputs: {
          datasetParam: [
            {
              name: "dataset",
              input: {
                type: "string",
                value: {
                  type: "literal",
                  content: "SECRET_COZE_DATASET_ID_SHOULD_NOT_LEAK"
                }
              }
            }
          ]
        }
      }
    },
    {
      id: "database",
      type: "42",
      data: {
        nodeMeta: {
          title: "Update Database"
        },
        inputs: {
          databaseInfoList: [
            {
              databaseInfoID: "SECRET_COZE_DATABASE_ID_SHOULD_NOT_LEAK"
            }
          ],
          sql: "UPDATE customers SET token = 'SECRET_COZE_SQL_SHOULD_NOT_LEAK'"
        }
      }
    },
    {
      id: "subflow",
      type: "9",
      data: {
        nodeMeta: {
          title: "Child Workflow"
        },
        inputs: {
          workflowId: "SECRET_COZE_WORKFLOW_ID_SHOULD_NOT_LEAK",
          spaceId: "SECRET_COZE_SPACE_ID_SHOULD_NOT_LEAK"
        }
      }
    },
    {
      id: "900001",
      type: "2",
      data: {
        nodeMeta: {
          title: "End"
        },
        inputs: {
          terminatePlan: "returnVariables"
        }
      }
    }
  ],
  edges: [
    {
      sourceNodeID: "100001",
      targetNodeID: "llm",
      sourcePortID: "main",
      targetPortID: "input"
    },
    {
      sourceNodeID: "llm",
      targetNodeID: "plugin",
      sourcePortID: "main",
      targetPortID: "input"
    },
    {
      sourceNodeID: "plugin",
      targetNodeID: "http",
      sourcePortID: "success",
      targetPortID: "input"
    },
    {
      sourceNodeID: "missing",
      targetNodeID: "900001",
      sourcePortID: "main",
      targetPortID: "input"
    }
  ]
};

describe("Coze definition import", () => {
  test("exposes a JSON-only WorkflowSourceAdapter contract", () => {
    expect(cozeDefinitionSourceAdapter).toMatchObject({
      id: "coze-definition",
      label: "Coze Definition JSON",
      sourceKind: "coze-definition"
    });
    expect(cozeDefinitionSourceAdapter.acceptsFile("workflow.json", "application/json")).toBe(true);
    expect(cozeDefinitionSourceAdapter.acceptsFile("workflow.yml", "application/x-yaml")).toBe(false);
    expect(cozeDefinitionSourceAdapter.acceptsFile("workflow.txt", "application/json")).toBe(false);
  });

  test("imports direct Coze canvas JSON as secret-safe WorkflowIR with source metadata", () => {
    const imported = importCozeDefinitionWorkflow({
      fileName: "coze-workflow.json",
      mimeType: "application/json",
      content: JSON.stringify(cozeCanvas)
    });

    expect(imported.workflow).toMatchObject({
      name: "coze-workflow",
      source: {
        sourceKind: "coze-definition",
        sourcePlatform: "coze",
        sourceVersion: "direct-canvas",
        sourceLabel: "coze-workflow.json",
        nodeCount: 9,
        edgeCount: 3
      }
    });
    expect(imported.workflow.nodes.map((node) => [node.id, node.type, node.typeFamily])).toEqual([
      ["100001", "coze.start", "known"],
      ["llm", "coze.llm", "known"],
      ["plugin", "coze.plugin", "known"],
      ["http", "coze.http", "known"],
      ["code", "coze.code", "known"],
      ["knowledge", "coze.knowledge.retrieve", "known"],
      ["database", "coze.database.update", "known"],
      ["subflow", "coze.subworkflow", "known"],
      ["900001", "coze.end", "known"]
    ]);
    expect(imported.workflow.edges).toContainEqual({
      id: "100001:main:0:llm:0",
      sourceNodeId: "100001",
      targetNodeId: "llm",
      sourceOutput: "main",
      sourceOutputIndex: 0,
      targetInput: "input"
    });
    expect(imported.metadata.diagnostics.map((diagnostic) => diagnostic.code)).toContain("coze_broken_edge");

    const serialized = JSON.stringify(imported);
    expect(serialized).toContain("[redacted]");
    expect(serialized).toContain("promptPresent");
    expect(serialized).toContain("codeRiskSignals");
    expect(serialized).toContain("pluginReferencePresent");
    expect(serialized).not.toContain("SECRET_COZE_PROMPT_SHOULD_NOT_LEAK");
    expect(serialized).not.toContain("SECRET_COZE_PLUGIN_ID_SHOULD_NOT_LEAK");
    expect(serialized).not.toContain("SECRET_COZE_TOKEN_SHOULD_NOT_LEAK");
    expect(serialized).not.toContain("SECRET_COZE_SIGNED_URL_SHOULD_NOT_LEAK");
    expect(serialized).not.toContain("SECRET_COZE_API_KEY_SHOULD_NOT_LEAK");
    expect(serialized).not.toContain("SECRET_COZE_HTTP_BEARER_SHOULD_NOT_LEAK");
    expect(serialized).not.toContain("SECRET_COZE_CODE_TOKEN_SHOULD_NOT_LEAK");
    expect(serialized).not.toContain("SECRET_COZE_DATASET_ID_SHOULD_NOT_LEAK");
    expect(serialized).not.toContain("SECRET_COZE_DATABASE_ID_SHOULD_NOT_LEAK");
    expect(serialized).not.toContain("SECRET_COZE_SQL_SHOULD_NOT_LEAK");
    expect(serialized).not.toContain("SECRET_COZE_WORKFLOW_ID_SHOULD_NOT_LEAK");
    expect(serialized).not.toContain("SECRET_COZE_SPACE_ID_SHOULD_NOT_LEAK");
  });

  test("detects supported wrapped Coze canvas fields", () => {
    for (const wrapperKey of ["workflow_schema", "canvas", "schema", "Canvas", "CanvasSchema"]) {
      const wrappedObject = importCozeDefinitionWorkflow({
        fileName: `${wrapperKey}.json`,
        content: JSON.stringify({ name: "Wrapped Coze", [wrapperKey]: cozeCanvas })
      });
      const wrappedString = importCozeDefinitionWorkflow({
        fileName: `${wrapperKey}-string.json`,
        content: JSON.stringify({ name: "Wrapped Coze", [wrapperKey]: JSON.stringify(cozeCanvas) })
      });

      expect(wrappedObject.workflow.source?.sourceVersion).toBe(wrapperKey);
      expect(wrappedObject.workflow.name).toBe("Wrapped Coze");
      expect(wrappedString.workflow.source?.sourceVersion).toBe(wrapperKey);
      expect(wrappedString.workflow.name).toBe("Wrapped Coze");
    }
  });

  test("rejects invalid JSON, missing graph shape, and guardrail violations safely", () => {
    expect(() =>
      importCozeDefinitionWorkflow({
        fileName: "broken.json",
        content: "{"
      })
    ).toThrow("Unable to parse Coze definition JSON.");

    expect(() =>
      importCozeDefinitionWorkflow({
        fileName: "missing.json",
        content: JSON.stringify({ workflow_schema: { no: "graph" } })
      })
    ).toThrow("Coze definition JSON must include nodes and edges arrays.");

    expect(() =>
      importCozeDefinitionWorkflow({
        fileName: "too-large.json",
        content: `${JSON.stringify(cozeCanvas)}${" ".repeat(2 * 1024 * 1024)}`
      })
    ).toThrow("Coze definition JSON file exceeds");

    expect(() =>
      importCozeDefinitionWorkflow({
        fileName: "too-many-nodes.json",
        content: JSON.stringify({ nodes: Array.from({ length: 501 }, (_, index) => ({ id: `n${index}`, type: "1" })), edges: [] })
      })
    ).toThrow("Coze definition node count exceeds");
  });

  test("turns unknown nodes, duplicate ids, and composite blocks into safe WorkflowIR", () => {
    const imported = importCozeDefinitionWorkflow({
      fileName: "composite.json",
      content: JSON.stringify({
        nodes: [
          {
            id: "100001",
            type: "1",
            data: { nodeMeta: { title: "Start" } }
          },
          {
            id: "loop",
            type: "21",
            data: { nodeMeta: { title: "Loop" } },
            blocks: [
              {
                id: "inner",
                type: "future-node",
                data: { nodeMeta: { title: "Mystery" } }
              },
              {
                id: "inner",
                type: "5",
                data: { nodeMeta: { title: "Duplicate Code" }, inputs: { code: "return 1;" } }
              }
            ],
            edges: [
              {
                sourceNodeID: "inner",
                targetNodeID: "inner",
                sourcePortID: "main",
                targetPortID: "input"
              }
            ]
          },
          {
            id: "900001",
            type: "2",
            data: { nodeMeta: { title: "End" } }
          }
        ],
        edges: [
          {
            sourceNodeID: "100001",
            targetNodeID: "loop"
          },
          {
            sourceNodeID: "loop",
            targetNodeID: "900001"
          }
        ]
      })
    });

    expect(imported.workflow.nodes.map((node) => [node.id, node.type, node.typeFamily])).toEqual([
      ["100001", "coze.start", "known"],
      ["loop", "coze.loop", "known"],
      ["inner", "coze.unknown.future-node", "unknown"],
      ["inner-2", "coze.code", "known"],
      ["900001", "coze.end", "known"]
    ]);
    expect(imported.workflow.edges.some((edge) => edge.sourceNodeId === "inner" && edge.targetNodeId === "inner-2")).toBe(true);

    const issueIds = diagnoseWorkflow(imported.workflow).map((issue) => issue.id);
    expect(issueIds).toEqual(
      expect.arrayContaining([
        "coze_definition_unstable_artifact",
        "coze_unknown_node_type:inner",
        "coze_duplicate_node_id:inner-2",
        "coze_code_node_present:inner-2",
        "coze_batch_or_loop_requires_review:loop"
      ])
    );
  });

  test("emits Coze-specific diagnostics as regular RiskIssue records", () => {
    const imported = importCozeDefinitionWorkflow({
      fileName: "risky.json",
      content: JSON.stringify(cozeCanvas)
    });
    const issueIds = diagnoseWorkflow(imported.workflow).map((issue) => issue.id);

    expect(issueIds).toEqual(
      expect.arrayContaining([
        "coze_definition_unstable_artifact",
        "coze_broken_edge:missing:900001",
        "coze_plugin_side_effect:plugin",
        "coze_http_without_timeout:http",
        "coze_http_auth_materialized:http",
        "coze_code_node_present:code",
        "coze_code_unsafe_reference:code",
        "coze_knowledge_external_reference:knowledge",
        "coze_database_mutation:database",
        "coze_subworkflow_unresolved:subflow",
        "coze_error_strategy_missing:plugin"
      ])
    );
  });

  test("records Coze source metadata in Review Packet without raw payload or secrets", () => {
    const imported = importCozeDefinitionWorkflow({
      fileName: "coze-workflow.json",
      content: JSON.stringify(cozeCanvas)
    });
    const report = createDoctorReportFromWorkflow(imported.workflow, "检查 Coze 工作流 token=SECRET_COZE_TOKEN_SHOULD_NOT_LEAK");
    const packet = createDoctorReviewPacket(report, "2026-06-25T00:00:00.000Z");
    const serialized = JSON.stringify(packet);

    expect(packet.source).toMatchObject({
      sourceKind: "coze-definition",
      sourcePlatform: "coze",
      sourceVersion: "direct-canvas",
      sourceLabel: "coze-workflow.json"
    });
    expect(parseDoctorReviewPacket(packet).source?.sourceKind).toBe("coze-definition");
    expect(serialized).not.toContain("sourceNodeID");
    expect(serialized).not.toContain("targetNodeID");
    expect(serialized).not.toContain("nodeMeta");
    expect(serialized).not.toContain("SECRET_COZE_TOKEN_SHOULD_NOT_LEAK");
    expect(serialized).not.toContain("SECRET_COZE_PROMPT_SHOULD_NOT_LEAK");
    expect(serialized).not.toContain("SECRET_COZE_SQL_SHOULD_NOT_LEAK");

    const aiInput = buildAiPatchProposalInput(report, {
      request: "检查 Coze 工作流 token=SECRET_COZE_TOKEN_SHOULD_NOT_LEAK"
    });
    const aiSerialized = JSON.stringify(aiInput);

    expect(aiSerialized).not.toContain("SECRET_COZE_TOKEN_SHOULD_NOT_LEAK");
    expect(aiSerialized).not.toContain("SECRET_COZE_PROMPT_SHOULD_NOT_LEAK");
    expect(aiSerialized).not.toContain("SECRET_COZE_SQL_SHOULD_NOT_LEAK");
  });
});
