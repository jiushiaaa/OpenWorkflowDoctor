# OpenWorkflowDoctor

OpenWorkflowDoctor is a Workflow Reliability IDE for existing n8n workflows. It helps users understand exported workflow JSON, diagnose risk, generate reviewable patch operations, and verify whether a patch is safe to accept.

The MVP is deliberately not a workflow builder and not a workflow runtime. It does not connect to production n8n, execute workflows, read credentials, or trigger external side effects.

## v0.3 Release Boundary

OpenWorkflowDoctor v0.3 adds a local browser workspace for multiple imported workflow reviews. The workspace is lightweight IDE state, not a connected n8n project.

- Workspace data is stored locally in this browser with IndexedDB.
- Settings, language, theme, and local AI provider settings remain in browser `localStorage`.
- Importing JSON creates a local Workflow Document from secret-safe `WorkflowIR`.
- Bundled samples can be loaded into the workspace as normal Workflow Documents.
- Multiple Workflow Documents can coexist and be switched from Workflow Explorer.
- Switching active workflows restores the workflow title, graph, selected node, active tab, patch request, latest report, review mode, and human review draft.
- Switching workflows does not rerun Doctor automatically.
- If the patch request changes after a report exists, the report is marked stale until Doctor is rerun.
- Review Packet artifacts are saved per workflow when packets are exported.
- Review Packet export shape remains the canonical `DoctorReviewPacket`; it is not a workspace export and not n8n-importable JSON.
- Clearing workspace data removes workflow documents and packet artifacts but does not clear language, theme, or AI provider settings.
- The product remains local-first only: no production n8n connection, no workflow execution, no credential access, no n8n-importable patch export, no AI Patch Agent, and no AI Verifier Agent.

## v0.2 Release Boundary

OpenWorkflowDoctor v0.2 freezes the local Workflow Doctor with i18n, Settings, and an advisory AI Explainer. The deterministic v0.1 trust model remains the source of truth.

- Default language is `zh-CN`, with an `en-US` language switch in Settings.
- Settings controls language, theme, and local AI Provider configuration.
- Local AI Provider configuration supports provider type, base URL, API key, and model.
- API keys are masked in the UI and stored only in this browser's local settings for local-first use.
- API keys are not part of `WorkflowIR`, `DoctorReviewPacket`, or exported review artifacts.
- AI Explainer uses secret-safe WorkflowIR summaries, graph summaries, risk summaries, and verifier gates.
- AI Explainer falls back to deterministic advisory text when no API key is configured or the provider is unavailable.
- AI Explainer is advisory-only: it cannot create `PatchOperation` objects, change verifier status, change `humanReviewValidation`, execute workflows, connect to n8n, or export n8n-importable patches.

## v0.1 Demo Boundary

OpenWorkflowDoctor v0.1 is safe to demo as a local static Workflow Doctor and Review Packet generator for exported n8n JSON.

- Local exported n8n JSON only.
- Static heuristic diagnostics only.
- No runtime execution.
- No credential access.
- No n8n API integration.
- Patched export is OpenWorkflowDoctor `WorkflowIR`, not n8n-importable JSON.
- Verifier output is review guidance, not proof of runtime safety.

## v0.1 demo positioning

OpenWorkflowDoctor v0.1 is a controlled demo for local exported n8n JSON only. It provides static heuristic diagnostics, a WorkflowIR patch preview only, and a Review Packet for human approval.

Strict boundaries:

- local exported n8n JSON only
- static heuristic diagnostics
- WorkflowIR patch preview only
- Review Packet for human approval
- no runtime execution
- no production n8n connection
- no credential access
- no n8n-importable patch export

## What this is not

- not a workflow builder
- not a workflow runtime
- not an automatic n8n fixer
- not a proof of runtime safety

## Current MVP

The deterministic core lives in `packages/workflow-ir`.
The first web workbench lives in `apps/web`.

Implemented:

- Import an exported n8n workflow JSON in the browser.
- Store multiple imported workflows as local Workflow Documents in an IndexedDB-backed Workspace.
- Switch active workflows from Workflow Explorer without rerunning Doctor.
- Load bundled sample workflows into the local Workspace.
- Persist patch request, latest Doctor report, selected node, active tab, review mode, human review draft, and review packet artifact history per workflow.
- Render a React Flow workflow graph from the deterministic `WorkflowViewModel`.
- Select graph nodes and inspect node-level risks.
- Show workflow summary, static risks, structured patch proposal, verification gates, and acceptance recommendation.
- Show a readable patch diff that explains each structured operation before preview/export.
- Keep original workflow and patched preview separate until the user explicitly applies a reviewed patch proposal.
- Export a local review packet and patched WorkflowIR artifact for human review handoff.
- Include an acceptance checklist in the UI and review packet so each verifier gate maps to a pass state or required human action.
- Record a local human review decision (`accept`, `hold`, or `reject`) in exported artifacts without overwriting the verifier recommendation.
- Require explicit confirmation of every non-pass checklist item before the UI allows a human `accept` decision; exported packets also include `humanReviewValidation` for this guard.
- Add a stable review target fingerprint to the UI and review packet so reviewers can identify the exact workflow, patch, verifier result, and checklist being accepted.
- Keep review target fingerprints scoped to the technical per-workflow review target; local artifact ids provide workspace uniqueness.
- Show resolved, remaining, and introduced issue ids in the UI and review packet so reviewers can inspect the concrete risk delta, not just counts.
- Redact sensitive parameter previews such as API keys, Authorization headers, passwords, tokens, and secrets before they enter WorkflowIR, UI, or exported artifacts.
- Parse exported n8n workflow JSON into secret-safe `WorkflowIR`.
- Build graph adjacency and walk upstream/downstream paths.
- Create a UI-ready workflow view model with graph nodes, edges, layout positions, and node risk badges.
- Summarize workflow purpose, entry nodes, terminal nodes, side effects, risk counts, and recommended status.
- Detect static risks with rule-based diagnostics, including webhook dedupe, HTTP timeout, payment idempotency, missing error branches, incomplete control-flow routes, and missing success audit trails.
- Generate rule-based structured `PatchProposal` objects for supported risk fixes, including timeout updates, explicit error-branch insertion, and missing branch-route stops.
- Apply structured `PatchOperation` objects to `WorkflowIR`.
- Verify patches separately from patch generation and return `VerificationReport`.
- Create an end-to-end `DoctorReport` that bundles the original workflow, summary, UI graph view model, issues, proposal, patched workflow, patched summary, patched UI graph view model, patched issues, verification, and acceptance recommendation.
- Create a serializable `DoctorReviewPacket` with before/after risk counts, readable patch diff, patched WorkflowIR, verifier output, acceptance checklist, and human review decision.
- Validate structured `PatchProposal` and `VerificationReport` output with Zod runtime schemas.

Not implemented yet:

- AI patch agent or AI verifier agent.
- n8n API integration.
- Runtime execution or credential handling.

## Commands

```bash
npm run dev -w apps/web -- -p 3001
npm run build -w apps/web
npm test
npm run test:e2e
npm run typecheck
npm run lint
```

## v0.1 Demo Script

1. Start the app with `npm run dev -w apps/web -- -p 3001`.
2. Open `http://127.0.0.1:3001`.
3. Use the built-in refund workflow or import `samples/n8n/refund-workflow.json`.
4. Run Doctor with the default request.
5. Review the graph, risk list, patch proposal, and readable patch diff.
6. Apply the reviewed patch preview.
7. Review the verifier report, acceptance checklist, target fingerprint, and issue delta.
8. Confirm required checklist items before using human Accept.
9. Export the review packet.

## Demo Limitations

- Diagnostics are rule-based heuristics and can produce false positives or miss risks.
- Workflow parsing targets common exported n8n JSON shapes, not the full n8n surface.
- Patch operations modify `WorkflowIR` for review; they do not produce raw n8n workflow JSON.
- The review target fingerprint is a stable review identifier, not a cryptographic signature.
- The app does not prove that a workflow is safe in production.

## Out of Scope for v0.1

- LLM analyzer, patch, or verifier agents.
- n8n API integration.
- Runtime execution.
- Credential handling or credential lookup.
- Raw n8n-importable patch generation.
- Production deployment controls, auth, persistence, or collaboration.

## v0.2 Capabilities

- Advisory AI Explainer with deterministic fallback.
- Settings modal for language, theme, and local AI Provider configuration.
- `zh-CN` and `en-US` primary UI copy.
- Local-first API key handling for the browser workbench.

## Future Roadmap

- Workspace export/import backup files after the local document model stabilizes.
- Review packet comparison, signing, or stronger tamper-evidence.
- Cross-workflow search and risk dashboards.
- Broader n8n fixture coverage and node catalog awareness.
- Optional AI patch agents only after they emit the same validated structured contracts and remain reviewable before apply.
- Richer path analysis and risk explanations.
- Review packet signing or stronger tamper-evidence.
- n8n export-generation experiments only after the WorkflowIR contract is stable.

## Development Direction

The product follows this flow:

```text
n8n JSON
  -> secret-safe WorkflowIR
  -> graph view model + summary + diagnostics
  -> structured patch proposal + readable diff
  -> human-reviewed patched preview
  -> verifier report
  -> review packet export + acceptance checklist
  -> human accept / hold / reject
```

Builder logic may propose changes, but only verifier logic can mark a patch `pass`, `hold`, or `fail`. The verifier distinguishes remaining repairable high-risk issues from expected high-risk side effects that still need explicit human confirmation.
Human review is recorded as a separate decision on the exported artifact, so a reviewer can accept, hold, or reject after reading the verifier output without changing what the verifier reported. Accepting a patch requires explicit confirmation of every non-pass checklist item, and the review packet records whether that human review is internally consistent. The review target fingerprint is stable across export time and human-review note changes, but changes when the workflow, patch, verifier result, or checklist changes. The issue delta lists the exact resolved, remaining, and introduced issue ids.

The current proposal generator is deterministic and intentionally narrow. It supports early demo fixes for payment idempotency, webhook dedupe, success audit logging, HTTP timeout, explicit error-branch handling, and missing branch-route stops based on detected risk issues and a natural-language request. Future LLM agents must output the same structured `PatchProposal` contract and pass the Zod validators before their output can be applied.

Comprehensive requests such as "fix all supported reliability issues" combine every currently supported deterministic fix into one reviewable patch proposal and review packet.

For app surfaces, `createDoctorReport(rawWorkflow, request)` is the current one-call entry point for the deterministic doctor flow.

WorkflowIR stores parameter summaries, not raw credentials. Sensitive parameter values are replaced with `[redacted]` before they appear in UI or review packet exports.

## Demo Sample

Use `samples/n8n/refund-workflow.json` for the first product demo. It intentionally includes risks around webhook dedupe, HTTP timeout, Stripe idempotency, missing error handling, and missing refund success audit logging so the doctor flow has something real to diagnose.
