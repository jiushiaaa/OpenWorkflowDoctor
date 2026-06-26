# v0.5 Read-only n8n Import

OpenWorkflowDoctor v0.5 adds an optional way to import existing workflows directly from an n8n instance. v0.5.1 hardens that path for real n8n testing by routing reads through a local allowlist proxy to avoid common browser CORS failures. This is an import source only. It does not turn OpenWorkflowDoctor into a workflow runtime, workflow builder, production connector, or write-back tool.

## Trust Model

```text
n8n API response
  -> read-only import adapter
  -> forbidden field stripping and secret-safe summaries
  -> WorkflowIR
  -> existing diagnostics and review pipeline
```

All review behavior remains local and review-only. Imported n8n workflows become local `WorkflowDocument` records with `sourceKind: "n8n-readonly"`. The stored document contains secret-safe `WorkflowIR` and source metadata, not the raw n8n API response.

## Allowed API Calls

The client exposes only three methods:

- `testConnection`
- `listWorkflows`
- `getWorkflow`

The only n8n endpoints used by the server-side proxy are:

- `GET /api/v1/workflows?limit=1&excludePinnedData=true`
- `GET /api/v1/workflows?excludePinnedData=true`
- `GET /api/v1/workflows/{id}?excludePinnedData=true`

`X-N8N-API-KEY` is the only auth header sent to n8n by default.

The browser calls only the local proxy route:

- `POST /api/n8n/readonly`

The proxy does not accept arbitrary methods or arbitrary paths. It derives the upstream n8n URL from an explicit action and forces `excludePinnedData=true`.

## Forbidden API Calls

v0.5 must not call:

- workflow create, update, delete, archive, unarchive, activate, deactivate, transfer, or tag update endpoints
- execution list, read, retry, stop, or delete endpoints
- credential list, read, schema, test, create, update, delete, or transfer endpoints
- webhook URLs, ids, paths, test URLs, or production URLs discovered in workflow data
- variables, users, source-control, audit, package, data-table, or private `/rest/*` endpoints

OpenWorkflowDoctor also does not export n8n-importable patch JSON. Patch Preview remains a local `WorkflowIR` preview only.

This path is the only supported direct platform read in the MVP. It is read-only, user-initiated, and session-key based; it is not platform write-back, workflow execution, credential inspection, or a production n8n mutator.

## Connection Storage

Connection metadata is stored in browser local storage:

- connection id
- label
- normalized n8n API root
- optional environment label
- auth header name
- timestamps and connection status

The n8n API key is session-only. It is stored in `sessionStorage`, not IndexedDB, not `WorkflowIR`, not Review Packets, and not Workflow Documents. Users can clear a session key or delete a connection from Settings.

## Imported Data

Stored workflow review data may include:

- workflow id as external workflow id
- workflow name
- nodes
- connections
- active status as source metadata
- tag names
- upstream `updatedAt`
- upstream `versionId`

Excluded or redacted data includes:

- credential ids
- credential names
- credential metadata
- pinned data
- static data
- execution data
- webhook ids, webhook paths, webhook URLs, test URLs, and production URLs
- sampled or binary payloads

Credential references are represented only as safe node metadata:

```json
{
  "credentialReferencePresent": true,
  "credentialTypes": ["httpHeaderAuth"],
  "credentialCount": 1
}
```

## Refresh

Refresh is manual only. Refresh fetches the upstream workflow by external id, converts it through the same secret-safe import adapter, and compares the new `WorkflowIR` to the stored local copy.

If unchanged, OpenWorkflowDoctor updates `lastFetchedAt`.

If changed, OpenWorkflowDoctor updates the local review copy and marks existing Doctor reports and AI Patch Proposals stale. The user must rerun Doctor before relying on verifier output or review packets for the refreshed workflow.

## Security Notes

n8n API keys may have broad permissions depending on the n8n plan and key scopes. Use the least-privileged key available. OpenWorkflowDoctor only performs read calls, but the key itself may still be powerful outside this app.

Read-only import does not guarantee runtime safety. It only gives the existing OpenWorkflowDoctor review pipeline a safer, faster way to obtain workflow definitions.

The local proxy means the OpenWorkflowDoctor server temporarily handles the session API key while forwarding read-only requests. The key is not logged or persisted server-side, and browser storage rules remain unchanged.

## Real n8n Smoke Test

Before a public launch or social post, run the manual smoke checklist in [Real n8n Import Smoke Test](real-n8n-import-smoke-test.md).

## v0.6+ Candidates

These remain out of scope for v0.5/v0.5.1:

- write-back to n8n
- workflow execution or test execution
- execution logs and observability analysis
- credential inspection
- workflow activation or deactivation
- n8n-importable patch export
- OAuth or team auth
- cloud sync
- scheduled refresh
- multi-workflow dependency import
