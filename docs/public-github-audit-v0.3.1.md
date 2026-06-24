# Public GitHub Audit Notes for v0.3.1

Date: 2026-06-24

Scope: public GitHub readiness for the v0.3.1 workbench state. This audit does not add features and does not change runtime behavior.

Command run:

```bash
npm audit
```

Result:

```text
7 vulnerabilities
5 moderate, 1 high, 1 critical
```

## Findings

| Package | Severity | Dependency type | Path | Reachable in shipped Next.js app? | Safe patch/minor fix? | `npm audit fix` risk | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `vitest` | critical | direct dev dependency | root `devDependencies` | No. Test runner only; not bundled into the app. | No patch/minor fix on the current v2 line. Advisory range is `<3.2.6`. | `npm audit fix --force` upgrades to `vitest@4.1.9`, a semver-major tooling change. | Defer. Upgrade deliberately in a separate maintenance slice. |
| `vite` | high | transitive dev dependency | `vitest -> vite` | No. Used by Vitest tooling, not the Next.js app runtime. | No safe patch/minor through current `vitest@2.1.9`. | Fixed only through semver-major Vitest upgrade according to npm audit. | Defer. |
| `vite-node` | moderate | transitive dev dependency | `vitest -> vite-node` | No. Test tooling only. | No safe patch/minor through current `vitest@2.1.9`. | Fixed only through semver-major Vitest upgrade according to npm audit. | Defer. |
| `@vitest/mocker` | moderate | transitive dev dependency | `vitest -> @vitest/mocker` | No. Test tooling only. | No safe patch/minor through current `vitest@2.1.9`. | Fixed only through semver-major Vitest upgrade according to npm audit. | Defer. |
| `esbuild` | moderate | transitive dev dependency | `vitest -> vite -> esbuild` | No. Development server/test tooling exposure; not bundled as app logic. | No safe patch/minor through current `vitest@2.1.9`. | Fixed only through semver-major Vitest upgrade according to npm audit. | Defer. |
| `next` | moderate | direct production dependency in `apps/web` | `@openworkflowdoctor/web -> next` | Partially. Next is the app framework, but the reported issue is via its nested `postcss` dependency. | No safe patch/minor fix reported by npm audit for the current Next 15 line. | npm audit suggests `next@9.3.3`, which is a destructive downgrade and not acceptable. | Defer. |
| `postcss` | moderate | transitive production dependency | `next -> postcss@8.4.31` | Low practical reachability in this app. The app does not accept untrusted CSS and run it through PostCSS stringify. | `postcss@8.5.10` exists, but Next pins `postcss@8.4.31`; an npm override produced an invalid dependency tree and was reverted. | Auto-fix routes through the unacceptable Next downgrade. | Defer. |

## Conclusions

1. Affected packages: `vitest`, `vite`, `vite-node`, `@vitest/mocker`, `esbuild`, `next`, and `postcss`.
2. Production dependency exposure is limited to `next -> postcss`; the Vitest/Vite/esbuild chain is development and test tooling.
3. The shipped Next.js app does not expose Vitest, Vite, Vite Node, or esbuild. The PostCSS advisory is not practically reachable unless the app processes untrusted CSS through PostCSS stringify, which it does not currently do.
4. No known safe patch/minor dependency fix was available from `npm audit` for this dependency graph.
5. `npm audit fix --force` would introduce breaking or unacceptable changes: a semver-major Vitest upgrade and an invalid Next downgrade suggestion.
6. No dependency issue was safely fixable now without either a semver-major tooling migration or an invalid Next transitive override.
7. Public GitHub readiness decision: document and defer. The repository can be published with this audit note because the critical/high findings are dev-tooling scoped and the production finding is low practical reachability in the current app.

## Deferred Maintenance

- Evaluate `vitest@3.2.6` or newer in a dedicated maintenance branch, then run the full verification suite.
- Track a Next release that resolves or removes the nested vulnerable PostCSS dependency without downgrading Next or breaking the app.
- Re-run `npm audit` after each dependency maintenance slice.
