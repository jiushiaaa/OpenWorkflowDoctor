import { describe, expect, test } from "vitest";
import {
  buildAiPatchProposalInput,
  createDoctorReportFromWorkflow,
  createDoctorReviewPacket,
  importCozeDefinitionWorkflow,
  importDifyDslWorkflow,
  importN8nReadonlyWorkflow,
  importWorkflowSourceArtifact,
  renderReviewPacketHtmlReport,
  renderReviewPacketMarkdownReport
} from "../src/index";
import { assertNoSecuritySentinelLeak, v091SecuritySentinels } from "../../../tests/security-sentinel-helpers";

describe("v0.9.1 security boundary sentinels", () => {
  test("keeps final preflight sentinels out of IR, metadata, diagnostics, reports, and AI patch context", () => {
    const importedSources = [
      importWorkflowSourceArtifact({
        adapterId: "n8n.exportedJson",
        fileName: "v091-n8n.json",
        mimeType: "application/json",
        content: JSON.stringify({
          name: "v0.9.1 n8n",
          nodes: [
            {
              id: "webhook",
              name: "Webhook",
              type: "n8n-nodes-base.webhook",
              parameters: {
                apiKey: v091SecuritySentinels.apiKey,
                authorization: `Bearer ${v091SecuritySentinels.bearerToken}`,
                cookie: v091SecuritySentinels.cookie,
                password: v091SecuritySentinels.password,
                privateKey: v091SecuritySentinels.privateKey,
                path: v091SecuritySentinels.webhookPath,
                signedUrl: `https://example.test/download?signature=${v091SecuritySentinels.signedUrl}`,
                rawPrompt: v091SecuritySentinels.rawPrompt,
                rawCode: v091SecuritySentinels.rawCode,
                rawSql: v091SecuritySentinels.rawSql
              }
            }
          ],
          connections: {}
        })
      }).workflowIR,
      importN8nReadonlyWorkflow({
        id: "readonly-workflow",
        name: "v0.9.1 n8n read-only",
        versionId: "readonly-version",
        nodes: [
          {
            id: "readonly-webhook",
            name: "Read-only Webhook",
            type: "n8n-nodes-base.webhook",
            parameters: {
              n8nApiKey: v091SecuritySentinels.n8nApiKey,
              webhookPath: v091SecuritySentinels.webhookPath
            }
          }
        ],
        connections: {}
      }).workflow,
      importDifyDslWorkflow({
        fileName: "v091-dify.yml",
        content: `
kind: app
version: 0.6.0
app:
  name: v0.9.1 Dify
  mode: workflow
workflow:
  environment_variables:
    - name: DIFY_SECRET
      type: secret
      value: ${v091SecuritySentinels.difySecretEnv}
  graph:
    nodes:
      - id: start
        data:
          title: Start
          type: start
      - id: tool
        data:
          title: Tool
          type: tool
          plugin_id: ${v091SecuritySentinels.pluginId}
          dataset_id: ${v091SecuritySentinels.datasetId}
          file_id: ${v091SecuritySentinels.fileId}
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
      }).workflow,
      importCozeDefinitionWorkflow({
        fileName: "v091-coze.json",
        content: JSON.stringify({
          name: "v0.9.1 Coze",
          nodes: [
            { id: "start", type: "1", data: { nodeMeta: { title: "Start" } } },
            {
              id: "plugin",
              type: "4",
              data: {
                nodeMeta: { title: "Plugin" },
                inputs: {
                  plugin_id: v091SecuritySentinels.pluginId,
                  dataset_id: v091SecuritySentinels.datasetId,
                  file_id: v091SecuritySentinels.fileId,
                  workspace_id: v091SecuritySentinels.workspaceId,
                  app_id: v091SecuritySentinels.appId,
                  bot_id: v091SecuritySentinels.botId,
                  org_id: v091SecuritySentinels.orgId,
                  tenant_id: v091SecuritySentinels.tenantId,
                  user_id: v091SecuritySentinels.userId,
                  rawPayload: v091SecuritySentinels.cozeRawPayload
                }
              }
            },
            { id: "end", type: "2", data: { nodeMeta: { title: "End" } } }
          ],
          edges: [{ sourceNodeID: "start", targetNodeID: "plugin" }]
        })
      }).workflow,
      importWorkflowSourceArtifact({
        adapterId: "custom.graphJson",
        fileName: "v091-custom.json",
        mimeType: "application/json",
        content: JSON.stringify({
          name: "v0.9.1 Custom Graph",
          sourceMetadata: {
            workspaceId: v091SecuritySentinels.workspaceId,
            appId: v091SecuritySentinels.appId,
            botId: v091SecuritySentinels.botId,
            orgId: v091SecuritySentinels.orgId,
            tenantId: v091SecuritySentinels.tenantId,
            userId: v091SecuritySentinels.userId
          },
          nodes: [
            {
              id: "start",
              name: "Start",
              type: "custom.start",
              parameters: {
                customGraphSensitiveContent: v091SecuritySentinels.customGraphSensitiveContent
              }
            }
          ],
          edges: []
        })
      }).workflowIR
    ];

    const artifacts = importedSources.map((workflow, index) => {
      const report = createDoctorReportFromWorkflow(
        workflow,
        `Review with provider key ${v091SecuritySentinels.aiProviderKey}`
      );
      const packet = createDoctorReviewPacket(report, "2026-06-26T00:00:00.000Z");
      return {
        workflow,
        source: workflow.source,
        diagnostics: workflow.source?.diagnostics ?? [],
        packet,
        markdown: renderReviewPacketMarkdownReport(packet),
        html: renderReviewPacketHtmlReport(packet),
        aiPatchInput: buildAiPatchProposalInput(report, {
          request: `Review with provider key ${v091SecuritySentinels.aiProviderKey}`
        }),
        reviewPacketArtifact: {
          schemaVersion: "openworkflowdoctor.review-packet-artifact.v1",
          id: `artifact-${index}`,
          workflowDocumentId: `document-${index}`,
          reviewTargetFingerprint: packet.reviewTargetFingerprint,
          label: "v0.9.1 preflight",
          createdAt: "2026-06-26T00:00:00.000Z",
          packet
        }
      };
    });

    expect(JSON.stringify(artifacts)).toContain("[redacted]");
    assertNoSecuritySentinelLeak(artifacts);
  });
});
