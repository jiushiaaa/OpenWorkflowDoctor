import { getWorkflowSourceAdapter, listImportableWorkflowSourceAdapters } from "./source-adapter-registry.js";
import type { AdapterImportResult, WorkflowSourceAdapterInput } from "./workflow-source-adapter.js";

export type WorkflowSourceArtifactImportInput = WorkflowSourceAdapterInput & {
  adapterId?: string;
};

export function importWorkflowSourceArtifact(input: WorkflowSourceArtifactImportInput): AdapterImportResult {
  const adapter = input.adapterId ? getWorkflowSourceAdapter(input.adapterId) : detectAdapter(input);
  if (!adapter) {
    throw new Error(input.adapterId ? `Unknown workflow source adapter ${input.adapterId}.` : "No workflow source adapter accepts this artifact.");
  }
  if (!adapter.capabilities.includes("file-upload") && !adapter.capabilities.includes("manual-artifact")) {
    throw new Error(`${adapter.label} is not a file/manual artifact adapter.`);
  }

  return adapter.import(input);
}

function detectAdapter(input: WorkflowSourceAdapterInput) {
  const candidates = listImportableWorkflowSourceAdapters().filter((adapter) =>
    adapter.acceptsFile(input.fileName, input.mimeType)
  );
  if (candidates.length === 0) {
    return undefined;
  }

  if (input.fileName.toLowerCase().endsWith(".yml") || input.fileName.toLowerCase().endsWith(".yaml")) {
    return candidates.find((adapter) => adapter.adapterId === "dify.dslYaml") ?? candidates[0];
  }

  return candidates.find((adapter) => adapter.adapterId === "n8n.exportedJson") ?? candidates[0];
}
