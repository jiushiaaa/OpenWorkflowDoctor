# Review Report Export

OpenWorkflowDoctor v0.9.0 added human-readable Review Report exports on top of the existing JSON Review Packet. v0.9.1 keeps that export surface unchanged and hardens the secret-safety and release-gate checks around it.

The source of truth is unchanged:

```text
DoctorReport
  -> DoctorReviewPacket
  -> JSON Review Packet / Markdown Review Report / HTML Review Report
```

Reports are generated from the sanitized `DoctorReviewPacket` data. They do not read raw source artifacts and do not create a second review model.

## Export Formats

| File | Purpose |
| --- | --- |
| `workflow-review-packet.json` | Canonical machine-readable `DoctorReviewPacket` for exact review data. |
| `workflow-review-report.md` | GitHub/Notion/docs-friendly human review report. |
| `workflow-review-report.html` | Static printable browser report with no JavaScript or external assets. |

Each rendered report includes:

- `reportFormatVersion`
- `packetSchemaVersion`
- `generatedAt`
- `exportKind`
- source adapter metadata
- review target fingerprint

## Included Sections

Markdown and HTML reports use the same stable section order:

1. Header
2. Executive Summary
3. Source Metadata
4. Trust Boundaries
5. Diagnostics
6. Patch Proposal
7. Patch Diff Summary
8. Verifier Result
9. Human Review
10. Appendix

The report UI mirrors that structure with readable preview sections for overview, risks, patch, verifier, human review, source metadata, and export.

## Source Metadata

Reports include the v0.8 adapter metadata already attached to `WorkflowIR` and Review Packets:

- `adapterId`
- `sourceKind`
- `sourcePlatform`
- `importMethod`
- `stability`
- safe source metadata
- parser warnings
- redaction summary
- source diagnostics

The origin is rendered in human terms, for example n8n exported JSON, n8n read-only import, Dify DSL YAML, Coze definition JSON, or Custom Graph JSON.

## Exclusions

Review reports intentionally exclude:

- raw source artifacts
- credentials
- API keys
- bearer/basic tokens
- cookies
- passwords
- private keys
- signed URLs
- webhook paths
- plugin ids
- dataset ids
- file ids
- workspace/app/bot/org/tenant/user ids
- raw prompts
- raw code
- raw SQL
- AI provider keys
- n8n API keys
- Dify secret values
- Coze raw payload values
- platform-native patch output

The HTML report is static only: no JavaScript, no remote CSS, no external fonts, and no remote images.

## Stale Reports

The report renderer accepts the current review target fingerprint. If it differs from the packet fingerprint, Markdown and HTML reports show a stale warning.

The workbench also shows a stale banner when the active workflow document marks `latestReportState` as `stale`. Users should rerun Doctor before relying on stale report output.

## Redaction

Reports run through the same `sanitizeForExport` boundary as Review Packets. Redaction happens before values can reach the report renderer, UI preview, JSON packet, Markdown, HTML, Review Packet Artifact, or AI patch input.

Sentinel tests cover JSON Review Packet, Markdown report, HTML report, Review Packet Artifact shape, Workflow Document state, report preview state where testable, adapter metadata, source diagnostics, AI Explainer context, and AI patch input for representative raw artifacts and secret values.
