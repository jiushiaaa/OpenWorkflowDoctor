# OpenWorkflowDoctor v0.1 Release Checklist

Run these commands from the repository root before any v0.1 demo or release commit:

```bash
npm test
npm run lint
npm run typecheck
npm run build -w apps/web
npm run test:e2e
```

Expected result: every command exits with code 0.

Do not tag a release until the demo owner manually reviews the resulting repository state.
