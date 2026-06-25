# v0.6.1 Dify Read-only Import Feasibility

Status: deferred.

Dify DSL YAML import is the stable supported path in OpenWorkflowDoctor. v0.6 reads a user-provided `.yml` or `.yaml` export, parses it in memory, converts it through the existing Dify DSL parser, redacts sensitive values, and stores only secret-safe `WorkflowIR` plus source metadata.

This note captures future feasibility for optional Dify read-only import. It does not ship a Dify direct import feature, Dify API connection, console cookie/session flow, workflow execution path, publish flow, write-back flow, dataset fetch, plugin fetch, file fetch, resource resolver, or raw DSL persistence.

## Feasibility Position

A future Dify direct import would mean remote DSL acquisition only:

```text
Dify console read-only response
  -> local allowlist proxy
  -> raw DSL held in memory only
  -> existing importDifyDslWorkflow parser
  -> existing redaction pipeline
  -> secret-safe WorkflowIR
  -> existing review-only Doctor flow
```

OpenWorkflowDoctor should not treat Dify app runtime APIs as an import surface. Runtime endpoints such as chat, completion, and workflow-run APIs execute or interact with published applications, so they remain out of scope.

Dify console APIs are not treated as stable public APIs. The feasible app list and export paths are console/internal, version-sensitive, and tied to Dify Studio authorization behavior. Any future implementation must be experimental, hidden behind a feature flag, and documented as best-effort compatibility rather than a default product capability.

## Future Trust Model

Allowed only in a future experimental implementation:

- List apps through strictly allowlisted console read endpoints.
- Export a selected app DSL with `include_secret=false`.
- Keep raw DSL in memory only.
- Immediately parse and redact into `WorkflowIR` by reusing the v0.6 Dify DSL parser and redaction pipeline.
- Store only sanitized source metadata, redaction summary, diagnostics, and `WorkflowIR`.

Forbidden:

- Dify app runtime API calls.
- Chat, completion, or workflow-run calls.
- Publish or write-back.
- App creation, update, copy, delete, enable, disable, import, or other mutation.
- Dataset content fetching.
- Plugin, tool, file, URL, or workspace-resource resolution.
- Secret export.
- Raw DSL persistence in workspace documents, Review Packets, AI context, logs, or browser storage.
- Arbitrary console API path proxying.

## Future Proxy Allowlist

If implemented later, the browser should call only:

- `POST /api/dify/readonly`

Allowed proxy actions:

- `testConnection`
- `listApps`
- `exportAppDsl`

Proxy requirements:

- Upstream requests must be `GET` only.
- The proxy must derive upstream paths from closed action names, not user-provided paths.
- Export must force `include_secret=false`.
- App ids must be validated before use in an upstream path.
- Pagination and mode filters must be bounded and allowlisted.
- The proxy must reject arbitrary paths.
- The proxy must reject runtime `/v1/*` paths.
- The proxy must reject dataset, plugin, file, workflow-run, import, publish, and mutation routes.
- The proxy must not log `Authorization`, `Cookie`, `x-csrf-token`, request auth fields, or upstream DSL content.

## Secret Exclusion and Redaction

Future remote export cannot rely on Dify alone for secret safety. OpenWorkflowDoctor must force `include_secret=false` where the console export endpoint supports it, but exported DSL still has to pass through the existing local redaction pipeline before any UI, workspace, AI, or Review Packet boundary.

The parser should continue to flag materialized secret environment variables, credential-like values, signed URLs, upload ids, dataset/workspace/user/app ids in parameter summaries, and other sensitive values already covered by v0.6 Dify DSL import.

## Release Gate

Do not expose Dify direct import by default in v0.6.1.

Before any user-facing release, require:

- A feature flag that defaults off.
- A Dify Cloud smoke test.
- A self-hosted Dify smoke test.
- Version notes for tested Dify releases.
- Proxy allowlist tests.
- Auth redaction/logging tests.
- Review Packet tests proving no raw DSL or auth material is exported.
- UI copy that labels the feature experimental and explains that console APIs may change.

Until those gates are met, the supported Dify path remains local Dify DSL YAML import.
