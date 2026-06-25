import { createParameterSummary } from "./redaction.js";
import type { CredentialReferenceSummary, EdgeIR, NodeIR, NodeParameterSummary, WorkflowIR } from "./types.js";

type N8nNode = {
  id?: unknown;
  name?: unknown;
  type?: unknown;
  parameters?: unknown;
  credentials?: unknown;
};

type N8nConnectionTarget = {
  node?: unknown;
  type?: unknown;
  index?: unknown;
};

const KNOWN_N8N_TYPE_PREFIX = "n8n-nodes-base.";

export function parseN8nWorkflow(json: unknown): WorkflowIR {
  const source = isRecord(json) ? json : {};
  const nodes = parseNodes(source.nodes);
  const edges = parseEdges(source.connections, nodes);
  const workflow: WorkflowIR = {
    name: typeof source.name === "string" && source.name.trim() ? source.name : "Untitled Workflow",
    nodes,
    edges
  };

  if (typeof source.id === "string" && source.id.trim()) {
    workflow.id = source.id;
  }

  return workflow;
}

function parseNodes(value: unknown): NodeIR[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const fallbackIdCounts = new Map<string, number>();

  return value.map((rawNode, index) => {
    const node = isRecord(rawNode) ? (rawNode as N8nNode) : {};
    const name = typeof node.name === "string" && node.name.trim() ? node.name : `Node ${index + 1}`;
    const id =
      typeof node.id === "string" && node.id.trim()
        ? node.id
        : createUniqueFallbackId(slugify(name, index), fallbackIdCounts);
    const type = typeof node.type === "string" && node.type.trim() ? node.type : "unknown";

    const parsedNode: NodeIR = {
      id,
      name,
      type,
      typeFamily: type.startsWith(KNOWN_N8N_TYPE_PREFIX) ? "known" : "unknown",
      parameters: summarizeParameters(node.parameters)
    };

    const credentialSummary = summarizeCredentials(node.credentials);
    if (credentialSummary.credentialReferencePresent) {
      parsedNode.credentialSummary = credentialSummary;
    }

    return parsedNode;
  });
}

function parseEdges(value: unknown, nodes: NodeIR[]): EdgeIR[] {
  if (!isRecord(value)) {
    return [];
  }

  const nodesByName = createUniqueNameMap(nodes);
  const edges: EdgeIR[] = [];

  for (const [sourceName, outputGroups] of Object.entries(value)) {
    const sourceNode = nodesByName.get(sourceName);
    if (!sourceNode || !isRecord(outputGroups)) {
      continue;
    }

    for (const [outputName, outputs] of Object.entries(outputGroups)) {
      if (!Array.isArray(outputs)) {
        continue;
      }

      outputs.forEach((targets, outputIndex) => {
        if (!Array.isArray(targets)) {
          return;
        }

        for (const rawTarget of targets) {
          const target = isRecord(rawTarget) ? (rawTarget as N8nConnectionTarget) : {};
          const targetName = typeof target.node === "string" ? target.node : "";
          const targetNode = nodesByName.get(targetName);
          if (!targetNode) {
            continue;
          }

          edges.push({
            id: `${sourceNode.id}:${outputName}:${outputIndex}:${targetNode.id}`,
            sourceNodeId: sourceNode.id,
            targetNodeId: targetNode.id,
            sourceOutput: outputName,
            sourceOutputIndex: outputIndex
          });
        }
      });
    }
  }

  return edges;
}

function summarizeParameters(value: unknown): NodeParameterSummary[] {
  if (!isRecord(value)) {
    return [];
  }

  return Object.entries(value).map(([key, parameterValue]) => createParameterSummary(key, parameterValue));
}

function summarizeCredentials(value: unknown): CredentialReferenceSummary {
  if (!isRecord(value)) {
    return {
      credentialReferencePresent: false,
      credentialTypes: [],
      credentialCount: 0
    };
  }

  const credentialTypes = Object.entries(value)
    .filter(([, credentialReference]) => isRecord(credentialReference))
    .map(([credentialType]) => credentialType)
    .filter((credentialType) => credentialType.trim().length > 0)
    .sort();

  return {
    credentialReferencePresent: credentialTypes.length > 0,
    credentialTypes,
    credentialCount: credentialTypes.length
  };
}

function slugify(value: string, index: number): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || `node-${index + 1}`;
}

function createUniqueFallbackId(baseId: string, idCounts: Map<string, number>): string {
  const nextCount = (idCounts.get(baseId) ?? 0) + 1;
  idCounts.set(baseId, nextCount);
  return nextCount === 1 ? baseId : `${baseId}-${nextCount}`;
}

function createUniqueNameMap(nodes: NodeIR[]): Map<string, NodeIR> {
  const nodesByName = new Map<string, NodeIR[]>();
  for (const node of nodes) {
    nodesByName.set(node.name, [...(nodesByName.get(node.name) ?? []), node]);
  }

  return new Map(
    [...nodesByName.entries()]
      .filter(([, matches]) => matches.length === 1)
      .map(([name, matches]) => [name, matches[0]!])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
