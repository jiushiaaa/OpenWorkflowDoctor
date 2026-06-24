export type AiProviderCompatibility = "verified" | "preset" | "experimental" | "custom";
export type AiProviderProtocol = "openai_compatible" | "anthropic_messages" | "gemini_native";
export type AiProviderTransport = "responses" | "chat_completions";
export type AiProviderResponseFormat = "none" | "json_object" | "json_schema";

export type AiProviderPreset = {
  id: string;
  label: string;
  compatibility: AiProviderCompatibility;
  protocol: AiProviderProtocol;
  defaultBaseUrl: string;
  defaultTransport: AiProviderTransport;
  defaultResponseFormat: AiProviderResponseFormat;
  modelExamples: string[];
  docsUrl?: string;
  notes: string[];
  aliases?: string[];
};

const providerPresets: readonly AiProviderPreset[] = [
  {
    id: "custom-openai-compatible",
    label: "Custom OpenAI-compatible",
    compatibility: "custom",
    protocol: "openai_compatible",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultTransport: "responses",
    defaultResponseFormat: "json_schema",
    modelExamples: ["gpt-4.1-mini"],
    notes: ["User supplied OpenAI-compatible endpoint and model."]
  },
  {
    id: "novai",
    label: "NovAI",
    compatibility: "verified",
    protocol: "openai_compatible",
    defaultBaseUrl: "https://us.novaiapi.com/v1",
    defaultTransport: "chat_completions",
    defaultResponseFormat: "json_object",
    modelExamples: ["gemini-3-pro-preview"],
    notes: ["Verified with normal_timeout_repair reaching verifier_completed."]
  },
  {
    id: "volcengine-ark",
    label: "Volcengine Ark",
    compatibility: "verified",
    protocol: "openai_compatible",
    defaultBaseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    defaultTransport: "chat_completions",
    defaultResponseFormat: "json_object",
    modelExamples: ["doubao-seed-2-0-pro-260215"],
    docsUrl: "https://www.volcengine.com/docs/82379/1494384",
    notes: ["Verified with normal_timeout_repair reaching verifier_completed."],
    aliases: ["volcengine_ark", "ark"]
  },
  {
    id: "alibaba-bailian",
    label: "Alibaba Bailian / DashScope",
    compatibility: "verified",
    protocol: "openai_compatible",
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultTransport: "chat_completions",
    defaultResponseFormat: "json_object",
    modelExamples: ["qwen3.7-plus"],
    docsUrl: "https://www.alibabacloud.com/help/en/model-studio/compatibility-of-openai-with-dashscope",
    notes: ["Verified with normal_timeout_repair reaching verifier_completed."],
    aliases: ["alibaba_bailian", "dashscope", "bailian"]
  },
  {
    id: "openai",
    label: "OpenAI",
    compatibility: "preset",
    protocol: "openai_compatible",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultTransport: "responses",
    defaultResponseFormat: "json_schema",
    modelExamples: ["gpt-4.1-mini"],
    docsUrl: "https://platform.openai.com/docs",
    notes: ["Preset template only until a v0.4.3 real-model smoke is recorded."]
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    compatibility: "preset",
    protocol: "openai_compatible",
    defaultBaseUrl: "https://api.deepseek.com",
    defaultTransport: "chat_completions",
    defaultResponseFormat: "json_object",
    modelExamples: ["deepseek-chat", "deepseek-reasoner"],
    docsUrl: "https://api-docs.deepseek.com/",
    notes: ["Preset template only. Use the model ID available in your console."]
  },
  {
    id: "kimi-moonshot",
    label: "Kimi / Moonshot",
    compatibility: "preset",
    protocol: "openai_compatible",
    defaultBaseUrl: "https://api.moonshot.ai/v1",
    defaultTransport: "chat_completions",
    defaultResponseFormat: "json_object",
    modelExamples: ["kimi-k2", "moonshot-v1-8k"],
    docsUrl: "https://platform.moonshot.ai/docs",
    notes: ["Preset template only. Use the model ID available in your console."],
    aliases: ["moonshot", "kimi"]
  },
  {
    id: "minimax",
    label: "MiniMax",
    compatibility: "preset",
    protocol: "openai_compatible",
    defaultBaseUrl: "https://api.minimax.io/v1",
    defaultTransport: "chat_completions",
    defaultResponseFormat: "json_object",
    modelExamples: ["MiniMax-Text-01"],
    docsUrl: "https://platform.minimax.io/docs",
    notes: ["Preset template only. Use the model ID available in your console."]
  },
  {
    id: "tencent-hunyuan",
    label: "Tencent Hunyuan",
    compatibility: "preset",
    protocol: "openai_compatible",
    defaultBaseUrl: "https://hunyuan.cloud.tencent.com/openai/v1",
    defaultTransport: "chat_completions",
    defaultResponseFormat: "json_object",
    modelExamples: ["hunyuan-turbos-latest"],
    docsUrl: "https://intl.cloud.tencent.com/ind/document/product/1290/79463",
    notes: ["Preset template only. Verify against your Tencent Cloud account before marking verified."],
    aliases: ["hunyuan", "tencent"]
  },
  {
    id: "gemini-openai-compatible",
    label: "Gemini OpenAI-compatible",
    compatibility: "preset",
    protocol: "openai_compatible",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultTransport: "chat_completions",
    defaultResponseFormat: "json_schema",
    modelExamples: ["gemini-2.5-pro"],
    docsUrl: "https://ai.google.dev/gemini-api/docs/openai",
    notes: ["Preset template only. Native Gemini adapter is intentionally out of scope for v0.4.3."]
  },
  {
    id: "claude-native",
    label: "Claude native",
    compatibility: "experimental",
    protocol: "anthropic_messages",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    defaultTransport: "chat_completions",
    defaultResponseFormat: "json_object",
    modelExamples: ["claude-sonnet-4-5"],
    docsUrl: "https://docs.anthropic.com/",
    notes: ["Experimental placeholder. Native Anthropic Messages adapter is not implemented in v0.4.3."]
  },
  {
    id: "gemini-native",
    label: "Gemini native",
    compatibility: "experimental",
    protocol: "gemini_native",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultTransport: "chat_completions",
    defaultResponseFormat: "json_object",
    modelExamples: ["gemini-2.5-pro"],
    docsUrl: "https://ai.google.dev/gemini-api/docs",
    notes: ["Experimental placeholder. Native Gemini adapter is not implemented in v0.4.3."]
  },
  {
    id: "zhipu-glm",
    label: "Zhipu GLM",
    compatibility: "experimental",
    protocol: "openai_compatible",
    defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultTransport: "chat_completions",
    defaultResponseFormat: "json_object",
    modelExamples: ["glm-4-plus"],
    docsUrl: "https://docs.bigmodel.cn/",
    notes: ["Experimental until the current endpoint and model ID are verified."]
  }
] as const;

export function listProviderPresets(): AiProviderPreset[] {
  return providerPresets.map((provider) => ({ ...provider, notes: [...provider.notes], modelExamples: [...provider.modelExamples] }));
}

export function getProviderPreset(id: string | undefined): AiProviderPreset | undefined {
  if (!id) {
    return undefined;
  }
  const normalized = normalizePresetId(id);
  const provider = providerPresets.find((preset) => preset.id === normalized);
  return provider ? { ...provider, notes: [...provider.notes], modelExamples: [...provider.modelExamples] } : undefined;
}

export function resolveProviderPreset(value: string | undefined): AiProviderPreset | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = normalizePresetId(value);
  const provider = providerPresets.find(
    (preset) => preset.id === normalized || preset.aliases?.some((alias) => normalizePresetId(alias) === normalized)
  );
  return provider?.id === "custom-openai-compatible"
    ? undefined
    : provider
      ? { ...provider, notes: [...provider.notes], modelExamples: [...provider.modelExamples] }
      : undefined;
}

function normalizePresetId(value: string): string {
  return value.trim().toLowerCase().replace(/_/gu, "-");
}
