# Roadmap

OpenWorkflowDoctor is a local-first Workflow Review IDE for existing workflow artifacts. It is not a workflow builder, workflow runtime, automatic workflow fixer, or production platform connector.

## Current Frozen Release

`v0.9.1` is the current freeze-audit release: Security / Dependency / Release Hardening. It preserves the v0.9.0 Review Packet export surface while hardening dependency audit status, sentinel leakage coverage, CI/release gates, Docker/env defaults, and v1 readiness docs.

The current product loop is:

```text
import exported n8n workflow, read-only n8n workflow, Dify DSL YAML, Coze definition JSON, or Custom Graph JSON
  -> parse into secret-safe WorkflowIR
  -> run static diagnostics
  -> generate JSON/Markdown/HTML review artifacts
  -> optionally request advisory AI explanation
  -> optionally request constrained AI PatchOperation proposal
  -> validate with Zod, semantic checks, and conflict detection
  -> preview deterministically
  -> run Verifier
  -> require Human Review
```

## Near-term Public Readiness

- Gather feedback from real n8n users before starting v0.5 implementation.
- Validate whether users prefer exported JSON review, read-only n8n import, or deeper AI patch assistance.
- Keep release notes explicit about AI and provider trust boundaries.
- Do not add new runtime behavior during public-readiness cleanup.

## v0.4.4 - Public Demo Polish

Scope:

- README first-screen clarity.
- Short demo GIF.
- Demo and feedback guides.
- GitHub topics.
- Issue templates.
- Pinned roadmap issue.

Non-goals:

- Read-only n8n import.
- Production n8n API connection.
- Workflow execution.
- Credential lookup or storage.
- Automatic write-back.

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

## v0.6.0 - Freeze Candidate: Dify DSL Import

Scope:

- Local `.yml` / `.yaml` upload.
- Dify DSL to secret-safe WorkflowIR.
- Dify source metadata in workspace and Review Packet.
- Dify-specific diagnostics for secrets, code, tools, retrieval resources, branches, app modes, and DSL versions.
- No Dify API connection.
- No workflow execution.
- No publish or write-back.
- No patched Dify DSL export.

## v0.6.1 - Deferred: Dify Read-only Import, Experimental

Status: deferred.

Scope of the v0.6.1 note:

- Document feasibility for remote Dify DSL acquisition only.
- Keep local Dify DSL YAML import as the stable supported path.
- Treat Dify console APIs as internal, version-sensitive, and not stable public APIs.
- Require any future implementation to be experimental and hidden behind a feature flag.
- Require a Dify Cloud + self-hosted smoke matrix before any user-facing release.

Non-goals:

- Dify app runtime API calls.
- Chat, completion, or workflow-run calls.
- Dify publish or write-back.
- Dify app mutation.
- Dataset, plugin, file, or resource fetching.
- Secret export.
- Raw DSL persistence.

## v0.7.0 - Freeze Candidate: Coze Workflow Definition Import

Scope:

- Manual Coze workflow definition `.json` upload.
- Direct canvas and wrapped canvas shape detection.
- Coze-to-WorkflowIR mapping with source metadata.
- Secret-safe redaction before persistence, UI, AI context, and Review Packet export.
- Coze-specific diagnostics for unstable artifacts, unknown nodes, broken edges, plugins/tools, HTTP, code, knowledge, database, subworkflow, files, conditions, loops, batches, and missing error strategy.
- Coze source badge and diagnosis-only warning in the workbench.

Non-goals:

- Coze cloud direct connection.
- Coze runtime workflow/chatflow API calls.
- Coze workflow execution.
- Publish or write-back to Coze.
- Credential inspection or resolution.
- Fetching plugins, datasets, files, bots, apps, variables, workspaces, child workflows, or runtime traces.
- Raw Coze JSON persistence.
- Coze-importable patched workflow export.

## v0.8.0 - Freeze Candidate: Adapter SDK / Source Adapter Framework

Scope:

- Stable internal `WorkflowSourceAdapter` contract.
- Static built-in adapter registry.
- Unified file/manual artifact import pipeline.
- Shared redaction and guardrails.
- Source metadata in WorkflowIR, workspace, UI, AI-safe context, Verifier flow, and Review Packet.
- Adapter conformance test kit.
- Built-in Custom Graph JSON adapter and sample.
- Registry-driven import menu, supported sources panel, and source badges.

Non-goals:

- Third-party executable adapters.
- Adapter plugin marketplace.
- Remote adapter loading.
- User-uploaded JavaScript adapters.
- Platform write-back or native platform patch export.
- Workflow execution, runtime logs, credential inspection, runtime plugin execution, or cloud sync.

## v0.9.0 - Frozen: Review Packet Export Polish

Scope:

- Preserve existing JSON Review Packet export.
- Add Markdown Review Report export.
- Add static HTML Review Report export with no JavaScript or external assets.
- Add readable Review Packet / Report preview sections in the workbench.
- Include adapter metadata, source warnings, redaction summary, verifier result, human review state, and review target fingerprint in reports.
- Mark stale reports when the active report fingerprint is outdated.
- Add sentinel tests for JSON, Markdown, HTML, Review Packet Artifact shape, and AI patch input.

Non-goals:

- New workflow source platforms.
- Workflow execution.
- Platform write-back.
- Credential inspection.
- Platform-native patch export.
- Cloud sharing, accounts, teams, comments, or hosted collaboration.

## v0.9.1 - Freeze Audit: Security / Dependency / Release Hardening

Scope:

- Remediate the Vitest/Vite/esbuild audit chain without forced dependency churn.
- Document the remaining Next/PostCSS transitive audit risk if no safe override exists.
- Add Release Gate CI for unit tests, lint, typecheck, build, e2e, and audit reporting.
- Keep Docker Smoke separate and Node 24-compatible on GitHub-hosted runners.
- Expand final v1 preflight sentinel coverage across WorkflowIR, workspace documents, Review Packet artifacts, reports, AI contexts, adapter metadata, source diagnostics, and report preview state where testable.
- Synchronize public docs and v1 readiness criteria.

Non-goals:

- Product feature expansion.
- New workflow sources.
- Workflow execution.
- Platform write-back.
- Credential inspection.
- Platform-native patch export.
- Dify or Coze direct cloud import as default integrations.
- Runtime logs, agent harnesses, cloud sync, accounts, collaboration, or public plugins.

## v0.10.0+ - Planned: Execution Logs and Observability Analysis

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
