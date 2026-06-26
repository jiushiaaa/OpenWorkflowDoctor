import { parseN8nWorkflow } from "./n8n-parser.js";
import {
  acceptsInputByExtensionAndMime,
  createAdapterImportResult,
  type WorkflowSourceAdapter
} from "./workflow-source-adapter.js";
import type { RedactionSummary, WorkflowIR, WorkflowSourceDiagnostic, WorkflowSourceMetadata } from "./types.js";

export type N8nReadonlyWorkflowMetadata = {
  externalWorkflowId?: string;
  workflowName: string;
  active?: boolean;
  upstreamUpdatedAt?: string;
  upstreamVersionId?: string;
  tags: string[];
};

export type N8nReadonlyWorkflowImport = {
  workflow: WorkflowIR;
  metadata: N8nReadonlyWorkflowMetadata;
  sourceMetadata: WorkflowSourceMetadata;
};

const MAX_N8N_READONLY_BYTES = 2 * 1024 * 1024;
const MAX_N8N_READONLY_NODE_COUNT = 500;
const MAX_N8N_READONLY_EDGE_COUNT = 1000;

export const n8nReadonlySourceAdapter: WorkflowSourceAdapter = {
  adapterId: "n8n.readonlyImport",
  id: "n8n-readonly",
  label: "n8n Read-only Import",
  sourceKind: "n8n-readonly",
  sourcePlatform: "n8n",
  importMethod: "read-only-connection",
  stability: "stable",
  acceptedInputs: {
    extensions: [".json"],
    mimeTypes: ["application/json", "text/json", ""]
  },
  trustModel: "read-only-platform-import",
  capabilities: ["read-only-connection", "source-diagnostics", "source-metadata", "review-packet-metadata"],
  limits: {
    maxFileBytes: MAX_N8N_READONLY_BYTES,
    maxNodes: MAX_N8N_READONLY_NODE_COUNT,
    maxEdges: MAX_N8N_READONLY_EDGE_COUNT,
    maxNestedDepth: 64
  },
  acceptsFile(fileName, mimeType) {
    return acceptsInputByExtensionAndMime(this.acceptedInputs, fileName, mimeType);
  },
  import(input) {
    let payload: unknown;
    try {
      payload = JSON.parse(input.content);
    } catch {
      throw new Error("Unable to parse n8n read-only workflow JSON.");
    }
    const imported = importN8nReadonlyWorkflow(payload);
    return createAdapterImportResult({
      adapter: this,
      input,
      workflowIR: imported.workflow,
      sourceMetadata: imported.sourceMetadata
    });
  }
};

export function importN8nReadonlyWorkflow(payload: unknown): N8nReadonlyWorkflowImport {
  const source = isRecord(payload) ? payload : {};
  const workflow = parseN8nWorkflow(source);
  const diagnostics = createSourceDiagnostics(workflow);
  const sourceMetadata = createSourceMetadata(source, workflow, diagnostics);

  return {
    workflow: {
      ...workflow,
      source: sourceMetadata
    },
    metadata: {
      ...(typeof source.id === "string" && source.id.trim().length > 0
        ? { externalWorkflowId: source.id }
        : {}),
      workflowName: workflow.name,
      ...(typeof source.active === "boolean" ? { active: source.active } : {}),
      ...(typeof source.updatedAt === "string" && source.updatedAt.trim().length > 0
        ? { upstreamUpdatedAt: source.updatedAt }
        : {}),
      ...(typeof source.versionId === "string" && source.versionId.trim().length > 0
        ? { upstreamVersionId: source.versionId }
        : {}),
      tags: extractTagNames(source.tags)
    },
    sourceMetadata
  };
}

function createSourceMetadata(
  source: Record<string, unknown>,
  workflow: WorkflowIR,
  diagnostics: WorkflowSourceDiagnostic[]
): WorkflowSourceMetadata {
  return {
    adapterId: "n8n.readonlyImport",
    sourceKind: "n8n-readonly",
    sourcePlatform: "n8n",
    importMethod: "read-only-connection",
    stability: "stable",
    ...(typeof source.versionId === "string" && source.versionId.trim().length > 0
      ? { sourceVersion: source.versionId }
      : {}),
    sourceLabel: workflow.name,
    app: {
      name: workflow.name,
      mode: "read-only-import"
    },
    nodeCount: workflow.nodes.length,
    edgeCount: workflow.edges.length,
    redactionSummary: summarizeWorkflowRedactions(workflow),
    parserWarnings: diagnostics.map((diagnostic) => diagnostic.message),
    diagnostics
  };
}

function createSourceDiagnostics(workflow: WorkflowIR): WorkflowSourceDiagnostic[] {
  return workflow.nodes
    .filter((node) => node.typeFamily === "unknown")
    .map((node) => ({
      code: "n8n_unknown_node_type",
      severity: "medium" as const,
      nodeId: node.id,
      message: "n8n node type is unknown to the built-in adapter.",
      evidence: [`Node type: ${node.type}`]
    }));
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

  return {
    redactedValueCount,
    redactedKeys: [...redactedKeys].sort(),
    notes: redactedValueCount > 0 ? ["n8n read-only import values were redacted or summarized before persistence."] : []
  };
}

function extractTagNames(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((tag) => {
      if (!isRecord(tag)) {
        return "";
      }
      return typeof tag.name === "string" ? tag.name.trim() : "";
    })
    .filter((tagName) => tagName.length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
