# Real Model Smoke Results v0.4.2

This document records the v0.4.2 manual real-model smoke result for AI Patch Proposal.

It intentionally does not include API keys, raw prompts, raw n8n JSON, or raw model responses.

## Confirmed Configuration: NovAI

- Provider: NovAI
- Model: `gemini-3-pro-preview`
- Transport: `chat_completions`
- Response format: `json_object`
- Case: `normal_timeout_repair`
- Repeat: `3`

## Result

- 3/3 attempts reached `verifier_completed`
- Schema validation: valid
- Semantic validation: valid
- Conflicts: 0
- Operation count: 1
- Verifier status: `hold`

## Confirmed Configuration: Volcengine Ark

- Provider: Volcengine Ark
- Base URL: `https://ark.cn-beijing.volces.com/api/v3`
- Model: `doubao-seed-2-0-pro-260215`
- Transport: `chat_completions`
- Response format: `json_object`
- Case: `normal_timeout_repair`
- Repeat: `3`

## Volcengine Ark Result

- 3/3 attempts reached `verifier_completed`
- Schema validation: valid
- Semantic validation: valid
- Conflicts: 0
- Operation count: 1
- Verifier status: `hold`

Additional Ark model IDs tested with the same key and base URL:

- `doubao-seed-2-1-pro-260628`: HTTP 404
- `deepseek-v4-pro-260425`: HTTP 404

The 404 results indicate that the current key, region, model ID, or endpoint ID combination was not callable. They do not indicate an AI Patch Proposal schema, semantic validation, patch preview, or verifier failure.

## Confirmed Configuration: Alibaba Cloud Bailian

- Provider: Alibaba Cloud Bailian / DashScope
- Base URL: `https://dashscope.aliyuncs.com/compatible-mode/v1`
- Model: `qwen3.7-plus`
- Transport: `chat_completions`
- Response format: `json_object`
- Case: `normal_timeout_repair`
- Repeat: `3`

## Alibaba Cloud Bailian Result

- 3/3 attempts reached `verifier_completed`
- Schema validation: valid
- Semantic validation: valid
- Conflicts: 0
- Operation count: 1
- Verifier status: `hold`

## Interpretation

This demonstrates the minimal real-model happy path for v0.4 AI Patch Proposal:

```text
real model output
  -> structured AI PatchProposal
  -> Zod schema validation
  -> semantic validation
  -> conflict detection
  -> deterministic patch engine preview
  -> deterministic verifier
  -> human review boundary
```

The result does not prove that a model is always reliable. It proves that a real model can produce a valid constrained PatchOperation candidate and that OpenWorkflowDoctor still routes it through deterministic validation, preview, verifier, and human review boundaries.

## Trust Boundary

- Real model output cannot directly apply patches.
- AI cannot change verifier status.
- AI cannot change human review.
- AI cannot export n8n-importable workflows.
- Deterministic verifier and human review remain required.

## Release Note Draft

OpenWorkflowDoctor v0.4.2 improves manual real-model smoke testing for AI Patch Proposal.

Highlights:

- Added targeted manual smoke cases.
- Added `normal_timeout_repair` as the recommended first real-model happy path.
- Added repeat controls for real-provider testing.
- Improved safe diagnostics for provider, model, and schema failures.
- Demonstrated a real-model path reaching deterministic verifier: schema valid -> semantic valid -> conflict check -> patch preview -> verifier hold.
