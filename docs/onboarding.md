# First-Run Onboarding

The v0.5.2 onboarding panel helps new users choose a safe local path before importing real workflows.

## Flow

1. Choose Demo mode or Connect n8n read-only.
2. Confirm trust boundaries:
   - OpenWorkflowDoctor does not execute workflows.
   - It does not write changes back to n8n.
   - It does not inspect or store credentials.
   - Patch proposals are review-only.
   - Imported data stays local.
3. Demo mode loads a bundled sample workflow and runs static Doctor diagnostics.
4. n8n mode sends the user to Settings to configure a read-only connection.
5. AI provider setup can be skipped. Rule-based diagnostics and verifier checks still work.

Onboarding state is stored in browser localStorage and can be reopened from Settings.
