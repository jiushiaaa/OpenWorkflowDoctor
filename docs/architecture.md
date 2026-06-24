# OpenWorkflowDoctor Architecture

OpenWorkflowDoctor is a Workflow Reliability IDE for existing n8n workflows. The MVP reads exported workflow JSON, converts it into a deterministic `WorkflowIR`, detects static risks, proposes structured patches, and verifies whether changes are safe to accept. It does not connect to production n8n, execute workflows, read credentials, or trigger external side effects.

## v0.3 Local Workspace Boundary

v0.3 adds a local browser workspace around the deterministic doctor flow. A workspace is only local IDE state for imported exported n8n JSON files. It is not a connected n8n project, not a runtime, and not a collaboration space.

Workspace data is split deliberately:

- `localStorage` keeps small workbench settings: language, theme, and local AI provider configuration.
- IndexedDB keeps workspace metadata, Workflow Documents, and Review Packet Artifacts.

The workspace stores secret-safe `WorkflowIR` and derived review state. It does not store raw imported n8n JSON, credentials, production API connections, workflow execution state, or n8n-importable patches.

Core workspace concepts:

- `LocalWorkspace`: local container with a stable id, active workflow document id, and ordered workflow document ids.
- `WorkflowDocument`: one imported workflow review session containing original `WorkflowIR`, patch request, latest `DoctorReport`, UI state, human review draft, and packet artifact ids.
- `ReviewPacketArtifact`: local saved/exported instance of a canonical `DoctorReviewPacket` for one workflow document.

Review packets remain per workflow. The exported packet shape remains `DoctorReviewPacket`; the artifact wrapper exists only for local workspace bookkeeping.

Active workflow switching behaves like switching files in a lightweight IDE:

1. Persist current document state.
2. Set `activeWorkflowDocumentId`.
3. Load the selected Workflow Document.
4. Restore title, graph, selected node, active tab, patch request, latest report, review mode, and human review draft.
5. Do not rerun Doctor automatically.

If the patch request changes after a report exists, the document marks `latestReportState` as `stale`. The user must rerun Doctor before the report, verifier, and review packet reflect the new request.

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

The UI-facing deterministic entry point is `createDoctorReport(rawWorkflow, request)`. It returns the original workflow, summary, UI graph view model, diagnostics, patch proposal, readable patch diff, patched workflow, patched UI graph view model, patched diagnostics, verification report, and final acceptance recommendation.

`createDoctorReviewPacket(report)` converts a `DoctorReport` into a serializable handoff artifact with a stable review target fingerprint, before/after risk counts, resolved/remaining/introduced issue ids, readable patch diff, structured operations, patched WorkflowIR, verifier output, an acceptance checklist derived from verifier gates, an optional human review decision, and `humanReviewValidation`.

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
- `graph.ts`: adjacency maps and upstream/downstream graph helpers.
- `view-model.ts`: deterministic UI graph view model with node positions, edge labels, and node risk badges.
- `summary.ts`: deterministic workflow explanation for purpose, entry nodes, terminal nodes, side effects, risk counts, and recommended status.
- `risk-rules.ts`: offline static diagnostics for workflow risks, including idempotency, timeout, error handling, branch coverage, and audit-trail checks.
- `patch-proposal.ts`: deterministic proposal generator for supported early fixes such as payment idempotency, webhook dedupe, success audit logging, HTTP timeout, explicit error-branch handling, and missing branch-route stops, using the same structured contract future AI patch agents should produce.
- `patch-diff.ts`: readable diff formatter for reviewable `PatchOperation` objects.
- `patch.ts`: immutable application of structured `PatchOperation` objects. Insert-after operations route success paths through the inserted node while preserving target-node error branches; explicit error-branch operations add a separate `error` output without changing success routes; branch-route operations add a stop/fallback route to a specific missing `main[index]` output.
- `review-packet.ts`: serializable handoff packet for human review and artifact export.
- `structured-output.ts`: Zod schemas and parsers for runtime validation of `PatchProposal` and `VerificationReport` output.
- `verifier.ts`: separate verifier that compares original and patched workflows and returns a `VerificationReport`.

This package intentionally has no frontend dependency and no LLM dependency.

## First 5 Milestones

1. Create `packages/workflow-ir` with core TypeScript interfaces, n8n parser, and graph helpers.
2. Add rule-based diagnostics for static workflow risks without LLMs.
3. Add structured patch proposal and apply engine for reviewable changes.
4. Add verification report model and deterministic verification gates.
5. Add the first web UI: JSON import, graph view, node inspector, risk list, and report view. Done as the initial `apps/web` workbench.
