import { describe, expect, test } from "vitest";
import {
  builtInWorkflowSourceAdapters,
  getWorkflowSourceAdapter,
  importWorkflowSourceArtifact,
  runWorkflowSourceAdapterConformance,
  createDoctorReportFromWorkflow,
  createDoctorReviewPacket,
  buildAiPatchProposalInput
} from "../src/index";

const sentinelN8nWorkflow = JSON.stringify({
  name: "Adapter Sentinel",
  nodes: [
    {
      id: "webhook",
      name: "Webhook",
      type: "n8n-nodes-base.webhook",
      parameters: {
        path: "SECRET_N8N_WEBHOOK_PATH_SHOULD_NOT_LEAK",
        headers: {
          Authorization: "Bearer SECRET_N8N_AUTH_SHOULD_NOT_LEAK"
        }
      }
    }
  ],
  connections: {}
});

describe("WorkflowSourceAdapter framework", () => {
  test("registers built-in source adapters with stable v0.8 metadata", () => {
    expect(builtInWorkflowSourceAdapters.map((adapter) => adapter.adapterId)).toEqual([
      "n8n.exportedJson",
      "n8n.readonlyImport",
      "dify.dslYaml",
      "coze.definitionJson",
      "custom.graphJson"
    ]);

    expect(getWorkflowSourceAdapter("n8n.exportedJson")).toMatchObject({
      adapterId: "n8n.exportedJson",
      label: "n8n Exported JSON",
      sourceKind: "n8n-exported-json",
      sourcePlatform: "n8n",
      importMethod: "file-upload",
      stability: "stable"
    });
    expect(getWorkflowSourceAdapter("dify.dslYaml")?.acceptedInputs.extensions).toEqual([".yml", ".yaml"]);
    expect(getWorkflowSourceAdapter("coze.definitionJson")?.stability).toBe("best-effort");
    expect(getWorkflowSourceAdapter("custom.graphJson")?.capabilities).toContain("manual-artifact");
  });

  test("imports a selected adapter through the unified artifact pipeline", () => {
    const result = importWorkflowSourceArtifact({
      adapterId: "n8n.exportedJson",
      fileName: "sentinel.json",
      mimeType: "application/json",
      content: sentinelN8nWorkflow
    });

    expect(result.adapterInfo).toMatchObject({
      adapterId: "n8n.exportedJson",
      sourceKind: "n8n-exported-json",
      sourcePlatform: "n8n",
      importMethod: "file-upload",
      stability: "stable"
    });
    expect(result.workflowIR.source).toMatchObject({
      adapterId: "n8n.exportedJson",
      sourceKind: "n8n-exported-json",
      sourcePlatform: "n8n",
      importMethod: "file-upload"
    });
    expect(result.importFingerprint).toMatch(/^owd-import-/);

    const serialized = JSON.stringify(result);
    expect(serialized).toContain("[redacted]");
    expect(serialized).not.toContain("SECRET_N8N_WEBHOOK_PATH_SHOULD_NOT_LEAK");
    expect(serialized).not.toContain("SECRET_N8N_AUTH_SHOULD_NOT_LEAK");
  });

  test("fails closed before creating sanitized output when file guardrails fail", () => {
    expect(() =>
      importWorkflowSourceArtifact({
        adapterId: "n8n.exportedJson",
        fileName: "workflow.txt",
        mimeType: "text/plain",
        content: sentinelN8nWorkflow
      })
    ).toThrow("n8n Exported JSON import does not accept workflow.txt.");
  });

  test("keeps adapter metadata and sentinel secrets safe across Review Packet and AI context", () => {
    const result = importWorkflowSourceArtifact({
      adapterId: "n8n.exportedJson",
      fileName: "sentinel.json",
      mimeType: "application/json",
      content: sentinelN8nWorkflow
    });
    const report = createDoctorReportFromWorkflow(
      result.workflowIR,
      "Check token=SECRET_N8N_AUTH_SHOULD_NOT_LEAK"
    );
    const packet = createDoctorReviewPacket(report);
    const aiInput = buildAiPatchProposalInput(report, {
      request: "Check token=SECRET_N8N_AUTH_SHOULD_NOT_LEAK"
    });
    const serialized = JSON.stringify({ packet, aiInput });

    expect(packet.source).toMatchObject({
      adapterId: "n8n.exportedJson",
      sourceKind: "n8n-exported-json",
      sourcePlatform: "n8n",
      importMethod: "file-upload",
      stability: "stable"
    });
    expect(serialized).not.toContain("SECRET_N8N_WEBHOOK_PATH_SHOULD_NOT_LEAK");
    expect(serialized).not.toContain("SECRET_N8N_AUTH_SHOULD_NOT_LEAK");
  });

  test("provides a shared adapter conformance test kit result for built-in adapters", () => {
    const result = runWorkflowSourceAdapterConformance({
      adapterId: "n8n.exportedJson",
      validInput: {
        fileName: "sentinel.json",
        mimeType: "application/json",
        content: sentinelN8nWorkflow
      },
      malformedInput: {
        fileName: "broken.json",
        mimeType: "application/json",
        content: "{"
      },
      sentinelSecrets: [
        "SECRET_N8N_WEBHOOK_PATH_SHOULD_NOT_LEAK",
        "SECRET_N8N_AUTH_SHOULD_NOT_LEAK"
      ]
    });

    expect(result.status).toBe("pass");
    expect(result.checks.map((check) => check.id)).toEqual(
      expect.arrayContaining([
        "malformed_input_creates_no_document",
        "raw_input_not_stored",
        "sentinel_secrets_do_not_leak",
        "review_packet_records_source_metadata",
        "parser_warnings_preserved",
        "redaction_summary_records_sanitization"
      ])
    );
  });
});
