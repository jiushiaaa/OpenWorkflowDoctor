import type { SampleWorkflowCatalogItem } from "../lib/sample-workflows";
import type { Translator } from "../lib/i18n";

export type WorkflowExplorerItem = {
  id: string;
  name: string;
  sourceLabel: string;
  statusLabel: string;
  humanReviewLabel: string;
  packetLabel: string;
  isActive: boolean;
};

export function WorkflowExplorer({
  workflows,
  samples,
  t,
  onImportClick,
  onLoadSample,
  onSelectWorkflow
}: {
  workflows: WorkflowExplorerItem[];
  samples: SampleWorkflowCatalogItem[];
  t: Translator;
  onImportClick: () => void;
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
        <button type="button" onClick={onImportClick}>
          {t("actions.importJson")}
        </button>
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
