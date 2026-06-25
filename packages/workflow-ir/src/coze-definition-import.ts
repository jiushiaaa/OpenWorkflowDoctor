import { createParameterSummary, formatRedactedValue, REDACTED_PREVIEW } from "./redaction.js";
import type { WorkflowSourceAdapter, WorkflowSourceAdapterInput } from "./workflow-source-adapter.js";
import type {
  EdgeIR,
  NodeIR,
  RedactionSummary,
  RiskSeverity,
  WorkflowIR,
  WorkflowSourceDiagnostic,
  WorkflowSourceMetadata
} from "./types.js";

export type CozeDefinitionImportResult = {
  workflow: WorkflowIR;
  metadata: WorkflowSourceMetadata;
};

type CanvasShape = {
  nodes: unknown[];
  edges: unknown[];
  artifactShape: string;
  root: Record<string, unknown>;
};

type ParsedNode = {
  node: NodeIR;
  rawId?: string;
  mappedId: string;
};

const MAX_COZE_DEFINITION_BYTES = 2 * 1024 * 1024;
const MAX_COZE_NODE_COUNT = 500;
const MAX_COZE_EDGE_COUNT = 1000;
const MAX_COZE_NESTED_BLOCK_DEPTH = 6;
const WRAPPER_KEYS = ["workflow_schema", "canvas", "schema", "Canvas", "CanvasSchema"];

const KNOWN_COZE_NODE_TYPES = new Map<string, string>([
  ["1", "coze.start"],
  ["Entry", "coze.start"],
  ["Start", "coze.start"],
  ["2", "coze.end"],
  ["Exit", "coze.end"],
  ["End", "coze.end"],
  ["3", "coze.llm"],
  ["LLM", "coze.llm"],
  ["4", "coze.plugin"],
  ["Plugin", "coze.plugin"],
  ["Api", "coze.plugin"],
  ["5", "coze.code"],
  ["CodeRunner", "coze.code"],
  ["Code", "coze.code"],
  ["6", "coze.knowledge.retrieve"],
  ["KnowledgeRetriever", "coze.knowledge.retrieve"],
  ["27", "coze.knowledge.write"],
  ["KnowledgeIndexer", "coze.knowledge.write"],
  ["KnowledgeDeleter", "coze.knowledge.delete"],
  ["8", "coze.condition.selector"],
  ["Selector", "coze.condition.selector"],
  ["If", "coze.condition.selector"],
  ["9", "coze.subworkflow"],
  ["SubWorkflow", "coze.subworkflow"],
  ["21", "coze.loop"],
  ["Loop", "coze.loop"],
  ["28", "coze.batch"],
  ["Batch", "coze.batch"],
  ["40", "coze.variable.assign"],
  ["VariableAssigner", "coze.variable.assign"],
  ["32", "coze.variable.merge"],
  ["VariableAggregator", "coze.variable.merge"],
  ["43", "coze.database.query"],
  ["DatabaseQuery", "coze.database.query"],
  ["12", "coze.database.custom-sql"],
  ["DatabaseCustomSQL", "coze.database.custom-sql"],
  ["42", "coze.database.update"],
  ["DatabaseUpdate", "coze.database.update"],
  ["44", "coze.database.delete"],
  ["DatabaseDelete", "coze.database.delete"],
  ["46", "coze.database.insert"],
  ["DatabaseInsert", "coze.database.insert"],
  ["45", "coze.http"],
  ["HTTPRequester", "coze.http"],
  ["Http", "coze.http"],
  ["30", "coze.input"],
  ["InputReceiver", "coze.input"],
  ["13", "coze.output"],
  ["OutputEmitter", "coze.output"],
  ["Message", "coze.message.output"],
  ["18", "coze.question"],
  ["QuestionAnswer", "coze.question"],
  ["37", "coze.message.list"],
  ["55", "coze.message.create"],
  ["56", "coze.message.edit"],
  ["57", "coze.message.delete"],
  ["39", "coze.conversation.create"],
  ["51", "coze.conversation.update"],
  ["52", "coze.conversation.delete"],
  ["53", "coze.conversation.list"],
  ["54", "coze.conversation.history"],
  ["38", "coze.conversation.clear-history"]
]);

export const cozeDefinitionSourceAdapter: WorkflowSourceAdapter = {
  id: "coze-definition",
  label: "Coze Definition JSON",
  sourceKind: "coze-definition",
  acceptsFile(fileName) {
    return fileName.toLowerCase().endsWith(".json");
  },
  parseToWorkflowIR(input) {
    return importCozeDefinitionWorkflow(input).workflow;
  },
  buildSourceMetadata(input) {
    return importCozeDefinitionWorkflow(input).metadata;
  },
  redactionSummary(input) {
    return importCozeDefinitionWorkflow(input).metadata.redactionSummary;
  }
};

export function importCozeDefinitionWorkflow(input: WorkflowSourceAdapterInput): CozeDefinitionImportResult {
  assertGuardrails(input);

  let parsed: unknown;
  try {
    parsed = JSON.parse(input.content);
  } catch {
    throw new Error("Unable to parse Coze definition JSON.");
  }

  const canvas = detectCanvasShape(parsed);
  if (!canvas) {
    throw new Error("Coze definition JSON must include nodes and edges arrays.");
  }
  if (canvas.nodes.length > MAX_COZE_NODE_COUNT) {
    throw new Error(`Coze definition node count exceeds ${MAX_COZE_NODE_COUNT}.`);
  }
  if (canvas.edges.length > MAX_COZE_EDGE_COUNT) {
    throw new Error(`Coze definition edge count exceeds ${MAX_COZE_EDGE_COUNT}.`);
  }

  const diagnostics: WorkflowSourceDiagnostic[] = [];
  const redactionTracker = createRedactionTracker();
  diagnostics.push({
    code: "coze_definition_unstable_artifact",
    severity: "medium",
    message: "Coze definition JSON is imported as a best-effort manual artifact, not a stable public export contract.",
    evidence: [`Artifact shape: ${canvas.artifactShape}`]
  });

  const flattened = flattenCanvas(canvas.nodes, canvas.edges, diagnostics);
  if (flattened.nodes.length > MAX_COZE_NODE_COUNT) {
    throw new Error(`Coze definition node count exceeds ${MAX_COZE_NODE_COUNT}.`);
  }
  if (flattened.edges.length > MAX_COZE_EDGE_COUNT) {
    throw new Error(`Coze definition edge count exceeds ${MAX_COZE_EDGE_COUNT}.`);
  }

  const parsedNodes = parseNodes(flattened.nodes, diagnostics, redactionTracker);
  const edges = parseEdges(flattened.edges, parsedNodes.rawIdOccurrences, diagnostics);
  const name = getWorkflowName(canvas.root, input.fileName);
  const metadata = buildMetadata({
    input,
    artifactShape: canvas.artifactShape,
    name,
    nodeCount: parsedNodes.nodes.length,
    edgeCount: edges.length,
    diagnostics,
    redactionSummary: redactionTracker.summary()
  });
  const workflow: WorkflowIR = {
    name,
    nodes: parsedNodes.nodes,
    edges,
    source: metadata
  };

  return { workflow, metadata };
}

function assertGuardrails(input: WorkflowSourceAdapterInput): void {
  if (!cozeDefinitionSourceAdapter.acceptsFile(input.fileName, input.mimeType)) {
    throw new Error("Coze definition import accepts .json files only.");
  }
  if (new TextEncoder().encode(input.content).length > MAX_COZE_DEFINITION_BYTES) {
    throw new Error(`Coze definition JSON file exceeds ${MAX_COZE_DEFINITION_BYTES} bytes.`);
  }
}

function detectCanvasShape(value: unknown): CanvasShape | null {
  const root = asRecord(value);
  if (!root) {
    return null;
  }
  if (Array.isArray(root.nodes) && Array.isArray(root.edges)) {
    return { nodes: root.nodes, edges: root.edges, artifactShape: "direct-canvas", root };
  }

  for (const key of WRAPPER_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(root, key)) {
      continue;
    }
    const wrapped = unwrapMaybeJson(root[key]);
    const canvas = asRecord(wrapped);
    if (canvas && Array.isArray(canvas.nodes) && Array.isArray(canvas.edges)) {
      return { nodes: canvas.nodes, edges: canvas.edges, artifactShape: key, root };
    }
  }

  return null;
}

function unwrapMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function flattenCanvas(
  rootNodes: unknown[],
  rootEdges: unknown[],
  diagnostics: WorkflowSourceDiagnostic[]
): { nodes: unknown[]; edges: unknown[] } {
  const nodes: unknown[] = [];
  const edges: unknown[] = [...rootEdges];

  function visit(rawNode: unknown, depth: number): void {
    if (depth > MAX_COZE_NESTED_BLOCK_DEPTH) {
      diagnostics.push({
        code: "coze_nested_block_depth_exceeded",
        severity: "high",
        message: "Coze composite node nesting exceeds the v0.7 guardrail.",
        evidence: [`Max depth: ${MAX_COZE_NESTED_BLOCK_DEPTH}`]
      });
      return;
    }

    nodes.push(rawNode);
    const node = asRecord(rawNode);
    if (!node) {
      return;
    }
    if (Array.isArray(node.edges)) {
      edges.push(...node.edges);
    }
    if (Array.isArray(node.blocks)) {
      for (const block of node.blocks) {
        visit(block, depth + 1);
      }
    }
  }

  for (const node of rootNodes) {
    visit(node, 0);
  }

  return { nodes, edges };
}

function parseNodes(
  rawNodes: unknown[],
  diagnostics: WorkflowSourceDiagnostic[],
  redactionTracker: RedactionTracker
): { nodes: NodeIR[]; rawIdOccurrences: Map<string, string[]> } {
  const idCounts = new Map<string, number>();
  const rawIdOccurrences = new Map<string, string[]>();
  const parsedNodes: ParsedNode[] = rawNodes.map((rawNode, index) => {
    const node = asRecord(rawNode) ?? {};
    const data = asRecord(node.data);
    const nodeMeta = data ? asRecord(data.nodeMeta) : null;
    const rawId = safeString(node.id);
    const sourceType = safeString(node.type) || "unknown";
    const mappedId = createUniqueId(rawId || `coze-node-${index + 1}`, idCounts);
    const type = mapCozeNodeType(sourceType);
    const typeFamily = type.startsWith("coze.unknown") ? "unknown" : "known";
    const name = formatRedactedValue("title", safeString(nodeMeta?.title) || `Coze Node ${index + 1}`);

    if (!rawId) {
      diagnostics.push(createDiagnostic("coze_missing_node_id", "medium", mappedId, "Coze node is missing id.", [`Fallback id: ${mappedId}`]));
    }
    if (rawId && mappedId !== rawId) {
      diagnostics.push(createDiagnostic("coze_duplicate_node_id", "medium", mappedId, "Coze node id was duplicated.", [`Original id: ${rawId}`, `Mapped id: ${mappedId}`]));
    }
    if (!KNOWN_COZE_NODE_TYPES.has(sourceType)) {
      diagnostics.push(createDiagnostic("coze_unknown_node_type", "medium", mappedId, "Coze node type is unknown to this adapter.", [`Source type: ${sourceType}`]));
    }

    if (rawId) {
      rawIdOccurrences.set(rawId, [...(rawIdOccurrences.get(rawId) ?? []), mappedId]);
    }

    const parameters = summarizeNodeParameters(type, sourceType, data, redactionTracker);
    return {
      rawId,
      mappedId,
      node: {
        id: mappedId,
        name,
        type,
        typeFamily,
        parameters
      }
    };
  });

  return {
    nodes: parsedNodes.map((parsed) => parsed.node),
    rawIdOccurrences
  };
}

function parseEdges(
  rawEdges: unknown[],
  rawIdOccurrences: Map<string, string[]>,
  diagnostics: WorkflowSourceDiagnostic[]
): EdgeIR[] {
  const edges: EdgeIR[] = [];
  const sourcePortCounts = new Map<string, number>();

  rawEdges.forEach((rawEdge, index) => {
    const edge = asRecord(rawEdge) ?? {};
    const rawSource = safeString(edge.sourceNodeID) || safeString(edge.source);
    const rawTarget = safeString(edge.targetNodeID) || safeString(edge.target);
    const sourceNodeId = resolveEdgeNodeId(rawSource, rawTarget, rawIdOccurrences, "source");
    const targetNodeId = resolveEdgeNodeId(rawTarget, rawSource, rawIdOccurrences, "target");

    if (!sourceNodeId || !targetNodeId) {
      diagnostics.push({
        code: "coze_broken_edge",
        severity: "medium",
        message: "Coze edge references a node that is not present in the imported definition.",
        evidence: [`Source: ${rawSource || "missing"}`, `Target: ${rawTarget || "missing"}`]
      });
      return;
    }

    const sourceOutput = safeString(edge.sourcePortID) || "main";
    const edgeOrdinalKey = `${sourceNodeId}:${sourceOutput}`;
    const sourceOutputIndex = sourcePortCounts.get(edgeOrdinalKey) ?? 0;
    sourcePortCounts.set(edgeOrdinalKey, sourceOutputIndex + 1);

    edges.push({
      id: safeString(edge.id) || `${sourceNodeId}:${sourceOutput}:${sourceOutputIndex}:${targetNodeId}:${index}`,
      sourceNodeId,
      targetNodeId,
      sourceOutput,
      sourceOutputIndex,
      ...(safeString(edge.targetPortID) ? { targetInput: safeString(edge.targetPortID) } : {})
    });
  });

  return edges;
}

function resolveEdgeNodeId(
  rawNodeId: string,
  otherRawNodeId: string,
  rawIdOccurrences: Map<string, string[]>,
  side: "source" | "target"
): string | undefined {
  const matches = rawIdOccurrences.get(rawNodeId) ?? [];
  if (matches.length === 0) {
    return undefined;
  }
  if (rawNodeId === otherRawNodeId && matches.length > 1) {
    return side === "source" ? matches[0] : matches[matches.length - 1];
  }
  return matches[0];
}

function summarizeNodeParameters(
  type: string,
  sourceType: string,
  data: Record<string, unknown> | null,
  redactionTracker: RedactionTracker
) {
  const summaries = [
    createTrackedSummary("sourceType", sourceType, redactionTracker)
  ];
  if (!data) {
    return summaries;
  }

  const inputs = asRecord(data.inputs);
  const haystack = JSON.stringify(data);
  const lowerHaystack = haystack.toLowerCase();
  const promptLength = collectStringValues(data, ["prompt", "systemprompt"]).join("").length;
  const promptPresent = promptLength > 0 || /prompt/i.test(haystack);
  const code = collectStringValues(data, ["code"]).join("\n");
  const sql = collectStringValues(data, ["sql"]).join("\n");
  const timeout = findNumericValue(inputs ?? data, ["timeout", "timeoutms"]);
  const retry = findNumericValue(inputs ?? data, ["retrytimes"]);
  const idsRedacted = /(plugin_?id|api_?id|dataset_?id|knowledge|databaseinfoid|workflow_?id|space_?id|app_?id|bot_?id|connector_?id|user_?id|account_?id|file_?url|image_?url|upload)/i.test(haystack);
  const authMaterialized = /(authorization|x-api-key|api[-_ ]?key|bearer|basic|authdata|bearertokendata)/i.test(haystack);
  const fileReferencePresent = /(upload|file_?id|file_?url|image_?url|object storage|tos:|s3:)/i.test(haystack);

  if (promptPresent) {
    summaries.push(createTrackedSummary("promptPresent", true, redactionTracker));
    summaries.push(createTrackedSummary("promptLengthBucket", bucketLength(promptLength), redactionTracker));
    redactionTracker.mark("prompt", "Coze prompt content was summarized before persistence.");
  }
  if (code) {
    summaries.push(createTrackedSummary("codePresent", true, redactionTracker));
    summaries.push(createTrackedSummary("codeRiskSignals", detectCodeRiskSignals(code), redactionTracker));
    redactionTracker.mark("code", "Coze code body was summarized before persistence.");
  }
  if (sql) {
    summaries.push(createTrackedSummary("sqlPresent", true, redactionTracker));
    summaries.push(createTrackedSummary("sqlMutationLikely", /\b(insert|update|delete|drop|alter|truncate)\b/i.test(sql), redactionTracker));
    redactionTracker.mark("sql", "Coze SQL text was summarized before persistence.");
  }
  if (type === "coze.plugin" || /plugin/i.test(haystack)) {
    summaries.push(createTrackedSummary("pluginReferencePresent", true, redactionTracker));
    redactionTracker.mark("pluginReference", "Coze plugin identifiers were summarized before persistence.");
  }
  if (type.startsWith("coze.knowledge") || /dataset|knowledge/i.test(haystack)) {
    summaries.push(createTrackedSummary("knowledgeReferencePresent", true, redactionTracker));
    redactionTracker.mark("knowledgeReference", "Coze knowledge identifiers were summarized before persistence.");
  }
  if (type === "coze.http" || type === "coze.plugin" || type.includes("database.") || lowerHaystack.includes("http")) {
    summaries.push(createTrackedSummary("externalSideEffectLikely", true, redactionTracker));
  }
  if (idsRedacted) {
    summaries.push(createTrackedSummary("idsRedacted", true, redactionTracker));
    redactionTracker.mark("ids", "Coze resource identifiers were redacted before persistence.");
  }
  if (authMaterialized) {
    summaries.push(createTrackedSummary("authMaterialized", true, redactionTracker));
    redactionTracker.mark("auth", "Coze authentication material was redacted before persistence.");
  }
  if (fileReferencePresent) {
    summaries.push(createTrackedSummary("fileReferencePresent", true, redactionTracker));
    redactionTracker.mark("fileReference", "Coze file references were summarized before persistence.");
  }
  if (typeof timeout === "number") {
    summaries.push(createTrackedSummary("timeout", timeout, redactionTracker));
  }
  if (typeof retry === "number") {
    summaries.push(createTrackedSummary("retryTimes", retry, redactionTracker));
  }
  if (inputs && inputs.settingOnError) {
    summaries.push(createTrackedSummary("errorStrategyPresent", true, redactionTracker));
  }
  if (Array.isArray(data.outputs)) {
    summaries.push(createTrackedSummary("outputCount", data.outputs.length, redactionTracker));
  }

  return summaries;
}

function buildMetadata({
  input,
  artifactShape,
  name,
  nodeCount,
  edgeCount,
  diagnostics,
  redactionSummary
}: {
  input: WorkflowSourceAdapterInput;
  artifactShape: string;
  name: string;
  nodeCount: number;
  edgeCount: number;
  diagnostics: WorkflowSourceDiagnostic[];
  redactionSummary: RedactionSummary;
}): WorkflowSourceMetadata {
  return {
    sourceKind: "coze-definition",
    sourcePlatform: "coze",
    sourceVersion: artifactShape,
    sourceLabel: input.fileName,
    app: {
      name,
      mode: "workflow-definition"
    },
    nodeCount,
    edgeCount,
    redactionSummary,
    parserWarnings: diagnostics.map((diagnostic) => diagnostic.message),
    diagnostics
  };
}

function mapCozeNodeType(sourceType: string): string {
  return KNOWN_COZE_NODE_TYPES.get(sourceType) ?? `coze.unknown.${normalizeUnknownType(sourceType)}`;
}

function normalizeUnknownType(sourceType: string): string {
  const normalized = sourceType.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "unknown";
}

function getWorkflowName(root: Record<string, unknown>, fileName: string): string {
  const rootName = safeString(root.name) || safeString(root.workflow_name) || safeString(root.workflowName);
  if (rootName) {
    return formatRedactedValue("name", rootName);
  }
  return fileName.replace(/\.json$/i, "") || "Untitled Coze Workflow";
}

function createUniqueId(baseId: string, idCounts: Map<string, number>): string {
  const nextCount = (idCounts.get(baseId) ?? 0) + 1;
  idCounts.set(baseId, nextCount);
  return nextCount === 1 ? baseId : `${baseId}-${nextCount}`;
}

function createTrackedSummary(key: string, value: unknown, redactionTracker: RedactionTracker) {
  const summary = createParameterSummary(key, value);
  redactionTracker.observe(key, summary.preview);
  return summary;
}

function collectStringValues(value: unknown, keyNeedles: string[]): string[] {
  const values: string[] = [];

  function visit(current: unknown, key = "") {
    if (typeof current === "string" && keyNeedles.some((needle) => normalize(key).includes(normalize(needle)))) {
      values.push(current);
      return;
    }
    if (Array.isArray(current)) {
      current.forEach((item) => visit(item, key));
      return;
    }
    const record = asRecord(current);
    if (!record) {
      return;
    }
    for (const [entryKey, entryValue] of Object.entries(record)) {
      visit(entryValue, entryKey);
    }
  }

  visit(value);
  return values;
}

function findNumericValue(value: unknown, keyNeedles: string[]): number | undefined {
  let found: number | undefined;

  function visit(current: unknown, key = "") {
    if (typeof found === "number") {
      return;
    }
    if (typeof current === "number" && keyNeedles.some((needle) => normalize(key).includes(normalize(needle)))) {
      found = current;
      return;
    }
    if (Array.isArray(current)) {
      current.forEach((item) => visit(item, key));
      return;
    }
    const record = asRecord(current);
    if (!record) {
      return;
    }
    for (const [entryKey, entryValue] of Object.entries(record)) {
      visit(entryValue, entryKey);
    }
  }

  visit(value);
  return found;
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

function createDiagnostic(
  code: string,
  severity: RiskSeverity,
  nodeId: string,
  message: string,
  evidence: string[]
): WorkflowSourceDiagnostic {
  return {
    code,
    severity,
    nodeId,
    message,
    evidence
  };
}

type RedactionTracker = {
  observe: (key: string, preview: string) => void;
  mark: (key: string, note: string) => void;
  summary: () => RedactionSummary;
};

function createRedactionTracker(): RedactionTracker {
  const redactedKeys = new Set<string>();
  const notes = new Set<string>();
  let redactedValueCount = 0;

  return {
    observe(key, preview) {
      if (preview.includes(REDACTED_PREVIEW)) {
        redactedKeys.add(key);
        redactedValueCount += 1;
      }
    },
    mark(key, note) {
      redactedKeys.add(key);
      notes.add(note);
      redactedValueCount += 1;
    },
    summary() {
      return {
        redactedValueCount,
        redactedKeys: [...redactedKeys].sort(),
        notes: [
          ...notes,
          ...(redactedValueCount > 0 ? [`Sensitive Coze values were replaced with ${REDACTED_PREVIEW} or summarized.`] : []),
          ...(redactedValueCount > 0 ? ["Coze definition values were redacted or summarized before persistence."] : [])
        ]
      };
    }
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}
