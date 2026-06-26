# OpenWorkflowDoctor v0.8.0 Public Release Checklist

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

- README names `v0.8.0` as the current release line.
- README supported sources include n8n exported JSON, n8n read-only import, Dify DSL YAML, Coze definition JSON, and Custom Graph JSON.
- `docs/adapter-sdk.md` documents the internal built-in adapter contract.
- `docs/custom-graph-json-import.md` documents the safe declarative Custom Graph format.
- `docs/source-adapter-conformance.md` documents shared conformance requirements.
- `docs/architecture.md` describes the unified adapter import pipeline.
- GitHub Actions Docker Smoke must pass before tagging v0.8.0.

## v0.8.0 Freeze Checks

- Built-in adapter registry contains `n8n.exportedJson`, `n8n.readonlyImport`, `dify.dslYaml`, `coze.definitionJson`, and `custom.graphJson`.
- File/manual imports use the unified import pipeline.
- Raw imported source artifacts are not stored in Workflow Documents, IndexedDB workspace records, Review Packet artifacts, AI context, UI inspector state, logs, or snapshots.
- Source metadata includes `adapterId`, `sourceKind`, `sourcePlatform`, `importMethod`, and `stability`.
- Review Packets include sanitized adapter metadata, parser warnings, redaction summary, and source diagnostics.
- Adapter conformance tests prove sentinel secrets do not leak into WorkflowIR, workspace state, Review Packets, or AI context.
- Custom Graph JSON supports declarative `name`, `nodes`, `edges`, optional sanitized metadata, and optional config summaries.
- Custom Graph JSON rejects malformed input and duplicate node ids.
- Broken edges become diagnostics instead of crashes.
- Unknown nodes do not crash import.
- Patch proposals remain WorkflowIR previews for human review.

## Non-goal Checks

- No third-party executable adapters.
- No adapter plugin marketplace.
- No remote adapter loading.
- No user-uploaded JavaScript adapters.
- No workflow execution.
- No platform write-back.
- No n8n/Dify/Coze native patch export.
- No credential inspection.
- No runtime plugin execution.
- No cloud sync.

Do not tag a release until the release owner manually reviews the resulting repository state.
