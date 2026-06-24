import { describe, expect, test } from "vitest";
import {
  getProviderPreset,
  listProviderPresets,
  resolveProviderPreset,
  type AiProviderPreset
} from "../src/index";

describe("AI provider registry", () => {
  test("includes required provider presets grouped by compatibility status", () => {
    const ids = listProviderPresets().map((provider: AiProviderPreset) => provider.id);

    expect(ids).toEqual(
      expect.arrayContaining([
        "custom-openai-compatible",
        "novai",
        "volcengine-ark",
        "alibaba-bailian",
        "openai",
        "deepseek",
        "kimi-moonshot",
        "minimax",
        "tencent-hunyuan",
        "gemini-openai-compatible",
        "claude-native",
        "gemini-native",
        "zhipu-glm"
      ])
    );

    expect(listProviderPresets().some((provider) => provider.compatibility === "verified")).toBe(true);
    expect(listProviderPresets().some((provider) => provider.compatibility === "preset")).toBe(true);
    expect(listProviderPresets().some((provider) => provider.compatibility === "experimental")).toBe(true);
    expect(getProviderPreset("custom-openai-compatible")?.compatibility).toBe("custom");
  });

  test("verified providers have defaults and model examples", () => {
    const verifiedProviders = listProviderPresets().filter((provider) => provider.compatibility === "verified");

    expect(verifiedProviders.map((provider) => provider.id)).toEqual(["novai", "volcengine-ark", "alibaba-bailian"]);
    for (const provider of verifiedProviders) {
      expect(provider.defaultBaseUrl).toMatch(/^https:\/\//u);
      expect(provider.defaultTransport).toBe("chat_completions");
      expect(provider.defaultResponseFormat).toBe("json_object");
      expect(provider.modelExamples.length).toBeGreaterThan(0);
    }
  });

  test("resolves aliases used by manual smoke environment variables", () => {
    expect(resolveProviderPreset("volcengine_ark")?.id).toBe("volcengine-ark");
    expect(resolveProviderPreset("alibaba_bailian")?.id).toBe("alibaba-bailian");
    expect(resolveProviderPreset("dashscope")?.id).toBe("alibaba-bailian");
    expect(resolveProviderPreset("custom")).toBeUndefined();
  });
});
