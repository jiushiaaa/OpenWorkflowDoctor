import { createParameterSummary, REDACTED_PREVIEW } from "./redaction.js";
import {
  acceptsInputByExtensionAndMime,
  assertAdapterFileGuardrails,
  createAdapterImportResult,
  type AdapterImportResult,
  type WorkflowSourceAdapter,
  type WorkflowSourceAdapterInput
} from "./workflow-source-adapter.js";
import type {
  EdgeIR,
  NodeIR,
  NodeParameterSummary,
  RedactionSummary,
  WorkflowIR,
  WorkflowSourceDiagnostic,
  WorkflowSourceMetadata
} from "./types.js";

export type CustomGraphJsonImportResult = {
  workflow: WorkflowIR;
  metadata: WorkflowSourceMetadata;
};

const MAX_CUSTOM_GRAPH_BYTES = 2 * 1024 * 1024;
const MAX_CUSTOM_GRAPH_NODE_COUNT = 500;
const MAX_CUSTOM_GRAPH_EDGE_COUNT = 1000;
const MAX_CUSTOM_GRAPH_NESTED_DEPTH = 32;
const KNOWN_CUSTOM_CATEGORIES = new Set([
  "action",
  "api",
  "branch",
  "condition",
  "database",
  "end",
  "http",
  "llm",
  "notification",
  "start",
  "task",
  "trigger"
]);

export const customGraphJsonSourceAdapter: WorkflowSourceAdapter = {
  adapterId: "custom.graphJson",
  id: "custom.graphJson",
  label: "Custom Graph JSON",
  sourceKind: "custom-graph-json",
  sourcePlatform: "custom",
  importMethod: "manual-artifact",
  stability: "experimental",
  acceptedInputs: {
    extensions: [".json"],
    mimeTypes: ["application/json", "text/json", ""]
  },
  trustModel: "untrusted-user-artifact",
  capabilities: ["file-upload", "manual-artifact", "source-diagnostics", "source-metadata", "review-packet-metadata"],
  limits: {
    maxFileBytes: MAX_CUSTOM_GRAPH_BYTES,
    maxNodes: MAX_CUSTOM_GRAPH_NODE_COUNT,
    maxEdges: MAX_CUSTOM_GRAPH_EDGE_COUNT,
    maxNestedDepth: MAX_CUSTOM_GRAPH_NESTED_DEPTH
  },
  acceptsFile(fileName, mimeType) {
    return acceptsInputByExtensionAndMime(this.acceptedInputs, fileName, mimeType);
  },
  import(input): AdapterImportResult {
    const imported = importCustomGraphJsonWorkflow(input);
    return createAdapterImportResult({
      adapter: this,
      input,
      workflowIR: imported.workflow,
      sourceMetadata: imported.metadata
    });
  }
};

export function importCustomGraphJsonWorkflow(input: WorkflowSourceAdapterInput): CustomGraphJsonImportResult {
  assertAdapterFileGuardrails(customGraphJsonSourceAdapter, input);

  let parsed: unknown;
  try {
    parsed = JSON.parse(input.content);
  } catch {
    throw new Error("Unable to parse Custom Graph JSON.");
  }

  const root = asRecord(parsed);
  if (!root || typeof root.name !== "string" || !Array.isArray(root.nodes) || !Array.isArray(root.edges)) {
    throw new Error("Custom Graph JSON must include name, nodes, and edges.");
  }
  if (root.nodes.length > MAX_CUSTOM_GRAPH_NODE_COUNT) {
    throw new Error(`Custom Graph JSON node count exceeds ${MAX_CUSTOM_GRAPH_NODE_COUNT}.`);
  }
  if (root.edges.length > MAX_CUSTOM_GRAPH_EDGE_COUNT) {
    throw new Error(`Custom Graph JSON edge count exceeds ${MAX_CUSTOM_GRAPH_EDGE_COUNT}.`);
  }

  const diagnostics: WorkflowSourceDiagnostic[] = [];
  const redactionTracker = createRedactionTracker();
  const nodes = parseNodes(root.nodes, diagnostics, redactionTracker);
  const edges = parseEdges(root.edges, nodes, diagnostics);
  const metadata = buildMetadata({
    input,
    workflowName: root.name.trim(),
    nodes,
    edges,
    diagnostics,
    redactionSummary: redactionTracker.summary()
  });
  const workflow: WorkflowIR = {
    name: root.name.trim(),
    nodes,
    edges,
    source: metadata
  };

  return { workflow, metadata };
}

function parseNodes(
  rawNodes: unknown[],
  diagnostics: WorkflowSourceDiagnostic[],
  redactionTracker: RedactionTracker
): NodeIR[] {
  const ids = new Set<string>();

  return rawNodes.map((rawNode, index) => {
    const node = asRecord(rawNode) ?? {};
    const id = safeString(node.id);
    if (!id) {
      throw new Error(`Custom Graph JSON node at index ${index} is missing id.`);
    }
    if (ids.has(id)) {
      throw new Error(`Custom Graph JSON contains duplicate node id ${id}.`);
    }
    ids.add(id);

    const sourceType = safeString(node.type) || safeString(node.category) || "task";
    const normalizedType = normalizeType(sourceType);
    const label = safeString(node.label) || safeString(node.name) || `Custom Node ${index + 1}`;
    const typeFamily = KNOWN_CUSTOM_CATEGORIES.has(normalizedType) ? "known" : "unknown";
    if (typeFamily === "unknown") {
      diagnostics.push({
        code: "custom_graph_unknown_node_type",
        severity: "medium",
        nodeId: id,
        message: "Custom Graph node type is unknown to this adapter.",
        evidence: [`Source type: ${sourceType}`]
      });
    }

    const parameters = summarizeNodeConfig(node, redactionTracker);
    return {
      id,
      name: label,
      type: `custom.${normalizedType}`,
      typeFamily,
      parameters
    };
  });
}

function parseEdges(
  rawEdges: unknown[],
  nodes: NodeIR[],
  diagnostics: WorkflowSourceDiagnostic[]
): EdgeIR[] {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const sourcePortCounts = new Map<string, number>();
  const edges: EdgeIR[] = [];

  rawEdges.forEach((rawEdge, index) => {
    const edge = asRecord(rawEdge) ?? {};
    const source = safeString(edge.source) || safeString(edge.from);
    const target = safeString(edge.target) || safeString(edge.to);
    if (!nodeIds.has(source) || !nodeIds.has(target)) {
      diagnostics.push({
        code: "custom_graph_broken_edge",
        severity: "medium",
        ...(nodeIds.has(source) ? { nodeId: source } : {}),
        message: "Custom Graph edge references a node that is not present.",
        evidence: [`Source: ${source || "missing"}`, `Target: ${target || "missing"}`]
      });
      return;
    }

    const sourceOutput = safeString(edge.label) || safeString(edge.conditionSummary) || "main";
    const edgeOrdinalKey = `${source}:${sourceOutput}`;
    const sourceOutputIndex = sourcePortCounts.get(edgeOrdinalKey) ?? 0;
    sourcePortCounts.set(edgeOrdinalKey, sourceOutputIndex + 1);
    edges.push({
      id: safeString(edge.id) || `${source}:${sourceOutput}:${sourceOutputIndex}:${target}:${index}`,
      sourceNodeId: source,
      targetNodeId: target,
      sourceOutput,
      sourceOutputIndex
    });
  });

  return edges;
}

function summarizeNodeConfig(node: Record<string, unknown>, redactionTracker: RedactionTracker): NodeParameterSummary[] {
  const parameters: NodeParameterSummary[] = [];
  const description = safeString(node.description);
  const configSummary = asRecord(node.configSummary) ?? asRecord(node.nodeConfigSummary);

  if (description) {
    parameters.push(createParameterSummary("descriptionLengthBucket", bucketLength(description.length)));
    if (/prompt|secret|token|authorization|password/i.test(description)) {
      parameters.push(createParameterSummary("descriptionRiskSignals", ["sensitive-reference"]));
      redactionTracker.mark("description", "Custom Graph descriptions were summarized before persistence.");
    }
  }

  if (!configSummary) {
    return parameters;
  }

  for (const [key, value] of Object.entries(configSummary)) {
    const normalized = normalizeKey(key);
    if (normalized.includes("rawprompt") || normalized === "prompt") {
      parameters.push(createParameterSummary("rawPromptPresent", true));
      parameters.push(createParameterSummary("rawPromptLengthBucket", bucketLength(stringLength(value))));
      redactionTracker.mark(key, "Custom Graph raw prompts were summarized before persistence.");
      continue;
    }
    if (normalized.includes("rawcode") || normalized === "code") {
      parameters.push(createParameterSummary("rawCodePresent", true));
      parameters.push(createParameterSummary("rawCodeRiskSignals", detectCodeRiskSignals(String(value))));
      redactionTracker.mark(key, "Custom Graph raw code was summarized before persistence.");
      continue;
    }
    if (normalized.includes("rawsql") || normalized === "sql") {
      parameters.push(createParameterSummary("rawSqlPresent", true));
      parameters.push(createParameterSummary("rawSqlMutationLikely", /\b(insert|update|delete|drop|alter|truncate)\b/i.test(String(value))));
      redactionTracker.mark(key, "Custom Graph raw SQL was summarized before persistence.");
      continue;
    }

    const summary = createParameterSummary(key, value);
    if (summary.redacted || summary.preview.includes(REDACTED_PREVIEW)) {
      redactionTracker.mark(key, "Custom Graph configuration value was redacted before persistence.");
    }
    parameters.push(summary);
  }

  return parameters;
}

function buildMetadata({
  input,
  workflowName,
  nodes,
  edges,
  diagnostics,
  redactionSummary
}: {
  input: WorkflowSourceAdapterInput;
  workflowName: string;
  nodes: NodeIR[];
  edges: EdgeIR[];
  diagnostics: WorkflowSourceDiagnostic[];
  redactionSummary: RedactionSummary;
}): WorkflowSourceMetadata {
  return {
    adapterId: "custom.graphJson",
    sourceKind: "custom-graph-json",
    sourcePlatform: "custom",
    importMethod: "manual-artifact",
    stability: "experimental",
    sourceLabel: input.fileName,
    app: {
      name: workflowName,
      mode: "declarative-graph-json"
    },
    nodeCount: nodes.length,
    edgeCount: edges.length,
    redactionSummary,
    parserWarnings: diagnostics.map((diagnostic) => diagnostic.message),
    diagnostics
  };
}

type RedactionTracker = {
  mark: (key: string, note: string) => void;
  summary: () => RedactionSummary;
};

function createRedactionTracker(): RedactionTracker {
  const redactedKeys = new Set<string>();
  const notes = new Set<string>();
  let redactedValueCount = 0;

  return {
    mark(key, note) {
      redactedKeys.add(key);
      notes.add(note);
      redactedValueCount += 1;
    },
    summary() {
      return {
        redactedValueCount,
        redactedKeys: [...redactedKeys].sort(),
        notes: [...notes]
      };
    }
  };
}

function normalizeType(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "task";
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function bucketLength(length: number): string {
  if (length <= 0) {
    return "empty";
  }
  if (length < 200) {
    return "short";
  }
  if (length < 1000) {
    return "medium";
  }
  return "long";
}

function stringLength(value: unknown): number {
  return typeof value === "string" ? value.length : JSON.stringify(value)?.length ?? 0;
}

function detectCodeRiskSignals(code: string): string[] {
  const signals: string[] = [];
  if (/fetch|http|request/i.test(code)) {
    signals.push("network");
  }
  if (/\bfs\b|filesystem|readfile|writefile/i.test(code)) {
    signals.push("filesystem");
  }
  if (/eval|function\s*\(/i.test(code)) {
    signals.push("dynamic-code");
  }
  if (/secret|token|authorization|password/i.test(code)) {
    signals.push("secret-reference");
  }
  return signals.length > 0 ? signals : ["none"];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
