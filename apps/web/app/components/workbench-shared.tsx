import type {
  DoctorReport,
  HumanReviewDecision,
  NodeParameterSummary,
  PatchDiffLine,
  RiskIssue,
  RiskSeverity,
  VerificationStatus,
  WorkflowViewNode
} from "@openworkflowdoctor/workflow-ir";
import type { Language, Translator } from "../lib/i18n";
import type { ReviewMode, WorkflowDocument, WorkspaceConsoleTab } from "../lib/workspace-store";

export type ConsoleTab = WorkspaceConsoleTab;
export type AiExplainerStatus = "idle" | "loading" | "ready" | "error";
export type SettingsTestStatus = "idle" | "testing" | "ready" | "fallback" | "missing-key" | "cleared";
export type CommandItem = {
  label: string;
  hint: string;
  disabled: boolean;
  action: () => void;
};

export type DoctorNodeData = WorkflowViewNode & {
  issues: RiskIssue[];
  issueCountLabel: string;
  severityLabel: string;
};

export const statusLabels: Record<VerificationStatus, string> = {
  pass: "PASS",
  hold: "HOLD",
  fail: "FAIL"
};

export const consoleTabIds: ConsoleTab[] = ["summary", "risks", "ai", "patch", "verification", "packet", "logs"];
export const reviewStepKeys = [
  "steps.import",
  "steps.diagnose",
  "steps.patchPreview",
  "steps.verify",
  "steps.humanReview",
  "steps.exportPacket"
] as const;

export const emptyIssues: RiskIssue[] = [];

export function Metric({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone?: VerificationStatus;
}) {
  return (
    <div className={`metric ${tone ? `metric--${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="key-value">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function DiffList({ diff, t }: { diff: PatchDiffLine[]; t: Translator }) {
  if (diff.length === 0) {
    return <p className="empty-text">{t("patch.noOperations")}</p>;
  }

  return (
    <ul className="diff-list">
      {diff.map((line) => (
        <li key={line.id}>
          <div className={`diff-marker diff-marker--${line.marker === "+" ? "add" : "update"}`}>
            {line.marker}
          </div>
          <div>
            <strong>{line.title}</strong>
            <small>{line.operationType}</small>
            <ul>
              {line.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ParameterList({ parameters, t }: { parameters: NodeParameterSummary[]; t: Translator }) {
  if (parameters.length === 0) {
    return <p className="empty-text">{t("inspector.noParameters")}</p>;
  }

  return (
    <section className="parameter-list" aria-label={t("inspector.parameters")}>
      <ul>
        {parameters.map((parameter) => (
          <li key={parameter.key}>
            <strong>{parameter.key}</strong>
            <code>{parameter.preview}</code>
            {parameter.redacted ? <small>{t("inspector.sensitiveRedacted")}</small> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function IssueList({
  issues,
  t,
  emptyLabel
}: {
  issues: RiskIssue[];
  t: Translator;
  emptyLabel?: string;
}) {
  if (issues.length === 0) {
    return <p className="empty-text">{emptyLabel ?? t("inspector.noRisksNode")}</p>;
  }

  return (
    <ul className="issue-list">
      {issues.map((issue) => (
        <li key={issue.id}>
          <span className={`severity severity--${issue.severity}`}>
            {getSeverityLabel(issue.severity, t)}
          </span>
          <strong>{issue.title}</strong>
          <small>{issue.explanation}</small>
        </li>
      ))}
    </ul>
  );
}

export function IssueDeltaList({
  title,
  issueIds,
  t
}: {
  title: string;
  issueIds: string[];
  t: Translator;
}) {
  return (
    <section className="issue-delta-group">
      <div>
        <span>{title}</span>
        <strong>{issueIds.length}</strong>
      </div>
      {issueIds.length > 0 ? (
        <ul>
          {issueIds.map((issueId) => (
            <li key={issueId}>
              <code>{issueId}</code>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-text">{t("packet.none")}</p>
      )}
    </section>
  );
}

export function getPrimaryVerifierReason(report: DoctorReport, t: Translator) {
  return (
    report.verification.checkedGates.find((gate) => gate.status !== "pass")?.explanation ??
    t("verification.allGatesPassed")
  );
}

export function getConsoleTabLabel(tab: ConsoleTab, t: Translator): string {
  switch (tab) {
    case "summary":
      return t("tabs.summary");
    case "risks":
      return t("tabs.risks");
    case "ai":
      return t("tabs.ai");
    case "patch":
      return t("tabs.patch");
    case "verification":
      return t("tabs.verification");
    case "packet":
      return t("tabs.packet");
    case "logs":
      return t("tabs.logs");
  }
}

export function getHumanDecisionLabel(decision: HumanReviewDecision, t: Translator): string {
  switch (decision) {
    case "undecided":
      return t("decision.undecided");
    case "accepted":
      return t("decision.accepted");
    case "held":
      return t("decision.held");
    case "rejected":
      return t("decision.rejected");
  }
}

export function getSeverityLabel(severity: RiskSeverity, t: Translator): string {
  switch (severity) {
    case "low":
      return t("severity.low");
    case "medium":
      return t("severity.medium");
    case "high":
      return t("severity.high");
    case "critical":
      return t("severity.critical");
  }
}

export function getSettingsTestStatusLabel(status: SettingsTestStatus, t: Translator): string {
  switch (status) {
    case "idle":
      return t("settings.testIdle");
    case "testing":
      return t("settings.testTesting");
    case "ready":
      return t("settings.testReady");
    case "fallback":
      return t("settings.testFallback");
    case "missing-key":
      return t("settings.testMissingKey");
    case "cleared":
      return t("settings.credentialsCleared");
  }
}

export function getWorkflowDocumentStatusLabel(document: WorkflowDocument, t: Translator): string {
  if (document.latestReportState === "stale") {
    return t("explorer.stale");
  }

  if (!document.latestReport) {
    return t("explorer.importedOnly");
  }

  if (document.reviewMode === "patched") {
    return `${t("explorer.patchPreview")} · ${statusLabels[document.latestReport.verification.status]}`;
  }

  return `${t("explorer.diagnosed")} · ${statusLabels[document.latestReport.verification.status]}`;
}

export function getPrimaryActionLabel({
  hasWorkflow,
  hasReport,
  hasPatchPreview,
  humanReviewAccepted,
  t
}: {
  hasWorkflow: boolean;
  hasReport: boolean;
  hasPatchPreview: boolean;
  humanReviewAccepted: boolean;
  t: Translator;
}) {
  if (!hasWorkflow) {
    return t("actions.importJson");
  }
  if (!hasReport) {
    return t("actions.runDoctor");
  }
  if (humanReviewAccepted) {
    return t("actions.exportReviewPacket");
  }
  if (!hasPatchPreview) {
    return t("actions.previewPatchedIr");
  }
  return t("actions.completeConfirmations");
}

export function getStepStatuses({
  hasWorkflow,
  hasReport,
  hasPatchPreview,
  hasVerification,
  hasHumanReview,
  canExport
}: {
  hasWorkflow: boolean;
  hasReport: boolean;
  hasPatchPreview: boolean;
  hasVerification: boolean;
  hasHumanReview: boolean;
  canExport: boolean;
}) {
  const completed = [
    hasWorkflow,
    hasReport,
    hasPatchPreview,
    hasVerification,
    hasHumanReview,
    canExport
  ];
  const firstOpen = completed.findIndex((isComplete) => !isComplete);

  return completed.map((isComplete, index) => {
    if (isComplete) {
      return "complete";
    }
    return firstOpen === index ? "active" : "locked";
  });
}

export function getStatusBarLanguageLabel(language: Language) {
  return language;
}

export function getViewLabel(reviewMode: ReviewMode, t: Translator) {
  return reviewMode === "patched" ? t("view.patched") : t("view.original");
}
