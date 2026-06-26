# Adapter SDK v0.8

OpenWorkflowDoctor v0.8 uses an internal built-in source adapter framework. It is not a public plugin system.

## Goals

- Add future built-in workflow sources without rewriting import UI, redaction, diagnostics, Review Packet metadata, Review Report metadata, and tests.
- Keep raw source artifacts inside the adapter/import boundary.
- Persist only secret-safe `WorkflowIR`, sanitized source metadata, parser warnings, source diagnostics, and redaction summaries.
- Keep AI Patch Proposal WorkflowIR-only.

## Contract

Each `WorkflowSourceAdapter` defines:

- `adapterId`: stable internal id, such as `n8n.exportedJson`.
- `label`: UI label from the built-in registry.
- `sourceKind`: source identity, such as `n8n-exported-json` or `custom-graph-json`.
- `sourcePlatform`: `n8n`, `dify`, `coze`, or `custom`.
- `importMethod`: `file-upload`, `read-only-connection`, `manual-artifact`, or `sample`.
- `stability`: `stable`, `experimental`, or `best-effort`.
- `acceptedInputs`: file extensions and MIME types.
- `trustModel`: built-in trust boundary.
- `capabilities`: UI and docs capabilities.
- `limits`: max file size, nodes, edges, and nested depth.
- `import(input)`: returns sanitized `AdapterImportResult`.

`AdapterImportResult` contains only:

- `workflowIR`
- `sourceMetadata`
- `sourceDiagnostics`
- `parserWarnings`
- `redactionSummary`
- `adapterInfo`
- `importFingerprint`

Raw input and raw parsed objects must not escape the adapter.

## Built-in Registry

The static registry contains:

- `n8n.exportedJson`
- `n8n.readonlyImport`
- `dify.dslYaml`
- `coze.definitionJson`
- `custom.graphJson`

The registry drives file import choices, supported source labels, badges, docs expectations, and conformance tests.

## Pipeline

The unified artifact import pipeline:

1. Select adapter by `adapterId` or safe default detection.
2. Validate extension, MIME type, file size, and nested depth.
3. Run adapter import in memory.
4. Enforce adapter node and edge limits.
5. Redact and summarize sensitive data.
6. Normalize to `WorkflowIR`.
7. Attach sanitized source metadata.
8. Create a workspace document from sanitized output only.
9. Make metadata available to UI, AI Explainer, AI Patch, Verifier, Review Packet, and Markdown/HTML Review Reports.

## Boundaries

v0.8 does not support third-party executable adapters, user-uploaded JavaScript adapters, remote adapter loading, adapter marketplaces, workflow execution, platform write-back, credential inspection, runtime plugin execution, or cloud sync.

## Review Report Metadata

v0.9 report exports reuse adapter metadata from the sanitized Review Packet. New source adapters must keep `adapterId`, `sourceKind`, `sourcePlatform`, `importMethod`, `stability`, parser warnings, source diagnostics, and redaction summary safe for JSON, Markdown, and static HTML export.
