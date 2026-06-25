# OpenWorkflowDoctor v0.6.1 Public Release Checklist

Run these commands from the repository root before any public release commit:

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
docker compose build
docker compose up
```

Expected result: every command exits with code 0. For `docker compose up`, verify the app opens locally, then stop it with `Ctrl+C`.

## Public docs checks

- README names `v0.6.1` as the current release line.
- README shows Docker Compose as the recommended public try-out path.
- README keeps Node setup documented as contributor setup.
- `docs/local-deployment.md` explains Docker, Node, and local data.
- `docs/onboarding.md` explains Demo mode, n8n mode, AI skip, and trust boundaries.
- `docs/troubleshooting.md` explains n8n checks, AI checks, and reset actions.
- `docs/public-demo-checklist.md` covers the public demo gates.
- `DEMO_SCRIPT.md` starts from onboarding and Docker.
- GitHub Actions Docker Smoke must pass before tagging v0.6.1.

## v0.6.1 freeze checks

- Demo mode works without n8n.
- Demo mode works without AI.
- First-run onboarding can be reopened from Settings.
- n8n import remains read-only.
- Dify DSL YAML import remains the stable supported Dify path.
- Dify direct import remains deferred and experimental only.
- No Dify API connection, session/cookie handling, execution, publish, write-back, dataset fetch, plugin fetch, file fetch, or raw DSL persistence is introduced.
- n8n API keys remain session-only.
- n8n requests keep using `excludePinnedData=true`.
- Troubleshooting shows invalid n8n URL guidance.
- Troubleshooting shows missing API key guidance.
- Missing AI provider does not block deterministic diagnostics.
- Reset confirmation lists removed and preserved local data before clearing.
- AI Patch Proposal remains review-only and cannot mutate raw n8n JSON.
- No docs imply hosted SaaS, workflow execution, write-back, credential inspection, cloud sync, or n8n-importable patch export.
- GitHub Actions `Docker Smoke` passes on a GitHub-hosted Linux runner.

Do not tag a release until the release owner manually reviews the resulting repository state.
