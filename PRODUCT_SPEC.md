You are helping me build an MVP called n8n Workflow Doctor.

Product positioning:
This is not a workflow builder. It is a Workflow Reliability IDE for existing n8n workflows.

Core goal:
Users upload an exported n8n workflow JSON. The app parses it into a Workflow IR, visualizes it as a graph, explains what it does, detects risks, generates safe patch proposals from natural language requests, and verifies whether the patch is safe to accept.

Do not connect to production n8n in the MVP.
Do not execute real workflow actions.
Do not access credentials.
Do not send emails, call Stripe, update CRM, delete records, or trigger external side effects.

MVP features:

1. Upload n8n JSON.
2. Parse n8n JSON into WorkflowIR.
3. Render a workflow graph.
4. Detect static risks.
5. Explain workflow purpose.
6. Generate structured patch proposals.
7. Apply patch only after user confirmation.
8. Generate Verification Report.

Core concept:
Builder can say “done”.
Verifier decides whether it is accepted.
Completion is not delivery.

Tech stack:

* Next.js
* TypeScript
* React Flow
* Zod
* Vitest
* SQLite or local file storage
* OpenAI API later, but first implement deterministic parser and rule-based diagnostics.

Important architecture:
Do not let the LLM directly mutate raw n8n JSON.
Always convert n8n JSON into WorkflowIR first.
Patch operations must be structured JSON.
Verification must be separate from patch generation.

Now create:

1. A concise architecture document.
2. A suggested folder structure.
3. The first 5 implementation milestones.
4. The TypeScript interfaces for WorkflowIR, NodeIR, EdgeIR, RiskIssue, PatchOperation, VerificationReport.
