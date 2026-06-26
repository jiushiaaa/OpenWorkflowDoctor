import { cozeDefinitionSourceAdapter } from "./coze-definition-import.js";
import { customGraphJsonSourceAdapter } from "./custom-graph-json-import.js";
import { difyDslSourceAdapter } from "./dify-dsl-import.js";
import { n8nExportedJsonSourceAdapter } from "./n8n-exported-json-import.js";
import { n8nReadonlySourceAdapter } from "./n8n-readonly-import.js";
import type { WorkflowSourceAdapter } from "./workflow-source-adapter.js";

export const builtInWorkflowSourceAdapters: WorkflowSourceAdapter[] = [
  n8nExportedJsonSourceAdapter,
  n8nReadonlySourceAdapter,
  difyDslSourceAdapter,
  cozeDefinitionSourceAdapter,
  customGraphJsonSourceAdapter
];

export function getWorkflowSourceAdapter(adapterId: string): WorkflowSourceAdapter | undefined {
  return builtInWorkflowSourceAdapters.find((adapter) => adapter.adapterId === adapterId);
}

export function listImportableWorkflowSourceAdapters(): WorkflowSourceAdapter[] {
  return builtInWorkflowSourceAdapters.filter((adapter) =>
    adapter.capabilities.some((capability) => capability === "file-upload" || capability === "manual-artifact")
  );
}
