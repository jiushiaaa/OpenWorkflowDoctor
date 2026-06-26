# OpenWorkflowDoctor v1 Readiness Checklist

`v1.0` should mean the review-only boundary is stable, the supported sources are clear, release gates are dependable, and known risks are documented. It should not mean adding workflow execution, platform write-back, credential inspection, cloud collaboration, or a public plugin system.

## Stable Source Support Matrix

| Source | v1 Status Target | Import Method | Raw Artifact Persistence | Execution / Write-back | Notes |
| --- | --- | --- | --- | --- | --- |
| n8n exported JSON | stable | local browser file import | no | none | parsed into secret-safe WorkflowIR before review |
| n8n read-only import | stable optional | user-provided session-only n8n key through read-only workflow endpoints | no raw API response in workspace | no mutation, activation, execution, or credential endpoints | key must stay out of WorkflowIR, workspace documents, Review Packets, and exports |
| Dify DSL YAML | stable | local `.yml` / `.yaml` import | no | no API, publish, execution, or write-back | direct remote Dify import remains deferred/experimental |
| Coze definition JSON | stable | local `.json` definition import | no | no API, runtime, publish, execution, or write-back | direct Coze cloud import remains unsupported |
| Custom Graph JSON | stable built-in adapter | declarative local JSON import | no raw sensitive content | no JavaScript, dynamic mapping, remote schema, plugin, execution, or write-back | unknown nodes must produce diagnostics instead of crashes |

## Stable Trust Boundaries

- [x] OpenWorkflowDoctor reviews workflows; it does not run them.
- [x] Imported artifacts always become WorkflowIR before diagnostics, AI, patches, verifier, workspace persistence, or reports.
- [x] LLMs never mutate raw source JSON/YAML.
- [x] AI Explainer receives only secret-safe review context.
- [x] AI Patch Proposal receives only secret-safe WorkflowIR-derived context.
- [x] Patch proposals are structured `PatchOperation` objects.
- [x] Patch generation and verification remain separate.
- [x] Verifier status cannot be set by AI.
- [x] Human Review remains the final acceptance step.
- [x] No platform write-back exists.
- [x] No credential inspection exists.
- [x] No platform-native patch export exists.
- [x] No public plugin system, user-uploaded JavaScript adapter, or remote adapter loading exists.
- [x] Session-only provider and n8n keys do not enter WorkflowIR, Workspace, Review Packet, report export, logs, or snapshots.

## Stable Review Packet and Report Exports

- [x] `DoctorReviewPacket` remains the canonical JSON handoff artifact.
- [x] Markdown Review Report renders from sanitized Review Packet data only.
- [x] Static HTML Review Report renders from sanitized Review Packet data only.
- [x] HTML report contains no JavaScript, external CSS, external fonts, remote images, or third-party assets.
- [x] Reports include source metadata, parser warnings, source diagnostics, redaction summary, verifier result, human review state, generated timestamp, schema versions, and review target fingerprint.
- [x] Reports exclude raw source artifacts, credentials, provider keys, signed URLs, webhook paths, raw prompts, raw code, raw SQL, platform ids, and platform-native patch output.
- [x] Stale report warnings appear when the active fingerprint differs from the packet fingerprint.

## Stable Adapter Framework

- [x] Built-in adapters use a static registry.
- [x] Adapter metadata is sanitized before WorkflowIR, UI, AI, verifier, Review Packet, and report export use.
- [x] Unknown node types are preserved as safe unknown nodes with diagnostics.
- [x] Broken edges are skipped or diagnosed without crashing.
- [x] Size limits fail closed.
- [x] Shared adapter conformance covers WorkflowIR, workspace documents, Review Packet artifacts, Markdown, HTML, AI context, adapter metadata, source diagnostics, and redaction summaries.

## CI and Release Gates

- [x] `npm ci`
- [x] `npm test`
- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] `npm run test:e2e`
- [x] `npm audit --json` reviewed and recorded for the release
- [ ] Docker Compose build passes
- [ ] Docker Smoke starts the app with localhost-safe defaults
- [x] Docker Smoke verifies the `OpenWorkflowDoctor` marker
- [x] GitHub Actions JavaScript actions are Node 24-compatible or documented with a safe migration path
- [x] Release checklist requires green Release Gate and Docker Smoke on the release commit before tagging

## Dependency Audit Status

- [x] Vitest/Vite/esbuild audit chain fixed or documented with an accepted risk owner.
- [x] Next/PostCSS audit finding fixed by a safe override or documented as a non-blocking transitive risk with a watch item.
- [x] No `npm audit fix --force` churn accepted without human review.
- [x] No major framework migration accepted solely for cosmetic outdated status.
- [x] Dependency audit notes stored in `docs/security/dependency-audit-v0.9.1.md` or a successor audit file.

## Known Non-Blocking Risks

- [x] Next/PostCSS transitive finding may remain if Next continues to pin a vulnerable PostCSS version and an override fails build/e2e.
- [x] Public docs may need minor release-line wording updates after the v0.9.1 tag.
- [x] Docker image size and production-only dependency pruning can be improved after v1 if no secret or runtime risk is found.
- [x] Direct Dify and Coze cloud import remain deferred until stable public API support and smoke matrices exist.

## UI / UX Polish Remaining for v0.9.2

- [ ] Tighten report preview readability only if it does not change report data shape.
- [ ] Improve first-run copy around supported sources and non-goals.
- [ ] Make stale report state and rerun guidance easier to scan.
- [ ] Improve Settings wording for session-only n8n keys and masked provider keys.
- [ ] Keep all UI polish separate from v1 trust-boundary changes.

## v1.0 Release Criteria

- [ ] v0.9.1 hardening release is tagged, pushed, and published.
- [ ] Release Gate and Docker Smoke pass on the v1 release commit.
- [ ] Dependency audit has no untriaged findings.
- [ ] Any remaining dependency finding has a documented risk classification and owner.
- [x] Secret leakage sentinel tests cover every target listed in the v0.9.1 audit plan.
- [x] Docs consistently state review-only behavior, no execution, no write-back, no credential inspection, WorkflowIR-only patches, Verifier checks, and Human Review acceptance.
- [x] `README.md`, `SECURITY.md`, `RELEASE_CHECKLIST.md`, `ROADMAP.md`, and core source adapter docs are synchronized.
- [ ] GitHub release notes repeat the v1 trust boundaries and known non-goals.
- [ ] No v1 release tag is created until the release owner manually reviews the final repository state.
