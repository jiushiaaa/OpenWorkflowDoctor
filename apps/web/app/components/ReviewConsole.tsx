import {
  createDoctorReviewPacket,
  type AiPatchProposalValidationResult,
  type DoctorReport,
  type HumanReviewDecision,
  type RiskIssue,
  type WorkflowIR
} from "@openworkflowdoctor/workflow-ir";
import type { WorkflowExplanation, WorkflowExplanationResult } from "@openworkflowdoctor/workflow-ai";
import type { Translator } from "../lib/i18n";
import type { AiPatchProposalState, ReviewMode } from "../lib/workspace-store";
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
  reviewReportMarkdown,
  reviewReportHtml,
  isReportStale,
  requiredChecklistItems,
  confirmedChecklistItemIds,
  canAcceptHumanReview,
  humanDecision,
  humanReviewNote,
  aiResult,
  aiStatus,
  aiError,
  aiPatchProposalState,
  aiPatchValidation,
  t,
  onTabChange,
  onGenerateAiExplanation,
  onGenerateAiPatchProposal,
  onPreviewPatchedIr,
  onPreviewAiPatchProposal,
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
  reviewReportMarkdown: string | null;
  reviewReportHtml: string | null;
  isReportStale: boolean;
  requiredChecklistItems: NonNullable<ReturnType<typeof createDoctorReviewPacket>>["acceptanceChecklist"];
  confirmedChecklistItemIds: string[];
  canAcceptHumanReview: boolean;
  humanDecision: HumanReviewDecision;
  humanReviewNote: string;
  aiResult: WorkflowExplanationResult | null;
  aiStatus: AiExplainerStatus;
  aiError: string | null;
  aiPatchProposalState: AiPatchProposalState;
  aiPatchValidation: AiPatchProposalValidationResult | null;
  t: Translator;
  onTabChange: (tab: ConsoleTab) => void;
  onGenerateAiExplanation: () => void;
  onGenerateAiPatchProposal: () => void;
  onPreviewPatchedIr: () => void;
  onPreviewAiPatchProposal: () => void;
  onBackToOriginal: () => void;
  onToggleChecklistConfirmation: (itemId: string) => void;
  onRecordHumanDecision: (decision: HumanReviewDecision) => void;
  onHumanReviewNoteChange: (note: string) => void;
  onExportReviewPacket: (kind: "json" | "markdown" | "html") => void;
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
            aiPatchProposalState={aiPatchProposalState}
            aiPatchValidation={aiPatchValidation}
            t={t}
            onGenerateAiPatchProposal={onGenerateAiPatchProposal}
            onPreviewPatchedIr={onPreviewPatchedIr}
            onPreviewAiPatchProposal={onPreviewAiPatchProposal}
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
            reviewReportMarkdown={reviewReportMarkdown}
            reviewReportHtml={reviewReportHtml}
            isReportStale={isReportStale}
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
  aiPatchProposalState,
  aiPatchValidation,
  t,
  onGenerateAiPatchProposal,
  onPreviewPatchedIr,
  onPreviewAiPatchProposal,
  onBackToOriginal
}: {
  report: DoctorReport | null;
  reviewMode: ReviewMode;
  aiPatchProposalState: AiPatchProposalState;
  aiPatchValidation: AiPatchProposalValidationResult | null;
  t: Translator;
  onGenerateAiPatchProposal: () => void;
  onPreviewPatchedIr: () => void;
  onPreviewAiPatchProposal: () => void;
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
      <section className="verification-summary" aria-label="AI-assisted patch proposal">
        <div className="console-toolbar">
          <div>
            <h3>{t("patch.aiTitle")}</h3>
            <p>{t("patch.aiAdvisory")}</p>
          </div>
          <div className="console-actions">
            <button type="button" onClick={onGenerateAiPatchProposal} disabled={aiPatchProposalState.status === "generating"}>
              {aiPatchProposalState.status === "generating" ? t("actions.generating") : t("actions.generateAiPatch")}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={onPreviewAiPatchProposal}
              disabled={
                reviewMode === "patched" ||
                !aiPatchProposalState.candidate ||
                aiPatchProposalState.status === "stale" ||
                aiPatchValidation?.canPreview !== true
              }
            >
              {t("patch.previewAi")}
            </button>
          </div>
        </div>
        <div className="console-grid">
          <Metric label={t("ai.source")} value={t("patch.aiBadge")} />
          <Metric label={t("verification.status")} value={aiPatchProposalState.status} />
          <KeyValue label={t("patch.inputFingerprint")} value={aiPatchProposalState.inputFingerprint ?? t("packet.none")} />
        </div>
        {aiPatchProposalState.safeError ? <p className="error-text">{aiPatchProposalState.safeError}</p> : null}
        {aiPatchProposalState.status === "stale" ? <p className="review-warning">{t("patch.aiStale")}</p> : null}
        {aiPatchProposalState.candidate ? (
          <>
            <p className="panel-lead">{aiPatchProposalState.candidate.proposal.summary}</p>
            <ul className="compact-list">
              {aiPatchProposalState.candidate.proposal.operations.map((operation, index) => (
                <li key={`${operation.type}:${operation.targetNodeId}:${index}`}>
                  <strong>{operation.type}</strong>
                  <small>{operation.targetNodeId}</small>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="empty-text">{t("patch.aiIdle")}</p>
        )}
        {aiPatchValidation?.conflicts.length ? (
          <section>
            <h3>{t("patch.conflicts")}</h3>
            <ul className="compact-list">
              {aiPatchValidation.conflicts.map((conflict) => (
                <li key={conflict.id}>
                  <strong>{conflict.severity}: {conflict.code}</strong>
                  <small>{conflict.explanation}</small>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {aiPatchProposalState.candidate?.safetyNotes.length ? (
          <section>
            <h3>{t("patch.safetyNotes")}</h3>
            <ul className="compact-list">
              {aiPatchProposalState.candidate.safetyNotes.map((note) => (
                <li key={note}>
                  <small>{note}</small>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </section>
    </div>
  );
}

function ReviewPacketTab({
  report,
  reviewPacket,
  reviewReportMarkdown,
  reviewReportHtml,
  isReportStale,
  reviewMode,
  t,
  onExportReviewPacket,
  onExportPatchedWorkflowIr
}: {
  report: DoctorReport | null;
  reviewPacket: ReturnType<typeof createDoctorReviewPacket> | null;
  reviewReportMarkdown: string | null;
  reviewReportHtml: string | null;
  isReportStale: boolean;
  reviewMode: ReviewMode;
  t: Translator;
  onExportReviewPacket: (kind: "json" | "markdown" | "html") => void;
  onExportPatchedWorkflowIr: () => void;
}) {
  if (!report || !reviewPacket) {
    return (
      <div className="console-stack">
        <p className="empty-text">{t("packet.pending")}</p>
        <ul className="compact-list">
          <li><small>{t("packet.emptyDiagnostics")}</small></li>
          <li><small>{t("packet.emptyPatch")}</small></li>
          <li><small>{t("packet.emptyVerifier")}</small></li>
          <li><small>{t("packet.emptyHumanReview")}</small></li>
        </ul>
      </div>
    );
  }

  return (
    <div className="console-stack report-preview">
      <div className="console-toolbar">
        <div>
          <h3>{t("packet.reportPreview")}</h3>
          <p>{t("packet.reportDescription")}</p>
        </div>
        <div className="console-actions">
          <button type="button" onClick={() => onExportReviewPacket("json")}>
            {t("actions.exportJsonReviewPacket")}
          </button>
          <button type="button" onClick={() => onExportReviewPacket("markdown")}>
            {t("actions.exportMarkdownReport")}
          </button>
          <button type="button" onClick={() => onExportReviewPacket("html")}>
            {t("actions.exportHtmlReport")}
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
      {isReportStale ? <p className="review-warning">{t("packet.stale")}</p> : null}

      <section className="report-section" aria-label={t("packet.overview")}>
        <div className="section-title-row">
          <div>
            <span>{t("packet.overview")}</span>
            <h3>{reviewPacket.workflowName}</h3>
          </div>
        </div>
        <div className="console-grid">
          <Metric label={t("toolbar.metrics.risks")} value={String(totalRiskCount(reviewPacket))} />
          <Metric label={t("verification.status")} value={statusLabels[reviewPacket.verification.status]} tone={reviewPacket.verification.status} />
          <Metric label={t("packet.humanReviewState")} value={reviewPacket.humanReviewValidation.status.toUpperCase()} tone={reviewPacket.humanReviewValidation.status} />
        </div>
      </section>

      <section className="report-section" aria-label={t("packet.risksSection")}>
        <h3>{t("packet.risksSection")}</h3>
        <div className="severity-row">
          {(["critical", "high", "medium", "low"] as const).map((severity) => (
            <span key={severity} className={`severity severity--${severity}`}>
              {getSeverityLabel(severity, t)} {reviewPacket.riskDelta.before[severity]}
            </span>
          ))}
        </div>
        <IssueList issues={reviewPacket.original.issues.slice(0, 5)} t={t} emptyLabel={t("packet.noRisks")} />
      </section>

      <section className="report-section" aria-label={t("packet.patchSection")}>
        <h3>{t("packet.patchSection")}</h3>
        <p className="panel-lead">{reviewPacket.patch.proposal.summary}</p>
        <div className="console-grid">
          <Metric label={t("toolbar.metrics.patchOps")} value={String(reviewPacket.patch.proposal.operations.length)} />
          <KeyValue
            label={t("packet.aiProvenance")}
            value={reviewPacket.patch.proposalSource?.kind === "ai-assisted" ? t("patch.aiBadge") : t("packet.deterministic")}
          />
          <KeyValue
            label={t("packet.conflictStatus")}
            value={reviewPacket.patch.proposalSource?.validation?.conflictStatus ?? t("packet.none")}
          />
        </div>
      </section>

      <section className="report-section" aria-label={t("packet.verifierSection")}>
        <h3>{t("packet.verifierSection")}</h3>
        <ul className="compact-list">
          {reviewPacket.verification.checkedGates.map((gate) => (
            <li key={gate.id}>
              <span className={`status status--${gate.status}`}>{statusLabels[gate.status]}</span>
              <strong>{gate.title}</strong>
              <small>{gate.explanation}</small>
            </li>
          ))}
        </ul>
      </section>

      <section className="report-section" aria-label={t("packet.humanReviewSection")}>
        <h3>{t("packet.humanReviewSection")}</h3>
        <div className="console-grid">
          <KeyValue label={t("verification.status")} value={reviewPacket.humanReviewValidation.status} />
          <KeyValue label={t("packet.reviewerDecision")} value={reviewPacket.humanReview.decision} />
          <KeyValue
            label={t("packet.unresolvedItems")}
            value={reviewPacket.humanReviewValidation.missingChecklistItemIds.join(", ") || t("packet.none")}
          />
        </div>
      </section>

      <section className="report-section" aria-label={t("packet.sourceMetadataSection")}>
        <h3>{t("packet.sourceMetadataSection")}</h3>
        <div className="console-grid">
          <KeyValue label="sourcePlatform" value={reviewPacket.source?.sourcePlatform ?? t("packet.none")} />
          <KeyValue label="sourceKind" value={reviewPacket.source?.sourceKind ?? t("packet.none")} />
          <KeyValue label="adapterId" value={reviewPacket.source?.adapterId ?? t("packet.none")} />
          <KeyValue label="importMethod" value={reviewPacket.source?.importMethod ?? t("packet.none")} />
          <KeyValue label="stability" value={reviewPacket.source?.stability ?? t("packet.none")} />
          <KeyValue
            label="redactionSummary"
            value={
              reviewPacket.source
                ? `${reviewPacket.source.redactionSummary.redactedValueCount} ${t("packet.redactedValues")}`
                : t("packet.none")
            }
          />
        </div>
      </section>

      <div className="console-grid">
        <IssueDeltaList title={t("packet.resolved")} issueIds={reviewPacket.issueDelta.resolvedIssueIds} t={t} />
        <IssueDeltaList title={t("packet.remaining")} issueIds={reviewPacket.issueDelta.remainingIssueIds} t={t} />
        <IssueDeltaList title={t("packet.introduced")} issueIds={reviewPacket.issueDelta.introducedIssueIds} t={t} />
      </div>
      <section className="report-section" aria-label={t("packet.exportSection")}>
        <h3>{t("packet.exportSection")}</h3>
        <div className="report-artifact-grid">
          <details>
            <summary>{t("packet.markdownPreview")}</summary>
            <pre>{reviewReportMarkdown}</pre>
          </details>
          <details>
            <summary>{t("packet.htmlPreview")}</summary>
            <pre>{reviewReportHtml}</pre>
          </details>
          <details>
            <summary>{t("packet.rawJson")}</summary>
            <pre>{JSON.stringify(reviewPacket, null, 2)}</pre>
          </details>
        </div>
      </section>
    </div>
  );
}

function totalRiskCount(reviewPacket: ReturnType<typeof createDoctorReviewPacket>): number {
  return Object.values(reviewPacket.riskDelta.before).reduce((total, count) => total + count, 0);
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
