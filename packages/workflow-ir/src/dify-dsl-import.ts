import { parse as parseYaml } from "yaml";
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

export type DifyDslImportResult = {
  workflow: WorkflowIR;
  metadata: WorkflowSourceMetadata;
};

type ParsedDifyImport = {
  workflow: WorkflowIR;
  metadata: WorkflowSourceMetadata;
};

const MAX_DIFY_DSL_BYTES = 2 * 1024 * 1024;
const MAX_DIFY_NODE_COUNT = 500;
const MAX_DIFY_EDGE_COUNT = 1000;
const SUPPORTED_APP_MODES = new Set(["workflow", "advanced-chat", "chatflow"]);
const KNOWN_DIFY_NODE_TYPES = new Set([
  "answer",
  "code",
  "end",
  "http-request",
  "if-else",
  "iteration",
  "knowledge-retrieval",
  "llm",
  "loop",
  "parameter-extractor",
  "question-classifier",
  "start",
  "template",
  "tool",
  "variable-aggregator",
  "variable-assigner"
]);

export const difyDslSourceAdapter: WorkflowSourceAdapter = {
  id: "dify-dsl",
  label: "Dify DSL YAML",
  sourceKind: "dify-dsl",
  acceptsFile(fileName) {
    const lowerName = fileName.toLowerCase();
    return lowerName.endsWith(".yml") || lowerName.endsWith(".yaml");
  },
  parseToWorkflowIR(input) {
    return importDifyDslWorkflow(input).workflow;
  },
  buildSourceMetadata(input) {
    return importDifyDslWorkflow(input).metadata;
  },
  redactionSummary(input) {
    return importDifyDslWorkflow(input).metadata.redactionSummary;
  }
};

export function importDifyDslWorkflow(input: WorkflowSourceAdapterInput): DifyDslImportResult {
  return parseDifyDsl(input);
}

function parseDifyDsl(input: WorkflowSourceAdapterInput): ParsedDifyImport {
  assertGuardrails(input);

  let parsed: unknown;
  try {
    parsed = parseYaml(input.content, { maxAliasCount: 0 });
  } catch {
    throw new Error("Unable to parse Dify DSL YAML.");
  }

  const root = asRecord(parsed);
  if (!root) {
    throw new Error("Dify DSL must include workflow.graph.nodes and workflow.graph.edges arrays.");
  }
  const app = asRecord(root.app);
  const workflow = asRecord(root.workflow);
  const graph = workflow ? asRecord(workflow.graph) : null;
  const rawNodes = graph && Array.isArray(graph.nodes) ? graph.nodes : null;
  const rawEdges = graph && Array.isArray(graph.edges) ? graph.edges : null;

  if (!root.kind || !root.version || !app || !workflow || !graph || !rawNodes || !rawEdges) {
    throw new Error("Dify DSL must include workflow.graph.nodes and workflow.graph.edges arrays.");
  }
  if (rawNodes.length > MAX_DIFY_NODE_COUNT) {
    throw new Error(`Dify DSL node count exceeds ${MAX_DIFY_NODE_COUNT}.`);
  }
  if (rawEdges.length > MAX_DIFY_EDGE_COUNT) {
    throw new Error(`Dify DSL edge count exceeds ${MAX_DIFY_EDGE_COUNT}.`);
  }

  const diagnostics: WorkflowSourceDiagnostic[] = [];
  const redactionTracker = createRedactionTracker();
  const nodeParse = parseDifyNodes(rawNodes, diagnostics, redactionTracker);
  const edges = parseDifyEdges(rawEdges, nodeParse.idMap, diagnostics);
  const metadata = buildMetadata({
    input,
    root,
    app,
    workflow,
    nodeCount: nodeParse.nodes.length,
    edgeCount: edges.length,
    diagnostics,
    redactionSummary: redactionTracker.summary()
  });

  const workflowIr: WorkflowIR = {
    name: safeString(app.name) || "Untitled Dify App",
    nodes: nodeParse.nodes,
    edges,
    source: metadata
  };

  return {
    workflow: workflowIr,
    metadata
  };
}

function parseDifyNodes(
  rawNodes: unknown[],
  diagnostics: WorkflowSourceDiagnostic[],
  redactionTracker: RedactionTracker
): { nodes: NodeIR[]; idMap: Map<string, string> } {
  const idCounts = new Map<string, number>();
  const idMap = new Map<string, string>();
  const nodes = rawNodes.map((rawNode, index) => {
    const node = asRecord(rawNode) ?? {};
    const data = asRecord(node.data);
    const rawId = safeString(node.id);
    const fallbackId = `dify-node-${index + 1}`;
    const id = createUniqueId(rawId || fallbackId, idCounts);
    const sourceType = safeString(data?.type) || "unknown";
    const title = safeString(data?.title) || `Dify Node ${index + 1}`;
    const type = mapDifyNodeType(sourceType);
    const typeFamily = type.startsWith("dify.unknown") ? "unknown" : "known";

    if (!rawId) {
      diagnostics.push(
        createDiagnostic("dify_missing_node_id", "medium", id, "Dify node is missing id.", [
          `Fallback id: ${id}`
        ])
      );
    }
    if (rawId && id !== rawId) {
      diagnostics.push(
        createDiagnostic("dify_duplicate_node_id", "medium", id, "Dify node id was duplicated.", [
          `Original id: ${rawId}`,
          `Mapped id: ${id}`
        ])
      );
    }
    if (!data) {
      diagnostics.push(
        createDiagnostic("dify_missing_node_data", "medium", id, "Dify node is missing data.", [
          `Node id: ${id}`
        ])
      );
    }
    if (!KNOWN_DIFY_NODE_TYPES.has(sourceType)) {
      diagnostics.push(
        createDiagnostic("dify_unknown_node_type", "medium", id, "Dify node type is unknown to this adapter.", [
          `Source type: ${sourceType}`
        ])
      );
    }

    if (rawId && !idMap.has(rawId)) {
      idMap.set(rawId, id);
    }

    const parameters = data
      ? Object.entries(data)
          .filter(([key]) => key !== "title" && key !== "type")
          .map(([key, value]) => {
            const summary = createParameterSummary(key, value);
            redactionTracker.observe(key, value, summary.preview);
            return summary;
          })
      : [];

    const nodeIr: NodeIR = {
      id,
      name: formatRedactedValue("title", title),
      type,
      typeFamily,
      parameters
    };

    return nodeIr;
  });

  return { nodes, idMap };
}

function parseDifyEdges(
  rawEdges: unknown[],
  idMap: Map<string, string>,
  diagnostics: WorkflowSourceDiagnostic[]
): EdgeIR[] {
  const edges: EdgeIR[] = [];

  rawEdges.forEach((rawEdge, index) => {
    const edge = asRecord(rawEdge) ?? {};
    const rawSource = safeString(edge.source);
    const rawTarget = safeString(edge.target);
    const sourceNodeId = rawSource ? idMap.get(rawSource) : undefined;
    const targetNodeId = rawTarget ? idMap.get(rawTarget) : undefined;

    if (!sourceNodeId || !targetNodeId) {
      diagnostics.push({
        code: !sourceNodeId ? "dify_edge_unknown_source" : "dify_edge_unknown_target",
        severity: "medium",
        ...(sourceNodeId ? { nodeId: sourceNodeId } : {}),
        message: "Dify edge references a node that is not present in workflow.graph.nodes.",
        evidence: [`Source: ${rawSource || "missing"}`, `Target: ${rawTarget || "missing"}`]
      });
      return;
    }

    const sourceOutput = safeString(edge.sourceHandle) || "main";
    edges.push({
      id: safeString(edge.id) || `${sourceNodeId}:${sourceOutput}:0:${targetNodeId}:${index}`,
      sourceNodeId,
      targetNodeId,
      sourceOutput,
      sourceOutputIndex: 0,
      ...(safeString(edge.targetHandle) ? { targetInput: safeString(edge.targetHandle) } : {})
    });
  });

  return edges;
}

function buildMetadata({
  input,
  root,
  app,
  workflow,
  nodeCount,
  edgeCount,
  diagnostics,
  redactionSummary
}: {
  input: WorkflowSourceAdapterInput;
  root: Record<string, unknown>;
  app: Record<string, unknown>;
  workflow: Record<string, unknown>;
  nodeCount: number;
  edgeCount: number;
  diagnostics: WorkflowSourceDiagnostic[];
  redactionSummary: RedactionSummary;
}): WorkflowSourceMetadata {
  const version = safeString(root.version);
  const mode = safeString(app.mode);
  const environmentVariables = parseEnvironmentVariables(workflow.environment_variables, diagnostics);

  if (version && !version.startsWith("0.6.")) {
    diagnostics.push({
      code: "dify_unsupported_dsl_version",
      severity: "medium",
      message: "Dify DSL version is outside the v0.6 adapter support range.",
      evidence: [`Version: ${version}`]
    });
  }
  if (mode && !SUPPORTED_APP_MODES.has(mode)) {
    diagnostics.push({
      code: "dify_unsupported_app_mode",
      severity: "medium",
      message: "Dify app mode is not supported by the v0.6 import adapter.",
      evidence: [`Mode: ${mode}`]
    });
  }

  const redactedEnvCount = environmentVariables.filter((variable) => variable.redacted).length;
  const combinedRedactionSummary = {
    redactedValueCount: redactionSummary.redactedValueCount + redactedEnvCount,
    redactedKeys: [...new Set([...redactionSummary.redactedKeys, ...environmentVariables.filter((variable) => variable.redacted).map((variable) => variable.name)])].sort(),
    notes: [
      ...redactionSummary.notes,
      ...(redactedEnvCount > 0 ? ["Dify environment variable values were redacted before persistence."] : [])
    ]
  };

  return {
    sourceKind: "dify-dsl",
    sourcePlatform: "dify",
    ...(version ? { sourceVersion: version } : {}),
    ...(mode ? { sourceAppMode: mode } : {}),
    sourceLabel: input.fileName,
    app: {
      name: safeString(app.name) || "Untitled Dify App",
      ...(safeString(app.description) ? { description: safeString(app.description) } : {}),
      ...(mode ? { mode } : {}),
      ...(safeString(app.icon) ? { icon: safeString(app.icon) } : {}),
      ...(safeString(app.icon_background) ? { iconBackground: safeString(app.icon_background) } : {}),
      ...(typeof app.use_icon_as_answer_icon === "boolean"
        ? { useIconAsAnswerIcon: app.use_icon_as_answer_icon }
        : {})
    },
    nodeCount,
    edgeCount,
    redactionSummary: combinedRedactionSummary,
    parserWarnings: diagnostics.map((diagnostic) => diagnostic.message),
    diagnostics,
    ...(environmentVariables.length > 0 ? { environmentVariables } : {})
  };
}

function parseEnvironmentVariables(
  value: unknown,
  diagnostics: WorkflowSourceDiagnostic[]
): NonNullable<WorkflowSourceMetadata["environmentVariables"]> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((rawVariable) => asRecord(rawVariable))
    .filter((variable): variable is Record<string, unknown> => Boolean(variable))
    .map((variable) => {
      const name = safeString(variable.name) || safeString(variable.variable) || "unnamed";
      const declaredType = safeString(variable.type);
      const valueExisted = Object.prototype.hasOwnProperty.call(variable, "value") || Object.prototype.hasOwnProperty.call(variable, "default");
      const isSecret = declaredType.toLowerCase() === "secret" || name.toLowerCase().includes("secret");
      const redacted = valueExisted && isSecret;

      if (redacted) {
        diagnostics.push({
          code: "dify_secret_env_materialized",
          severity: "high",
          nodeId: "workflow",
          message: "Dify secret environment variable contains a materialized value in DSL.",
          evidence: [`Variable: ${name}`, `Type: ${declaredType || "unknown"}`]
        });
      }

      return {
        name,
        ...(declaredType ? { declaredType } : {}),
        valueExisted,
        redacted,
        ...(redacted ? { redactionReason: "secret environment variable value" } : {})
      };
    });
}

function mapDifyNodeType(sourceType: string): string {
  switch (sourceType) {
    case "start":
      return "dify.start";
    case "end":
    case "answer":
      return `dify.${sourceType}`;
    case "llm":
      return "dify.llm";
    case "tool":
    case "http-request":
      return `dify.${sourceType}`;
    case "knowledge-retrieval":
      return "dify.retrieval";
    case "code":
      return "dify.code";
    case "template":
      return "dify.template";
    case "if-else":
    case "question-classifier":
      return `dify.condition.${sourceType}`;
    case "iteration":
    case "loop":
      return `dify.loop.${sourceType}`;
    case "variable-aggregator":
    case "variable-assigner":
    case "parameter-extractor":
      return `dify.variable.${sourceType}`;
    default:
      return `dify.unknown.${sourceType || "unknown"}`;
  }
}

function createUniqueId(baseId: string, idCounts: Map<string, number>): string {
  const nextCount = (idCounts.get(baseId) ?? 0) + 1;
  idCounts.set(baseId, nextCount);
  return nextCount === 1 ? baseId : `${baseId}-${nextCount}`;
}

function assertGuardrails(input: WorkflowSourceAdapterInput): void {
  if (!difyDslSourceAdapter.acceptsFile(input.fileName, input.mimeType)) {
    throw new Error("Dify DSL import accepts .yml or .yaml files only.");
  }
  if (new TextEncoder().encode(input.content).length > MAX_DIFY_DSL_BYTES) {
    throw new Error(`Dify DSL file exceeds ${MAX_DIFY_DSL_BYTES} bytes.`);
  }
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
  observe: (key: string, originalValue: unknown, preview: string) => void;
  summary: () => RedactionSummary;
};

function createRedactionTracker(): RedactionTracker {
  const redactedKeys = new Set<string>();
  let redactedValueCount = 0;

  return {
    observe(key, originalValue, preview) {
      const serializedOriginal = JSON.stringify(originalValue);
      if (preview.includes(REDACTED_PREVIEW) || serializedOriginal?.includes(REDACTED_PREVIEW)) {
        redactedKeys.add(key);
        redactedValueCount += 1;
      }
    },
    summary() {
      return {
        redactedValueCount,
        redactedKeys: [...redactedKeys].sort(),
        notes: redactedValueCount > 0 ? ["Dify node configuration values were redacted before persistence."] : []
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
