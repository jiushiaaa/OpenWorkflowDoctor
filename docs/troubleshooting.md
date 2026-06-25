# Troubleshooting

OpenWorkflowDoctor v0.5.2 includes in-product troubleshooting cards in Settings.

## n8n Connection Checks

- Local proxy reachable.
- n8n base URL is a valid `/api/v1` URL.
- n8n is reachable through the proxy.
- Session-only API key is present.
- API key is accepted.
- Workflow list endpoint works.
- Selected workflow import works.
- `excludePinnedData=true` is used.
- No write endpoint is called.

The local proxy only uses read-only workflow endpoints and returns sanitized errors. API keys are not printed in UI logs.

## AI Provider Checks

- Provider preset is selected.
- Base URL is present.
- Model is present.
- API key is present and masked.
- Optional lightweight test request status.
- Diagnostics-only fallback is available.

Missing AI configuration never blocks rule-based diagnostics.

## Reset Actions

Settings can clear imported workflows, n8n connection config, AI provider config, first-run onboarding state, or the entire local workspace. Reset confirmations list what will be removed and what will be preserved before any local data is cleared.
