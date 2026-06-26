# Custom Graph JSON Import

`custom.graphJson` is a safe built-in adapter for simple declarative workflow graphs. It is useful when a platform does not yet have a first-class adapter.

It does not support JavaScript, executable mapping rules, dynamic imports, remote schemas, or runtime plugins.

Custom Graph JSON remains a declarative built-in adapter only. It is not a public plugin system and does not allow user-uploaded JavaScript adapters, remote adapter loading, workflow execution, platform write-back, credential inspection, or platform-native patch export.

## Shape

```json
{
  "name": "Support Workflow",
  "sourceMetadata": {
    "system": "internal helpdesk"
  },
  "nodes": [
    {
      "id": "start",
      "label": "Start",
      "type": "trigger",
      "configSummary": {
        "event": "ticket.created"
      }
    }
  ],
  "edges": [
    {
      "source": "start",
      "target": "triage",
      "label": "main"
    }
  ]
}
```

Nodes support:

- `id`
- `label` or `name`
- `type` or `category`
- optional `description`
- optional `configSummary` or `nodeConfigSummary`

Edges support:

- `source` or `from`
- `target` or `to`
- optional `label`
- optional `conditionSummary`

## Redaction

The adapter redacts or summarizes auth headers, API keys, bearer/basic tokens, cookies, passwords, private keys, signed URLs, webhook paths, file ids, dataset ids, plugin ids, workspace/app/bot/org/tenant/user ids, raw prompts, raw code, and raw SQL.

Descriptions are summarized by length and risk signals instead of being stored as raw text.

## Diagnostics

The adapter fails closed for malformed JSON, missing `name`/`nodes`/`edges`, duplicate node ids, size limits, and over-limit graphs.

Unknown node types are preserved as `unknown` WorkflowIR nodes with diagnostics. Broken edges are skipped and recorded as source diagnostics.

## Sample

See `samples/custom-graph/support-workflow.json`.
