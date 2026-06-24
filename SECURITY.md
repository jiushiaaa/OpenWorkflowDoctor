# Security

OpenWorkflowDoctor is local-first and review-first. It reviews exported n8n workflows; it does not run them.

## Supported Security Model

- OpenWorkflowDoctor does not execute workflows.
- OpenWorkflowDoctor does not trigger external workflow side effects.
- OpenWorkflowDoctor does not connect to production n8n in the current MVP.
- OpenWorkflowDoctor does not write back to n8n.
- Imported workflow JSON is parsed into secret-safe `WorkflowIR` before review.
- Sensitive values such as API keys, authorization headers, passwords, tokens, private keys, credentials, and secrets are redacted before they enter WorkflowIR, UI summaries, or review exports.
- API keys for AI providers are stored only in local browser settings for BYOK use.
- API keys are not included in WorkflowIR.
- API keys are not included in Doctor Review Packets.
- API keys are not included in workspace documents.
- API keys are not included in GitHub release notes, smoke result docs, or public docs.

## AI Provider Boundary

- AI Explainer output is advisory only.
- AI Patch Proposal can only propose structured `PatchOperation` candidates.
- AI output must pass Zod validation, semantic validation, conflict detection, deterministic patch preview, verifier, and human review.
- AI cannot mutate raw n8n JSON.
- AI cannot apply patches directly.
- AI cannot change verifier status.
- AI cannot change human review.
- AI cannot export n8n-importable workflows.
- Raw n8n JSON, credentials, provider config, raw prompts, raw model responses, and human review state must not be sent to AI providers.

## User Guidance

- Do not upload workflows that contain secrets in names, labels, descriptions, or other human-readable fields.
- Treat imported workflow content as untrusted data.
- Review every PatchOperation before previewing or accepting a patch.
- Treat Review Packets as handoff artifacts for human approval, not proof of runtime safety.
- Keep local provider API keys out of screenshots, issue reports, logs, and public documentation.

## Reporting Issues

If you find a security issue, do not open a public issue containing secrets, API keys, private workflow data, raw provider responses, or private n8n URLs. Report only the minimal reproducible behavior and redact sensitive data first.

## Out of Scope for MVP

- Workflow execution.
- Credential lookup or credential storage.
- Production n8n API integration.
- Automatic write-back to n8n.
- n8n-importable patched workflow export.
- AI mutation of raw workflow JSON.
