# Feedback Guide

OpenWorkflowDoctor is in a public feedback stage before v0.5.

The goal is to learn whether real n8n users need workflow review, what risks they care about, and whether read-only n8n import is the right next step.

## Best Feedback Questions

- Do you currently review n8n workflows before deploying changes?
- Which risks matter most: missing error handling, missing timeouts, duplicate webhooks, payment idempotency, branch coverage, audit trails, or something else?
- Is exported JSON review acceptable, or do you need read-only import from n8n?
- Is a Review Packet understandable as a handoff artifact?
- Would you trust AI Patch Proposal if every operation remains structured, validated, previewed, verified, and manually reviewed?
- Which providers should be verified next?

## What to Include in Feedback

- n8n workflow type or domain.
- Whether the workflow is personal, team, or production-critical.
- The risk you expected OpenWorkflowDoctor to catch.
- Whether the current UI made the verifier and human review boundaries clear.
- Whether you would prefer v0.5 read-only n8n import or deeper diagnostics first.

## Safety Notes

- Do not paste API keys, credentials, private URLs, tokens, or secrets into GitHub issues.
- Do not upload workflows that contain secrets in node labels, names, descriptions, or other human-readable fields.
- Redact screenshots before sharing them.
- Review Packet exports may contain workflow structure and reviewer decisions; treat them as project artifacts.
