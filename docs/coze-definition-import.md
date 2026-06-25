# v0.7 Coze Workflow Definition Import

OpenWorkflowDoctor v0.7 adds manual Coze workflow definition JSON import as a diagnosis-only source adapter.

This is not a Coze cloud integration, runtime, exporter, or write-back path.

## Supported Input

The Coze importer accepts `.json` files only. The uploaded JSON is treated as untrusted input.

Supported graph shapes:

- direct canvas: `{ "nodes": [...], "edges": [...] }`
- wrapped graph fields: `workflow_schema`, `canvas`, `schema`, `Canvas`, or `CanvasSchema`
- wrapped values may be JSON objects or JSON strings

The importer rejects invalid JSON, missing graph shape, oversized files, too many nodes or edges, and nested blocks beyond the v0.7 depth guardrail.

## Data Flow

```text
Coze definition JSON
  -> cozeDefinitionSourceAdapter
  -> importCozeDefinitionWorkflow
  -> secret-safe WorkflowIR
  -> WorkflowDocument sourceKind: coze-definition
  -> existing diagnostics, WorkflowIR patch preview, verifier, human review, and Review Packet flow
```

Raw Coze JSON is parsed in memory and is not stored in workspace documents, AI context, UI state, or Review Packets.

## Mapping

Coze nodes map to `NodeIR` with stable safe ids, redacted labels, normalized `coze.*` types, and summarized parameters.

Known families include start, end, LLM, plugin/tool, code, knowledge retrieval/write/delete, condition/selector, subworkflow, loop, batch, variable assign/merge, database operations, HTTP request, conversation/message/input/output, and unknown.

Unknown node types become `coze.unknown.<type>` and generate diagnostics instead of crashing.

Coze edges map `sourceNodeID` and `targetNodeID` to existing `EdgeIR` source/target fields. `sourcePortID` is preserved as the source output, and `targetPortID` is preserved as target input metadata. Broken edges are dropped and recorded as diagnostics.

Composite `blocks` and nested `edges` are flattened into WorkflowIR with safe id collision handling. Raw nested payloads are not persisted.

## Redaction

The adapter redacts or summarizes sensitive fields before persistence:

- authorization headers, cookies, API keys, bearer/basic tokens, OAuth tokens, passwords, private keys
- signed URLs, webhook paths, sensitive URL query values
- plugin ids, API ids, plugin versions, plugin credential material
- dataset, knowledge, database, workflow, app, bot, connector, user, account, and workspace ids
- uploaded file ids, file URLs, image URLs, and object storage references
- full prompts, code bodies, SQL, request/response bodies, and schema defaults
- any key/name implying secret material

Persisted safe summaries include `promptPresent`, `promptLengthBucket`, `codePresent`, `codeRiskSignals`, `sqlPresent`, `sqlMutationLikely`, `pluginReferencePresent`, `knowledgeReferencePresent`, `externalSideEffectLikely`, `idsRedacted`, redaction counts, and reasons.

## Diagnostics

Coze-specific diagnostics are emitted as normal `RiskIssue` records, including:

- `coze_definition_unstable_artifact`
- `coze_missing_start_node`
- `coze_missing_end_node`
- `coze_unknown_node_type`
- `coze_broken_edge`
- `coze_condition_without_fallback`
- `coze_plugin_side_effect`
- `coze_http_without_timeout`
- `coze_http_auth_materialized`
- `coze_code_node_present`
- `coze_code_unsafe_reference`
- `coze_knowledge_external_reference`
- `coze_database_mutation`
- `coze_subworkflow_unresolved`
- `coze_file_reference`
- `coze_error_strategy_missing`
- `coze_batch_or_loop_requires_review`

Generic WorkflowIR diagnostics still apply where relevant.

## UI and Review Packet

The workbench shows a `Coze Definition` source badge and this warning:

> Imported for diagnosis only. OpenWorkflowDoctor will not connect to Coze, run, publish, fetch resources, or write back.

The inspector shows source kind, source platform, artifact shape, node count, edge count, parser warnings, redaction summary, and unresolved resource status.

Review Packets include safe Coze source metadata, parser warnings, redaction summary, Coze diagnostics, verifier result, and human review state. They exclude raw Coze JSON, raw prompts, raw code, raw SQL, plugin ids, dataset ids, workflow ids, bot ids, workspace ids, signed URLs, credentials, and Coze-importable patches.

## v0.7 Non-goals

v0.7 does not:

- connect to Coze Cloud
- call Coze APIs
- call runtime workflow/chatflow APIs
- execute Coze workflows
- publish or write back to Coze
- inspect or resolve credentials
- fetch plugins, datasets, files, bots, apps, variables, workspaces, child workflows, or runtime traces
- store raw Coze JSON in workspace documents
- export Coze-importable patches

AI Patch Proposal remains WorkflowIR-only.
