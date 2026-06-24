# OpenWorkflowDoctor v0.1 Controlled Demo Script

Target length: 3 minutes.

## Setup

Run:

```bash
npm run dev -w apps/web -- -p 3001
```

Open `http://localhost:3001`.

## Talk Track

1. Start with the boundary.
   OpenWorkflowDoctor v0.1 is a local static Workflow Doctor for exported n8n JSON. It does not connect to production n8n, execute workflows, read credentials, or export n8n-importable patches.

2. Import a sample.
   Use `samples/n8n/refund-risky.workflow.json`. Point out that this is a local file import and all analysis happens against secret-safe WorkflowIR.

3. Run Doctor.
   Click `Run Doctor`. Show the workflow graph, risk badges, risk list, summary, and node inspector.

4. Explain the patch proposal.
   Show that the Builder proposes structured WorkflowIR operations and a readable diff. Say clearly that this is a patch preview, not a production n8n mutation.

5. Apply reviewed preview.
   Click `Apply Reviewed Patch`. Show the patched graph/risk view, verifier report, acceptance checklist, issue delta, and target fingerprint.

6. Show human review.
   Point out that Accept is gated by checklist confirmations. Confirm required items, then show that human review is recorded separately from verifier guidance.

7. Export review packet.
   Click `Export Review Packet`. Describe it as a handoff artifact for human approval and audit, not proof of runtime safety.

## Close

The v0.1 thesis: Builder can propose changes, but Verifier and human review decide whether a patch preview is acceptable. Completion is not delivery.
