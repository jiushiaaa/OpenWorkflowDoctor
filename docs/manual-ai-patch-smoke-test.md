# Manual AI Patch Proposal Smoke Test

This smoke test is optional. It is not part of default CI, and normal tests do not require an AI API key.

Mock and deterministic tests remain the automated correctness source. This manual smoke only checks that a real OpenAI-compatible model can move safely through the v0.4 AI Patch Proposal chain:

```text
real model output
  -> AI Patch Proposal Zod schema validation
  -> semantic validation
  -> conflict detection
  -> deterministic patch engine preview
  -> deterministic verifier
  -> human review remains required by schema
```

## Environment

Set these variables only in your local shell. Do not commit them.

```bash
OPENWORKFLOWDOCTOR_AI_BASE_URL="https://api.openai.com/v1"
OPENWORKFLOWDOCTOR_AI_API_KEY="..."
OPENWORKFLOWDOCTOR_AI_MODEL="gpt-4.1-mini"
OPENWORKFLOWDOCTOR_AI_TRANSPORT="responses"
OPENWORKFLOWDOCTOR_AI_RESPONSE_FORMAT="json_object"
OPENWORKFLOWDOCTOR_AI_TIMEOUT_MS="15000"
OPENWORKFLOWDOCTOR_AI_CASE="all"
OPENWORKFLOWDOCTOR_AI_REPEAT="1"
```

The script appends `/responses` when the base URL does not already end with `/responses`.

`OPENWORKFLOWDOCTOR_AI_TRANSPORT` is optional:

- `responses` uses the OpenAI Responses endpoint family. This is the default.
- `chat_completions` uses the OpenAI Chat Completions endpoint family.

For Chat Completions compatibility testing:

```bash
OPENWORKFLOWDOCTOR_AI_TRANSPORT="chat_completions"
```

`OPENWORKFLOWDOCTOR_AI_RESPONSE_FORMAT` is optional:

- `none`: no `response_format`; prompt instructs JSON only.
- `json_object`: sends JSON-object response format where supported. This is the default for `chat_completions`.
- `json_schema`: sends the AI Patch Proposal JSON schema where supported.

Use `json_object` first for OpenAI-compatible relays:

```bash
OPENWORKFLOWDOCTOR_AI_BASE_URL="https://us.novaiapi.com/v1"
OPENWORKFLOWDOCTOR_AI_MODEL="gemini-3-pro-preview"
OPENWORKFLOWDOCTOR_AI_TRANSPORT="chat_completions"
OPENWORKFLOWDOCTOR_AI_RESPONSE_FORMAT="json_object"
OPENWORKFLOWDOCTOR_AI_TIMEOUT_MS="60000"
```

If `json_object` still reaches `zod_invalid` because the model omits envelope fields, try:

```bash
OPENWORKFLOWDOCTOR_AI_RESPONSE_FORMAT="json_schema"
```

Some providers reject `json_schema`; that should appear as `provider_http_error` and does not mean OpenWorkflowDoctor's validator failed.

`OPENWORKFLOWDOCTOR_AI_TIMEOUT_MS` is optional and defaults to `15000`. Increase it for slow real-model compatibility checks, for example:

```bash
OPENWORKFLOWDOCTOR_AI_TIMEOUT_MS="60000"
```

`OPENWORKFLOWDOCTOR_AI_CASE` is optional:

- `all`
- `normal_repair`
- `normal_timeout_repair`
- `prompt_injection`
- `unsupported_operation`
- `prose_only`
- `semantic_conflict`

`OPENWORKFLOWDOCTOR_AI_REPEAT` is optional, defaults to `1`, and is capped at `5` to avoid accidental high-cost runs.

For the recommended first happy-path test with NovAI, use the smallest supported repair: add a timeout to one HTTP request node. This avoids synthetic `newNode` generation and focuses on the real-provider chain:

```bash
OPENWORKFLOWDOCTOR_AI_BASE_URL="https://us.novaiapi.com/v1"
OPENWORKFLOWDOCTOR_AI_MODEL="gemini-3-pro-preview"
OPENWORKFLOWDOCTOR_AI_TRANSPORT="chat_completions"
OPENWORKFLOWDOCTOR_AI_RESPONSE_FORMAT="json_object"
OPENWORKFLOWDOCTOR_AI_TIMEOUT_MS="120000"
OPENWORKFLOWDOCTOR_AI_CASE="normal_timeout_repair"
OPENWORKFLOWDOCTOR_AI_REPEAT="3"
```

PowerShell:

```powershell
$env:OPENWORKFLOWDOCTOR_AI_BASE_URL='https://us.novaiapi.com/v1'
$env:OPENWORKFLOWDOCTOR_AI_MODEL='gemini-3-pro-preview'
$env:OPENWORKFLOWDOCTOR_AI_TRANSPORT='chat_completions'
$env:OPENWORKFLOWDOCTOR_AI_RESPONSE_FORMAT='json_object'
$env:OPENWORKFLOWDOCTOR_AI_TIMEOUT_MS='120000'
$env:OPENWORKFLOWDOCTOR_AI_CASE='normal_timeout_repair'
$env:OPENWORKFLOWDOCTOR_AI_REPEAT='3'
npm run test:ai:manual
```

Optional debug:

```bash
DEBUG_AI_PATCH=1
```

`DEBUG_AI_PATCH=1` prints the raw model response. Leave it off for normal use because raw responses may contain unsafe content. The script never prints the API key, raw n8n JSON, or raw prompt.

## Run

```bash
npm run test:ai:manual
```

If any required environment variable is missing, the script prints a skipped message and exits with code 0.

The script uses:

```text
samples/n8n/refund-risky.workflow.json
```

It parses that sample locally into `WorkflowIR`, builds `AiPatchProposalInput`, and sends only that AI-safe patch input to the configured model. It never sends raw n8n JSON.

## Suggested Manual Model Order

Use one model at a time. The goal is not a broad model benchmark; it is to prove that OpenWorkflowDoctor remains safe when model output varies.

Recommended order:

1. Strong structured-output-capable model from your primary provider.
   Example model id: `doubao-seed-2-0-pro-260215`, or the latest equivalent model or endpoint id available in your provider console.
2. Lower-cost model from the same provider.
   Example model id: `doubao-seed-2-0-lite-260215` or `doubao-seed-2-0-mini-260215`.
3. OpenAI-compatible relay model.
   Example base URL: `https://us.novaiapi.com/v1`.
   Example model id: `[次]gemini-2.5-pro`.

Passing does not mean the model always repairs perfectly. Passing means valid proposals can continue through deterministic validation, invalid proposals are stopped, and verifier plus human review authority are preserved.

## Cases

The manual smoke runs six real-model cases:

- normal repair request
- normal timeout repair request
- prompt injection request
- unsupported operation request
- prose-only request
- semantic conflict request

For each case, it prints only a safe summary:

- case name
- repeat index
- provider label
- model label
- transport used
- response format mode
- failure stage
- HTTP status when available
- response shape summary
- schema valid / invalid
- semantic valid / invalid
- conflicts count
- operation count
- verifier status
- elapsed ms
- Zod issue count when schema validation fails
- top 5 safe Zod issue summaries when schema validation fails

Expected behavior is not that every model answer is useful. The expected behavior is that unsafe, unsupported, prose-only, stale, or conflicting model output is stopped before preview, and that any valid preview runs only through the deterministic patch engine and verifier.

`normal_timeout_repair` is the recommended first happy-path case. It asks for one `update_node_parameters` operation using an allowed `timeout` parameter and does not require a synthetic `newNode`.

`normal_repair` is broader. It may ask the model to generate synthetic nodes for error handling or guard behavior. If that case reaches `zod_invalid` on paths such as `proposal.operations.0.newNode.parameters`, the model generated a proposal-shaped answer but failed the structured contract. That is a safe stop, not a reason to loosen the schema.

Successful v0.4 real-model happy path means:

- schema is valid
- semantic validation is valid
- conflicts are none or informational
- operation count is greater than 0
- deterministic patch preview succeeds
- verifier reaches `verifier_completed`

`json_object` is currently the recommended NovAI mode. `json_schema` may return HTTP 400 depending on provider compatibility.

## Failure Stages

The smoke runner distinguishes these safe failure stages:

- `skipped_missing_env`: required opt-in environment variables are absent.
- `provider_request_failed`: the provider request failed before an HTTP response was available.
- `provider_timeout`: the provider request timed out.
- `provider_http_error`: the provider returned a non-2xx status.
- `missing_output_text`: the provider response did not contain extractable model text.
- `json_parse_failed`: model text was present but was not valid JSON.
- `zod_invalid`: model JSON did not match the strict AI Patch Proposal schema.
- `semantic_invalid`: schema passed, but deterministic semantic validation did not pass.
- `conflict_blocker`: schema passed, but deterministic conflict detection found a blocking conflict.
- `patch_preview_failed`: deterministic patch preview failed.
- `verifier_completed`: deterministic patch preview and verifier both ran.

The response shape summary is intentionally coarse:

```text
has_output=true/false
has_choices=true/false
has_message_content=true/false
has_output_text=true/false
content_type=string/array/unknown
```

Use it to tell whether a provider looks like Responses API, Chat Completions API, or neither. It does not include raw model output.

## Zod Issue Summaries

When a case reaches `zod_invalid`, the runner prints a safe schema summary instead of raw model output:

```text
zod issue count: 3
zod issue: path=proposal.operations, category=missing_required_field, code=invalid_type, expected=array, received=undefined, message=Required field is missing.
```

Each issue summary may include:

- `path`: schema path, for example `proposal.operations.0.newNode.parameters`
- `category`: compact category
- `code`: Zod issue code
- `expected`: expected shape or literal category when available
- `received`: received value type only, never the raw value
- `message`: safe generic message

Categories:

- `missing_required_field`
- `unknown_field`
- `wrong_literal`
- `wrong_type`
- `unsupported_enum_value`
- `array_too_large`
- `string_too_long`
- `nested_schema_error`
- `unknown`

The runner also prints an aggregate summary:

- attempts
- verifier completed count
- timeout count
- provider error count
- semantic invalid count
- conflict blocker count
- best reached stage
- how many cases reached a provider response
- how many reached output text
- how many parsed JSON
- how many failed Zod
- top recurring Zod paths
- top recurring Zod categories

Use the Zod summary to improve prompts or provider request formatting without weakening validation:

- Missing root fields such as `proposal` or `proposal.operations`: strengthen the prompt to require the full `AiPatchProposalCandidate` envelope.
- `schemaVersion` or `requiresHumanReview` literal failures: restate those literals exactly.
- Unsupported operation types such as deletion or credential edits: keep rejecting them and clarify v0.4 allowed operations.
- Missing `targetNodeId` or unknown operation fields: strengthen the prompt to require `targetNodeId` exactly and provide a minimal operation example.
- Missing `newNode.parameters`: add a minimal valid synthetic node example to the prompt.
- Repeated JSON shape failures with Chat Completions providers: compare `OPENWORKFLOWDOCTOR_AI_RESPONSE_FORMAT=json_object` and `OPENWORKFLOWDOCTOR_AI_RESPONSE_FORMAT=json_schema`.

Invalid outputs are expected to be rejected. Do not loosen the AI Patch Proposal schema, auto-repair JSON, or use another model to rewrite the response just to reach preview.

## CI Boundary

Do not add this script to default CI. It depends on a real provider, model behavior, network availability, and local credentials.

Use the existing automated suite for correctness:

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```
