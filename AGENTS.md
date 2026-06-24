# AGENTS.md

## Project

This project is `n8n Workflow Doctor`, a Workflow Reliability IDE for existing n8n workflows.

## Product principles

1. This is not a workflow builder.
2. This is not a workflow runtime.
3. This product never executes real workflow side effects in the MVP.
4. The product helps users understand, diagnose, patch, and verify existing workflows.
5. AI-generated changes must always be reviewable before being applied.

## Architecture principles

1. Never let an LLM directly mutate raw n8n JSON.
2. Always parse imported workflow JSON into WorkflowIR first.
3. All patch proposals must be represented as structured PatchOperation objects.
4. Patch generation and verification must be separate steps.
5. A Builder Agent can propose changes, but only a Verifier can mark them pass / hold / fail.
6. Rule-based diagnostics should work without LLM.
7. LLM output must be validated with Zod.
8. Unknown node types must not crash the system.
9. External credentials must never be read or stored.
10. Production n8n API integration is out of scope for MVP.

## Testing requirements

Every core package change must include tests.

Run:

* npm test
* npm run typecheck
* npm run lint

Do not mark a task complete unless tests pass.
