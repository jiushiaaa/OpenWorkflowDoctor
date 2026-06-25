# v0.6 Dify DSL Import

OpenWorkflowDoctor v0.6 adds Dify DSL YAML as the first non-n8n platform adapter. YAML import remains the stable supported Dify path.

This is an import source only. It does not add a Dify API connection, workflow execution, publish, write-back, credential lookup, dataset fetch, plugin fetch, file fetch, URL fetch, or patched Dify DSL export.

The policy is simple: direct Dify import is intentionally deferred. The currently feasible remote acquisition routes are Dify console/internal APIs, not stable public app runtime APIs, and they are version-sensitive. Future exploration is documented in [v0.6.1 Dify Read-only Import Feasibility](dify-readonly-import-feasibility.md) and must stay experimental behind a feature flag before any user-facing release.

## Trust Boundary

Allowed flow:

```text
Dify .yml/.yaml DSL
  -> difyDslSourceAdapter
  -> importDifyDslWorkflow
  -> secret-safe WorkflowIR
  -> WorkflowDocument sourceKind: dify-dsl
  -> existing Doctor report, PatchOperation preview, verifier, Human Review, and Review Packet flow
```

Raw YAML is parsed in memory and is not stored in workspace documents. The stored document contains `WorkflowIR`, sanitized source metadata, redaction summary, parser warnings, and diagnostics.

## Parsed DSL Fields

v0.6 validates the basic Dify app shape:

- `kind`
- `version`
- `app`
- `workflow`
- `workflow.graph.nodes`
- `workflow.graph.edges`

Safe source metadata records app name, description, mode, DSL version, source label, node count, edge count, parser warnings, diagnostics, redaction summary, and safe environment-variable presence metadata.

## Mapping

Dify nodes map into `NodeIR`:

- node `id` -> `NodeIR.id`
- `data.title` -> `NodeIR.name`
- `data.type` -> normalized `NodeIR.type`
- unknown node types -> `dify.unknown.*`
- safe `data` fields -> redacted parameter summaries

Dify edges map into `EdgeIR`:

- `source` -> `sourceNodeId`
- `target` -> `targetNodeId`
- `sourceHandle` -> `sourceOutput`
- `targetHandle` is treated as source metadata only in v0.6

Edges pointing at missing nodes are not persisted as invalid edges. They produce Dify diagnostics.

## Redaction

Redaction happens before persistence, UI display, AI context, patch context, and Review Packet export.

The importer redacts or summarizes:

- Dify environment variable values, especially `type: secret`
- API keys, bearer tokens, passwords, private keys, authorization headers, cookies, and `x-api-key`
- provider/tool credential references
- signed URLs
- `upload_file_id`, `uploadedId`, and file ids
- dataset, tenant, workspace, user, and app ids when they appear in parameter summaries

The Review Packet records source metadata but never raw YAML.

## Dify-Specific Diagnostics

v0.6 adds Dify-specific rules for:

- materialized secret environment variables
- file/file-list defaults with upload ids
- external side-effect nodes such as tool and HTTP nodes
- code nodes and unsafe code references
- knowledge retrieval external resource references
- missing start node
- missing terminal end/answer node
- unknown edge endpoints
- conditional branch without fallback/default route
- unknown node types
- unsupported Dify DSL versions
- unsupported app modes

Generic WorkflowIR diagnostics still run on the converted graph.

## UI

The import menu supports:

- exported n8n JSON
- Dify DSL YAML
- read-only n8n import

Dify imports show a `Dify DSL` source badge and the warning:

> Imported for diagnosis only. OpenWorkflowDoctor will not run, publish, or write back to Dify.

## Out of Scope

v0.6 does not include:

- Dify API connection
- Dify direct read-only import
- Dify workflow execution
- Dify publish or write-back
- Dify credential inspection
- dataset, plugin, file, URL, or workspace-resource fetching
- patched Dify DSL export
- Coze import

## Validation

Run:

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```
