import { parseN8nWorkflow } from "./n8n-parser.js";
import type { WorkflowIR } from "./types.js";

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
};

export function importN8nReadonlyWorkflow(payload: unknown): N8nReadonlyWorkflowImport {
  const source = isRecord(payload) ? payload : {};
  const workflow = parseN8nWorkflow(source);

  return {
    workflow,
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
    }
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
