import type { SampleWorkflowCatalogItem } from "../lib/sample-workflows";
import type { Translator } from "../lib/i18n";
import type { WorkflowSourceAdapter } from "@openworkflowdoctor/workflow-ir";

export type WorkflowExplorerItem = {
  id: string;
  name: string;
  sourceLabel: string;
  sourceKind: string;
  statusLabel: string;
  humanReviewLabel: string;
  packetLabel: string;
  isActive: boolean;
};

export function WorkflowExplorer({
  workflows,
  samples,
  importableSources,
  t,
  onImportClick,
  onImportN8nClick,
  onLoadSample,
  onSelectWorkflow
}: {
  workflows: WorkflowExplorerItem[];
  samples: SampleWorkflowCatalogItem[];
  importableSources: WorkflowSourceAdapter[];
  t: Translator;
  onImportClick: (adapterId?: string) => void;
  onImportN8nClick: () => void;
  onLoadSample: (sample: SampleWorkflowCatalogItem) => void;
  onSelectWorkflow: (workflowDocumentId: string) => void;
}) {
  return (
    <section className="workflow-explorer" aria-label={t("explorer.title")}>
      <div className="section-title-row">
        <div>
          <span>{t("explorer.localWorkspace")}</span>
          <strong>{t("explorer.title")}</strong>
        </div>
        <div className="workflow-explorer__actions">
          {importableSources.map((source) => (
            <button key={source.adapterId} type="button" onClick={() => onImportClick(source.adapterId)}>
              {source.label}
            </button>
          ))}
          <button type="button" onClick={onImportN8nClick}>
            {t("actions.importFromN8n")}
          </button>
        </div>
      </div>

      {workflows.length > 0 ? (
        <ul className="workflow-explorer__list">
          {workflows.map((workflow) => (
            <li key={workflow.id}>
              <button
                type="button"
                className={workflow.isActive ? "is-selected" : ""}
                aria-pressed={workflow.isActive}
                onClick={() => onSelectWorkflow(workflow.id)}
              >
                <strong>{workflow.name}</strong>
                {workflow.sourceKind === "n8n-readonly" ? <small>{t("explorer.n8nReadonly")}</small> : null}
                {workflow.sourceKind === "n8n-exported-json" ? <small>n8n JSON</small> : null}
                {workflow.sourceKind === "dify-dsl" ? <small>{t("explorer.difyDsl")}</small> : null}
                {workflow.sourceKind === "coze-definition" ? <small>{t("explorer.cozeDefinition")}</small> : null}
                {workflow.sourceKind === "custom-graph-json" ? <small>Custom Graph</small> : null}
                <small>{workflow.statusLabel}</small>
                <small>{workflow.humanReviewLabel}</small>
                <small>{workflow.packetLabel}</small>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="side-copy">{t("explorer.empty")}</p>
      )}

      <div className="sample-list" aria-label={t("explorer.samples")}>
        <span>{t("explorer.samples")}</span>
        {samples.map((sample) => (
          <button key={sample.id} type="button" className="secondary-button" onClick={() => onLoadSample(sample)}>
            {t("actions.loadSample")} {sample.label}
          </button>
        ))}
      </div>
    </section>
  );
}
