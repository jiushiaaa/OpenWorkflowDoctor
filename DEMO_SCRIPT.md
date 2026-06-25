# OpenWorkflowDoctor v0.5.2 Demo Script

Target length: 4 minutes.

## Setup

Recommended public path:

```bash
docker compose up
```

Open `http://localhost:3000`.

Contributor path:

```bash
npm install
npm run dev -w apps/web
```

## Talk Track

1. Start with the boundary.
   OpenWorkflowDoctor is a local-first Workflow Reliability IDE. It reviews workflows; it does not run them, read credentials, write back to n8n, sync to cloud, or export n8n-importable patches.

2. Use first-run onboarding.
   Show Demo mode and Connect n8n read-only. Read the trust checklist before importing anything real.

3. Start Demo mode.
   Load the bundled sample and show that Doctor diagnostics and the Review Console work without n8n and without AI.

4. Show troubleshooting.
   Open Settings. Point out n8n checks, AI provider checks, masked API key state, and diagnostics-only fallback.

5. Explain read-only n8n import.
   Configure an n8n base URL and session-only key only if a safe test instance is available. List workflows, import one as a local review copy, and mention `excludePinnedData=true`.

6. Show deterministic review.
   Inspect the workflow graph, risk list, structured WorkflowIR patch preview, Verifier, and Human Review checklist.

7. Explain AI Patch Proposal.
   AI can propose reviewable PatchOperation candidates only. Deterministic validation, Verifier, and Human Review remain required.

8. Show reset.
   Open reset confirmation and point out exactly what local data will be removed and what stays.

## Close

The v0.5.2 thesis: first-time users can try, configure, troubleshoot, and reset the local app without weakening the read-only import and review-only AI boundaries.
