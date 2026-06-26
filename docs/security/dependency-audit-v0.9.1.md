# OpenWorkflowDoctor v0.9.1 Security, Dependency, and Release Hardening Plan and Result

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` before implementing this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `v0.9.1` as a hardening-only release before v1.0.

**Architecture:** Keep the existing review-only product boundary intact. Dependency remediation, CI, Docker, docs, and sentinel tests may change, but no new workflow sources, runtime execution, platform write-back, credential inspection, cloud sync, plugin system, direct Dify/Coze import, logs, or agent harness should be added.

**Tech Stack:** npm workspaces, TypeScript, Vitest, Next.js, Playwright, Docker Compose, GitHub Actions.

---

## Precondition

Status: passed on 2026-06-26.

- Local tag exists: `git tag --list v0.9.0` returned `v0.9.0`.
- Remote tag exists: `git ls-remote --tags origin refs/tags/v0.9.0` returned `refs/tags/v0.9.0`.
- GitHub release exists: `gh release view v0.9.0 --repo jiushiaaa/OpenWorkflowDoctor --json tagName,name,isDraft,isPrerelease,publishedAt,url` returned a published, non-draft, non-prerelease release at `https://github.com/jiushiaaa/OpenWorkflowDoctor/releases/tag/v0.9.0`.

## A. v0.9.1 Plan Summary

`v0.9.1` should be a release hardening pass only:

- classify and remediate dependency audit findings without `npm audit fix --force`;
- prove trust boundaries with targeted code review and sentinel tests;
- add or document release gates for test, lint, typecheck, build, e2e, Docker Smoke, and dependency audit;
- refresh stale release docs so they describe the v0.9.1 hardening line without expanding product scope;
- create a v1 readiness checklist that separates v1 blockers from non-blocking v0.9.2 polish.

Success criteria:

- `npm audit --json` findings are either fixed by low-risk updates or explicitly documented as deferred with rationale.
- Secret-safety sentinel coverage includes WorkflowIR, workspace documents, review packet artifacts, JSON/Markdown/HTML exports, AI contexts, adapter metadata, source diagnostics, and feasible logs/snapshots.
- CI has a clear Release Gate path.
- Docker Smoke proves the public try-out path starts without external services or real secrets.
- Public docs consistently say: OpenWorkflowDoctor reviews workflows; it does not run them.

Implementation status: completed for freeze audit. The Vitest/Vite/esbuild critical/high chain was remediated, Release Gate CI was added, Docker Smoke was kept separate and moved to `actions/checkout@v5`, final pre-v1 sentinel coverage was expanded, version metadata was bumped to `0.9.1`, and docs were synchronized. The only remaining audit findings are the documented Next/PostCSS moderate transitive chain.

## B. Dependency Audit Findings

Commands inspected:

- `npm audit --json`
- `npm outdated --json`
- `npm ls vite vitest next postcss esbuild @vitest/mocker vite-node --all`
- `npm view` for candidate `vitest`, `next`, and `postcss` dependency state

Initial audit result: 7 vulnerabilities total: 5 moderate, 1 high, 1 critical.

Final audit result after remediation: 2 vulnerabilities total: 2 moderate, 0 high, 0 critical.

Final dependency tree:

- `vitest@3.2.6`
- `@vitest/mocker@3.2.6`
- `vite-node@3.2.4`
- `vite@7.3.6`
- `esbuild@0.28.1`
- `apps/web -> next@15.5.19 -> postcss@8.4.31`
- `vitest -> vite -> postcss@8.5.15`

| Package | Current Version | Vulnerable Range | Severity | Direct | Prod or Dev | Affected Path | Runtime Surface | Dev/Test/Build Surface | Recommended Action | Safe in v0.9.1 | Defer to v1.x | Force Upgrade Churn |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `vitest` | `2.1.9` | `<=3.2.5` | critical | yes | dev-only | root `devDependencies` | no production runtime impact; risk applies when Vitest UI/server is exposed | local test tooling | upgrade to `vitest@3.2.6` first, then rerun audit and full checks | yes, if tests pass | `vitest@4.1.9` can wait unless 3.2.6 fails to clear audit | `npm audit fix --force` would jump to `4.1.9` |
| `@vitest/mocker` | `2.1.9` | `<=3.0.0-beta.4` | moderate | no | dev-only | `vitest -> @vitest/mocker` | no production runtime impact | local test tooling | resolved with `vitest@3.2.6` candidate | yes, via Vitest upgrade | no | force path follows Vitest 4 |
| `vite-node` | `2.1.9` | `<=2.2.0-beta.2` | moderate | no | dev-only | `vitest -> vite-node` | no production runtime impact | local test tooling | resolved with `vitest@3.2.6` candidate | yes, via Vitest upgrade | no | force path follows Vitest 4 |
| `vite` | `5.4.21` | `<=6.4.2` | high | no | dev-only through Vitest | `vitest -> vite` | no production runtime impact | local test tooling; vulnerable dev server behavior on local machine | upgrade Vitest and confirm lockfile resolves Vite above the vulnerable range; use a lockfile-only or override adjustment only if needed | yes, if audit clears and tests pass | Vite ecosystem major churn can wait if not needed | force path follows Vitest 4 |
| `esbuild` | `0.21.5` | `<=0.24.2` | moderate | no | dev-only through Vite | `vitest -> vite -> esbuild` | no production runtime impact | local dev/test server request exposure | resolved by moving Vite above affected range | yes, through Vitest/Vite remediation | no | force path follows Vitest 4 |
| `next` | `15.5.19` | `9.3.4-canary.0 - 16.3.0-canary.5` | moderate | yes in `apps/web` | production dependency | `apps/web -> next -> postcss` | limited web app surface; no user-supplied CSS workflow path identified | build/server CSS processing | do not downgrade to npm audit's suggested `9.3.3`; evaluate a `postcss` override to `>=8.5.10` and prove with build/e2e | maybe, only after override test | defer Next major migration; `next@16.2.9` still declares `postcss@8.4.31` | high if forced via Next major/downgrade |
| `postcss` | `8.4.31` under Next | `<8.5.10` | moderate | no | production transitive | `apps/web -> next -> postcss` | limited unless attacker-controlled CSS reaches Next/PostCSS stringification | build/server CSS processing | evaluate package override to `postcss@8.5.15` or newer; keep documented if Next pin blocks safe remediation | maybe, if build/e2e pass | yes if override is unstable | forcing Next does not currently fix this cleanly |

Outdated packages that should not be treated as automatic v0.9.1 work:

- `next`: current `15.5.19`, latest `16.2.9`; major migration is outside hardening unless required for security and proven safe.
- `typescript`: current `5.9.3`, latest `6.0.3`; major migration is not v0.9.1 scope.
- `eslint` and `@eslint/js`: current `9.39.4`, latest `10.x`; major migration is not v0.9.1 scope.
- `@types/node`: updated within the Node 20 line to `20.19.43` to satisfy the Vite 7 peer expectation without jumping to Node 26 types.
- `vitest`: current `2.1.9`, latest `4.1.9`; prefer `3.2.6` as the smallest audit-clearing candidate before considering v4.

## C. Proposed Safe Dependency Actions

Implementation result:

- [x] Upgraded `vitest` to `3.2.6`.
- [x] Ran `npm install` to update `package-lock.json`.
- [x] Ran `npm ls vite vitest esbuild @vitest/mocker vite-node --all`.
- [x] Ran `npm audit --json` and confirmed the Vitest/Vite/esbuild chain is cleared.
- [x] Ran focused sentinel tests after adding v0.9.1 coverage.
- [x] Tested a minimal npm override for `postcss@8.5.15`.
- [x] Reverted the override because npm left `next/node_modules/postcss@8.4.31` in place, marked it invalid, and audit still reported the same moderate Next/PostCSS findings.
- [x] Documented the remaining Next/PostCSS chain as a known non-blocking transitive risk.

Do not do these before v1.0:

- Do not run `npm audit fix --force`.
- Do not downgrade Next to satisfy npm audit output.
- Do not migrate to Next 16 solely for the current PostCSS audit finding, because `next@16.2.9` still declares `postcss@8.4.31`.
- Do not migrate TypeScript 6, ESLint 10, or Vitest 4 unless a smaller security fix cannot pass.

## D. Security Boundary Audit Plan

Use code search, targeted tests, and manual review. Any implementation finding must remain hardening-only.

| Boundary | Current Evidence to Review | v0.9.1 Audit Check |
| --- | --- | --- |
| No workflow execution | docs and code references to static diagnostics, patch preview, verifier | search for runtime execution calls and platform run endpoints; add negative tests if any import path suggests execution |
| No platform write-back | docs forbid write-back; n8n route should be read-only | inspect API routes for mutating methods; confirm no Dify/Coze write clients exist |
| No credential inspection | docs and redaction code summarize credential presence only | test n8n credential fields, Dify secrets, Coze credential-like fields, and Custom Graph sensitive fields |
| No platform-native patch export | report export docs exclude native patches | confirm JSON/Markdown/HTML exports contain only `DoctorReviewPacket`/WorkflowIR review artifacts |
| No raw source artifact persistence | architecture and adapter docs say raw source is parsed in memory | inspect workspace serialization and adapter results for raw n8n/Dify/Coze/Custom Graph payload fields |
| No public plugin system | adapter docs state built-in static registry only | inspect adapter registry/import UI for dynamic loaders, remote URLs, or user JavaScript execution |
| AI Explainer secret-safe context | `packages/workflow-ai` builds safe graph summaries | extend tests for all sentinel categories, not just API key/bearer examples |
| AI Patch secret-safe WorkflowIR context | AI patch tests already cover provider and raw label exclusions | extend tests to Dify/Coze/Custom Graph sentinel values |
| Review exports exclude secrets | report renderer uses `sanitizeForExport` | add combined JSON/Markdown/HTML snapshot-free assertions for all sentinel categories |
| Session-only provider/n8n keys | README/docs say keys stay out of WorkflowIR, Workspace, Review Packet, exports | inspect local storage/session storage split and route request handling |
| Docker/CI do not print secrets | Docker Smoke prints Compose logs on failure | ensure sample `.env` has no real secrets and CI log output does not echo key-bearing env values |

## E. Secret Leakage Test Plan

Final v1 preflight sentinel coverage should build one or more hostile workflow fixtures per source type and assert absence across every derived artifact.

Targets:

- `WorkflowIR`
- `WorkflowDocument`
- `ReviewPacketArtifact`
- `DoctorReviewPacket`
- Markdown report
- HTML report
- AI Explainer context
- AI Patch context
- UI report preview state where testable
- adapter metadata
- source diagnostics
- logs and test snapshots where feasible

Sentinel categories:

- API key
- bearer token
- cookie
- password
- private key
- webhook path
- signed URL
- plugin id
- dataset id
- file id
- workspace/app/bot/org/tenant/user id
- raw prompt
- raw code
- raw SQL
- AI provider key
- n8n API key
- Dify secret env value
- Coze raw payload value

Implementation plan:

- [ ] Create shared sentinel constants in the test layer, not production code.
- [ ] Add one assertion helper that serializes artifacts and fails if any sentinel appears.
- [ ] Cover n8n exported JSON and read-only import shapes.
- [ ] Cover Dify DSL YAML.
- [ ] Cover Coze definition JSON.
- [ ] Cover Custom Graph JSON.
- [ ] Cover AI Explainer input and AI Patch Proposal input separately.
- [ ] Cover Markdown/HTML report strings and UI preview state where testable.
- [ ] Avoid snapshotting raw sentinels into committed fixtures unless the fixture itself is explicitly a test-only hostile input.

## F. CI / Release Hardening Plan

Current state:

- `.github/workflows/docker-smoke.yml` builds Docker Compose, starts the app, probes `http://localhost:3000`, checks for the `OpenWorkflowDoctor` marker, prints diagnostics on failure, and tears down volumes.
- There is no combined GitHub Actions Release Gate workflow for `npm test`, lint, typecheck, build, e2e, dependency audit, and Docker Smoke.

Plan:

- [x] Add a `Release Gate` workflow that runs on `push`, `pull_request`, and `workflow_dispatch`.
- [x] Use `npm ci`.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run typecheck`.
- [x] Run `npm run build`.
- [x] Install Playwright browser dependencies if needed, then run `npm run test:e2e`.
- [x] Run `npm audit --json` as a non-blocking audit report while the documented Next/PostCSS finding remains.
- [x] Keep Docker Smoke as a separate workflow.
- [x] Update `RELEASE_CHECKLIST.md` so tagging requires Release Gate and Docker Smoke to pass on the release commit.

GitHub Actions Node runtime annotation:

- `actions/checkout@v4` targets Node 20 and is expected to trigger deprecation annotations as GitHub moves JavaScript actions to Node 24.
- GitHub's changelog states Node 20 actions are being migrated toward Node 24, and actions may be forced to Node 24 before Node 20 is removed from runners.
- `actions/checkout@v5` updates checkout to Node 24 and requires runner version `v2.327.1` or newer.
- For GitHub-hosted `ubuntu-latest`, upgrading Docker Smoke and Release Gate checkout steps to `actions/checkout@v5` is the recommended v0.9.1 action after one green workflow run.
- If self-hosted runners are introduced, document the minimum runner version before adopting checkout v5 there.

References:

- GitHub changelog: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/
- `actions/checkout` v5 release notes: https://github.com/actions/checkout/releases/tag/v5.0.0

## G. Docker Hardening Plan

Reviewed:

- `Dockerfile`
- `docker-compose.yml`
- `.env.example`
- `docs/local-deployment.md`
- `.github/workflows/docker-smoke.yml`

Current observations:

- Compose binds the app to `127.0.0.1:${OPENWORKFLOWDOCTOR_APP_PORT:-3000}:3000`.
- Demo mode defaults to `true`.
- No AI provider key or n8n key is required by `.env.example`.
- `.env.example` tells users to configure n8n and AI providers inside the browser UI.
- Docker Smoke checks the public root page for the `OpenWorkflowDoctor` marker.
- Failure diagnostics print `docker compose logs`; this is acceptable only if the app never logs key material.

Plan:

- [x] Keep localhost-only Compose port binding.
- [x] Keep demo mode as the default Docker try-out path.
- [x] Add a release checklist item that Docker must start without AI/n8n env vars.
- [x] Confirm existing provider/n8n key tests keep keys out of workflow documents, packet artifacts, and API responses.
- [x] Confirm Docker Smoke still checks the `OpenWorkflowDoctor` marker.
- [x] Defer image-size hardening because no secret or runtime risk required it for v0.9.1.

## H. Documentation Consistency Plan

Docs to audit and update:

- `README.md`
- `SECURITY.md`
- `RELEASE_CHECKLIST.md`
- `ROADMAP.md`
- `docs/architecture.md`
- `docs/adapter-sdk.md`
- `docs/source-adapter-conformance.md`
- `docs/review-report-export.md`
- `docs/n8n-readonly-import.md`
- `docs/dify-dsl-import.md`
- `docs/coze-definition-import.md`
- `docs/custom-graph-json-import.md`

Consistency checks:

- OpenWorkflowDoctor reviews workflows; it does not run them.
- AI proposes; Verifier checks; Human Review accepts.
- Patch Proposal is WorkflowIR-only.
- No platform write-back.
- No credential inspection.
- Reports are generated from sanitized Review Packet data only.
- Supported sources are n8n exported JSON, optional n8n read-only import, Dify DSL YAML, Coze definition JSON, and Custom Graph JSON.
- Dify direct import and Coze direct import remain deferred/unsupported as default platform integrations.

Implementation result:

- `README.md` names `v0.9.1` as the current hardening release.
- `ROADMAP.md` includes a `v0.9.1` hardening section and keeps execution logs/observability outside the pre-v1 hardening lane.
- `RELEASE_CHECKLIST.md` is now the `v0.9.1` freeze audit checklist.
- `SECURITY.md` distinguishes optional read-only n8n import from production n8n mutation.
- `docs/local-deployment.md` no longer carries the stale `v0.5.2` intro.
- Source adapter docs repeat the review-only boundary and secret-safe report expectations.

## I. What Should Be Implemented in v0.9.1

- [x] Safe dependency remediation for Vitest/Vite/esbuild chain.
- [x] Tested decision on Next/PostCSS: safe override rejected; known non-blocking risk documented.
- [x] Release Gate workflow.
- [x] Checkout v5 migration for GitHub-hosted workflows.
- [x] Expanded sentinel leakage tests for all requested targets and categories.
- [x] Docker hardening checklist updates.
- [x] Docs consistency updates listed above.
- [x] `docs/v1-readiness-checklist.md`.

## J. What Should Be Explicitly Deferred

- New workflow source platforms.
- Workflow execution.
- Platform write-back.
- Credential inspection.
- Platform-native patch export.
- Dify direct import as a default supported path.
- Coze direct import as a default supported path.
- Runtime logs and observability analysis.
- Agent harness or multi-agent features.
- Cloud sync.
- Accounts and collaboration.
- Public plugin system.
- User-uploaded JavaScript adapters.
- Remote adapter loading.
- Large framework migrations unrelated to audit closure.
- Next 16, TypeScript 6, ESLint 10, or Vitest 4 unless smaller security remediations fail.

## Safe to Proceed?

Yes, v0.9.1 is ready for freeze-audit verification once the full local gate passes.

Do not create a release tag until Release Gate and Docker Smoke pass on the release commit and the release owner manually reviews the final repository state.
