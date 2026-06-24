import { describe, expect, test } from "vitest";
import {
  clearAiCredentials,
  getAiProviderStatus,
  loadWorkbenchSettings,
  maskApiKey,
  saveWorkbenchSettings
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
