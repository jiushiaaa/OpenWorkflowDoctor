# Local Deployment

OpenWorkflowDoctor v0.9.1 is a local-first Workflow Reliability IDE for reviewing existing workflow artifacts. It does not run workflows, write back to source platforms, inspect credentials, or sync to a cloud service.

## Quick Try With Docker Compose

```bash
docker compose up
```

Then open http://localhost:3000.

Docker Compose starts only OpenWorkflowDoctor. It does not bundle n8n and does not require an AI key or n8n connection. Demo mode works from bundled sample workflows.

Optional local overrides:

```bash
cp .env.example .env
```

Change `OPENWORKFLOWDOCTOR_APP_PORT` if port `3000` is already in use.

If local Docker is unavailable, the repository includes a GitHub Actions `Docker Smoke` workflow that builds the Compose service, starts it on a GitHub-hosted Linux runner, probes `http://localhost:3000`, verifies the `OpenWorkflowDoctor` marker, prints Compose diagnostics on failure, and always runs `docker compose down -v`.

## Developer Setup With Node

```bash
npm install
npm run dev -w apps/web
```

Use this path for contribution work. Docker Compose is the recommended public try-out path.

## Local Data

The browser stores imported review copies, review packets, onboarding state, n8n connection labels, and AI settings locally. n8n API keys are session-only by default. Reset controls in Settings can clear local data without touching bundled demo workflows.
