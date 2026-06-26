import { describe, expect, test } from "vitest";
import {
  buildAiPatchProposalInput,
  createDoctorReportFromWorkflow,
  createDoctorReviewPacket,
  diagnoseWorkflow,
  importCustomGraphJsonWorkflow,
  importWorkflowSourceArtifact,
  parseDoctorReviewPacket
} from "../src/index";

const customGraph = {
  name: "Support Escalation",
  sourceMetadata: {
    workspaceId: "SECRET_CUSTOM_WORKSPACE_ID_SHOULD_NOT_LEAK",
    appId: "SECRET_CUSTOM_APP_ID_SHOULD_NOT_LEAK",
    exportedBy: "support-admin"
  },
  nodes: [
    {
      id: "start",
      label: "Start",
      type: "trigger",
      configSummary: {
        webhookPath: "SECRET_CUSTOM_WEBHOOK_PATH_SHOULD_NOT_LEAK"
      }
    },
    {
      id: "llm",
      name: "Draft Reply",
      category: "llm",
      description: "Uses prompt SECRET_CUSTOM_PROMPT_SHOULD_NOT_LEAK",
      configSummary: {
        rawPrompt: "SECRET_CUSTOM_PROMPT_SHOULD_NOT_LEAK",
        Authorization: "Bearer SECRET_CUSTOM_TOKEN_SHOULD_NOT_LEAK"
      }
    },
    {
      id: "sql",
      label: "Update Ticket",
      type: "database",
      nodeConfigSummary: {
        rawSql: "UPDATE tickets SET token = 'SECRET_CUSTOM_SQL_SHOULD_NOT_LEAK'"
      }
    }
  ],
  edges: [
    {
      source: "start",
      target: "llm",
      label: "main"
    },
    {
      from: "llm",
      to: "missing",
      conditionSummary: "fallback"
    }
  ]
};

describe("Custom Graph JSON import", () => {
  test("imports declarative graph JSON into secret-safe WorkflowIR", () => {
    const imported = importCustomGraphJsonWorkflow({
      fileName: "support-workflow.json",
      mimeType: "application/json",
      content: JSON.stringify(customGraph)
    });

    expect(imported.workflow).toMatchObject({
      name: "Support Escalation",
      source: {
        adapterId: "custom.graphJson",
        sourceKind: "custom-graph-json",
        sourcePlatform: "custom",
        importMethod: "manual-artifact",
        stability: "experimental",
        sourceLabel: "support-workflow.json",
        nodeCount: 3,
        edgeCount: 1
      }
    });
    expect(imported.workflow.nodes.map((node) => [node.id, node.type, node.typeFamily])).toEqual([
      ["start", "custom.trigger", "known"],
      ["llm", "custom.llm", "known"],
      ["sql", "custom.database", "known"]
    ]);
    expect(imported.workflow.edges).toEqual([
      {
        id: "start:main:0:llm:0",
        sourceNodeId: "start",
        targetNodeId: "llm",
        sourceOutput: "main",
        sourceOutputIndex: 0
      }
    ]);
    expect(imported.metadata.diagnostics.map((diagnostic) => diagnostic.code)).toContain("custom_graph_broken_edge");

    const serialized = JSON.stringify(imported);
    expect(serialized).toContain("[redacted]");
    expect(serialized).toContain("rawPromptPresent");
    expect(serialized).toContain("rawSqlPresent");
    expect(serialized).not.toContain("SECRET_CUSTOM_WORKSPACE_ID_SHOULD_NOT_LEAK");
    expect(serialized).not.toContain("SECRET_CUSTOM_APP_ID_SHOULD_NOT_LEAK");
    expect(serialized).not.toContain("SECRET_CUSTOM_WEBHOOK_PATH_SHOULD_NOT_LEAK");
    expect(serialized).not.toContain("SECRET_CUSTOM_PROMPT_SHOULD_NOT_LEAK");
    expect(serialized).not.toContain("SECRET_CUSTOM_TOKEN_SHOULD_NOT_LEAK");
    expect(serialized).not.toContain("SECRET_CUSTOM_SQL_SHOULD_NOT_LEAK");
  });

  test("rejects malformed custom graph JSON and duplicate node ids safely", () => {
    expect(() =>
      importCustomGraphJsonWorkflow({
        fileName: "broken.json",
        content: "{"
      })
    ).toThrow("Unable to parse Custom Graph JSON.");

    expect(() =>
      importCustomGraphJsonWorkflow({
        fileName: "missing.json",
        content: JSON.stringify({ nodes: [] })
      })
    ).toThrow("Custom Graph JSON must include name, nodes, and edges.");

    expect(() =>
      importCustomGraphJsonWorkflow({
        fileName: "duplicate.json",
        content: JSON.stringify({
          name: "Duplicate",
          nodes: [
            { id: "same", label: "A", type: "task" },
            { id: "same", label: "B", type: "task" }
          ],
          edges: []
        })
      })
    ).toThrow("Custom Graph JSON contains duplicate node id same.");
  });

  test("flows through the unified adapter pipeline and downstream diagnostics", () => {
    const result = importWorkflowSourceArtifact({
      adapterId: "custom.graphJson",
      fileName: "support-workflow.json",
      mimeType: "application/json",
      content: JSON.stringify(customGraph)
    });
    const issueIds = diagnoseWorkflow(result.workflowIR).map((issue) => issue.id);

    expect(result.adapterInfo.adapterId).toBe("custom.graphJson");
    expect(issueIds).toContain("custom_graph_broken_edge:llm:missing");
  });

  test("records Custom Graph source metadata in Review Packet without raw JSON or secrets", () => {
    const imported = importCustomGraphJsonWorkflow({
      fileName: "support-workflow.json",
      content: JSON.stringify(customGraph)
    });
    const report = createDoctorReportFromWorkflow(
      imported.workflow,
      "Review SECRET_CUSTOM_TOKEN_SHOULD_NOT_LEAK"
    );
    const packet = createDoctorReviewPacket(report);
    const aiInput = buildAiPatchProposalInput(report, {
      request: "Review SECRET_CUSTOM_TOKEN_SHOULD_NOT_LEAK"
    });
    const serialized = JSON.stringify({ packet, aiInput });

    expect(parseDoctorReviewPacket(packet).source).toMatchObject({
      adapterId: "custom.graphJson",
      sourceKind: "custom-graph-json",
      sourcePlatform: "custom",
      importMethod: "manual-artifact"
    });
    expect(serialized).not.toContain("SECRET_CUSTOM_WORKSPACE_ID_SHOULD_NOT_LEAK");
    expect(serialized).not.toContain("SECRET_CUSTOM_TOKEN_SHOULD_NOT_LEAK");
    expect(serialized).not.toContain("SECRET_CUSTOM_SQL_SHOULD_NOT_LEAK");
  });
});
