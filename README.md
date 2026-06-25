# OpenWorkflowDoctor

Local-first Workflow Review IDE for existing n8n workflows.

OpenWorkflowDoctor reviews workflows. It does not run them.

Current stable release: `v0.4.4` Public Demo Polish.

It is not a workflow builder, workflow runtime, automatic n8n fixer, or production n8n mutator.

It turns exported n8n JSON or optional read-only n8n imports into a secret-safe WorkflowIR, static risk report, structured patch preview, verifier result, human review checklist, and exportable Review Packet.

AI can explain and propose structured `PatchOperation` candidates, but deterministic validation, verifier gates, and human review remain required.

![OpenWorkflowDoctor demo](docs/assets/openworkflowdoctor-demo-v0.4.4.gif)

## What It Does

- Reviews exported n8n workflow JSON locally.
- Optionally imports workflows from n8n through read-only workflow API calls.
- Shows graph structure, static risks, patch previews, verifier gates, and review packets.
- Keeps AI suggestions reviewable and bounded by structured validation.
- Never executes workflows, reads credentials, writes back to n8n, activates/deactivates workflows, or exports n8n-importable patched workflows.

## Screenshot

![OpenWorkflowDoctor workbench](docs/assets/openworkflowdoctor-workbench-v0.4.4.png)

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
3. Inspect the workflow graph, static risks, deterministic patch preview, verifier gates, and human review checklist.
4. Open Settings and review provider presets, including Verified, Preset, Experimental, and Custom tiers.
5. Inspect the AI Patch Proposal boundary: AI can propose structured operations only, and unavailable providers fall back safely.
6. Apply the reviewed patch preview locally.
7. Export the Review Packet for human approval.

The exported packet is an OpenWorkflowDoctor review artifact. It is not an n8n-importable workflow and it does not execute any side effects.

For a tighter walkthrough, see [Demo Guide](docs/demo-guide.md).

## Features

- Import exported n8n workflow JSON in the browser.
- Import selected workflows from n8n as local read-only review copies.
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
- Support AI-assisted patch proposals as validated structured `PatchOperation` candidates, with deterministic validation, patch preview, verifier gates, and human review still required.
- Store n8n connection metadata locally while keeping n8n API keys session-only by default.
- Support `zh-CN` and `en-US` UI copy.

Supported static diagnostics currently include webhook dedupe, HTTP timeout, payment idempotency, missing error branches, incomplete control-flow routes, and missing success audit trails.

## Trust Boundaries

OpenWorkflowDoctor is local-first and review-first.

- Imported workflow data stays in the browser workspace.
- Settings, language, theme, and local AI provider settings stay in browser local storage.
- AI API keys are masked in the UI and are not included in `WorkflowIR`, `DoctorReviewPacket`, or exported artifacts.
- n8n API keys are stored session-only and are not included in `WorkflowIR`, `DoctorReviewPacket`, Review Packet Artifacts, or Workflow Documents.
- Sensitive parameter previews such as API keys, authorization headers, passwords, tokens, and secrets are redacted before they enter WorkflowIR, UI, or review exports.
- n8n read-only import uses only workflow list/get endpoints with `excludePinnedData=true`.
- Static diagnostics and deterministic patch generation work without an LLM.
- AI Explainer remains advisory-only.
- AI Patch Proposal can propose validated structured changes, but it cannot apply patches, mutate raw n8n JSON, change verifier status, or change human review.
- Patch generation and verification are separate steps.
- A Builder Agent may propose changes in future versions, but only a Verifier can mark them `pass`, `hold`, or `fail`.
- Human review is recorded separately from verifier output.

Out of scope for the current MVP:

- workflow execution
- credential lookup or credential storage
- production n8n mutation
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
| v0.3.2 | Frozen | Public GitHub readiness cleanup |
| v0.4.0 | Frozen | Constrained AI Patch Proposal. AI can only output validated structured `PatchOperation` data. |
| v0.4.2 | Frozen | Real-model happy path and provider compatibility smoke results |
| v0.4.3 | Frozen | Provider Presets and Compatibility Registry |
| v0.4.4 | Current stable | Public demo polish, README demo media, issue templates, and feedback roadmap |
| v0.5.0 | Implemented, audit pending | Read-only n8n Import. Import only, no execution and no write-back. |
| v0.6.0 | Planned | Execution Logs and Observability Analysis for failure paths, slow nodes, and error hotspots. |

The current product definition through v0.4.4:

OpenWorkflowDoctor is a local-first Workflow Review IDE. It supports importing multiple n8n workflows from JSON or optional read-only n8n workflow reads, running static diagnostics, previewing WorkflowIR patches, reviewing verifier output, recording human review, exporting Review Packets, generating advisory AI explanations, and requesting constrained AI PatchOperation proposals through configurable BYOK providers. AI never participates in final acceptance.

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

For read-only n8n import details, see [v0.5 Read-only n8n Import](docs/n8n-readonly-import.md).

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
- `packages/workflow-ai`: advisory AI explanation, constrained AI patch proposal, provider registry, and provider helper contracts.
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

## Public Release Docs

- [CHANGELOG.md](CHANGELOG.md)
- [SECURITY.md](SECURITY.md)
- [ROADMAP.md](ROADMAP.md)
- [GitHub release notes](docs/github-release-notes.md)
- [Demo Guide](docs/demo-guide.md)
- [Feedback Guide](docs/feedback-guide.md)
- [Provider presets and compatibility](docs/provider-presets-compatibility.md)
- [Manual AI Patch Proposal smoke test](docs/manual-ai-patch-smoke-test.md)
- [Real-model smoke results v0.4.2](docs/real-model-smoke-results-v0.4.2.md)
- [Public GitHub audit notes v0.3.1](docs/public-github-audit-v0.3.1.md)
