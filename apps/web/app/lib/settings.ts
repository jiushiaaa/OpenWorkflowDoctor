import {
  getProviderPreset,
  listProviderPresets,
  type AiProviderResponseFormat,
  type AiProviderTransport
} from "@openworkflowdoctor/workflow-ai";
import { DEFAULT_LANGUAGE, resolveLanguage, type Language } from "./i18n";

export type ThemeMode = "light" | "dark" | "system";
export type AiProviderType = "openai-compatible";
export type AiProviderStatus = "configured" | "fallback";

export type AiProviderSettings = {
  enabled: boolean;
  providerType: AiProviderType;
  providerPreset: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  transport: AiProviderTransport;
  responseFormat: AiProviderResponseFormat;
};

export type WorkbenchSettings = {
  language: Language;
  theme: ThemeMode;
  ai: AiProviderSettings;
};

export const SETTINGS_STORAGE_KEY = "openworkflowdoctor.workbench.settings.v1";

export const defaultWorkbenchSettings: WorkbenchSettings = {
  language: DEFAULT_LANGUAGE,
  theme: "system",
  ai: {
    enabled: true,
    providerType: "openai-compatible",
    providerPreset: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4.1-mini",
    transport: "responses",
    responseFormat: "json_schema"
  }
};

export function loadWorkbenchSettings(storage: Storage | undefined): WorkbenchSettings {
  if (!storage) {
    return cloneSettings(defaultWorkbenchSettings);
  }

  const rawValue = storage.getItem(SETTINGS_STORAGE_KEY);
  if (!rawValue) {
    return cloneSettings(defaultWorkbenchSettings);
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<WorkbenchSettings>;
    return normalizeSettings(parsed);
  } catch {
    return cloneSettings(defaultWorkbenchSettings);
  }
}

export function saveWorkbenchSettings(storage: Storage | undefined, settings: WorkbenchSettings): void {
  if (!storage) {
    return;
  }

  storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalizeSettings(settings)));
}

export function clearAiCredentials(settings: AiProviderSettings): AiProviderSettings {
  return {
    ...settings,
    apiKey: ""
  };
}

export function applyAiProviderPreset(settings: AiProviderSettings, presetId: string): AiProviderSettings {
  const preset = getProviderPreset(presetId);
  if (!preset) {
    return settings;
  }

  return {
    ...settings,
    providerType: "openai-compatible",
    providerPreset: preset.id,
    baseUrl: preset.defaultBaseUrl,
    model: preset.modelExamples[0] ?? settings.model,
    transport: preset.defaultTransport,
    responseFormat: preset.defaultResponseFormat
  };
}

export function maskApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (trimmed.length === 0) {
    return "";
  }
  if (trimmed.length <= 8) {
    return "••••";
  }

  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

export function getAiProviderStatus(settings: AiProviderSettings): AiProviderStatus {
  return settings.enabled && settings.apiKey.trim().length > 0 ? "configured" : "fallback";
}

export function toRequestProviderSettings(settings: AiProviderSettings) {
  return {
    enabled: settings.enabled,
    providerType: settings.providerType,
    providerPreset: settings.providerPreset,
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    model: settings.model,
    transport: settings.transport,
    responseFormat: settings.responseFormat
  };
}

function normalizeSettings(settings: Partial<WorkbenchSettings>): WorkbenchSettings {
  const ai: Partial<AiProviderSettings> = settings.ai ?? {};

  return {
    language: resolveLanguage(settings.language),
    theme: normalizeTheme(settings.theme),
    ai: {
      enabled: typeof ai.enabled === "boolean" ? ai.enabled : defaultWorkbenchSettings.ai.enabled,
      providerType: "openai-compatible",
      providerPreset: normalizeProviderPreset(ai.providerPreset),
      baseUrl:
        typeof ai.baseUrl === "string" && ai.baseUrl.trim().length > 0
          ? ai.baseUrl.trim()
          : defaultWorkbenchSettings.ai.baseUrl,
      apiKey: typeof ai.apiKey === "string" ? ai.apiKey : "",
      model:
        typeof ai.model === "string" && ai.model.trim().length > 0
          ? ai.model.trim()
          : defaultWorkbenchSettings.ai.model,
      transport: normalizeTransport(ai.transport),
      responseFormat: normalizeResponseFormat(ai.responseFormat)
    }
  };
}

function normalizeTheme(theme: unknown): ThemeMode {
  return theme === "light" || theme === "dark" || theme === "system" ? theme : "system";
}

function cloneSettings(settings: WorkbenchSettings): WorkbenchSettings {
  return JSON.parse(JSON.stringify(settings)) as WorkbenchSettings;
}

function normalizeProviderPreset(value: unknown): string {
  if (typeof value !== "string") {
    return defaultWorkbenchSettings.ai.providerPreset;
  }

  return listProviderPresets().some((preset) => preset.id === value)
    ? value
    : defaultWorkbenchSettings.ai.providerPreset;
}

function normalizeTransport(value: unknown): AiProviderTransport {
  return value === "chat_completions" || value === "responses" ? value : defaultWorkbenchSettings.ai.transport;
}

function normalizeResponseFormat(value: unknown): AiProviderResponseFormat {
  return value === "none" || value === "json_object" || value === "json_schema"
    ? value
    : defaultWorkbenchSettings.ai.responseFormat;
}
