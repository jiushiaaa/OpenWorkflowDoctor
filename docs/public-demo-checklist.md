# Public Demo Checklist

Use this checklist before a public v0.5.2 demo or freeze audit.

- Demo mode works without n8n.
- Demo mode works without AI.
- Docker Compose starts from a fresh clone.
- Read-only boundaries are visible before import.
- Invalid n8n URL gives actionable feedback.
- Missing AI provider does not block diagnostics.
- Reset workspace removes local user data.
- No docs imply hosted SaaS, write-back, or execution.
- The app does not execute workflows.
- The app does not write changes back to n8n.
- The app does not inspect or store credentials.
- AI patch proposals remain review-only PatchOperation objects.
