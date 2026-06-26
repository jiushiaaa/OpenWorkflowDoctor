import { createParameterSummary } from "./redaction.js";
import { parseN8nWorkflow } from "./n8n-parser.js";
import {
  acceptsInputByExtensionAndMime,
  assertAdapterFileGuardrails,
  createAdapterImportResult,
  createEmptyRedactionSummary,
  type WorkflowSourceAdapter,
  type WorkflowSourceAdapterInput
} from "./workflow-source-adapter.js";
import type {
  RedactionSummary,
  WorkflowIR,
  WorkflowSourceDiagnostic,
  WorkflowSourceMetadata
} from "./types.js";

export type N8nExportedJsonImportResult = {
  workflow: WorkflowIR;
  metadata: WorkflowSourceMetadata;
};

const MAX_N8N_EXPORTED_JSON_BYTES = 2 * 1024 * 1024;
const MAX_N8N_NODE_COUNT = 500;
const MAX_N8N_EDGE_COUNT = 1000;
const MAX_N8N_NESTED_DEPTH = 64;

export const n8nExportedJsonSourceAdapter: WorkflowSourceAdapter = {
  adapterId: "n8n.exportedJson",
  id: "n8n.exportedJson",
  label: "n8n Exported JSON",
  sourceKind: "n8n-exported-json",
  sourcePlatform: "n8n",
  importMethod: "file-upload",
  stability: "stable",
  acceptedInputs: {
    extensions: [".json"],
    mimeTypes: ["application/json", "text/json", ""]
  },
  trustModel: "untrusted-user-artifact",
  capabilities: ["file-upload", "source-diagnostics", "source-metadata", "review-packet-metadata"],
  limits: {
    maxFileBytes: MAX_N8N_EXPORTED_JSON_BYTES,
    maxNodes: MAX_N8N_NODE_COUNT,
    maxEdges: MAX_N8N_EDGE_COUNT,
    maxNestedDepth: MAX_N8N_NESTED_DEPTH
  },
  acceptsFile(fileName, mimeType) {
    return acceptsInputByExtensionAndMime(this.acceptedInputs, fileName, mimeType);
  },
  import(input) {
    const imported = importN8nExportedJsonWorkflow(input);
    return createAdapterImportResult({
      adapter: this,
      input,
      workflowIR: imported.workflow,
      sourceMetadata: imported.metadata
    });
  }
};

export function importN8nExportedJsonWorkflow(input: WorkflowSourceAdapterInput): N8nExportedJsonImportResult {
  assertAdapterFileGuardrails(n8nExportedJsonSourceAdapter, input);

  let parsed: unknown;
  try {
    parsed = JSON.parse(input.content);
  } catch {
    throw new Error("Unable to parse n8n exported JSON.");
  }

  const workflow = parseN8nWorkflow(parsed);
  if (workflow.nodes.length > MAX_N8N_NODE_COUNT) {
    throw new Error(`n8n exported JSON node count exceeds ${MAX_N8N_NODE_COUNT}.`);
  }
  if (workflow.edges.length > MAX_N8N_EDGE_COUNT) {
    throw new Error(`n8n exported JSON edge count exceeds ${MAX_N8N_EDGE_COUNT}.`);
  }

  const diagnostics = diagnoseN8nSource(parsed, workflow);
  const redactionSummary = summarizeWorkflowRedactions(workflow);
  const metadata: WorkflowSourceMetadata = {
    adapterId: "n8n.exportedJson",
    sourceKind: "n8n-exported-json",
    sourcePlatform: "n8n",
    importMethod: "file-upload",
    stability: "stable",
    sourceLabel: input.fileName,
    app: {
      name: workflow.name,
      mode: "exported-json"
    },
    nodeCount: workflow.nodes.length,
    edgeCount: workflow.edges.length,
    redactionSummary,
    parserWarnings: diagnostics.map((diagnostic) => diagnostic.message),
    diagnostics
  };

  return {
    workflow: {
      ...workflow,
      source: metadata
    },
    metadata
  };
}

function diagnoseN8nSource(source: unknown, workflow: WorkflowIR): WorkflowSourceDiagnostic[] {
  const diagnostics: WorkflowSourceDiagnostic[] = [];
  const nodesByName = new Map<string, string>();
  for (const node of workflow.nodes) {
    if (node.typeFamily === "unknown") {
      diagnostics.push({
        code: "n8n_unknown_node_type",
        severity: "medium",
        nodeId: node.id,
        message: "n8n node type is unknown to the built-in adapter.",
        evidence: [`Node type: ${node.type}`]
      });
    }
    if (!nodesByName.has(node.name)) {
      nodesByName.set(node.name, node.id);
    } else {
      nodesByName.set(node.name, "");
    }
  }

  const root = asRecord(source);
  const connections = root ? asRecord(root.connections) : null;
  if (!connections) {
    return diagnostics;
  }

  for (const [sourceName, outputGroups] of Object.entries(connections)) {
    const sourceNodeId = nodesByName.get(sourceName);
    if (!sourceNodeId) {
      diagnostics.push({
        code: "n8n_broken_edge",
        severity: "medium",
        message: "n8n connection references a source node that is not present or not uniquely named.",
        evidence: [`Source: ${sourceName}`, "Target: unknown"]
      });
      continue;
    }
    const outputs = asRecord(outputGroups);
    if (!outputs) {
      continue;
    }
    for (const targetsByIndex of Object.values(outputs)) {
      if (!Array.isArray(targetsByIndex)) {
        continue;
      }
      for (const targets of targetsByIndex) {
        if (!Array.isArray(targets)) {
          continue;
        }
        for (const rawTarget of targets) {
          const target = asRecord(rawTarget);
          const targetName = typeof target?.node === "string" ? target.node : "";
          if (!targetName || !nodesByName.get(targetName)) {
            diagnostics.push({
              code: "n8n_broken_edge",
              severity: "medium",
              nodeId: sourceNodeId,
              message: "n8n connection references a target node that is not present or not uniquely named.",
              evidence: [`Source: ${sourceName}`, `Target: ${targetName || "missing"}`]
            });
          }
        }
      }
    }
  }

  return diagnostics;
}

function summarizeWorkflowRedactions(workflow: WorkflowIR): RedactionSummary {
  const redactedKeys = new Set<string>();
  let redactedValueCount = 0;

  for (const node of workflow.nodes) {
    for (const parameter of node.parameters) {
      if (parameter.redacted) {
        redactedKeys.add(parameter.key);
        redactedValueCount += 1;
      }
    }
    if (node.credentialSummary?.credentialReferencePresent) {
      redactedKeys.add("credentials");
      redactedValueCount += node.credentialSummary.credentialCount;
    }
  }

  if (redactedValueCount === 0) {
    return createEmptyRedactionSummary();
  }

  return {
    redactedValueCount,
    redactedKeys: [...redactedKeys].sort(),
    notes: ["n8n exported JSON values were redacted or summarized before persistence."]
  };
}

export function createN8nParameterSummaryForAdapter(key: string, value: unknown) {
  return createParameterSummary(key, value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
