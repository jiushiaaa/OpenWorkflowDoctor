import {
  createDoctorReviewPacket,
  type DoctorReport,
  type HumanReviewDecision,
  type RiskIssue,
  type WorkflowIR
} from "@openworkflowdoctor/workflow-ir";
import type { WorkflowExplanation, WorkflowExplanationResult } from "@openworkflowdoctor/workflow-ai";
import type { Translator } from "../lib/i18n";
import type { ReviewMode } from "../lib/workspace-store";
import { VerificationPanel } from "./VerificationPanel";
import {
  consoleTabIds,
  DiffList,
  getConsoleTabLabel,
  getSeverityLabel,
  IssueDeltaList,
  IssueList,
  KeyValue,
  Metric,
  statusLabels,
  type AiExplainerStatus,
  type ConsoleTab
} from "./workbench-shared";

export function ReviewConsole({
  activeTab,
  activeSummary,
  activeIssues,
  activeWorkflow,
  report,
  reviewMode,
  reviewPacket,
  requiredChecklistItems,
  confirmedChecklistItemIds,
  canAcceptHumanReview,
  humanDecision,
  humanReviewNote,
  aiResult,
  aiStatus,
  aiError,
  t,
  onTabChange,
  onGenerateAiExplanation,
  onPreviewPatchedIr,
  onBackToOriginal,
  onToggleChecklistConfirmation,
  onRecordHumanDecision,
  onHumanReviewNoteChange,
  onExportReviewPacket,
  onExportPatchedWorkflowIr
}: {
  activeTab: ConsoleTab;
  activeSummary: DoctorReport["summary"] | null;
  activeIssues: RiskIssue[];
  activeWorkflow: WorkflowIR | null;
  report: DoctorReport | null;
  reviewMode: ReviewMode;
  reviewPacket: ReturnType<typeof createDoctorReviewPacket> | null;
  requiredChecklistItems: NonNullable<ReturnType<typeof createDoctorReviewPacket>>["acceptanceChecklist"];
  confirmedChecklistItemIds: string[];
  canAcceptHumanReview: boolean;
  humanDecision: HumanReviewDecision;
  humanReviewNote: string;
  aiResult: WorkflowExplanationResult | null;
  aiStatus: AiExplainerStatus;
  aiError: string | null;
  t: Translator;
  onTabChange: (tab: ConsoleTab) => void;
  onGenerateAiExplanation: () => void;
  onPreviewPatchedIr: () => void;
  onBackToOriginal: () => void;
  onToggleChecklistConfirmation: (itemId: string) => void;
  onRecordHumanDecision: (decision: HumanReviewDecision) => void;
  onHumanReviewNoteChange: (note: string) => void;
  onExportReviewPacket: () => void;
  onExportPatchedWorkflowIr: () => void;
}) {
  return (
    <section className="review-console" aria-label="Review Console">
      <div className="tab-list" role="tablist" aria-label="Review Console tabs">
        {consoleTabIds.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => onTabChange(tab)}
          >
            {getConsoleTabLabel(tab, t)}
          </button>
        ))}
      </div>

      <div className="tab-panel" role="tabpanel">
        {activeTab === "summary" ? (
          <SummaryTab summary={activeSummary} workflow={activeWorkflow} report={report} t={t} />
        ) : null}
        {activeTab === "risks" ? <RisksTab issues={activeIssues} report={report} t={t} /> : null}
        {activeTab === "ai" ? (
          <AiExplainerTab
            report={report}
            result={aiResult}
            status={aiStatus}
            error={aiError}
            t={t}
            onGenerate={onGenerateAiExplanation}
          />
        ) : null}
        {activeTab === "patch" ? (
          <PatchDiffTab
            report={report}
            reviewMode={reviewMode}
            t={t}
            onPreviewPatchedIr={onPreviewPatchedIr}
            onBackToOriginal={onBackToOriginal}
          />
        ) : null}
        {activeTab === "verification" ? (
          <VerificationPanel
            report={report}
            reviewPacket={reviewPacket}
            requiredChecklistItems={requiredChecklistItems}
            confirmedChecklistItemIds={confirmedChecklistItemIds}
            canAcceptHumanReview={canAcceptHumanReview}
            humanDecision={humanDecision}
            humanReviewNote={humanReviewNote}
            t={t}
            onToggleChecklistConfirmation={onToggleChecklistConfirmation}
            onRecordHumanDecision={onRecordHumanDecision}
            onHumanReviewNoteChange={onHumanReviewNoteChange}
          />
        ) : null}
        {activeTab === "packet" ? (
          <ReviewPacketTab
            report={report}
            reviewPacket={reviewPacket}
            reviewMode={reviewMode}
            t={t}
            onExportReviewPacket={onExportReviewPacket}
            onExportPatchedWorkflowIr={onExportPatchedWorkflowIr}
          />
        ) : null}
        {activeTab === "logs" ? (
          <LogsTab workflow={activeWorkflow} report={report} reviewMode={reviewMode} t={t} />
        ) : null}
      </div>
    </section>
  );
}

function SummaryTab({
  summary,
  workflow,
  report,
  t
}: {
  summary: DoctorReport["summary"] | null;
  workflow: WorkflowIR | null;
  report: DoctorReport | null;
  t: Translator;
}) {
  if (!workflow) {
    return <p className="empty-text">{t("summary.importPrompt")}</p>;
  }

  return (
    <div className="console-grid console-grid--summary">
      <section>
        <h3>{t("summary.title")}</h3>
        <p className="panel-lead">
          {summary?.overview ??
            `${workflow.name} ${t("summary.pending")}`}
        </p>
      </section>
      <KeyValue label={t("summary.entryNodes")} value={summary?.entryNodes.join(", ") || t("summary.notDiagnosed")} />
      <KeyValue label={t("summary.terminalNodes")} value={summary?.terminalNodes.join(", ") || t("summary.notDiagnosed")} />
      <KeyValue label={t("summary.sideEffects")} value={summary?.sideEffectNodes.join(", ") || t("summary.notDiagnosed")} />
      <KeyValue
        label={t("summary.patchModel")}
        value={report ? t("summary.patchModelReady") : t("summary.patchModelPending")}
      />
    </div>
  );
}

function RisksTab({ issues, report, t }: { issues: RiskIssue[]; report: DoctorReport | null; t: Translator }) {
  if (!report) {
    return <p className="empty-text">{t("risks.pending")}</p>;
  }

  return (
    <div className="problems-panel">
      <div className="console-toolbar">
        <div>
          <h3>{t("risks.title")}</h3>
          <p>{t("risks.description")}</p>
        </div>
        <strong>{issues.length} {t("risks.count")}</strong>
      </div>
      <IssueList issues={issues} t={t} />
    </div>
  );
}

function AiExplainerTab({
  report,
  result,
  status,
  error,
  t,
  onGenerate
}: {
  report: DoctorReport | null;
  result: WorkflowExplanationResult | null;
  status: AiExplainerStatus;
  error: string | null;
  t: Translator;
  onGenerate: () => void;
}) {
  if (!report) {
    return <p className="empty-text">{t("ai.pending")}</p>;
  }

  const sourceLabel = result?.source === "ai" ? t("ai.aiAdvisory") : t("ai.deterministicFallback");
  const explanation: WorkflowExplanation | null = result?.explanation ?? null;

  return (
    <div className="console-stack" aria-label="AI explainer">
      <div className="console-toolbar">
        <div>
          <h3>{t("ai.title")}</h3>
          <p>{t("ai.advisory")}</p>
        </div>
        <div className="console-actions">
          <button type="button" onClick={onGenerate} disabled={status === "loading"}>
            {status === "loading" ? t("actions.generating") : t("actions.generateExplanation")}
          </button>
        </div>
      </div>

      <p className="callout callout--hold">
        {t("ai.safeInput")} {t("ai.localKeyNotice")}
      </p>

      {status === "idle" ? (
        <p className="empty-text">{t("ai.idle")}</p>
      ) : null}
      {status === "loading" ? (
        <p className="empty-text">{t("ai.loading")}</p>
      ) : null}
      {result?.unavailableReason ? (
        <p className="review-warning">{t("ai.unavailable")} {result.unavailableReason}</p>
      ) : null}
      {error ? <p className="error-text">{error}</p> : null}

      {explanation ? (
        <>
          <section className="verification-summary" aria-label="AI explanation source">
            <Metric label={t("ai.source")} value={sourceLabel} />
            <KeyValue label={t("ai.purpose")} value={explanation.workflowPurpose} />
          </section>

          <section>
            <h3>{t("ai.highRiskPaths")}</h3>
            <ul className="compact-list">
              {explanation.highRiskPaths.map((path) => (
                <li key={`${path.title}:${path.relatedIssueIds.join(",")}`}>
                  <strong>{path.title}</strong>
                  <small>{path.explanation}</small>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3>{t("ai.criticalIssues")}</h3>
            <ul className="compact-list">
              {explanation.criticalIssueExplanations.map((issue) => (
                <li key={issue.issueId}>
                  <span className={`severity severity--${issue.severity}`}>
                    {getSeverityLabel(issue.severity, t)}
                  </span>
                  <strong>{issue.title}</strong>
                  <small>{issue.whyItMatters}</small>
                  <small>{issue.humanCheck}</small>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3>{t("ai.reviewerChecks")}</h3>
            <ul className="compact-list">
              {explanation.reviewerChecklist.map((item) => (
                <li key={item}>
                  <small>{item}</small>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}

function PatchDiffTab({
  report,
  reviewMode,
  t,
  onPreviewPatchedIr,
  onBackToOriginal
}: {
  report: DoctorReport | null;
  reviewMode: ReviewMode;
  t: Translator;
  onPreviewPatchedIr: () => void;
  onBackToOriginal: () => void;
}) {
  if (!report) {
    return <p className="empty-text">{t("patch.pending")}</p>;
  }

  return (
    <div className="console-stack">
      <div className="console-toolbar">
        <div>
          <h3>{t("patch.title")}</h3>
          <p>{t("patch.description")}</p>
        </div>
        <div className="console-actions">
          <button
            type="button"
            onClick={onPreviewPatchedIr}
            disabled={reviewMode === "patched" || report.proposal.operations.length === 0}
          >
            {t("patch.previewLocal")}
          </button>
          <button type="button" className="secondary-button" onClick={onBackToOriginal}>
            {t("patch.original")}
          </button>
        </div>
      </div>
      <h3>{t("patch.operationList")}</h3>
      <p className="panel-lead">{report.proposal.summary}</p>
      <DiffList diff={report.patchDiff} t={t} />
    </div>
  );
}

function ReviewPacketTab({
  report,
  reviewPacket,
  reviewMode,
  t,
  onExportReviewPacket,
  onExportPatchedWorkflowIr
}: {
  report: DoctorReport | null;
  reviewPacket: ReturnType<typeof createDoctorReviewPacket> | null;
  reviewMode: ReviewMode;
  t: Translator;
  onExportReviewPacket: () => void;
  onExportPatchedWorkflowIr: () => void;
}) {
  if (!report || !reviewPacket) {
    return <p className="empty-text">{t("packet.pending")}</p>;
  }

  return (
    <div className="console-stack">
      <div className="console-toolbar">
        <div>
          <h3>{t("packet.artifactPreview")}</h3>
          <p>{t("packet.description")}</p>
        </div>
        <div className="console-actions">
          <button type="button" onClick={onExportReviewPacket}>
            {t("actions.exportReviewPacket")}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={onExportPatchedWorkflowIr}
            disabled={reviewMode !== "patched" || report.proposal.operations.length === 0}
          >
            {t("actions.exportPatchedWorkflowIr")}
          </button>
        </div>
      </div>
      <div className="fingerprint-block">
        <small>{t("packet.targetFingerprint")}</small>
        <code>{reviewPacket.reviewTargetFingerprint}</code>
      </div>
      <div className="console-grid">
        <IssueDeltaList title={t("packet.resolved")} issueIds={reviewPacket.issueDelta.resolvedIssueIds} t={t} />
        <IssueDeltaList title={t("packet.remaining")} issueIds={reviewPacket.issueDelta.remainingIssueIds} t={t} />
        <IssueDeltaList title={t("packet.introduced")} issueIds={reviewPacket.issueDelta.introducedIssueIds} t={t} />
      </div>
    </div>
  );
}

function LogsTab({
  workflow,
  report,
  reviewMode,
  t
}: {
  workflow: WorkflowIR | null;
  report: DoctorReport | null;
  reviewMode: ReviewMode;
  t: Translator;
}) {
  const logs = [
    workflow ? `${workflow.name} ${t("logs.importedSuffix")}` : t("logs.waiting"),
    report ? t("logs.diagnosticsDone") : t("logs.notRun"),
    report ? `${report.proposal.operations.length} ${t("logs.operationsSuffix")}` : t("logs.noPatch"),
    report ? `${t("logs.verifierPrefix")} ${statusLabels[report.verification.status]}.` : t("logs.verifierNotRun"),
    reviewMode === "patched"
      ? t("logs.patchedVisible")
      : t("logs.originalVisible")
  ];

  return (
    <ul className="log-list">
      {logs.map((log) => (
        <li key={log}>{log}</li>
      ))}
    </ul>
  );
}
