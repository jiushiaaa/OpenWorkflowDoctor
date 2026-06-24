# OpenWorkflowDoctor v0.4.4 Demo Script

Target length: 3 minutes.

## Setup

Run:

```bash
npx next dev apps/web -p 3001
```

Open `http://localhost:3001`.

## Talk Track

1. Start with the boundary.
   OpenWorkflowDoctor is a local-first Workflow Review IDE. It reviews workflows; it does not run them, connect to production n8n, read credentials, write back to n8n, or export n8n-importable patches.

2. Import a sample.
   Use `samples/n8n/refund-workflow.json` or load the bundled refund sample. Point out that local exported n8n JSON is parsed into secret-safe WorkflowIR before review.

3. Run Doctor.
   Click `Run Doctor`. Show the workflow graph, risk badges, risk list, summary, and node inspector.

4. Explain deterministic review.
   Show the deterministic patch preview and readable diff. Say clearly that the preview uses structured WorkflowIR operations and does not mutate raw n8n JSON.

5. Show provider presets.
   Open Settings. Show the provider dropdown, the Verified / Preset / Experimental / Custom tiers, and the transport / response format fields. Mention that NovAI, Volcengine Ark, and Alibaba Bailian / DashScope have passed the real-model `normal_timeout_repair` smoke path.

6. Explain AI Patch Proposal.
   Open the patch tab. Show that AI can only propose reviewable PatchOperation candidates. If no API key is configured, show the safe unavailable state. If a provider is configured, show that generated AI output still goes through Zod validation, semantic validation, conflict detection, deterministic patch preview, Verifier, and Human Review.

7. Apply reviewed preview.
   Click `Preview Patch IR` or `Preview AI Patch` only after inspecting operations. Show the patched graph/risk view, verifier report, acceptance checklist, issue delta, and target fingerprint.

8. Show human review.
   Point out that Accept is gated by checklist confirmations. Confirm required items, then show that human review is recorded separately from verifier guidance.

9. Export review packet.
   Click `Export Review Packet`. Describe it as a handoff artifact for human approval and audit, not proof of runtime safety.

## Close

The v0.4.4 thesis: AI can help explain and propose constrained structured changes, but deterministic validation, Verifier, and Human Review remain required. Completion is not delivery.
