# Provider Presets and Compatibility Registry

OpenWorkflowDoctor uses provider presets to make AI provider configuration explicit and reviewable.

Provider presets do not add AI Patch capabilities, loosen schemas, execute workflows, or connect to n8n. They only configure how OpenWorkflowDoctor calls a user-selected AI endpoint.

## Status Levels

- `Verified`: `normal_timeout_repair` reached `verifier_completed` with a real provider. Schema validation, semantic validation, conflict detection, deterministic patch preview, and verifier all ran.
- `Preset`: configuration template only. The base URL, transport, response format, and example models are provided, but the provider has not been verified with the v0.4 AI Patch smoke.
- `Experimental`: placeholder or unverified provider shape. Native adapters may be needed later.
- `Custom`: user-supplied OpenAI-compatible provider.

## Verified Providers

| Provider | Base URL | Transport | Response Format | Model Example |
| --- | --- | --- | --- | --- |
| NovAI | `https://us.novaiapi.com/v1` | `chat_completions` | `json_object` | `gemini-3-pro-preview` |
| Volcengine Ark | `https://ark.cn-beijing.volces.com/api/v3` | `chat_completions` | `json_object` | `doubao-seed-2-0-pro-260215` |
| Alibaba Bailian / DashScope | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `chat_completions` | `json_object` | `qwen3.7-plus` |

## Preset Providers

| Provider | Base URL | Transport | Response Format | Model Examples |
| --- | --- | --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | `responses` | `json_schema` | `gpt-4.1-mini` |
| DeepSeek | `https://api.deepseek.com` | `chat_completions` | `json_object` | `deepseek-chat`, `deepseek-reasoner` |
| Kimi / Moonshot | `https://api.moonshot.ai/v1` | `chat_completions` | `json_object` | `kimi-k2`, `moonshot-v1-8k` |
| MiniMax | `https://api.minimax.io/v1` | `chat_completions` | `json_object` | `MiniMax-Text-01` |
| Tencent Hunyuan | `https://hunyuan.cloud.tencent.com/openai/v1` | `chat_completions` | `json_object` | `hunyuan-turbos-latest` |
| Gemini OpenAI-compatible | `https://generativelanguage.googleapis.com/v1beta/openai` | `chat_completions` | `json_schema` | `gemini-2.5-pro` |

## Experimental Providers

| Provider | Reason |
| --- | --- |
| Claude native | Native Anthropic Messages adapter is not implemented in v0.4.3. |
| Gemini native | Native Gemini adapter is not implemented in v0.4.3. |
| Zhipu GLM | Endpoint and model ID are not verified yet. |

## Safety Boundary

- API keys remain local settings only.
- Provider presets are not written into WorkflowIR, Review Packets, or workspace artifacts as secrets.
- Raw n8n JSON is not sent to AI providers.
- AI output must still pass Zod schema validation.
- Semantic validation, conflict detection, deterministic patch preview, verifier, and human review remain required.

