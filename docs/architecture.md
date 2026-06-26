# OpenWorkflowDoctor Architecture

OpenWorkflowDoctor is a Workflow Reliability IDE for existing workflow artifacts. The MVP reads exported n8n workflow JSON, optional read-only n8n workflow definitions, Dify DSL YAML, Coze workflow definition JSON, or Custom Graph JSON, converts them into deterministic `WorkflowIR`, detects static risks, proposes structured patches, and verifies whether changes are safe to accept. It does not execute workflows, read credentials, write back to n8n, Dify, Coze, or custom sources, or trigger external side effects.

## v0.8 Adapter SDK / Source Adapter Framework

v0.8 stabilizes the internal built-in adapter architecture. It is not a public plugin system and does not allow user-uploaded JavaScript adapters, remote adapter loading, adapter marketplaces, platform write-back, workflow execution, credential inspection, runtime plugin execution, or cloud sync.

```text
source artifact or read-only payload
  -> built-in WorkflowSourceAdapter
  -> shared guardrails and redaction
  -> sanitized AdapterImportResult
  -> WorkflowDocument
  -> diagnostics, AI Explainer, AI Patch, Verifier, Human Review, Review Packet
```

The static registry contains `n8n.exportedJson`, `n8n.readonlyImport`, `dify.dslYaml`, `coze.definitionJson`, and `custom.graphJson`. Registry metadata drives the import menu, supported sources panel, source badges, capability labels, docs, and conformance coverage.

Review Packets record sanitized adapter metadata: `adapterId`, `sourceKind`, `sourcePlatform`, `importMethod`, `stability`, source metadata, parser warnings, redaction summary, and source diagnostics. JSON Review Packets, Markdown Review Reports, and static HTML Review Reports are all generated from that sanitized packet data. They do not include raw source artifacts, native platform patch output, secrets, raw prompts, raw code, raw SQL, credentials, or platform-importable patches.

## v0.9 Review Report Export Boundary

v0.9 keeps `DoctorReviewPacket` as the canonical review artifact and adds two human-readable renderers:

```text
DoctorReviewPacket
  -> JSON Review Packet
  -> Markdown Review Report
  -> static HTML Review Report
```

The Markdown and HTML reports include a deterministic section order: header, executive summary, source metadata, trust boundaries, diagnostics, patch proposal, patch diff summary, verifier result, human review, and appendix. The web workbench previews the same review information through overview, risks, patch, verifier, human review, source metadata, and export sections while keeping the raw JSON packet available.

Reports include `reportFormatVersion`, `packetSchemaVersion`, generated timestamp, export kind, review target fingerprint, and adapter metadata. If the active report state is stale or the current fingerprint differs from the packet fingerprint, the UI and rendered reports show a stale warning. HTML exports are static only: no JavaScript, external CSS, external fonts, remote images, or third-party assets.

## v0.7 Coze Workflow Definition Import Boundary

v0.7 adds a manual Coze workflow definition JSON import source while preserving the existing review boundary. It is not a Coze API integration, Coze runtime integration, or Coze workflow builder.

The allowed data flow is:

```text
Coze definition .json
  -> cozeDefinitionSourceAdapter
  -> importCozeDefinitionWorkflow
  -> secret-safe WorkflowIR
  -> WorkflowDocument sourceKind: coze-definition
  -> existing Doctor report, PatchOperation preview, verifier, and Review Packet flow
```

The importer supports direct canvas objects with `nodes` and `edges`, plus wrapped `workflow_schema`, `canvas`, `schema`, `Canvas`, or `CanvasSchema` fields when the wrapped value is either an object or JSON string. Raw Coze JSON is parsed in memory and is not stored in workspace documents. The persisted document stores `WorkflowIR`, sanitized Coze source metadata, parser warnings, Coze diagnostics, and a redaction summary.

Coze import does not call Coze APIs, call runtime workflow/chatflow APIs, execute workflows, publish, write back, inspect credentials, resolve credentials, fetch plugins, fetch datasets, fetch files, fetch bots/apps/variables/workspaces, fetch child workflows, fetch runtime traces, or export patched Coze JSON.

Review Packets record safe Coze source metadata such as `sourceKind: coze-definition`, `sourcePlatform: coze`, source artifact shape, source label, workflow/app name, node count, edge count, redaction summary, parser warnings, and diagnostics. They do not include raw Coze JSON, raw prompts, raw code, raw SQL, plugin ids, dataset ids, workflow ids, bot ids, workspace ids, signed URLs, or credentials.

## v0.6 Dify DSL Import Boundary

v0.6 adds a local Dify DSL YAML import source while preserving the existing review boundary. It is not a Dify API integration and not a Dify workflow builder.

The allowed data flow is:

```text
Dify .yml/.yaml DSL
  -> difyDslSourceAdapter
  -> importDifyDslWorkflow
  -> secret-safe WorkflowIR
  -> WorkflowDocument sourceKind: dify-dsl
  -> existing Doctor report, PatchOperation preview, verifier, and Review Packet flow
```

The importer validates only the basic app/workflow graph shape: `kind`, `version`, `app`, `workflow`, `workflow.graph.nodes`, and `workflow.graph.edges`. Raw YAML is parsed in memory and is not stored in workspace documents. The persisted document stores `WorkflowIR`, sanitized source metadata, parser warnings, Dify diagnostics, and a redaction summary.

Dify import does not call Dify APIs, execute workflows, publish, write back, inspect credentials, fetch datasets, fetch plugins, fetch files, fetch URLs, resolve workspace resources, or export patched Dify DSL.

Review Packets record safe Dify source metadata such as `sourceKind: dify-dsl`, `sourcePlatform: dify`, DSL version, app name/mode, redaction summary, and parser warnings. They do not include raw YAML or secrets.

## v0.5 Read-only n8n Import Boundary

v0.5 adds a read-only n8n import source while preserving the existing local review boundary. It is not a production mutation integration. It only helps users choose an existing workflow from n8n instead of manually exporting JSON.

The allowed data flow is:

```text
n8n workflow list/get response
  -> importN8nReadonlyWorkflow
  -> secret-safe WorkflowIR
  -> WorkflowDocument sourceKind: n8n-readonly
  -> existing Doctor report, PatchOperation preview, verifier, and Review Packet flow
```

The web client exposes only `testConnection`, `listWorkflows`, and `getWorkflow`. The allowed n8n endpoints are `GET /workflows?excludePinnedData=true`, `GET /workflows?limit=1&excludePinnedData=true`, and `GET /workflows/{id}?excludePinnedData=true`. No generic n8n request helper is exposed to the UI.

v0.5 used browser-direct reads and therefore depended on the n8n instance allowing browser CORS from the local workbench origin. v0.5.1 moves the default app path to a local Next.js allowlist proxy at `POST /api/n8n/readonly`. The browser calls only that local route. The route accepts explicit read-only actions, derives the upstream n8n URL internally, forces `excludePinnedData=true`, and forwards only GET requests to n8n. It does not accept arbitrary methods or paths and does not log or persist the n8n API key server-side.

n8n connection metadata is stored separately from workflow documents. Local storage may contain the connection id, label, normalized API root, environment label, auth header name, timestamps, and connection status. The n8n API key is session-only by default and is not stored in IndexedDB, WorkflowIR, Review Packets, Review Packet Artifacts, or Workflow Documents.

Imported n8n workflow documents store only source metadata:

- external workflow id
- connection id and label
- optional environment label
- base URL origin
- imported and last-fetched timestamps
- upstream updated/version/active/tag metadata

Credential references are summarized on nodes as safe presence metadata: credential reference present, credential types, and count. Credential ids, credential names, pinned data, static data, execution data, webhook ids, webhook URLs, sampled payloads, and binary payloads are excluded or redacted before persistence.

Manual refresh fetches the upstream workflow again and converts it through the same adapter. If the source WorkflowIR changed, existing Doctor reports and AI Patch Proposals are marked stale and the user must rerun Doctor. Refresh never writes back to n8n.

Forbidden in v0.5:

- workflow create, update, delete, archive, unarchive, activate, deactivate, transfer, or tag update
- execution list/read/retry/stop/delete
- credential list/read/schema/test/create/update/delete/transfer
- webhook triggering
- n8n-importable patch export
- cloud sync, team auth, or OAuth

## v0.3 Local Workspace Boundary

v0.3 adds a local browser workspace around the deterministic doctor flow. A workspace is only local IDE state for imported exported n8n JSON files. It is not a connected n8n project, not a runtime, and not a collaboration space.

Workspace data is split deliberately:

- `localStorage` keeps small workbench settings: language, theme, and local AI provider configuration.
- IndexedDB keeps workspace metadata, Workflow Documents, and Review Packet Artifacts.

The workspace stores secret-safe `WorkflowIR` and derived review state. It does not store raw imported n8n JSON, credentials, production API connections, workflow execution state, or n8n-importable patches.

Core workspace concepts:

- `LocalWorkspace`: local container with a stable id, active workflow document id, and ordered workflow document ids.
- `WorkflowDocument`: one imported workflow review session containing original `WorkflowIR`, source metadata, patch request, latest `DoctorReport`, UI state, human review draft, and packet artifact ids.
- `ReviewPacketArtifact`: local saved/exported instance of a canonical `DoctorReviewPacket` for one workflow document.

Review packets remain per workflow. The exported packet shape remains `DoctorReviewPacket`; the artifact wrapper exists only for local workspace bookkeeping.

Active workflow switching behaves like switching files in a lightweight IDE:

1. Persist current document state.
2. Set `activeWorkflowDocumentId`.
3. Load the selected Workflow Document.
4. Restore title, graph, selected node, active tab, patch request, latest report, review mode, and human review draft.
5. Do not rerun Doctor automatically.

If the patch request changes after a report exists, the document marks `latestReportState` as `stale`. The user must rerun Doctor before the report, verifier, and review packet reflect the new request.

## v0.4 AI Patch Proposal Boundary

v0.4 adds AI-assisted patch proposal generation without changing the product trust boundary. AI receives only an AI-safe review input derived from secret-safe `WorkflowIR`, synthetic graph ids, aliased issue ids, deterministic diagnostics, a bounded user request, and an explicit capability manifest. It does not receive raw n8n JSON, raw node labels, credentials, API keys, provider config, Review Packet artifacts, raw prompts, raw model responses, or human review state.

AI output must parse as an `openworkflowdoctor.ai-patch-proposal.v1` candidate and pass deterministic semantic validation before it can be previewed. The v0.4 AI-allowed operation set is intentionally small: `insert_error_branch`, `insert_branch_route`, `insert_node_after` with OpenWorkflowDoctor synthetic node types, and `update_node_parameters` only for HTTP `timeout` values from 1000 to 120000. Unsupported operations, stale fingerprints, unmapped targets, duplicate new node ids, existing branch routes, unsupported node types, unsupported parameters, and `idempotencyKey` updates are represented as deterministic `PatchConflict` records.

Previewing an AI proposal still uses the deterministic patch engine, diagnostics, verifier, and human review flow. AI never applies patches, mutates raw n8n JSON, changes verifier status, changes `humanReviewValidation`, executes workflows, calls production n8n, or exports n8n-importable patches. Review Packets record AI-assisted proposal provenance without storing raw prompts, raw responses, API keys, provider endpoints, or provider configuration.

## v0.1 Demo Boundary

v0.1 is a local static analysis and review artifact demo:

- It accepts local exported n8n JSON only.
- Diagnostics are deterministic static heuristics.
- It does not execute workflows or call external services.
- It does not access, resolve, or connect to credentials.
- Patched export is OpenWorkflowDoctor `WorkflowIR`, not n8n-importable JSON.
- Verifier output is review guidance for humans, not proof of runtime safety.

## Product Boundary

OpenWorkflowDoctor is not a workflow builder and not a workflow runtime. The first version focuses on existing n8n exports only. The current web workbench imports local JSON in the browser, keeps original and patched previews separate until review confirmation, and does not connect to production n8n. AI features will be added after the deterministic parser, graph helpers, risk rules, patch model, and verification report are stable.

WorkflowIR is secret-safe by design: imported parameter values are summarized, and sensitive values such as API keys, Authorization headers, passwords, tokens, private keys, credentials, and secrets are replaced with `[redacted]` before they can reach the UI or exported artifacts.

## Suggested Folder Structure

```text
apps/
  web/
    app/
      components/
      hooks/
      lib/
packages/
  workflow-ir/
    src/
      doctor-report.ts
      types.ts
      n8n-parser.ts
      graph.ts
      view-model.ts
      summary.ts
      risk-rules.ts
      patch-proposal.ts
      patch-diff.ts
      patch.ts
      review-packet.ts
      structured-output.ts
      verifier.ts
    tests/
  ai/
    src/
      prompts/
      structured-output.ts
      analyzer-agent.ts
      patch-agent.ts
      verifier-agent.ts
samples/
  n8n/
  dify/
  coze/
```

## Core Data Flow

```text
n8n export JSON
  -> parseN8nWorkflow
  -> secret-safe WorkflowIR
  -> graph helpers, UI graph view model, workflow summary, and static diagnostics
  -> structured PatchOperation proposals and readable patch diff
  -> immutable patched WorkflowIR preview after human review
  -> Verifier-generated VerificationReport
  -> review packet export + acceptance checklist for handoff
  -> separate human accept / hold / reject decision
```

Dify imports enter the same deterministic pipeline after `importDifyDslWorkflow` converts YAML to secret-safe `WorkflowIR`. Coze imports enter it after `importCozeDefinitionWorkflow` converts definition JSON to secret-safe `WorkflowIR`.

The UI-facing deterministic entry point is `createDoctorReport(rawWorkflow, request)`. It returns the original workflow, summary, UI graph view model, diagnostics, patch proposal, readable patch diff, patched workflow, patched UI graph view model, patched diagnostics, verification report, and final acceptance recommendation.

`createDoctorReviewPacket(report)` converts a `DoctorReport` into a serializable handoff artifact with a stable review target fingerprint, before/after risk counts, resolved/remaining/introduced issue ids, readable patch diff, structured operations, patched WorkflowIR, verifier output, an acceptance checklist derived from verifier gates, an optional human review decision, and `humanReviewValidation`.

`renderReviewPacketMarkdownReport(packet)` and `renderReviewPacketHtmlReport(packet)` render that same sanitized packet into team-shareable reports. They summarize review evidence rather than serializing raw source artifacts, raw prompts, raw code, raw SQL, credentials, or native platform patches.

`apps/web` uses these entry points directly for the first workbench: JSON import, graph canvas, node inspector, summary, risk list, patch proposal, reviewed patched preview, verification report, acceptance checklist, human review decision, and local JSON exports.

In v0.3, `apps/web` wraps that same deterministic flow in a local workspace layer. Importing JSON or loading a sample creates a Workflow Document from parsed `WorkflowIR`. Running Doctor persists the latest `DoctorReport` on that document. Exporting a review packet saves a Review Packet Artifact for that document and downloads the canonical packet JSON.

The workbench shell keeps those responsibilities split: `app/page.tsx` composes the IDE, `app/hooks` owns local workspace, deterministic review, and advisory AI explainer orchestration, and `app/components` renders review steps, graph, inspector, console tabs, verifier state, settings, command palette, and status bar through explicit props.

LLMs must never mutate raw n8n JSON. Builder output must be structured and reviewable. Verifier output is separate from patch generation. Verifier gates separate unresolved repairable risks from inherent high-risk side effects that require human acceptance.
Human review decisions are stored separately from verifier status so the artifact can show both what the system proved and what a reviewer chose. A human `accept` decision is considered internally consistent only when every non-pass acceptance checklist item is explicitly confirmed; otherwise `humanReviewValidation` remains `hold`.
The review target fingerprint is computed from the workflow under review, proposed operations, readable diff, patched WorkflowIR, verifier report, and acceptance checklist. It intentionally excludes export time and human-review notes so the same technical review target keeps the same identifier across handoff cycles.
The issue delta is id-based: resolved issues are original diagnostics absent from the patched diagnostics, remaining issues are present in both, and introduced issues appear only after patching.
Future LLM outputs must pass `structured-output.ts` schemas before they can enter patch application or verification.

Comprehensive repair requests are still deterministic in the MVP: they combine the currently supported rule-based fixes into one structured proposal rather than asking a model to freely rewrite the workflow.

Diagnostics evaluate the patched `WorkflowIR` shape, not only individual node parameters. For example, a direct downstream dedupe guard counts as webhook duplicate protection in later verification passes.

## Implemented Deterministic Modules

`packages/workflow-ir` currently contains:

- `doctor-report.ts`: end-to-end orchestration for the deterministic doctor flow.
- `types.ts`: shared IR, risk, patch, and verification report types.
- `n8n-parser.ts`: exported n8n JSON to `WorkflowIR`.
- `dify-dsl-import.ts`: Dify DSL YAML to secret-safe `WorkflowIR` with source metadata, redaction summary, parser warnings, and Dify-specific diagnostics.
- `coze-definition-import.ts`: Coze workflow definition JSON to secret-safe `WorkflowIR` with source metadata, redaction summary, parser warnings, and Coze-specific diagnostics.
- `workflow-source-adapter.ts`: minimal source adapter contract for local import sources.
- `graph.ts`: adjacency maps and upstream/downstream graph helpers.
- `view-model.ts`: deterministic UI graph view model with node positions, edge labels, and node risk badges.
- `summary.ts`: deterministic workflow explanation for purpose, entry nodes, terminal nodes, side effects, risk counts, and recommended status.
- `risk-rules.ts`: offline static diagnostics for workflow risks, including idempotency, timeout, error handling, branch coverage, and audit-trail checks.
- `patch-proposal.ts`: deterministic proposal generator for supported early fixes such as payment idempotency, webhook dedupe, success audit logging, HTTP timeout, explicit error-branch handling, and missing branch-route stops, using the same structured contract future AI patch agents should produce.
- `patch-diff.ts`: readable diff formatter for reviewable `PatchOperation` objects.
- `patch.ts`: immutable application of structured `PatchOperation` objects. Insert-after operations route success paths through the inserted node while preserving target-node error branches; explicit error-branch operations add a separate `error` output without changing success routes; branch-route operations add a stop/fallback route to a specific missing `main[index]` output.
- `review-packet.ts`: serializable handoff packet for human review and artifact export.
- `review-report-export.ts`: Markdown and static HTML report renderers derived from sanitized Review Packet data.
- `structured-output.ts`: Zod schemas and parsers for runtime validation of `PatchProposal` and `VerificationReport` output.
- `verifier.ts`: separate verifier that compares original and patched workflows and returns a `VerificationReport`.

This package intentionally has no frontend dependency and no LLM dependency.

## First 5 Milestones

1. Create `packages/workflow-ir` with core TypeScript interfaces, n8n parser, and graph helpers.
2. Add rule-based diagnostics for static workflow risks without LLMs.
3. Add structured patch proposal and apply engine for reviewable changes.
4. Add verification report model and deterministic verification gates.
5. Add the first web UI: JSON import, graph view, node inspector, risk list, and report view. Done as the initial `apps/web` workbench.
