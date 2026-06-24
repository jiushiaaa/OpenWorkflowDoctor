# OpenWorkflowDoctor v0.2 Release Checklist

Run these commands from the repository root before any v0.2 release commit:

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

Expected result: every command exits with code 0.

## v0.2 freeze checks

- Default language is `zh-CN`.
- `en-US` language switch works.
- Settings controls language, theme, and AI Provider.
- Theme control lives in Settings, not as a loose top-level temporary button.
- AI Provider config supports provider, base URL, API key, and model.
- API key is masked in UI.
- API key is stored only in browser-local Settings for local-first use.
- API key is not included in `WorkflowIR`.
- API key is not included in `DoctorReviewPacket`.
- API key is not logged.
- AI Explainer works without API key using deterministic fallback.
- AI Explainer remains advisory-only.
- AI Explainer cannot create `PatchOperation`.
- AI Explainer cannot change verifier status.
- AI Explainer cannot change `humanReviewValidation`.
- Deterministic diagnostics and Verifier remain the source of truth.
- Primary UI copy is translated in `zh-CN` and `en-US`.
- README documents v0.2 capabilities and limitations.
- Playwright e2e covers Settings, language switch, and AI fallback.
- Do not add AI patch generation, AI verifier behavior, n8n API integration, workflow execution, or n8n-importable patch export.

Do not tag a release until the release owner manually reviews the resulting repository state.
