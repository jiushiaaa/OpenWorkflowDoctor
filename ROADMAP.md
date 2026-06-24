# Roadmap

OpenWorkflowDoctor is a local-first Workflow Review IDE for existing n8n workflows. It is not a workflow builder, workflow runtime, automatic n8n fixer, or production n8n connector.

## Current Stable Release

`v0.4.3` is the current stable release: Provider Presets & Compatibility Registry.

The current product loop is:

```text
import exported n8n workflow
  -> parse into secret-safe WorkflowIR
  -> run static diagnostics
  -> generate Review Packet
  -> optionally request advisory AI explanation
  -> optionally request constrained AI PatchOperation proposal
  -> validate with Zod, semantic checks, and conflict detection
  -> preview deterministically
  -> run Verifier
  -> require Human Review
```

## Near-term Public Readiness

- Keep README, CHANGELOG, SECURITY, release notes, demo script, and roadmap aligned with the latest stable release.
- Add or refresh screenshots and short demo media.
- Keep release notes explicit about AI and provider trust boundaries.
- Do not add new runtime behavior during public-readiness cleanup.

## v0.5.0 - Planned: Read-only n8n Import

v0.5 should start with a design document before implementation.

Planned scope:

- n8n base URL setting.
- n8n API key setting.
- Read-only workflow list fetch.
- Read-only workflow import.
- Credential metadata avoidance.
- No workflow execution.
- No write-back.
- No automatic patch application.
- No production side effects.

Required design questions:

- What exact n8n API fields are fetched?
- How are credentials, credential names, and metadata avoided or redacted?
- How does imported remote data enter WorkflowIR?
- How is read-only mode made visible in the UI?
- How are provider keys and n8n API keys kept separate?
- What evidence proves no execution or write-back path exists?

## v0.6.0 - Planned: Execution Logs and Observability Analysis

Possible later scope:

- Import or paste execution logs.
- Analyze failure paths, slow nodes, retries, and error hotspots.
- Keep log analysis separate from workflow execution.
- Redact sensitive log values before storage, AI use, or export.

## Explicit Non-goals

- Running workflows.
- Building new workflows from scratch.
- Automatically fixing production workflows.
- Reading or storing external credentials.
- Writing back to n8n.
- Exporting n8n-importable patched workflows in the MVP.
- Letting AI bypass deterministic validation, verifier gates, or human review.
