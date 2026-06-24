import contentAutomationWorkflow from "../../../../samples/n8n/content-automation.workflow.json";
import messyLegacyWorkflow from "../../../../samples/n8n/messy-legacy.workflow.json";
import refundRiskyWorkflow from "../../../../samples/n8n/refund-risky.workflow.json";

export type SampleWorkflowCatalogItem = {
  id: string;
  label: string;
  filename: string;
  workflow: unknown;
};

export const SAMPLE_WORKFLOWS: SampleWorkflowCatalogItem[] = [
  {
    id: "refund-risky",
    label: "Refund Risky",
    filename: "refund-risky.workflow.json",
    workflow: refundRiskyWorkflow
  },
  {
    id: "content-automation",
    label: "Content Automation",
    filename: "content-automation.workflow.json",
    workflow: contentAutomationWorkflow
  },
  {
    id: "messy-legacy",
    label: "Messy Legacy",
    filename: "messy-legacy.workflow.json",
    workflow: messyLegacyWorkflow
  }
];
