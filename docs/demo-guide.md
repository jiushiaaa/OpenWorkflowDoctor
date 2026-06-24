# Demo Guide

This guide shows the shortest path through OpenWorkflowDoctor.

OpenWorkflowDoctor reviews workflows. It does not run them.

## Run Locally

```bash
npm install
npx next dev apps/web -p 3001
```

Open `http://127.0.0.1:3001`.

## Three-minute Flow

1. Load the `Refund Risky` sample.
2. Run Doctor.
3. Open the risk list and show static diagnostics.
4. Open Patch Diff and inspect the structured WorkflowIR patch preview.
5. Generate an AI Patch Proposal if a local BYOK provider is configured.
6. Preview the patch only after reviewing operations.
7. Show Verifier status.
8. Complete required human confirmations.
9. Export the Review Packet.

## Talk Track

OpenWorkflowDoctor is a local-first Workflow Review IDE for exported n8n workflows.

It is not a workflow builder, workflow runtime, automatic n8n fixer, or production n8n connector.

The review chain is:

```text
exported n8n JSON
  -> secret-safe WorkflowIR
  -> static diagnostics
  -> structured patch preview
  -> verifier gates
  -> human review
  -> Review Packet
```

AI can explain and propose structured `PatchOperation` candidates, but AI cannot apply patches, change verifier status, change human review, or mutate raw n8n JSON.

## What to Emphasize

- Imported workflow data stays local in the browser workspace.
- API keys stay in local browser settings.
- Review Packets are handoff artifacts, not proof of runtime safety.
- The verifier can hold even when a patch improves the workflow, because remaining side-effect paths still require human confirmation.
- v0.5 read-only n8n import is planned but should be designed before implementation.
