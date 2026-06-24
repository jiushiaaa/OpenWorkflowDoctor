import { describe, expect, test } from "vitest";
import {
  applyAiProviderPreset,
  clearAiCredentials,
  getAiProviderStatus,
  loadWorkbenchSettings,
  maskApiKey,
  saveWorkbenchSettings,
  toRequestProviderSettings
} from "./settings";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  length = 0;

  clear(): void {
    this.values.clear();
    this.length = 0;
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
    this.length = this.values.size;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
    this.length = this.values.size;
  }
}

describe("workbench settings storage", () => {
  test("loads safe local-first defaults", () => {
    const settings = loadWorkbenchSettings(new MemoryStorage());

    expect(settings.language).toBe("zh-CN");
    expect(settings.theme).toBe("system");
    expect(settings.ai.enabled).toBe(true);
    expect(settings.ai.providerType).toBe("openai-compatible");
    expect(settings.ai.apiKey).toBe("");
    expect(getAiProviderStatus(settings.ai)).toBe("fallback");
  });

  test("persists language and provider settings locally", () => {
    const storage = new MemoryStorage();
    const settings = loadWorkbenchSettings(storage);

    saveWorkbenchSettings(storage, {
      ...settings,
      language: "en-US",
      ai: {
        ...settings.ai,
        apiKey: "sk-local-browser-only",
        model: "gpt-4.1-mini"
      }
    });

    const reloaded = loadWorkbenchSettings(storage);
    expect(reloaded.language).toBe("en-US");
    expect(reloaded.ai.apiKey).toBe("sk-local-browser-only");
    expect(reloaded.ai.model).toBe("gpt-4.1-mini");
    expect(getAiProviderStatus(reloaded.ai)).toBe("configured");
  });

  test("applies provider presets without changing API key", () => {
    const settings = loadWorkbenchSettings(new MemoryStorage());
    const updated = applyAiProviderPreset(
      {
        ...settings.ai,
        apiKey: "sk-local-browser-only"
      },
      "volcengine-ark"
    );

    expect(updated.providerPreset).toBe("volcengine-ark");
    expect(updated.baseUrl).toBe("https://ark.cn-beijing.volces.com/api/v3");
    expect(updated.transport).toBe("chat_completions");
    expect(updated.responseFormat).toBe("json_object");
    expect(updated.model).toBe("doubao-seed-2-0-pro-260215");
    expect(updated.apiKey).toBe("sk-local-browser-only");
  });

  test("preserves user overrides and exports provider config without API key surprises", () => {
    const settings = loadWorkbenchSettings(new MemoryStorage());
    const updated = {
      ...applyAiProviderPreset(settings.ai, "alibaba-bailian"),
      baseUrl: "https://proxy.example.test/v1",
      model: "custom-model",
      transport: "responses" as const,
      responseFormat: "json_schema" as const,
      apiKey: "sk-local-browser-only"
    };

    expect(toRequestProviderSettings(updated)).toEqual({
      enabled: true,
      providerType: "openai-compatible",
      providerPreset: "alibaba-bailian",
      baseUrl: "https://proxy.example.test/v1",
      apiKey: "sk-local-browser-only",
      model: "custom-model",
      transport: "responses",
      responseFormat: "json_schema"
    });
  });

  test("masks and clears API keys", () => {
    expect(maskApiKey("sk-local-browser-only")).toBe("sk-l...only");

    const settings = loadWorkbenchSettings(new MemoryStorage());
    const cleared = clearAiCredentials({
      ...settings.ai,
      apiKey: "sk-local-browser-only"
    });

    expect(cleared.apiKey).toBe("");
    expect(getAiProviderStatus(cleared)).toBe("fallback");
  });
});
