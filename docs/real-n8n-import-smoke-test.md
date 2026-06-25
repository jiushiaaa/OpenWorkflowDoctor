# Real n8n Import Smoke Test

Use this checklist before public demos or posts that invite users to connect their own n8n instance.

The v0.5.1 path is still read-only. Do not execute workflows, trigger webhooks, inspect credentials, update workflows, activate/deactivate workflows, or export n8n-importable patch JSON during this smoke test.

## Preconditions

- OpenWorkflowDoctor is running locally with `npm run dev -w apps/web` or the documented Next dev command.
- You have access to a test n8n Cloud or self-hosted instance.
- Use a non-production workflow and the least-privileged API key available.

## Create a Test Workflow

1. In n8n, create a small test workflow.
2. Include at least one trigger-like node and one side-effect-like node such as HTTP Request, Slack, Stripe, Gmail, or a similar node.
3. Add a credential reference to one node if possible. Do not put real secrets in node parameters.
4. Save the workflow.
5. Leave activation off unless your n8n test instance requires otherwise. OpenWorkflowDoctor does not activate or execute it.

## Create or Use an API Key

1. Create an n8n API key from the n8n UI.
2. Prefer the narrowest read permission available for your n8n plan.
3. Copy the key only into OpenWorkflowDoctor Settings.
4. After the smoke test, revoke the key if it was created only for testing.

## Configure OpenWorkflowDoctor

1. Open Settings.
2. In `n8n Connections`, enter:
   - connection label, for example `Test n8n Cloud`
   - n8n instance URL, for example `https://example.app.n8n.cloud`
   - optional environment label, for example `test`
   - n8n session key
3. Save the connection.
4. Confirm the UI says the key is session-only and not stored in WorkflowIR, workflow documents, review packets, or review packet artifacts.

## Test Connection and List Workflows

1. Open `Import from n8n`.
2. Select the saved connection.
3. Click `List workflows`.
4. Confirm your test workflow appears.
5. In browser devtools or a local network inspector, confirm the browser calls only the local OpenWorkflowDoctor proxy:
   - `POST /api/n8n/readonly`
6. Confirm the OpenWorkflowDoctor server-side request to n8n is only:
   - `GET /api/v1/workflows?excludePinnedData=true`
   - optional cursor paging with `cursor=...`
   - `GET /api/v1/workflows?limit=1&excludePinnedData=true` if testing the low-level connection check

## Import Selected Workflow

1. Select the test workflow.
2. Click `Import as local review copy`.
3. Confirm the workflow opens in the workbench.
4. Confirm the Workflow Explorer/source badge says:
   - `Read-only n8n source`
   - `Imported as local review copy`
   - `Refresh marks existing reports stale when upstream changes`
5. Confirm the local document has `sourceKind: n8n-readonly`.

## Run Doctor and Export Review Packet

1. Click `Run Doctor`.
2. Confirm a Doctor report appears.
3. Review Summary, Risks, Patch Diff, Verification, and Packet tabs.
4. Preview a patch only as local WorkflowIR.
5. Export the Review Packet.
6. Inspect the exported packet and confirm it does not contain:
   - n8n API key
   - raw n8n API response
   - credential ids
   - credential names
   - pinned data
   - static data
   - execution data
   - webhook URL, webhook id, or webhook path

## Refresh and Stale Report Behavior

1. In n8n, edit the test workflow. Add or rename a harmless node.
2. Save the workflow.
3. Return to OpenWorkflowDoctor.
4. Click `Refresh n8n`.
5. Confirm the local review copy updates.
6. Confirm the existing report is marked stale.
7. Confirm any AI Patch Proposal is marked stale.
8. Confirm the UI says the previous report was generated for a previous upstream version.
9. Rerun Doctor before exporting a new Review Packet.

## Manual Smoke Checklist

- [ ] Only `GET /workflows` is used against n8n.
- [ ] Only `GET /workflows/{id}` is used against n8n.
- [ ] `excludePinnedData=true` is present on every n8n workflow list/get request.
- [ ] No credentials endpoint is called.
- [ ] No executions endpoint is called.
- [ ] No `POST`, `PUT`, or `DELETE` request is sent to n8n.
- [ ] No activation/deactivation endpoint is called.
- [ ] No webhook URL is called.
- [ ] Imported workflow becomes `sourceKind: n8n-readonly`.
- [ ] n8n API key is not stored in `WorkflowIR`.
- [ ] n8n API key is not stored in `WorkflowDocument`.
- [ ] n8n API key is not stored in `ReviewPacketArtifact`.
- [ ] n8n API key is not stored in `DoctorReviewPacket`.
- [ ] Credential references are reduced to safe metadata only.
- [ ] `pinData`, `staticData`, and execution data are excluded.
- [ ] Patch Preview remains local only.

## CORS and Proxy Notes

v0.5 used browser-direct requests to the n8n API, which can fail if the n8n instance does not allow the OpenWorkflowDoctor origin through CORS.

v0.5.1 routes n8n reads through a local Next.js allowlist proxy:

- browser request: `POST /api/n8n/readonly`
- server-side n8n requests: only `GET /workflows`, `GET /workflows/{id}`, and the optional `GET /workflows?limit=1` connection check
- `excludePinnedData=true` is forced by the proxy
- arbitrary methods and arbitrary paths are not accepted
- the API key is not logged or persisted server-side
- browser storage rules remain unchanged: n8n keys are session-only

This avoids the common browser CORS failure for real n8n instances. It also means the local OpenWorkflowDoctor server temporarily handles the API key while forwarding the read-only request. Keep OpenWorkflowDoctor local and do not deploy it as a shared multi-user service without a separate auth and secret-handling design.
