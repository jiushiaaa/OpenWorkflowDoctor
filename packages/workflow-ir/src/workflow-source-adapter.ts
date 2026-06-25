import type { RedactionSummary, WorkflowIR, WorkflowSourceKind, WorkflowSourceMetadata } from "./types.js";

export type WorkflowSourceAdapterInput = {
  fileName: string;
  mimeType?: string;
  content: string;
};

export type WorkflowSourceAdapter = {
  id: string;
  label: string;
  sourceKind: WorkflowSourceKind;
  acceptsFile: (fileName: string, mimeType?: string) => boolean;
  parseToWorkflowIR: (input: WorkflowSourceAdapterInput) => WorkflowIR;
  buildSourceMetadata: (input: WorkflowSourceAdapterInput) => WorkflowSourceMetadata;
  redactionSummary: (input: WorkflowSourceAdapterInput) => RedactionSummary;
};
