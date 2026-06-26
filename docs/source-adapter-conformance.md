# Source Adapter Conformance

Every built-in source adapter must pass the shared conformance expectations before release.

## Required Checks

- Malformed input creates no import result or workspace document.
- Raw input is not stored.
- Sentinel secrets do not leak into `WorkflowIR`.
- Sentinel secrets do not leak into workspace documents.
- Sentinel secrets do not leak into Review Packet artifacts.
- Sentinel secrets do not leak into Markdown Review Reports.
- Sentinel secrets do not leak into static HTML Review Reports.
- Sentinel secrets do not leak into AI context.
- Unknown nodes do not crash import.
- Broken edges create diagnostics.
- Source metadata is sanitized.
- Review Packet and Review Reports record `adapterId`, `sourceKind`, `sourcePlatform`, and `importMethod`.
- Parser warnings are preserved.
- `redactionSummary` records redacted or summarized values.
- Limits are enforced.

## Test Kit

Core adapters can use `runWorkflowSourceAdapterConformance` from `packages/workflow-ir`.

Adapter-specific tests should still cover platform details, but the shared kit proves the common safety boundary.

## Current Coverage

v0.8 applies conformance-style coverage to:

- n8n exported JSON
- Dify DSL YAML
- Coze definition JSON
- Custom Graph JSON

n8n read-only import keeps its existing read-only connection tests and participates in the registry as `n8n.readonlyImport`.

v0.9 adds report export coverage for JSON Review Packet, Markdown Review Report, static HTML Review Report, Review Packet Artifact shape, and AI patch input sentinel checks.

v0.9.1 expands the final pre-v1 sentinel matrix to include WorkflowIR, Workflow Documents, Review Packet Artifacts, DoctorReviewPacket JSON, Markdown, HTML, AI Explainer context, AI Patch context, adapter metadata, source diagnostics, and report preview state where testable.
