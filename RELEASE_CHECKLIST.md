# OpenWorkflowDoctor v0.9.1 Freeze Audit Checklist

Run these commands from the repository root before any public release commit:

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
git diff --check
docker compose build
docker compose up
```

Expected result: every command exits with code 0. For `docker compose up`, verify the app opens locally without AI or n8n environment variables, then stop it with `Ctrl+C`.

## Required Release Gates

- GitHub Actions `Release Gate` must pass on the release commit.
- GitHub Actions `Docker Smoke` must pass on the release commit.
- `npm audit --json` must be reviewed and reflected in `docs/security/dependency-audit-v0.9.1.md`.
- Known unresolved dependency findings must be classified before tagging.
- Do not tag a release until the release owner manually reviews the resulting repository state.

## Public Docs Checks

- README names `v0.9.1` as the current release line.
- README supported sources include n8n exported JSON, optional n8n read-only import, Dify DSL YAML, Coze definition JSON, and Custom Graph JSON.
- `SECURITY.md` states the product is review-first, does not execute workflows, does not write back, and does not inspect credentials.
- `docs/review-report-export.md` explains JSON Review Packet vs Markdown Review Report vs static HTML Review Report.
- `docs/adapter-sdk.md` documents the internal built-in adapter contract and non-goals.
- `docs/custom-graph-json-import.md` documents the safe declarative Custom Graph format.
- `docs/source-adapter-conformance.md` documents shared conformance and v0.9.1 sentinel expectations.
- `docs/architecture.md` describes the unified adapter import pipeline and v0.9.1 hardening boundary.
- `docs/v1-readiness-checklist.md` reflects the current v1 preflight status.

## v0.9.1 Freeze Checks

- Vitest/Vite/esbuild critical/high audit chain is remediated without `npm audit fix --force`.
- Remaining Next/PostCSS audit risk is documented if no safe low-churn remediation exists.
- Release Gate runs unit tests, lint, typecheck, build, e2e, and a non-blocking audit report.
- Docker Smoke uses GitHub-hosted runners and Node 24-compatible checkout action.
- Docker Compose remains localhost-bound and demo-mode friendly.
- `.env.example` contains no real secrets and does not require AI or n8n keys.
- Existing JSON Review Packet export behavior is preserved.
- Markdown Review Report export creates deterministic human-readable sections.
- Static HTML Review Report export contains no JavaScript, external CSS, external fonts, remote images, or third-party assets.
- Reports include sanitized adapter metadata, parser warnings, redaction summary, source diagnostics, schema versions, generated timestamp, and review target fingerprint.
- Sentinel tests prove secrets do not leak into WorkflowIR, Workflow Documents, Review Packet Artifacts, JSON Review Packets, Markdown, HTML, AI Explainer context, AI Patch input, adapter metadata, source diagnostics, or report preview state where testable.
- Patch proposals remain WorkflowIR previews for human review.

## Non-goal Checks

- No new workflow source platforms.
- No workflow execution.
- No platform write-back.
- No platform-native patch export.
- No credential inspection.
- No Dify direct import as a default supported integration.
- No Coze direct import as a default supported integration.
- No runtime logs.
- No agent harness or multi-agent features.
- No cloud sync.
- No accounts or collaboration.
- No third-party executable adapters.
- No adapter plugin marketplace.
- No remote adapter loading.
- No user-uploaded JavaScript adapters.
