import { useMemo } from "react";
import { buildWorkflowExplanationInput, type WorkflowExplanationInput } from "@openworkflowdoctor/workflow-ai";
import {
  buildAiPatchProposalInput,
  createAiPatchDoctorReport,
  createDoctorReportFromWorkflow,
  createDoctorReviewPacket,
  createWorkflowViewModel,
  renderReviewPacketHtmlReport,
  renderReviewPacketMarkdownReport,
  validateAiPatchProposalCandidate,
  type AiPatchProposalCandidate,
  type DoctorReviewPacket,
  type HumanReview,
  type HumanReviewDecision
} from "@openworkflowdoctor/workflow-ir";
import { toRequestProviderSettings, type AiProviderSettings } from "../lib/settings";
import {
  createEmptyAiPatchProposalState,
  createEmptyHumanReview,
  createReviewPacketArtifact,
  type ReviewPacketArtifact,
  type WorkflowDocument
} from "../lib/workspace-store";
import { emptyIssues, getStepStatuses, type ConsoleTab } from "../components/workbench-shared";
import type { AiPatchProposalApiResult } from "../api/ai/patch/route";

const defaultRequest =
  "帮我修复支付和通知相关风险，优先补 webhook 去重和退款幂等性。";

export type ReviewReportDownloadKind = "json" | "markdown" | "html";

export type ReviewReportDownload = {
  filename: string;
  mimeType: string;
  body: string;
};

export function deriveDoctorReviewState(
  activeDocument: WorkflowDocument | null,
  activeReviewPacketArtifacts: ReviewPacketArtifact[]
) {
  const workflowInput = activeDocument?.originalWorkflowIr ?? null;
  const report = activeDocument?.latestReport ?? null;
  const request = activeDocument?.currentRequest ?? defaultRequest;
  const selectedNodeId = activeDocument?.selectedNodeId ?? null;
  const reviewMode = activeDocument?.reviewMode ?? "original";
  const activeTab = activeDocument?.activeTab ?? "summary";
  const isReportStale = activeDocument?.latestReportState === "stale";
  const humanReview = normalizeHumanReview(activeDocument?.humanReviewDraft);
  const humanDecision = humanReview.decision;
  const humanReviewNote = activeDocument?.humanReviewDraft.reviewerNote ?? "";
  const confirmedChecklistItemIds = activeDocument?.humanReviewDraft.confirmedChecklistItemIds ?? [];
  const reviewPacket = report ? createDoctorReviewPacket(report, undefined, humanReview) : null;
  const reportExportOptions = reviewPacket
    ? {
        currentReviewTargetFingerprint: isReportStale
          ? `stale-${reviewPacket.reviewTargetFingerprint}`
          : reviewPacket.reviewTargetFingerprint
      }
    : undefined;
  const reviewReportMarkdown = reviewPacket
    ? renderReviewPacketMarkdownReport(reviewPacket, reportExportOptions)
    : null;
  const reviewReportHtml = reviewPacket
    ? renderReviewPacketHtmlReport(reviewPacket, reportExportOptions)
    : null;
  const aiInput: WorkflowExplanationInput | null = report ? buildWorkflowExplanationInput(report) : null;
  const aiPatchProposalInput = report ? buildAiPatchProposalInput(report, { request }) : null;
  const aiPatchProposalState = activeDocument?.aiPatchProposalState ?? createEmptyAiPatchProposalState();
  const aiPatchValidation =
    report && aiPatchProposalInput && aiPatchProposalState.candidate
      ? validateAiPatchProposalCandidate(aiPatchProposalInput, report.workflow, aiPatchProposalState.candidate)
      : null;
  const requiredChecklistItems =
    reviewPacket?.acceptanceChecklist.filter((item) => item.status !== "pass") ?? [];
  const missingChecklistItemIds = requiredChecklistItems
    .filter((item) => !confirmedChecklistItemIds.includes(item.id))
    .map((item) => item.id);
  const canAcceptHumanReview =
    Boolean(report) && report?.verification.status !== "fail" && missingChecklistItemIds.length === 0;
  const humanReviewAccepted =
    reviewPacket?.humanReview.decision === "accepted" &&
    reviewPacket.humanReviewValidation.status === "pass";
  const currentPacketArtifact = reviewPacket
    ? activeReviewPacketArtifacts.find(
        (artifact) => artifact.reviewTargetFingerprint === reviewPacket.reviewTargetFingerprint
      )
    : null;
  const activeWorkflow =
    report && reviewMode === "patched"
      ? report.patchedWorkflow
      : report?.workflow ?? workflowInput;
  const activeSummary =
    report && reviewMode === "patched" ? report.patchedSummary : report?.summary ?? null;
  const activeIssues = report
    ? reviewMode === "patched"
      ? report.patchedIssues
      : report.issues
    : emptyIssues;
  const activeView = activeWorkflow
    ? report && reviewMode === "patched"
      ? report.patchedView
      : report?.view ?? createWorkflowViewModel(activeWorkflow, [])
    : null;
  const stepStatuses = getStepStatuses({
    hasWorkflow: Boolean(workflowInput),
    hasReport: Boolean(report),
    hasPatchPreview: reviewMode === "patched",
    hasVerification: Boolean(report?.verification),
    hasHumanReview: humanDecision !== "undecided",
    canExport: Boolean(humanReviewAccepted)
  });

  return {
    workflowInput,
    report,
    request,
    selectedNodeId,
    reviewMode,
    activeTab,
    isReportStale,
    humanReview,
    humanDecision,
    humanReviewNote,
    confirmedChecklistItemIds,
    reviewPacket,
    reviewReportMarkdown,
    reviewReportHtml,
    aiInput,
    aiPatchProposalInput,
    aiPatchProposalState,
    aiPatchValidation,
    requiredChecklistItems,
    missingChecklistItemIds,
    canAcceptHumanReview,
    humanReviewAccepted,
    currentPacketArtifact,
    activeWorkflow,
    activeSummary,
    activeIssues,
    activeView,
    stepStatuses
  };
}

export function useDoctorReviewController({
  activeDocument,
  activeReviewPacketArtifacts,
  updateActiveDocument,
  saveReviewPacketArtifact,
  loadWorkspaceSnapshot,
  setError,
  onReviewChanged
}: {
  activeDocument: WorkflowDocument | null;
  activeReviewPacketArtifacts: ReviewPacketArtifact[];
  updateActiveDocument: (updater: (document: WorkflowDocument) => WorkflowDocument) => void;
  saveReviewPacketArtifact: (artifact: ReviewPacketArtifact) => Promise<void>;
  loadWorkspaceSnapshot: (nextActiveDocumentId?: string | null) => Promise<void>;
  setError: (error: string | null) => void;
  onReviewChanged: () => void;
}) {
  const state = useMemo(
    () => deriveDoctorReviewState(activeDocument, activeReviewPacketArtifacts),
    [activeDocument, activeReviewPacketArtifacts]
  );

  function updatePatchRequest(nextRequest: string) {
    updateActiveDocument((document) => ({
      ...document,
      currentRequest: nextRequest,
      latestReportState: document.latestReport ? "stale" : document.latestReportState,
      aiPatchProposalState:
        document.aiPatchProposalState.status === "idle"
          ? document.aiPatchProposalState
          : {
              ...document.aiPatchProposalState,
              status: "stale"
            }
    }));
  }

  function updateActiveTab(nextTab: ConsoleTab) {
    updateActiveDocument((document) => ({
      ...document,
      activeTab: nextTab
    }));
  }

  function updateSelectedNodeId(nodeId: string | null) {
    updateActiveDocument((document) => ({
      ...document,
      selectedNodeId: nodeId
    }));
  }

  function updateHumanReviewNote(note: string) {
    updateActiveDocument((document) => ({
      ...document,
      humanReviewDraft: {
        ...document.humanReviewDraft,
        reviewerNote: note
      }
    }));
  }

  function rerunDoctor() {
    if (!activeDocument) {
      return;
    }

    const nextReport = createDoctorReportFromWorkflow(activeDocument.originalWorkflowIr, activeDocument.currentRequest);
    updateActiveDocument((document) => ({
      ...document,
      latestReport: nextReport,
      latestReportState: "ready",
      reviewMode: "original",
      activeTab: "risks",
      selectedNodeId: nextReport.view.nodes[0]?.id ?? null,
      humanReviewDraft: createEmptyHumanReview(),
      aiPatchProposalState: createEmptyAiPatchProposalState()
    }));
    onReviewChanged();
    setError(null);
  }

  async function generateAiPatchProposal(settings: AiProviderSettings) {
    if (!state.aiPatchProposalInput || !state.report) {
      return;
    }
    const inputFingerprint = state.aiPatchProposalInput.inputFingerprint;

    if (!settings.enabled || settings.apiKey.trim().length === 0) {
      updateActiveDocument((document) => ({
        ...document,
        aiPatchProposalState: {
          status: "provider_unavailable",
          safeError: settings.enabled ? "No AI provider configured." : "AI provider is disabled.",
          inputFingerprint
        }
      }));
      return;
    }

    updateActiveDocument((document) => ({
      ...document,
      aiPatchProposalState: {
        status: "generating",
        inputFingerprint
      }
    }));

    try {
      const response = await fetch("/api/ai/patch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          input: state.aiPatchProposalInput,
          provider: toRequestProviderSettings(settings)
        })
      });

      if (!response.ok) {
        throw new Error(`AI patch proposal request failed with ${response.status}`);
      }

      const result = (await response.json()) as AiPatchProposalApiResult;
      if (result.source !== "ai") {
        throw new Error(result.unavailableReason);
      }

      const validation = validateAiPatchProposalCandidate(state.aiPatchProposalInput, state.report.workflow, result.candidate);
      updateActiveDocument((document) => ({
        ...document,
        aiPatchProposalState: {
          status: validation.canPreview ? "ready" : "conflict",
          candidate: result.candidate,
          generatedAt: result.candidate.createdAt,
          inputFingerprint: result.candidate.inputFingerprint,
          ...(validation.canPreview ? {} : { safeError: "AI proposal has blocking conflicts." })
        }
      }));
    } catch (error) {
      updateActiveDocument((document) => ({
        ...document,
        aiPatchProposalState: {
          status: "error",
          safeError: error instanceof Error ? error.message : "AI patch proposal failed.",
          inputFingerprint
        }
      }));
    }
  }

  function previewAiPatchProposal() {
    if (!state.report || !state.aiPatchProposalInput || !state.aiPatchProposalState.candidate) {
      return;
    }

    const nextReport = createAiPatchDoctorReport(
      state.report,
      state.aiPatchProposalInput,
      state.aiPatchProposalState.candidate as AiPatchProposalCandidate
    );
    updateActiveDocument((document) => ({
      ...document,
      latestReport: nextReport,
      latestReportState: "ready",
      reviewMode: "patched",
      activeTab: "verification",
      selectedNodeId: nextReport.patchedView.nodes[0]?.id ?? null,
      humanReviewDraft: createEmptyHumanReview()
    }));
    onReviewChanged();
    setError(null);
  }

  function previewPatchedIr() {
    if (!state.report) {
      return;
    }

    updateActiveDocument((document) => ({
      ...document,
      reviewMode: "patched",
      activeTab: "verification",
      selectedNodeId: state.report?.patchedView.nodes[0]?.id ?? null
    }));
  }

  async function exportReviewPacket(kind: ReviewReportDownloadKind = "json") {
    if (!state.reviewPacket || !state.report || !activeDocument) {
      return;
    }

    const download = createReviewReportDownload(kind, state.report.workflow.name, state.reviewPacket, {
      currentReviewTargetFingerprint: state.isReportStale
        ? `stale-${state.reviewPacket.reviewTargetFingerprint}`
        : state.reviewPacket.reviewTargetFingerprint
    });
    downloadText(download);

    const artifact = createReviewPacketArtifact({
      workflowDocumentId: activeDocument.id,
      packet: state.reviewPacket,
      exportedAt: new Date().toISOString()
    });
    await saveReviewPacketArtifact(artifact);
    await loadWorkspaceSnapshot(activeDocument.id);
  }

  function exportPatchedWorkflowIr() {
    if (!state.report) {
      return;
    }

    downloadJson(`${slugify(state.report.workflow.name)}-patched-workflow-ir.json`, {
      schemaVersion: "openworkflowdoctor.workflow-ir.v1",
      workflow: state.report.patchedWorkflow,
      verification: state.report.verification,
      acceptanceRecommendation: state.report.acceptanceRecommendation,
      humanReview: state.humanReview
    });
  }

  function backToOriginal() {
    if (!state.report) {
      return;
    }

    updateActiveDocument((document) => ({
      ...document,
      reviewMode: "original",
      selectedNodeId: state.report?.view.nodes[0]?.id ?? null
    }));
  }

  function recordHumanDecision(decision: HumanReviewDecision) {
    updateActiveDocument((document) => ({
      ...document,
      humanReviewDraft:
        decision === "undecided"
          ? {
              decision,
              reviewerNote: document.humanReviewDraft.reviewerNote,
              confirmedChecklistItemIds: document.humanReviewDraft.confirmedChecklistItemIds
            }
          : {
              ...document.humanReviewDraft,
              decision,
              decidedAt: new Date().toISOString()
            }
    }));
  }

  function toggleChecklistConfirmation(itemId: string) {
    updateActiveDocument((document) => {
      const current = document.humanReviewDraft.confirmedChecklistItemIds;
      return {
        ...document,
        humanReviewDraft: {
          ...document.humanReviewDraft,
          confirmedChecklistItemIds: current.includes(itemId)
            ? current.filter((currentId) => currentId !== itemId)
            : [...current, itemId]
        }
      };
    });
  }

  return {
    ...state,
    updatePatchRequest,
    updateActiveTab,
    updateSelectedNodeId,
    updateHumanReviewNote,
    rerunDoctor,
    generateAiPatchProposal,
    previewPatchedIr,
    previewAiPatchProposal,
    exportReviewPacket,
    exportPatchedWorkflowIr,
    backToOriginal,
    recordHumanDecision,
    toggleChecklistConfirmation
  };
}

export function createReviewReportDownload(
  kind: ReviewReportDownloadKind,
  workflowName: string,
  packet: DoctorReviewPacket,
  options = {}
): ReviewReportDownload {
  const slug = slugify(workflowName);

  switch (kind) {
    case "json":
      return {
        filename: `${slug}-review-packet.json`,
        mimeType: "application/json",
        body: `${JSON.stringify(packet, null, 2)}\n`
      };
    case "markdown":
      return {
        filename: `${slug}-review-report.md`,
        mimeType: "text/markdown",
        body: renderReviewPacketMarkdownReport(packet, options)
      };
    case "html":
      return {
        filename: `${slug}-review-report.html`,
        mimeType: "text/html",
        body: renderReviewPacketHtmlReport(packet, options)
      };
  }
}

function normalizeHumanReview(draft: HumanReview | undefined): HumanReview {
  const humanReview = draft ?? createEmptyHumanReview();

  return {
    ...humanReview,
    reviewerNote: humanReview.reviewerNote.trim(),
    confirmedChecklistItemIds: humanReview.decision === "accepted" ? humanReview.confirmedChecklistItemIds : []
  };
}

function downloadText(download: ReviewReportDownload) {
  const blob = new Blob([download.body], {
    type: download.mimeType
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = download.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadJson(filename: string, value: unknown) {
  downloadText({
    filename,
    mimeType: "application/json",
    body: `${JSON.stringify(value, null, 2)}\n`
  });
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "workflow";
}
