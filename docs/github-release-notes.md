# GitHub Release Notes

Use these notes when creating GitHub Releases for the existing tags. `v0.4.3` is the most important public release.

## v0.4.3

Title:

```text
OpenWorkflowDoctor v0.4.3
```

Body:

```text
Provider Presets & Compatibility Registry.

Highlights:
- Added provider registry.
- Added Settings provider dropdown.
- Added Verified / Preset / Experimental / Custom provider tiers.
- Added transport and responseFormat configuration.
- Added manual smoke preset support.
- Verified real-model happy path providers:
  - NovAI
  - Volcengine Ark
  - Alibaba Bailian / DashScope

Trust boundaries:
- Provider presets do not add new patch authority.
- AI still cannot mutate raw n8n JSON.
- AI still cannot apply patches directly.
- AI still cannot change Verifier status.
- AI still cannot change Human Review.
- AI still cannot export n8n-importable workflows.
- Zod validation, semantic validation, conflict detection, deterministic patch preview, Verifier, and Human Review remain authoritative.
```

## v0.4.2

Title:

```text
OpenWorkflowDoctor v0.4.2
```

Body:

```text
Real-model happy path / provider compatibility.

Highlights:
- Added targeted manual AI Patch Proposal smoke tests.
- Added normal_timeout_repair as the recommended first real-model happy path.
- Added repeat controls for real-provider testing.
- Improved safe diagnostics for provider, model, and schema failures.
- Verified the minimal path from real model output to deterministic verifier completion.

Trust boundaries:
- Manual real-model smoke tests are optional and are not part of default CI.
- Real model output cannot directly apply patches.
- AI cannot change Verifier status.
- AI cannot change Human Review.
- Deterministic validation, patch preview, Verifier, and Human Review remain required.
```

## v0.4.0

Title:

```text
OpenWorkflowDoctor v0.4.0
```

Body:

```text
Constrained AI Patch Proposal.

Highlights:
- Added AI-assisted Patch Proposal.
- AI can only output structured PatchOperation candidates.
- Added Zod validation, semantic validation, conflict detection, deterministic patch preview, Verifier integration, and Human Review boundaries.
- Kept deterministic diagnostics and deterministic patch proposals available without AI.

Trust boundaries:
- AI is a constrained Builder only.
- AI cannot mutate raw n8n JSON.
- AI cannot apply patches.
- AI cannot change Verifier status or Human Review.
- AI output must remain reviewable before preview or acceptance.
```

## v0.3.2

Title:

```text
OpenWorkflowDoctor v0.3.2
```

Body:

```text
Public GitHub readiness cleanup.

Highlights:
- Added public readiness notes.
- Documented npm audit findings and deferred maintenance decisions.
- Cleaned up public-facing docs without changing runtime behavior.

Trust boundaries:
- No runtime behavior changed in this release.
- OpenWorkflowDoctor remains local-first and review-first.
```

## v0.3.1

Title:

```text
OpenWorkflowDoctor v0.3.1
```

Body:

```text
Workbench Refactor.

Highlights:
- Split Workbench UI into components and controller hooks.
- Kept deterministic review behavior unchanged.
- Made the frontend structure easier to extend.

Trust boundaries:
- Refactor only.
- No new AI authority, n8n execution, production connection, or write-back behavior.
```

## v0.3.0

Title:

```text
OpenWorkflowDoctor v0.3.0
```

Body:

```text
Local Workspace + Multiple Workflows.

Highlights:
- Added local browser workspace.
- Added multiple workflow document management.
- Added state restoration.
- Added multi-workflow switching without automatic Doctor reruns.

Trust boundaries:
- Workspace state stays local.
- Workspace documents store secret-safe WorkflowIR and derived review state.
- No credentials, production connections, workflow execution state, or n8n-importable patches are stored.
```

## v0.2.0

Title:

```text
OpenWorkflowDoctor v0.2.0
```

Body:

```text
Advisory AI Explainer + Settings + i18n + BYOK Provider.

Highlights:
- Added advisory AI explanations.
- Added local Settings.
- Added zh-CN and en-US UI copy.
- Added browser-local BYOK AI provider configuration.
- Added deterministic fallback when no AI provider is configured.

Trust boundaries:
- AI Explainer is advisory-only.
- AI cannot create PatchOperation.
- AI cannot change Verifier status.
- AI cannot change Human Review.
- API keys stay in browser-local settings and are not included in WorkflowIR or Review Packets.
```

## v0.1.0

Title:

```text
OpenWorkflowDoctor v0.1.0
```

Body:

```text
Deterministic Workflow Doctor + Review Packet.

Highlights:
- Added deterministic WorkflowIR parsing for exported n8n JSON.
- Added static workflow diagnostics.
- Added Review Packet export.
- Added Verifier and Human Review boundaries.
- Added the first local web workbench.

Trust boundaries:
- OpenWorkflowDoctor does not execute workflows.
- OpenWorkflowDoctor does not connect to production n8n.
- Review Packets are review artifacts, not n8n-importable workflow patches.
```
