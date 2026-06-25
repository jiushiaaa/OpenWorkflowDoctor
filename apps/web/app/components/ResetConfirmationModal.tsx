import type { ResetActionPlan } from "../lib/troubleshooting";
import type { Translator } from "../lib/i18n";

export function ResetConfirmationModal({
  plan,
  t,
  onConfirm,
  onCancel
}: {
  plan: ResetActionPlan;
  t: Translator;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="modal-overlay" role="presentation">
      <section className="settings-modal reset-modal" role="dialog" aria-modal="true" aria-label={t("settings.resetEntireWorkspace")}>
        <header>
          <div>
            <span>{t("settings.workspace")}</span>
            <h2>{t("settings.resetEntireWorkspace")}</h2>
          </div>
          <button type="button" onClick={onCancel} aria-label={t("actions.close")}>
            {t("actions.close")}
          </button>
        </header>
        <div className="settings-body">
          <section className="settings-section">
            <h3>{t("settings.resetRemoves")}</h3>
            <ul className="safety-list">
              {plan.removes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <section className="settings-section">
            <h3>{t("settings.resetPreserves")}</h3>
            <ul className="safety-list">
              {plan.preserves.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <div className="settings-actions">
            <button type="button" onClick={onConfirm}>
              {t("actions.confirmReset")}
            </button>
            <button type="button" className="secondary-button" onClick={onCancel}>
              {t("actions.cancel")}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
