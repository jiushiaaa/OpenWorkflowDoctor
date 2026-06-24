# OpenWorkflowDoctor

Local-first Workflow Review IDE for exported n8n workflows.

OpenWorkflowDoctor reviews workflows. It does not run them.

It is not:

- a workflow builder
- a workflow runtime
- an automatic n8n fixer
- a production n8n connector

It is:

- a workflow doctor for exported n8n JSON
- a static diagnostics workbench
- a secret-safe WorkflowIR review tool
- a structured patch preview surface
- a verifier review and human approval flow
- a local workspace for multiple workflow reviews

The product is designed around one trust boundary: AI may explain and, in future versions, propose validated structured changes, but it must never directly mutate raw n8n JSON or decide final acceptance.

## Demo

Run the local web workbench:

```bash
npm install
npx next dev apps/web -p 3001
```

Open `http://127.0.0.1:3001`.

Recommended demo flow:

1. Load the bundled refund workflow sample or import `samples/n8n/refund-workflow.json`.
2. Run Doctor with the default reliability review request.
3. Inspect the workflow graph, static risks, patch preview, verifier gates, and human review checklist.
4. Apply the reviewed patch preview locally.
5. Export the Review Packet for human approval.

The exported packet is an OpenWorkflowDoctor review artifact. It is not an n8n-importable workflow and it does not execute any side effects.

## Features

- Import exported n8n workflow JSON in the browser.
- Parse workflow JSON into secret-safe `WorkflowIR`.
- Store multiple workflow reviews in a local IndexedDB workspace.
- Switch active workflows from Workflow Explorer without rerunning Doctor.
- Render a React Flow graph from deterministic workflow analysis.
- Show workflow summary, node risks, static diagnostics, and acceptance recommendation.
- Generate deterministic structured `PatchProposal` objects for supported reliability fixes.
- Apply structured `PatchOperation` objects only to `WorkflowIR` preview state.
- Keep original workflow, patched preview, verifier output, and human review decision separate.
- Export a `DoctorReviewPacket` with before/after risk counts, readable patch diff, verifier gates, checklist state, review target fingerprint, and human decision.
- Support advisory AI explanations with local BYOK provider settings and deterministic fallback.
- Support `zh-CN` and `en-US` UI copy.

Supported static diagnostics currently include webhook dedupe, HTTP timeout, payment idempotency, missing error branches, incomplete control-flow routes, and missing success audit trails.

## Trust Boundaries

OpenWorkflowDoctor is local-first and review-first.

- Imported workflow data stays in the browser workspace.
- Settings, language, theme, and local AI provider settings stay in browser local storage.
- API keys are masked in the UI and are not included in `WorkflowIR`, `DoctorReviewPacket`, or exported artifacts.
- Sensitive parameter previews such as API keys, authorization headers, passwords, tokens, and secrets are redacted before they enter WorkflowIR, UI, or review exports.
- Static diagnostics and deterministic patch generation work without an LLM.
- AI Explainer is advisory-only in v0.2 and v0.3.x.
- Patch generation and verification are separate steps.
- A Builder Agent may propose changes in future versions, but only a Verifier can mark them `pass`, `hold`, or `fail`.
- Human review is recorded separately from verifier output.

Out of scope for the current MVP:

- workflow execution
- credential lookup or credential storage
- production n8n API integration
- raw n8n JSON mutation by an LLM
- automatic write-back to n8n
- n8n-importable patched workflow export

## Version Roadmap

| Version | Status | Scope |
| --- | --- | --- |
| v0.1.0 | Frozen | Deterministic Workflow Doctor and Review Packet |
| v0.2.0 | Frozen | Advisory AI Explainer, Settings, i18n, and BYOK AI Provider |
| v0.3.0 | Frozen | Local Workspace and Multiple Workflows |
| v0.3.1 | Frozen | Workbench Refactor |
| v0.4.0 | Planned | AI Patch Proposal. AI can only output validated structured `PatchOperation` data. |
| v0.5.0 | Planned | Read-only n8n Import. Import only, no execution and no write-back. |
| v0.6.0 | Planned | Execution Logs and Observability Analysis for failure paths, slow nodes, and error hotspots. |

The current product definition through v0.3.1:

OpenWorkflowDoctor is a local-first Workflow Review IDE. It supports importing multiple n8n workflows, running static diagnostics, previewing WorkflowIR patches, reviewing verifier output, recording human review, and exporting Review Packets. AI only explains; it does not participate in final acceptance.

## Architecture

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

Core rules:

- Always parse imported workflow JSON into WorkflowIR first.
- Never let an LLM directly mutate raw n8n JSON.
- Represent all patch proposals as structured PatchOperation objects.
- Validate LLM output with Zod before it can enter the patch pipeline.
- Unknown node types must not crash the system.
- Rule-based diagnostics must work without LLM.
- External credentials must never be read or stored.

## Packages

- `packages/workflow-ir`: deterministic WorkflowIR, diagnostics, patch proposal, verification, and review packet logic.
- `packages/workflow-ai`: advisory AI explanation contracts and provider helpers.
- `apps/web`: local browser workbench.
- `samples/n8n`: demo exported workflow JSON.

## Local Development

Install dependencies:

```bash
npm install
```

Run the workbench:

```bash
npx next dev apps/web -p 3001
```

Run checks:

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

Run dependency audit:

```bash
npm audit
```

See `docs/public-github-audit-v0.3.1.md` for the current public-readiness audit notes.
