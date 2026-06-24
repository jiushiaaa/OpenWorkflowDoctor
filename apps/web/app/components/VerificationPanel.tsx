import { createDoctorReviewPacket, type DoctorReport, type HumanReviewDecision } from "@openworkflowdoctor/workflow-ir";
import type { Translator } from "../lib/i18n";
import {
  getHumanDecisionLabel,
  getPrimaryVerifierReason,
  KeyValue,
  Metric,
  statusLabels
} from "./workbench-shared";

export function VerificationPanel({
  report,
  reviewPacket,
  requiredChecklistItems,
  confirmedChecklistItemIds,
  canAcceptHumanReview,
  humanDecision,
  humanReviewNote,
  t,
  onToggleChecklistConfirmation,
  onRecordHumanDecision,
  onHumanReviewNoteChange
}: {
  report: DoctorReport | null;
  reviewPacket: ReturnType<typeof createDoctorReviewPacket> | null;
  requiredChecklistItems: NonNullable<ReturnType<typeof createDoctorReviewPacket>>["acceptanceChecklist"];
  confirmedChecklistItemIds: string[];
  canAcceptHumanReview: boolean;
  humanDecision: HumanReviewDecision;
  humanReviewNote: string;
  t: Translator;
  onToggleChecklistConfirmation: (itemId: string) => void;
  onRecordHumanDecision: (decision: HumanReviewDecision) => void;
  onHumanReviewNoteChange: (note: string) => void;
}) {
  if (!report || !reviewPacket) {
    return <p className="empty-text">{t("verification.pending")}</p>;
  }

  const primaryReason = getPrimaryVerifierReason(report, t);

  return (
    <div className="verification-layout">
      <section className="verification-summary">
        <div>
          <span>{t("verification.status")}</span>
          <strong className={`status status--${report.verification.status}`}>
            {statusLabels[report.verification.status]}
          </strong>
        </div>
        <KeyValue label={t("verification.primaryReason")} value={primaryReason} />
        <Metric label={t("verification.resolved")} value={String(reviewPacket.issueDelta.resolvedIssueIds.length)} />
        <Metric label={t("verification.remaining")} value={String(reviewPacket.issueDelta.remainingIssueIds.length)} />
        <Metric label={t("verification.introduced")} value={String(reviewPacket.issueDelta.introducedIssueIds.length)} />
      </section>

      {report.verification.status === "hold" ? (
        <p className="callout callout--hold">
          {t("verification.holdReason")}
        </p>
      ) : null}
      {report.verification.status === "fail" ? (
        <p className="callout callout--fail">
          {t("verification.failReason")}
        </p>
      ) : null}

      <section className="human-review-panel" aria-label={t("verification.requiredConfirmations")}>
        <div className="section-title-row">
          <div>
            <span>{t("verification.requiredConfirmations")}</span>
            <strong>{requiredChecklistItems.length}</strong>
          </div>
          <strong>{getHumanDecisionLabel(humanDecision, t)}</strong>
        </div>
        {requiredChecklistItems.length > 0 ? (
          <div className="confirmation-list">
            {requiredChecklistItems.map((item) => (
              <label key={item.id}>
                <input
                  type="checkbox"
                  checked={confirmedChecklistItemIds.includes(item.id)}
                  onChange={() => onToggleChecklistConfirmation(item.id)}
                />
                <span>
                  <strong>{item.label}</strong>
                  {item.action}
                </span>
              </label>
            ))}
          </div>
        ) : (
          <p className="empty-text">{t("verification.noConfirmations")}</p>
        )}
        <div className="decision-buttons">
          {(["accepted", "held", "rejected"] as const).map((decision) => (
            <button
              key={decision}
              type="button"
              className={humanDecision === decision ? "is-selected" : ""}
              onClick={() => onRecordHumanDecision(decision)}
              disabled={decision === "accepted" && !canAcceptHumanReview}
            >
              {getHumanDecisionLabel(decision, t)}
            </button>
          ))}
        </div>
        {reviewPacket.humanReviewValidation.status !== "pass" ? (
          <p className="review-warning">{reviewPacket.humanReviewValidation.explanation}</p>
        ) : null}
        <textarea
          aria-label={t("verification.reviewerNote")}
          value={humanReviewNote}
          onChange={(event) => onHumanReviewNoteChange(event.target.value)}
        />
      </section>

      <section>
        <h3>{t("verification.ciChecks")}</h3>
        <ul className="compact-list">
          {report.verification.checkedGates.map((gate) => (
            <li key={gate.id}>
              <span className={`status status--${gate.status}`}>
                {statusLabels[gate.status]}
              </span>
              <strong>{gate.title}</strong>
              <small>{gate.explanation}</small>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
