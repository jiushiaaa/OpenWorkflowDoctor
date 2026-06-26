import { createDoctorReport, type HumanReview, type WorkflowIR } from "@openworkflowdoctor/workflow-ir";
import { describe, expect, test } from "vitest";
import type { ReviewPacketArtifact, WorkflowDocument } from "../lib/workspace-store";
import { createReviewReportDownload, deriveDoctorReviewState } from "./useDoctorReviewController";

const workflow: WorkflowIR = {
  name: "Tiny Workflow",
  nodes: [
    {
      id: "start",
      name: "Start",
      type: "n8n-nodes-base.manualTrigger",
      typeFamily: "known",
      parameters: []
    }
  ],
  edges: []
};

function createDocument(overrides: Partial<WorkflowDocument> = {}): WorkflowDocument {
  return {
    schemaVersion: "openworkflowdoctor.workflow-document.v1",
    id: "workflow-1",
    displayName: "Tiny Workflow",
    sourceKind: "sample",
    sourceLabel: "tiny.json",
    importedAt: "2026-06-24T00:00:00.000Z",
    updatedAt: "2026-06-24T00:00:00.000Z",
    originalWorkflowIr: workflow,
    currentRequest: "检查风险",
    latestReportState: "not-run",
    humanReviewDraft: {
      decision: "undecided",
      reviewerNote: "  keep only trimmed note in exported review  ",
      confirmedChecklistItemIds: ["patch_has_operations"]
    },
    reviewMode: "original",
    activeTab: "summary",
    selectedNodeId: "start",
    reviewPacketArtifactIds: [],
    aiPatchProposalState: { status: "idle" },
    ...overrides
  };
}

describe("deriveDoctorReviewState", () => {
  test("keeps dirty review notes out of exported human review state", () => {
    const state = deriveDoctorReviewState(createDocument(), []);

    expect(state.humanReview).toEqual<HumanReview>({
      decision: "undecided",
      reviewerNote: "keep only trimmed note in exported review",
      confirmedChecklistItemIds: []
    });
    expect(state.humanReviewNote).toBe("  keep only trimmed note in exported review  ");
  });

  test("does not allow human review acceptance to override failed verifier gates", () => {
    const report = createDoctorReport({ name: "Broken", nodes: "bad", connections: null }, "检查风险");
    const state = deriveDoctorReviewState(
      createDocument({
        latestReport: report,
        latestReportState: "ready",
        humanReviewDraft: {
          decision: "accepted",
          reviewerNote: "Trying to accept a failed verifier result.",
          decidedAt: "2026-06-24T00:01:00.000Z",
          confirmedChecklistItemIds: ["patch_has_operations", "workflow_has_nodes"]
        }
      }),
      []
    );

    expect(state.canAcceptHumanReview).toBe(false);
    expect(state.reviewPacket?.humanReviewValidation.status).toBe("fail");
  });

  test("matches the current packet artifact per active workflow fingerprint", () => {
    const report = createDoctorReport({ name: "Broken", nodes: "bad", connections: null }, "检查风险");
    const state = deriveDoctorReviewState(createDocument({ latestReport: report, latestReportState: "ready" }), []);
    const matchingArtifact: ReviewPacketArtifact = {
      schemaVersion: "openworkflowdoctor.review-packet-artifact.v1",
      id: "packet-1",
      workflowDocumentId: "workflow-1",
      reviewTargetFingerprint: state.reviewPacket?.reviewTargetFingerprint ?? "missing",
      label: "Tiny Workflow packet",
      createdAt: "2026-06-24T00:02:00.000Z",
      exportedAt: "2026-06-24T00:03:00.000Z",
      packet: state.reviewPacket!
    };

    expect(deriveDoctorReviewState(createDocument({ latestReport: report, latestReportState: "ready" }), [matchingArtifact]).currentPacketArtifact?.id).toBe("packet-1");
  });

  test("marks generated report previews stale when the active document report is stale", () => {
    const report = createDoctorReport({ name: "Broken", nodes: "bad", connections: null }, "检查风险");
    const state = deriveDoctorReviewState(
      createDocument({
        latestReport: report,
        latestReportState: "stale"
      }),
      []
    );

    expect(state.reviewReportMarkdown).toContain("Stale report warning");
    expect(state.reviewReportHtml).toContain("Report generated for previous source fingerprint");
  });

  test("creates JSON, Markdown, and HTML review report download descriptors", () => {
    const report = createDoctorReport({ name: "Download Workflow", nodes: "bad", connections: null }, "检查风险");
    const packet = deriveDoctorReviewState(
      createDocument({
        latestReport: report,
        latestReportState: "ready"
      }),
      []
    ).reviewPacket!;

    expect(createReviewReportDownload("json", "Download Workflow", packet).filename).toBe(
      "download-workflow-review-packet.json"
    );
    expect(createReviewReportDownload("markdown", "Download Workflow", packet)).toMatchObject({
      filename: "download-workflow-review-report.md",
      mimeType: "text/markdown"
    });
    expect(createReviewReportDownload("html", "Download Workflow", packet)).toMatchObject({
      filename: "download-workflow-review-report.html",
      mimeType: "text/html"
    });
  });
});
