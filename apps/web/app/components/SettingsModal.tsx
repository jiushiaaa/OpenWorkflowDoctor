import type { Language, Translator } from "../lib/i18n";
import { maskApiKey, type ThemeMode, type WorkbenchSettings } from "../lib/settings";
import { getSettingsTestStatusLabel, KeyValue, type SettingsTestStatus } from "./workbench-shared";

export function SettingsModal({
  settings,
  workspaceStatus,
  testStatus,
  t,
  onSettingsChange,
  onTestConnection,
  onClearCredentials,
  onClearWorkspaceData,
  onClose
}: {
  settings: WorkbenchSettings;
  workspaceStatus: string;
  testStatus: SettingsTestStatus;
  t: Translator;
  onSettingsChange: (updater: (current: WorkbenchSettings) => WorkbenchSettings) => void;
  onTestConnection: () => void;
  onClearCredentials: () => void;
  onClearWorkspaceData: () => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-overlay" role="presentation">
      <section className="settings-modal" role="dialog" aria-modal="true" aria-label={t("settings.title")}>
        <header>
          <div>
            <span>{t("toolbar.settings")}</span>
            <h2>{t("settings.title")}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={t("actions.close")}>
            {t("actions.close")}
          </button>
        </header>

        <div className="settings-body">
          <section className="settings-section">
            <h3>{t("settings.general")}</h3>
            <label>
              <span>{t("settings.language")}</span>
              <select
                value={settings.language}
                onChange={(event) =>
                  onSettingsChange((current) => ({
                    ...current,
                    language: event.target.value as Language
                  }))
                }
              >
                <option value="zh-CN">zh-CN</option>
                <option value="en-US">en-US</option>
              </select>
            </label>
            <label>
              <span>{t("settings.theme")}</span>
              <select
                value={settings.theme}
                onChange={(event) =>
                  onSettingsChange((current) => ({
                    ...current,
                    theme: event.target.value as ThemeMode
                  }))
                }
              >
                <option value="light">{t("settings.themeLight")}</option>
                <option value="dark">{t("settings.themeDark")}</option>
                <option value="system">{t("settings.themeSystem")}</option>
              </select>
            </label>
          </section>

          <section className="settings-section">
            <h3>{t("settings.aiProvider")}</h3>
            <label className="settings-check">
              <input
                type="checkbox"
                checked={settings.ai.enabled}
                onChange={(event) =>
                  onSettingsChange((current) => ({
                    ...current,
                    ai: {
                      ...current.ai,
                      enabled: event.target.checked
                    }
                  }))
                }
              />
              <span>{t("settings.enableAi")}</span>
            </label>
            <label>
              <span>{t("settings.providerType")}</span>
              <select value={settings.ai.providerType} disabled>
                <option value="openai-compatible">OpenAI-compatible</option>
              </select>
            </label>
            <label>
              <span>{t("settings.baseUrl")}</span>
              <input
                value={settings.ai.baseUrl}
                onChange={(event) =>
                  onSettingsChange((current) => ({
                    ...current,
                    ai: {
                      ...current.ai,
                      baseUrl: event.target.value
                    }
                  }))
                }
              />
            </label>
            <label>
              <span>{t("settings.apiKey")}</span>
              <input
                type="password"
                value={settings.ai.apiKey}
                autoComplete="off"
                onChange={(event) =>
                  onSettingsChange((current) => ({
                    ...current,
                    ai: {
                      ...current.ai,
                      apiKey: event.target.value
                    }
                  }))
                }
              />
            </label>
            <p className="settings-help">
              {t("settings.apiKeyStored")}
              {settings.ai.apiKey ? ` ${t("settings.apiKeyMasked")}: ${maskApiKey(settings.ai.apiKey)}` : ""}
            </p>
            <label>
              <span>{t("settings.model")}</span>
              <input
                value={settings.ai.model}
                onChange={(event) =>
                  onSettingsChange((current) => ({
                    ...current,
                    ai: {
                      ...current.ai,
                      model: event.target.value
                    }
                  }))
                }
              />
            </label>
            <div className="settings-actions">
              <button type="button" onClick={onTestConnection} disabled={testStatus === "testing"}>
                {t("actions.testConnection")}
              </button>
              <button type="button" className="secondary-button" onClick={onClearCredentials}>
                {t("actions.clearCredentials")}
              </button>
            </div>
            <p className="settings-help">{getSettingsTestStatusLabel(testStatus, t)}</p>
          </section>

          <section className="settings-section">
            <h3>{t("settings.workspace")}</h3>
            <KeyValue label={t("settings.workspaceStatus")} value={workspaceStatus} />
            <div className="settings-actions">
              <button type="button" className="secondary-button" onClick={onClearWorkspaceData}>
                {t("actions.clearWorkspaceData")}
              </button>
              <button type="button" className="secondary-button" disabled>
                {t("actions.exportWorkspace")} · {t("settings.placeholder")}
              </button>
              <button type="button" className="secondary-button" disabled>
                {t("actions.importWorkspace")} · {t("settings.placeholder")}
              </button>
            </div>
          </section>

          <section className="settings-section">
            <h3>{t("settings.safety")}</h3>
            <ul className="safety-list">
              <li>{t("safety.localStatic")}</li>
              <li>{t("safety.noExecution")}</li>
              <li>{t("safety.noN8nMutation")}</li>
              <li>{t("safety.noCredentialAccess")}</li>
              <li>{t("safety.patchPreview")}</li>
              <li>{t("safety.aiAdvisory")}</li>
              <li>{t("safety.verifierTruth")}</li>
            </ul>
          </section>
        </div>
      </section>
    </div>
  );
}
