# Changelog

All notable OpenWorkflowDoctor releases are listed here. OpenWorkflowDoctor reviews workflows; it does not run them.

## v0.8.0 - Adapter SDK / Source Adapter Framework

- Added the internal built-in `WorkflowSourceAdapter` contract and static adapter registry.
- Added the unified source artifact import pipeline for file/manual imports.
- Added shared adapter metadata for WorkflowIR, workspace documents, UI badges, AI-safe context, Verifier flow, and Review Packets.
- Added shared source adapter conformance tests.
- Added the built-in Custom Graph JSON adapter and sample artifact.
- Added adapter SDK, Custom Graph JSON, and conformance documentation.

Trust boundaries:

- No public plugin system, user-uploaded JavaScript adapter, remote adapter loading, adapter marketplace, workflow execution, platform write-back, credential inspection, runtime plugin execution, or cloud sync was added.
- AI Patch Proposal remains WorkflowIR-only.

## v0.7.0 - Coze Workflow Definition Import

- Added manual Coze workflow definition JSON import.
- Added Coze source metadata, source badge, diagnosis-only warning, and inspector source metadata.
- Added Coze-to-WorkflowIR mapping for known node families, unknown node diagnostics, edge/branch mapping, and composite block flattening.
- Added Coze-specific diagnostics for unstable artifacts, broken edges, side effects, HTTP auth/timeout risk, code, knowledge, database, subworkflow, files, conditions, loops, batches, and missing error strategy.
- Added Coze redaction before persistence, UI, AI context, and Review Packet export.

Trust boundaries:

- No Coze cloud connection, API call, runtime workflow/chatflow call, execution, publish, write-back, credential inspection, resource fetch, raw Coze JSON persistence, or Coze-importable patch export was added.
- AI Patch Proposal remains WorkflowIR-only.

## v0.4.4 - Public Demo Polish

- Tightened the README first screen around the core product boundary.
- Added a short demo GIF.
- Added a demo guide and feedback guide for first-time users.
- Added GitHub issue templates for feedback and bug reports.
- Added a pinned roadmap issue for v0.5 read-only n8n import.
- Added repository topics for GitHub discovery.

Trust boundaries:

- No workflow runtime, production n8n connection, credential lookup, or write-back behavior was added.
- AI still cannot mutate raw n8n JSON, apply patches, change verifier status, change human review, or bypass deterministic validation.

## v0.4.3 - Provider Presets & Compatibility Registry

- Added the provider compatibility registry.
- Added the Settings provider dropdown.
- Added Verified, Preset, Experimental, and Custom provider tiers.
- Added provider transport and response format configuration.
- Added manual smoke preset support for provider compatibility checks.
- Verified the `normal_timeout_repair` real-model path with NovAI, Volcengine Ark, and Alibaba Bailian / DashScope.

Trust boundaries:

- Provider presets do not add new patch authority.
- AI still cannot mutate raw n8n JSON, apply patches, change verifier status, change human review, or export n8n-importable workflows.
- Zod validation, semantic validation, conflict detection, deterministic patch preview, verifier, and human review remain authoritative.

## v0.4.2 - Real-model Happy Path / Provider Compatibility

- Added targeted manual real-model smoke testing for AI Patch Proposal.
- Added `normal_timeout_repair` as the recommended first real-model happy path.
- Added repeat controls and safe provider failure diagnostics.
- Recorded the minimal real-model path from provider output to deterministic verifier completion.

Trust boundaries:

- Manual real-model smoke tests are optional and are not part of default CI.
- Real model output cannot directly apply patches, change verifier status, change human review, or bypass deterministic validation.
- Results prove the constrained path can work with real providers; they do not prove model reliability.

## v0.4.1 - Internal Diagnostics Iteration

- Internal diagnostics iteration only.
- No public tag was created.

## v0.4.0 - Constrained AI Patch Proposal

- Added AI-assisted Patch Proposal.
- Restricted AI output to structured `PatchOperation` candidates.
- Added Zod validation, semantic validation, conflict detection, deterministic patch preview, verifier integration, and human review boundaries for AI-assisted proposals.
- Kept deterministic diagnostics and deterministic patch proposal behavior available without an AI provider.

Trust boundaries:

- AI is a constrained Builder only.
- AI cannot read raw n8n JSON, credentials, provider config, raw Review Packets, or human review state.
- AI cannot apply patches, mutate raw workflow data, mark verifier gates, or decide acceptance.

## v0.3.2 - Public GitHub Readiness Cleanup

- Added public GitHub readiness notes.
- Documented dependency audit findings and deferred maintenance decisions.
- Cleaned up public-facing documentation without changing runtime behavior.

## v0.3.1 - Workbench Refactor

- Split Workbench UI into components and controller hooks.
- Kept deterministic workflow review behavior unchanged.
- Prepared the frontend structure for later review, AI, and workspace extensions.

## v0.3.0 - Local Workspace + Multiple Workflows

- Added a local browser workspace.
- Added multiple workflow document management.
- Added state restoration for active workflow review sessions.
- Added multi-workflow switching without rerunning Doctor automatically.

Trust boundaries:

- Workspace state remains local browser state.
- Workspace documents store secret-safe WorkflowIR and derived review state, not credentials, production connections, or executable workflow state.

## v0.2.0 - Advisory AI Explainer + Settings + i18n + BYOK Provider

- Added advisory AI explanations.
- Added local Settings.
- Added `zh-CN` and `en-US` UI copy.
- Added browser-local BYOK provider configuration.
- Added deterministic fallback when no AI provider is configured.

Trust boundaries:

- AI Explainer is advisory-only.
- AI cannot create `PatchOperation`, change verifier status, change human review, or affect acceptance.
- API keys stay in browser-local settings and are not included in WorkflowIR or Review Packets.

## v0.1.0 - Deterministic Workflow Doctor + Review Packet

- Added deterministic WorkflowIR parsing for exported n8n workflow JSON.
- Added static workflow diagnostics.
- Added Review Packet export.
- Added verifier and human review boundaries.
- Added the initial local web workbench.

Trust boundaries:

- OpenWorkflowDoctor does not execute workflows.
- OpenWorkflowDoctor does not connect to production n8n.
- Review Packets are review artifacts, not n8n-importable workflow patches.
