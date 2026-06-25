# OpenWorkflowDoctor v0.5.1 Public Release Checklist

Run these commands from the repository root before any public release commit:

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

Expected result: every command exits with code 0.

## Public docs checks

- README names `v0.5.1` as the current stable release.
- README includes a current demo GIF and workbench screenshot.
- CHANGELOG lists all public tags and keeps AI trust boundaries explicit.
- SECURITY documents local BYOK, WorkflowIR redaction, Review Packet exclusions, and AI provider boundaries.
- ROADMAP keeps v0.5.1 read-only n8n import in real-smoke hardening status.
- GitHub release notes are available in `docs/github-release-notes.md`.
- Demo and feedback guides are available in `docs/demo-guide.md` and `docs/feedback-guide.md`.
- GitHub issue templates are available under `.github/ISSUE_TEMPLATE`.
- Provider compatibility is documented in `docs/provider-presets-compatibility.md`.
- Manual smoke instructions are documented in `docs/manual-ai-patch-smoke-test.md` and `docs/real-n8n-import-smoke-test.md`.

## v0.5.1 freeze checks

- Provider registry includes Verified, Preset, Experimental, and Custom tiers.
- Settings provider dropdown uses provider presets.
- Provider config supports provider, base URL, API key, model, transport, and response format.
- API key is masked in UI.
- API key is stored only in browser-local Settings for local-first use.
- API key is not included in `WorkflowIR`.
- API key is not included in `DoctorReviewPacket`.
- API key is not included in workspace documents.
- AI Explainer remains advisory-only.
- AI Patch Proposal can only propose structured `PatchOperation` candidates.
- AI Patch Proposal output must pass Zod validation.
- AI Patch Proposal output must pass semantic validation and conflict detection.
- AI Patch Proposal preview must use the deterministic patch engine.
- AI cannot change verifier status.
- AI cannot change `humanReviewValidation`.
- Deterministic diagnostics and Verifier remain the source of truth.
- Human Review remains required before acceptance.
- Primary UI copy is translated in `zh-CN` and `en-US`.
- Playwright e2e covers Settings, language switch, AI fallback, provider presets, AI patch preview, and multi-workflow state.
- Read-only n8n import remains import-only.
- Do not add workflow execution, automatic write-back, credential lookup, execution lookup, webhook triggering, or n8n-importable patch export.

Do not tag a release until the release owner manually reviews the resulting repository state.
