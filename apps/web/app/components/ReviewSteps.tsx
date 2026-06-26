import type { RefObject } from "react";
import type {
  DoctorReport,
  HumanReviewDecision,
  VerificationStatus,
  WorkflowIR,
  WorkflowSourceAdapter,
  WorkflowSourceMetadata
} from "@openworkflowdoctor/workflow-ir";
import type { Translator } from "../lib/i18n";
import type { SampleWorkflowCatalogItem } from "../lib/sample-workflows";
import type { ReviewMode } from "../lib/workspace-store";
import { WorkflowExplorer, type WorkflowExplorerItem } from "./WorkflowExplorer";
import {
  getHumanDecisionLabel,
  KeyValue,
  reviewStepKeys,
  statusLabels
} from "./workbench-shared";

export function ReviewSteps({
  fileInputRef,
  workflows,
  samples,
  workspaceLoaded,
  workflowInput,
  report,
  reviewMode,
  reviewTargetFingerprint,
  packetExportStatus,
  primaryActionLabel,
  stepStatuses,
  request,
  isReportStale,
  error,
  humanDecision,
  sourceKind,
  sourceLabel,
  sourceMetadata,
  supportedSources,
  t,
  onImportFile,
  onImportClick,
  onImportN8nClick,
  onLoadSample,
  onSelectWorkflow,
  onPrimaryAction,
  onRequestChange,
  onRunDoctor,
  onRefreshN8n
}: {
  fileInputRef: RefObject<HTMLInputElement | null>;
  workflows: WorkflowExplorerItem[];
  samples: SampleWorkflowCatalogItem[];
  workspaceLoaded: boolean;
  workflowInput: WorkflowIR | null;
  report: DoctorReport | null;
  reviewMode: ReviewMode;
  reviewTargetFingerprint: string | null;
  packetExportStatus: string;
  primaryActionLabel: string;
  stepStatuses: string[];
  request: string;
  isReportStale: boolean;
  error: string | null;
  humanDecision: HumanReviewDecision;
  sourceKind?: string | undefined;
  sourceLabel?: string | undefined;
  sourceMetadata?: WorkflowSourceMetadata | undefined;
  supportedSources: WorkflowSourceAdapter[];
  t: Translator;
  onImportFile: (file: File | undefined) => void;
  onImportClick: (adapterId?: string) => void;
  onImportN8nClick: () => void;
  onLoadSample: (sample: SampleWorkflowCatalogItem) => void;
  onSelectWorkflow: (workflowDocumentId: string) => void;
  onPrimaryAction: () => void;
  onRequestChange: (request: string) => void;
  onRunDoctor: () => void;
  onRefreshN8n: () => void;
}) {
  return (
    <aside className="review-steps" aria-label={t("sidebar.reviewSteps")}>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json,.yml,.yaml,application/x-yaml,text/yaml"
        onChange={(event) => onImportFile(event.target.files?.[0])}
      />

      <WorkflowExplorer
        workflows={workflows}
        samples={samples}
        importableSources={supportedSources.filter((source) =>
          source.capabilities.some((capability) => capability === "file-upload" || capability === "manual-artifact")
        )}
        t={t}
        onImportClick={onImportClick}
        onImportN8nClick={onImportN8nClick}
        onLoadSample={onLoadSample}
        onSelectWorkflow={onSelectWorkflow}
      />

      <section className="workflow-card" aria-label={t("sidebar.reviewTarget")}>
        <span>{t("app.version")}</span>
        <h2>{t("sidebar.reviewTarget")}</h2>
        <span>{t("sidebar.workflowName")}</span>
        <h1>{workflowInput?.name ?? (workspaceLoaded ? "OpenWorkflowDoctor" : t("workspace.loading"))}</h1>
        {sourceMetadata ? (
          <div className="source-badge">
            <strong>{sourceMetadata.sourcePlatform} · {sourceMetadata.sourceKind}</strong>
            <span>{sourceLabel}</span>
            <span>{sourceMetadata.importMethod} · {sourceMetadata.stability}</span>
            <span>{t("source.patchPreviewBoundary")}</span>
          </div>
        ) : null}
        {!workflowInput ? (
          <p className="side-copy">
            {t("sidebar.localStaticCopy")}
          </p>
        ) : null}
        <div className="current-view">
          <span>{t("sidebar.currentView")}</span>
          <strong>{reviewMode === "patched" ? t("view.patched") : t("view.original")}</strong>
        </div>
        <KeyValue
          label={t("sidebar.fingerprint")}
          value={reviewTargetFingerprint ?? t("sidebar.fingerprintPending")}
        />
        <KeyValue label={t("sidebar.packetExportStatus")} value={packetExportStatus} />
        {sourceKind === "n8n-readonly" ? (
          <button type="button" className="secondary-button" onClick={onRefreshN8n}>
            {t("actions.refreshN8n")}
          </button>
        ) : null}
      </section>

      <button type="button" className="primary-action" onClick={onPrimaryAction}>
        {primaryActionLabel}
      </button>

      <ol className="stepper" aria-label={t("sidebar.reviewSteps")}>
        {reviewStepKeys.map((step, index) => (
          <li key={step} className={`stepper__item stepper__item--${stepStatuses[index]}`}>
            <span>{index + 1}</span>
            <strong>{t(step)}</strong>
          </li>
        ))}
      </ol>

      {workflowInput ? (
        <section className="request-panel" aria-label={t("sidebar.patchRequest")}>
          <label htmlFor="patch-request">{t("sidebar.patchRequest")}</label>
          <textarea
            id="patch-request"
            value={request}
            onChange={(event) => onRequestChange(event.target.value)}
          />
          {isReportStale ? (
            <p className="review-warning">
              {sourceKind === "n8n-readonly" ? t("workspace.n8nReportStale") : t("workspace.reportStale")}
            </p>
          ) : null}
          <button type="button" onClick={onRunDoctor}>
            {t("actions.runDoctor")}
          </button>
        </section>
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}

      {report ? (
        <section className="side-state" aria-label={`${t("sidebar.verifier")} / ${t("sidebar.humanReview")}`}>
          <div>
            <span>{t("sidebar.verifier")}</span>
            <strong className={`status status--${report.verification.status}`}>
              {statusLabels[report.verification.status as VerificationStatus]}
            </strong>
          </div>
          <div>
            <span>{t("sidebar.humanReview")}</span>
            <strong>{getHumanDecisionLabel(humanDecision, t)}</strong>
          </div>
        </section>
      ) : null}

      {report ? (
        <section className="preview-note" aria-label={t("sidebar.previewTitle")}>
          <strong>{t("sidebar.previewTitle")}</strong>
          <p>{t("source.patchPreviewBoundary")}</p>
        </section>
      ) : null}

      <section className="preview-note" aria-label={t("source.supportedSources")}>
        <strong>{t("source.supportedSources")}</strong>
        <ul className="compact-source-list">
          {supportedSources.map((source) => (
            <li key={source.adapterId}>
              <span>{source.label}</span>
              <small>{source.sourcePlatform} · {source.importMethod} · {source.stability}</small>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
