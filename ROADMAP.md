# Roadmap

OpenWorkflowDoctor is a local-first Workflow Review IDE for existing workflow artifacts. It is not a workflow builder, workflow runtime, automatic workflow fixer, or production platform connector.

## Current Freeze Candidate

`v0.7.0` is the current freeze candidate: Coze Workflow Definition JSON Import. It adds local manual Coze definition import while preserving the same review-only WorkflowIR boundary.

The current product loop is:

```text
import exported n8n workflow, read-only n8n workflow, Dify DSL YAML, or Coze definition JSON
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

## v0.8.0+ - Planned: Execution Logs and Observability Analysis

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
