# OpenWorkflowDoctor v0.9.0 Public Release Checklist

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

## Public Docs Checks

- README names `v0.9.0` as the current release line.
- README supported sources include n8n exported JSON, n8n read-only import, Dify DSL YAML, Coze definition JSON, and Custom Graph JSON.
- `docs/review-report-export.md` explains JSON Review Packet vs Markdown Review Report vs static HTML Review Report.
- `docs/adapter-sdk.md` documents the internal built-in adapter contract.
- `docs/custom-graph-json-import.md` documents the safe declarative Custom Graph format.
- `docs/source-adapter-conformance.md` documents shared conformance requirements.
- `docs/architecture.md` describes the unified adapter import pipeline.
- GitHub Actions Docker Smoke must pass before tagging v0.9.0.

## v0.9.0 Freeze Checks

- Existing JSON Review Packet export behavior is preserved.
- Markdown Review Report export creates deterministic GitHub-readable sections.
- Static HTML Review Report export contains no JavaScript, external CSS, external fonts, remote images, or third-party assets.
- Report UI includes overview, risks, patch, verifier, human review, source metadata, export, and raw JSON access.
- Reports include sanitized adapter metadata, parser warnings, redaction summary, source diagnostics, schema versions, generated timestamp, and review target fingerprint.
- Stale report warnings appear when a report was generated for a previous fingerprint.
- Sentinel tests prove secrets do not leak into JSON Review Packet, Markdown, HTML, Review Packet Artifact shape, UI preview state where testable, or AI patch input.
- Patch proposals remain WorkflowIR previews for human review.

## Non-goal Checks

- No third-party executable adapters.
- No adapter plugin marketplace.
- No remote adapter loading.
- No user-uploaded JavaScript adapters.
- No workflow execution.
- No platform write-back.
- No n8n/Dify/Coze native patch export.
- No platform-native patch export from report rendering.
- No credential inspection.
- No runtime plugin execution.
- No cloud sync.

Do not tag a release until the release owner manually reviews the resulting repository state.
