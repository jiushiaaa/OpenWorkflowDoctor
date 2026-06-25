import { describe, expect, test } from "vitest";
import {
  createDoctorReportFromWorkflow,
  createDoctorReviewPacket,
  buildAiPatchProposalInput,
  difyDslSourceAdapter,
  diagnoseWorkflow,
  importDifyDslWorkflow,
  parseDoctorReviewPacket
} from "../src/index";

const minimalDifyDsl = `
kind: app
version: 0.6.0
app:
  name: Customer Support Bot
  description: Handles support questions.
  mode: workflow
workflow:
  environment_variables:
    - name: SERVICE_TOKEN
      type: secret
      value: sk-live-should-not-leak
  graph:
    nodes:
      - id: start
        data:
          title: User Input
          type: start
          variables:
            - variable: contract_file
              type: file
              default:
                name: contract.pdf
                upload_file_id: file-secret-id
                uploadedId: file-secret-id-camel
      - id: llm
        data:
          title: Answer Customer
          type: llm
          model:
            provider: openai
            name: gpt-4.1-mini
          headers:
            Authorization: Bearer token-should-not-leak
      - id: end
        data:
          title: End
          type: end
    edges:
      - id: start-llm
        source: start
        target: llm
        sourceHandle: source
        targetHandle: target
      - id: llm-end
        source: llm
        target: end
`;

describe("Dify DSL import", () => {
  test("exposes a lightweight WorkflowSourceAdapter contract", () => {
    expect(difyDslSourceAdapter).toMatchObject({
      id: "dify-dsl",
      label: "Dify DSL YAML",
      sourceKind: "dify-dsl"
    });
    expect(difyDslSourceAdapter.acceptsFile("workflow.yml", "")).toBe(true);
    expect(difyDslSourceAdapter.acceptsFile("workflow.yaml", "application/x-yaml")).toBe(true);
    expect(difyDslSourceAdapter.acceptsFile("workflow.json", "application/json")).toBe(false);
    expect(difyDslSourceAdapter.acceptsFile("workflow.txt", "application/x-yaml")).toBe(false);
  });

  test("imports a valid Dify DSL as secret-safe WorkflowIR with source metadata", () => {
    const imported = importDifyDslWorkflow({
      fileName: "support.yml",
      mimeType: "application/x-yaml",
      content: minimalDifyDsl
    });

    expect(imported.workflow).toMatchObject({
      name: "Customer Support Bot",
      source: {
        sourceKind: "dify-dsl",
        sourcePlatform: "dify",
        sourceVersion: "0.6.0",
        sourceAppMode: "workflow",
        app: {
          name: "Customer Support Bot",
          mode: "workflow",
          description: "Handles support questions."
        },
        nodeCount: 3,
        edgeCount: 2
      }
    });
    expect(imported.workflow.nodes.map((node) => [node.id, node.type, node.typeFamily])).toEqual([
      ["start", "dify.start", "known"],
      ["llm", "dify.llm", "known"],
      ["end", "dify.end", "known"]
    ]);
    expect(imported.workflow.edges).toContainEqual({
      id: "start-llm",
      sourceNodeId: "start",
      targetNodeId: "llm",
      sourceOutput: "source",
      sourceOutputIndex: 0,
      targetInput: "target"
    });
    expect(imported.metadata.sourceKind).toBe("dify-dsl");

    const serialized = JSON.stringify(imported);
    expect(serialized).toContain("[redacted]");
    expect(serialized).not.toContain("sk-live-should-not-leak");
    expect(serialized).not.toContain("token-should-not-leak");
    expect(serialized).not.toContain("file-secret-id");
    expect(serialized).not.toContain("file-secret-id-camel");
    expect(diagnoseWorkflow(imported.workflow).map((issue) => issue.id)).toContain(
      "dify_file_upload_id_reference:start"
    );
  });

  test("supports advanced-chat app mode while preserving WorkflowIR patch boundaries", () => {
    const imported = importDifyDslWorkflow({
      fileName: "chatflow.yaml",
      content: minimalDifyDsl.replace("mode: workflow", "mode: advanced-chat")
    });

    expect(imported.workflow.source?.sourceAppMode).toBe("advanced-chat");
    expect(imported.workflow.source?.parserWarnings).not.toContain("Unsupported Dify app mode: advanced-chat");
  });

  test("rejects malformed YAML and missing graph shape safely", () => {
    expect(() =>
      importDifyDslWorkflow({
        fileName: "broken.yml",
        content: "kind: app\nworkflow:\n  graph: ["
      })
    ).toThrow("Unable to parse Dify DSL YAML.");

    expect(() =>
      importDifyDslWorkflow({
        fileName: "missing-graph.yml",
        content: "kind: app\nversion: 0.6.0\napp:\n  name: Missing\nworkflow: {}\n"
      })
    ).toThrow("Dify DSL must include workflow.graph.nodes and workflow.graph.edges arrays.");
  });

  test("turns malformed or unknown Dify nodes into diagnostics instead of crashes", () => {
    const imported = importDifyDslWorkflow({
      fileName: "warnings.yml",
      content: `
kind: app
version: 9.9.0
app:
  name: Warning Workflow
  mode: agent-chat
workflow:
  graph:
    nodes:
      - data:
          title: Missing ID
          type: llm
      - id: mystery
        data:
          title: Mystery
          type: custom-future-node
      - id: mystery
        data:
          title: Duplicate
          type: code
          code: fetch("https://api.example.test?token=secret-token")
    edges:
      - source: mystery
        target: missing-target
`
    });

    expect(imported.workflow.nodes.map((node) => node.id)).toEqual(["dify-node-1", "mystery", "mystery-2"]);
    expect(imported.workflow.nodes.find((node) => node.id === "mystery")?.type).toBe("dify.unknown.custom-future-node");

    const issueIds = diagnoseWorkflow(imported.workflow).map((issue) => issue.id);
    expect(issueIds).toEqual(
      expect.arrayContaining([
        "dify_missing_node_id:dify-node-1",
        "dify_unknown_node_type:mystery",
        "dify_duplicate_node_id:mystery-2",
        "dify_edge_unknown_target:mystery:missing-target",
        "dify_code_node_present:mystery-2",
        "dify_code_node_unsafe_reference:mystery-2",
        "dify_unsupported_dsl_version",
        "dify_unsupported_app_mode"
      ])
    );
  });

  test("adds Dify-specific risk diagnostics for side effects, retrieval resources, and missing paths", () => {
    const imported = importDifyDslWorkflow({
      fileName: "risky.yml",
      content: `
kind: app
version: 0.6.0
app:
  name: Risky Dify
  mode: workflow
workflow:
  environment_variables:
    - name: API_SECRET
      type: secret
      value: plaintext
  graph:
    nodes:
      - id: branch
        data:
          title: Branch
          type: if-else
      - id: tool
        data:
          title: HTTP Tool
          type: tool
          provider_id: langgenius/http
      - id: knowledge
        data:
          title: Knowledge
          type: knowledge-retrieval
          dataset_ids:
            - dataset_private_id
    edges:
      - source: branch
        target: tool
        sourceHandle: true
`
    });

    const issueIds = diagnoseWorkflow(imported.workflow).map((issue) => issue.id);

    expect(issueIds).toEqual(
      expect.arrayContaining([
        "dify_secret_env_materialized:workflow",
        "dify_side_effect_node:tool",
        "dify_retrieval_external_resource:knowledge",
        "dify_missing_start_node",
        "dify_missing_terminal_node",
        "dify_condition_without_fallback:branch"
      ])
    );
  });

  test("records Dify source metadata in Review Packet without raw YAML or secrets", () => {
    const imported = importDifyDslWorkflow({
      fileName: "support.yml",
      content: minimalDifyDsl
    });
    const report = createDoctorReportFromWorkflow(imported.workflow, "检查 Dify 工作流风险");
    const packet = createDoctorReviewPacket(report, "2026-06-25T00:00:00.000Z");
    const serialized = JSON.stringify(packet);

    expect(packet.source).toMatchObject({
      sourceKind: "dify-dsl",
      sourcePlatform: "dify",
      sourceVersion: "0.6.0",
      sourceAppMode: "workflow",
      app: {
        name: "Customer Support Bot",
        mode: "workflow"
      }
    });
    expect(parseDoctorReviewPacket(packet).source?.sourceKind).toBe("dify-dsl");
    expect(serialized).not.toContain("kind: app");
    expect(serialized).not.toContain("sk-live-should-not-leak");
    expect(serialized).not.toContain("token-should-not-leak");

    const aiInput = buildAiPatchProposalInput(report, { request: "检查 Dify token=ai-secret" });
    const aiSerialized = JSON.stringify(aiInput);

    expect(aiSerialized).not.toContain("kind: app");
    expect(aiSerialized).not.toContain("sk-live-should-not-leak");
    expect(aiSerialized).not.toContain("token-should-not-leak");
    expect(aiSerialized).not.toContain("ai-secret");
  });

  test("keeps sentinel Dify secrets out of Review Packet and AI patch context", () => {
    const imported = importDifyDslWorkflow({
      fileName: "sentinel.yml",
      content: `
kind: app
version: 0.6.0
app:
  name: Sentinel Dify
  mode: workflow
workflow:
  environment_variables:
    - name: SENTINEL_SECRET
      type: secret
      value: SECRET_DIFY_ENV_VALUE_SHOULD_NOT_LEAK
  graph:
    nodes:
      - id: start
        data:
          title: Start
          type: start
          variables:
            - variable: upload
              type: file
              default:
                upload_file_id: SECRET_DIFY_UPLOAD_FILE_ID_SHOULD_NOT_LEAK
                uploadedId: SECRET_DIFY_UPLOAD_FILE_ID_SHOULD_NOT_LEAK
      - id: tool
        data:
          title: Tool
          type: tool
          headers:
            Authorization: Bearer SECRET_DIFY_AUTH_HEADER_SHOULD_NOT_LEAK
          url: https://api.example.test/resource?signature=SECRET_DIFY_SIGNED_URL_SHOULD_NOT_LEAK&safe=1
      - id: answer
        data:
          title: Answer
          type: answer
    edges:
      - source: start
        target: tool
      - source: tool
        target: answer
`
    });
    const report = createDoctorReportFromWorkflow(imported.workflow, "Check token=SECRET_DIFY_AUTH_HEADER_SHOULD_NOT_LEAK");
    const packet = createDoctorReviewPacket(report);
    const aiInput = buildAiPatchProposalInput(report, {
      request: "Check token=SECRET_DIFY_AUTH_HEADER_SHOULD_NOT_LEAK"
    });
    const serialized = JSON.stringify({ imported, packet, aiInput });

    expect(serialized).toContain("[redacted]");
    expect(serialized).not.toContain("SECRET_DIFY_ENV_VALUE_SHOULD_NOT_LEAK");
    expect(serialized).not.toContain("SECRET_DIFY_UPLOAD_FILE_ID_SHOULD_NOT_LEAK");
    expect(serialized).not.toContain("SECRET_DIFY_AUTH_HEADER_SHOULD_NOT_LEAK");
    expect(serialized).not.toContain("SECRET_DIFY_SIGNED_URL_SHOULD_NOT_LEAK");
  });
});
