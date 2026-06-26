import { describe, expect, test } from "vitest";
import {
  buildAiPatchProposalInput,
  createDoctorReportFromWorkflow,
  createDoctorReviewPacket,
  importWorkflowSourceArtifact,
  renderReviewPacketHtmlReport,
  renderReviewPacketMarkdownReport
} from "../src/index";

const sentinelN8n = JSON.stringify({
  name: "Report Sentinel <Workflow>",
  nodes: [
    {
      id: "webhook",
      name: "Webhook <Start>",
      type: "n8n-nodes-base.webhook",
      parameters: {
        path: "SECRET_REPORT_WEBHOOK_PATH_SHOULD_NOT_LEAK",
        headers: {
          Authorization: "Bearer SECRET_REPORT_AUTH_SHOULD_NOT_LEAK"
        }
      }
    }
  ],
  connections: {}
});

const difyYaml = `
kind: app
version: 0.6.0
app:
  name: Report Dify
  mode: workflow
workflow:
  environment_variables:
    - name: REPORT_SECRET
      type: secret
      value: SECRET_REPORT_DIFY_ENV_SHOULD_NOT_LEAK
  graph:
    nodes:
      - id: start
        data:
          title: Start
          type: start
      - id: answer
        data:
          title: Answer
          type: answer
    edges:
      - source: start
        target: answer
`;

const cozeJson = JSON.stringify({
  name: "Report Coze",
  nodes: [
    { id: "100001", type: "1", data: { nodeMeta: { title: "Start" } } },
    {
      id: "llm",
      type: "3",
      data: {
        nodeMeta: { title: "Answer" },
        inputs: {
          llmParam: [
            {
              name: "systemPrompt",
              input: { type: "string", value: { type: "literal", content: "SECRET_REPORT_COZE_PROMPT_SHOULD_NOT_LEAK" } }
            }
          ]
        }
      }
    },
    { id: "900001", type: "2", data: { nodeMeta: { title: "End" } } }
  ],
  edges: [{ sourceNodeID: "100001", targetNodeID: "llm" }]
});

const customGraphJson = JSON.stringify({
  name: "Report Custom",
  nodes: [
    { id: "start", name: "Start", type: "custom.start" },
    { id: "http", name: "Call API", type: "custom.http", parameters: { token: "SECRET_REPORT_CUSTOM_TOKEN_SHOULD_NOT_LEAK" } }
  ],
  edges: [{ id: "start-http", sourceNodeId: "start", targetNodeId: "http" }]
});

const sentinelValues = [
  "SECRET_REPORT_WEBHOOK_PATH_SHOULD_NOT_LEAK",
  "SECRET_REPORT_AUTH_SHOULD_NOT_LEAK",
  "SECRET_REPORT_DIFY_ENV_SHOULD_NOT_LEAK",
  "SECRET_REPORT_COZE_PROMPT_SHOULD_NOT_LEAK",
  "SECRET_REPORT_CUSTOM_TOKEN_SHOULD_NOT_LEAK",
  "SECRET_REPORT_REQUEST_SHOULD_NOT_LEAK"
];

const freezeAuditSentinelValues = [
  "SECRET_EXPORT_API_KEY_SHOULD_NOT_LEAK",
  "SECRET_EXPORT_COOKIE_SHOULD_NOT_LEAK",
  "SECRET_EXPORT_WEBHOOK_PATH_SHOULD_NOT_LEAK",
  "SECRET_EXPORT_SIGNED_URL_SHOULD_NOT_LEAK",
  "SECRET_EXPORT_PLUGIN_ID_SHOULD_NOT_LEAK",
  "SECRET_EXPORT_DATASET_ID_SHOULD_NOT_LEAK",
  "SECRET_EXPORT_FILE_ID_SHOULD_NOT_LEAK",
  "SECRET_EXPORT_PROMPT_SHOULD_NOT_LEAK",
  "SECRET_EXPORT_CODE_SHOULD_NOT_LEAK",
  "SECRET_EXPORT_SQL_SHOULD_NOT_LEAK",
  "SECRET_EXPORT_AI_PROVIDER_KEY_SHOULD_NOT_LEAK"
];

describe("Review Packet report exports", () => {
  test("renders Markdown with required review sections and adapter metadata", () => {
    const packet = packetFor("n8n.exportedJson", "workflow.json", sentinelN8n);
    const markdown = renderReviewPacketMarkdownReport(packet, {
      generatedAt: "2026-06-26T00:00:00.000Z"
    });

    expect(markdown).toContain("# Workflow Review Report");
    expect(markdown).toContain("## Executive Summary");
    expect(markdown).toContain("## Source Metadata");
    expect(markdown).toContain("## Trust Boundaries");
    expect(markdown).toContain("## Diagnostics");
    expect(markdown).toContain("## Patch Proposal");
    expect(markdown).toContain("## Patch Diff Summary");
    expect(markdown).toContain("## Verifier Result");
    expect(markdown).toContain("## Human Review");
    expect(markdown).toContain("## Appendix");
    expect(markdown).toContain("adapterId: `n8n.exportedJson`");
    expect(markdown).toContain("sourcePlatform: `n8n`");
    expect(markdown).toContain("Verifier status: `hold`");
    expect(markdown).toContain("Human review validation: `hold`");
    expect(markdown).toContain("Risk severity breakdown");
  });

  test("renders static HTML with escaped content and no external assets", () => {
    const packet = packetFor("n8n.exportedJson", "workflow.json", sentinelN8n);
    const html = renderReviewPacketHtmlReport(packet, {
      generatedAt: "2026-06-26T00:00:00.000Z"
    });

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<h1>Workflow Review Report</h1>");
    expect(html).toContain("Report Sentinel &lt;Workflow&gt;");
    expect(html).not.toContain("Report Sentinel <Workflow>");
    expect(html).not.toMatch(/<script\b/i);
    expect(html).not.toMatch(/\s(src|href)=["']https?:\/\//i);
    expect(html).not.toMatch(/<link\b/i);
    expect(html).toContain("<section id=\"trust-boundaries\">");
  });

  test("marks stale reports when the current fingerprint differs", () => {
    const packet = packetFor("n8n.exportedJson", "workflow.json", sentinelN8n);

    expect(
      renderReviewPacketMarkdownReport(packet, {
        currentReviewTargetFingerprint: "owd1-different"
      })
    ).toContain("Stale report warning");
    expect(
      renderReviewPacketHtmlReport(packet, {
        currentReviewTargetFingerprint: "owd1-different"
      })
    ).toContain("Report generated for previous source fingerprint");
  });

  test.each([
    ["n8n.exportedJson", "workflow.json", sentinelN8n, "n8n"],
    ["dify.dslYaml", "workflow.yml", difyYaml, "dify"],
    ["coze.definitionJson", "workflow.json", cozeJson, "coze"],
    ["custom.graphJson", "workflow.json", customGraphJson, "custom"]
  ])("exports reports for %s imports", (adapterId, fileName, content, platform) => {
    const packet = packetFor(adapterId, fileName, content);
    const markdown = renderReviewPacketMarkdownReport(packet);
    const html = renderReviewPacketHtmlReport(packet);

    expect(packet.source?.sourcePlatform).toBe(platform);
    expect(markdown).toContain(`sourcePlatform: \`${platform}\``);
    expect(html).toContain(platform);
  });

  test("keeps sentinel secrets out of JSON packet, Markdown, HTML, ReviewPacketArtifact, and AI patch input", () => {
    const imported = importWorkflowSourceArtifact({
      adapterId: "n8n.exportedJson",
      fileName: "workflow.json",
      content: sentinelN8n
    });
    const report = createDoctorReportFromWorkflow(
      imported.workflowIR,
      "Check token=SECRET_REPORT_REQUEST_SHOULD_NOT_LEAK"
    );
    const packet = createDoctorReviewPacket(report, "2026-06-26T00:00:00.000Z");
    const markdown = renderReviewPacketMarkdownReport(packet);
    const html = renderReviewPacketHtmlReport(packet);
    const aiInput = buildAiPatchProposalInput(report, {
      request: "Check token=SECRET_REPORT_REQUEST_SHOULD_NOT_LEAK"
    });
    const artifact = {
      schemaVersion: "openworkflowdoctor.review-packet-artifact.v1",
      packet
    };
    const serialized = JSON.stringify({ packet, markdown, html, artifact, aiInput });

    expect(serialized).toContain("[redacted]");
    for (const sentinel of sentinelValues) {
      expect(serialized).not.toContain(sentinel);
    }
  });

  test("keeps v0.9 freeze audit sentinel strings out of exported review surfaces", () => {
    const imported = importWorkflowSourceArtifact({
      adapterId: "n8n.exportedJson",
      fileName: "freeze-audit.json",
      content: JSON.stringify({
        name: "Freeze Audit",
        nodes: [
          {
            id: "webhook",
            name: "Webhook",
            type: "n8n-nodes-base.webhook",
            parameters: {
              apiKey: "SECRET_EXPORT_API_KEY_SHOULD_NOT_LEAK",
              cookie: "SECRET_EXPORT_COOKIE_SHOULD_NOT_LEAK",
              path: "SECRET_EXPORT_WEBHOOK_PATH_SHOULD_NOT_LEAK",
              signedUrl: "https://example.test/download?signature=SECRET_EXPORT_SIGNED_URL_SHOULD_NOT_LEAK",
              pluginId: "SECRET_EXPORT_PLUGIN_ID_SHOULD_NOT_LEAK",
              datasetId: "SECRET_EXPORT_DATASET_ID_SHOULD_NOT_LEAK",
              fileId: "SECRET_EXPORT_FILE_ID_SHOULD_NOT_LEAK",
              rawPrompt: "SECRET_EXPORT_PROMPT_SHOULD_NOT_LEAK",
              rawCode: "SECRET_EXPORT_CODE_SHOULD_NOT_LEAK",
              rawSql: "SECRET_EXPORT_SQL_SHOULD_NOT_LEAK"
            }
          }
        ],
        connections: {}
      })
    });
    const report = createDoctorReportFromWorkflow(
      imported.workflowIR,
      "Check provider key SECRET_EXPORT_AI_PROVIDER_KEY_SHOULD_NOT_LEAK"
    );
    const packet = createDoctorReviewPacket(report, "2026-06-26T00:00:00.000Z");
    const markdown = renderReviewPacketMarkdownReport(packet);
    const html = renderReviewPacketHtmlReport(packet);
    const artifact = {
      schemaVersion: "openworkflowdoctor.review-packet-artifact.v1",
      packet
    };
    const aiInput = buildAiPatchProposalInput(report, {
      request: "Check provider key SECRET_EXPORT_AI_PROVIDER_KEY_SHOULD_NOT_LEAK"
    });
    const serialized = JSON.stringify({ packet, markdown, html, artifact, aiInput });

    expect(serialized).toContain("[redacted]");
    for (const sentinel of freezeAuditSentinelValues) {
      expect(serialized).not.toContain(sentinel);
    }
  });
});

function packetFor(adapterId: string, fileName: string, content: string) {
  const imported = importWorkflowSourceArtifact({
    adapterId,
    fileName,
    content
  });
  const report = createDoctorReportFromWorkflow(imported.workflowIR, "Review reliability");
  return createDoctorReviewPacket(report, "2026-06-26T00:00:00.000Z");
}
