import { listProviderPresets } from "@openworkflowdoctor/workflow-ai";
import type { Language, Translator } from "../lib/i18n";
import {
  applyAiProviderPreset,
  maskApiKey,
  type ThemeMode,
  type WorkbenchSettings
} from "../lib/settings";
import type { N8nConnectionSettings, SaveN8nConnectionInput } from "../lib/n8n-connections";
import { getSettingsTestStatusLabel, KeyValue, type SettingsTestStatus } from "./workbench-shared";

const providerPresets = listProviderPresets();

export function SettingsModal({
  settings,
  workspaceStatus,
  testStatus,
  t,
  onSettingsChange,
  n8nConnections,
  n8nDraft,
  n8nApiKey,
  onTestConnection,
  onClearCredentials,
  onN8nDraftChange,
  onN8nApiKeyChange,
  onSaveN8nConnection,
  onDeleteN8nConnection,
  onClearN8nSessionKey,
  onClearWorkspaceData,
  onClose
}: {
  settings: WorkbenchSettings;
  workspaceStatus: string;
  testStatus: SettingsTestStatus;
  t: Translator;
  onSettingsChange: (updater: (current: WorkbenchSettings) => WorkbenchSettings) => void;
  n8nConnections: N8nConnectionSettings[];
  n8nDraft: SaveN8nConnectionInput;
  n8nApiKey: string;
  onTestConnection: () => void;
  onClearCredentials: () => void;
  onN8nDraftChange: (draft: SaveN8nConnectionInput) => void;
  onN8nApiKeyChange: (apiKey: string) => void;
  onSaveN8nConnection: () => void;
  onDeleteN8nConnection: (connectionId: string) => void;
  onClearN8nSessionKey: (connectionId: string) => void;
  onClearWorkspaceData: () => void;
  onClose: () => void;
}) {
  const selectedProvider = getSelectedProvider(settings.ai.providerPreset);

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
              <span>{t("settings.providerPreset")}</span>
              <select
                aria-label={t("settings.providerPreset")}
                value={settings.ai.providerPreset}
                onChange={(event) =>
                  onSettingsChange((current) => ({
                    ...current,
                    ai: applyAiProviderPreset(current.ai, event.target.value)
                  }))
                }
              >
                {providerPresets.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="provider-preset-meta">
              <span className={`provider-status provider-status-${selectedProvider.compatibility}`}>
                {getProviderStatusLabel(selectedProvider.compatibility, t)}
              </span>
              <span>{selectedProvider.modelExamples.join(", ")}</span>
            </div>
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
            <label>
              <span>{t("settings.transport")}</span>
              <select
                value={settings.ai.transport}
                onChange={(event) =>
                  onSettingsChange((current) => ({
                    ...current,
                    ai: {
                      ...current.ai,
                      transport: event.target.value as WorkbenchSettings["ai"]["transport"]
                    }
                  }))
                }
              >
                <option value="responses">responses</option>
                <option value="chat_completions">chat_completions</option>
              </select>
            </label>
            <label>
              <span>{t("settings.responseFormat")}</span>
              <select
                value={settings.ai.responseFormat}
                onChange={(event) =>
                  onSettingsChange((current) => ({
                    ...current,
                    ai: {
                      ...current.ai,
                      responseFormat: event.target.value as WorkbenchSettings["ai"]["responseFormat"]
                    }
                  }))
                }
              >
                <option value="none">none</option>
                <option value="json_object">json_object</option>
                <option value="json_schema">json_schema</option>
              </select>
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
            <h3>{t("settings.n8nConnections")}</h3>
            <p className="settings-help">{t("settings.n8nReadOnlyHelp")}</p>
            <label>
              <span>{t("settings.n8nLabel")}</span>
              <input
                aria-label={t("settings.n8nLabel")}
                value={n8nDraft.label}
                onChange={(event) => onN8nDraftChange({ ...n8nDraft, label: event.target.value })}
              />
            </label>
            <label>
              <span>{t("settings.n8nBaseUrl")}</span>
              <input
                aria-label={t("settings.n8nBaseUrl")}
                value={n8nDraft.baseUrl}
                onChange={(event) => onN8nDraftChange({ ...n8nDraft, baseUrl: event.target.value })}
              />
            </label>
            <label>
              <span>{t("settings.n8nEnvironment")}</span>
              <input
                aria-label={t("settings.n8nEnvironment")}
                value={n8nDraft.environmentLabel ?? ""}
                onChange={(event) => onN8nDraftChange({ ...n8nDraft, environmentLabel: event.target.value })}
              />
            </label>
            <label>
              <span>{t("settings.n8nApiKey")}</span>
              <input
                aria-label={t("settings.n8nApiKey")}
                type="password"
                autoComplete="off"
                value={n8nApiKey}
                onChange={(event) => onN8nApiKeyChange(event.target.value)}
              />
            </label>
            <p className="settings-help">{t("settings.n8nKeySessionOnly")}</p>
            <div className="settings-actions">
              <button type="button" onClick={onSaveN8nConnection}>
                {t("actions.saveN8nConnection")}
              </button>
            </div>

            {n8nConnections.length > 0 ? (
              <ul className="connection-list">
                {n8nConnections.map((connection) => (
                  <li key={connection.connectionId}>
                    <div>
                      <strong>{connection.label}</strong>
                      <small>
                        {connection.baseUrl}
                        {connection.environmentLabel ? ` · ${connection.environmentLabel}` : ""}
                      </small>
                      <small>{t("settings.n8nStatus")}: {connection.lastConnectionStatus}</small>
                    </div>
                    <div className="settings-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => onClearN8nSessionKey(connection.connectionId)}
                      >
                        {t("actions.clearSessionKey")}
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => onDeleteN8nConnection(connection.connectionId)}
                      >
                        {t("actions.deleteConnection")}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="settings-help">{t("settings.n8nNoConnections")}</p>
            )}
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

function getSelectedProvider(providerPreset: string) {
  return providerPresets.find((provider) => provider.id === providerPreset) ?? providerPresets[0]!;
}

function getProviderStatusLabel(status: NonNullable<ReturnType<typeof getSelectedProvider>>["compatibility"], t: Translator) {
  switch (status) {
    case "verified":
      return t("settings.providerStatusVerified");
    case "preset":
      return t("settings.providerStatusPreset");
    case "experimental":
      return t("settings.providerStatusExperimental");
    default:
      return t("settings.providerStatusCustom");
  }
}
