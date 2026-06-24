import { DEFAULT_LANGUAGE, resolveLanguage, type Language } from "./i18n";

export type ThemeMode = "light" | "dark" | "system";
export type AiProviderType = "openai-compatible";
export type AiProviderStatus = "configured" | "fallback";

export type AiProviderSettings = {
  enabled: boolean;
  providerType: AiProviderType;
  baseUrl: string;
  apiKey: string;
  model: string;
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
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4.1-mini"
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
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    model: settings.model
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
      baseUrl:
        typeof ai.baseUrl === "string" && ai.baseUrl.trim().length > 0
          ? ai.baseUrl.trim()
          : defaultWorkbenchSettings.ai.baseUrl,
      apiKey: typeof ai.apiKey === "string" ? ai.apiKey : "",
      model:
        typeof ai.model === "string" && ai.model.trim().length > 0
          ? ai.model.trim()
          : defaultWorkbenchSettings.ai.model
    }
  };
}

function normalizeTheme(theme: unknown): ThemeMode {
  return theme === "light" || theme === "dark" || theme === "system" ? theme : "system";
}

function cloneSettings(settings: WorkbenchSettings): WorkbenchSettings {
  return JSON.parse(JSON.stringify(settings)) as WorkbenchSettings;
}
