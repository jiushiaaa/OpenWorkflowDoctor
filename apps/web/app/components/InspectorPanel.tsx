import type {
  DoctorReport,
  NodeParameterSummary,
  PatchDiffLine,
  RiskIssue,
  WorkflowIR,
  WorkflowViewModel
} from "@openworkflowdoctor/workflow-ir";
import type { Translator } from "../lib/i18n";
import {
  DiffList,
  getSeverityLabel,
  IssueList,
  KeyValue,
  ParameterList,
  type DoctorNodeData
} from "./workbench-shared";

export function InspectorPanel({
  workflow,
  summary,
  activeView,
  activeIssues,
  selectedNodeId,
  patchDiff,
  t
}: {
  workflow: WorkflowIR | null;
  summary: DoctorReport["summary"] | null;
  activeView: WorkflowViewModel | null;
  activeIssues: RiskIssue[];
  selectedNodeId: string | null;
  patchDiff: PatchDiffLine[];
  t: Translator;
}) {
  const selectedNode = getSelectedNode(activeView, activeIssues, selectedNodeId, t);
  const parameters = workflow && selectedNode ? getSelectedNodeParameters(workflow, selectedNode.id) : [];
  const sideEffect =
    Boolean(selectedNode?.issues.some((issue) => issue.id.startsWith("high_risk_side_effect_node:"))) ||
    Boolean(selectedNode && summary?.sideEffectNodes.includes(selectedNode.label));
  const patchImpact = selectedNode
    ? patchDiff.filter((line) => line.targetNodeId === selectedNode.id)
    : [];
  const graphContext = workflow && selectedNode ? getGraphContext(workflow, selectedNode.id) : null;
  const source = workflow?.source;

  return (
    <aside className="inspector" aria-label={t("inspector.label")}>
      <div className="inspector-header">
        <span>{t("inspector.title")}</span>
        <strong>{selectedNode?.label ?? t("inspector.noNode")}</strong>
      </div>
      {source ? (
        <section className="inspector-section">
          <h3>{t("inspector.sourceMetadata")}</h3>
          <KeyValue label="sourceKind" value={source.sourceKind} />
          <KeyValue label="sourcePlatform" value={source.sourcePlatform} />
          <KeyValue label={t("inspector.sourceArtifactShape")} value={source.sourceVersion ?? t("inspector.none")} />
          <KeyValue label={t("toolbar.metrics.nodes")} value={String(source.nodeCount)} />
          <KeyValue label={t("toolbar.metrics.edges")} value={String(source.edgeCount)} />
          <KeyValue label={t("inspector.parserWarnings")} value={formatWarnings(source.parserWarnings, t)} />
          <KeyValue
            label={t("inspector.redactionSummary")}
            value={formatRedactionSummary(source.redactionSummary.redactedValueCount, source.redactionSummary.redactedKeys, t)}
          />
          <KeyValue
            label={t("inspector.resourceResolution")}
            value={source.sourceKind === "coze-definition" ? t("inspector.resourceReferencesNotResolved") : t("inspector.none")}
          />
        </section>
      ) : null}
      {selectedNode ? (
        <>
          <section className="inspector-section">
            <h3>{t("inspector.overview")}</h3>
            <KeyValue label={t("inspector.nodeName")} value={selectedNode.label} />
            <KeyValue label={t("inspector.nodeType")} value={selectedNode.type} />
            <div className="badge-row">
              {selectedNode.highestSeverity ? (
                <span className={`severity severity--${selectedNode.highestSeverity}`}>
                  {getSeverityLabel(selectedNode.highestSeverity, t)}
                </span>
              ) : (
                <span className="severity severity--clear">{t("inspector.clear")}</span>
              )}
              {sideEffect ? <span className="side-effect-badge">{t("inspector.sideEffect")}</span> : null}
            </div>
          </section>
          <section className="inspector-section">
            <h3>{t("inspector.risks")}</h3>
            <IssueList issues={selectedNode.issues} emptyLabel={t("inspector.noRisksNode")} t={t} />
          </section>
          <section className="inspector-section">
            <h3>{t("inspector.parameters")}</h3>
            <ParameterList parameters={parameters} t={t} />
          </section>
          <section className="inspector-section">
            <h3>{t("inspector.patchImpact")}</h3>
            {patchImpact.length > 0 ? <DiffList diff={patchImpact} t={t} /> : <p className="empty-text">{t("inspector.noPatchImpact")}</p>}
          </section>
          <section className="inspector-section">
            <h3>{t("inspector.graphContext")}</h3>
            <KeyValue label={t("inspector.incoming")} value={graphContext?.incoming.join(", ") || t("inspector.none")} />
            <KeyValue label={t("inspector.outgoing")} value={graphContext?.outgoing.join(", ") || t("inspector.none")} />
          </section>
        </>
      ) : (
        <section className="inspector-empty" aria-label={t("inspector.noNode")}>
          <p className="empty-text">{t("inspector.emptyPrompt")}</p>
          <ul>
            <li>{t("inspector.emptyRisks")}</li>
            <li>{t("inspector.emptySideEffects")}</li>
            <li>{t("inspector.emptyPatchImpact")}</li>
            <li>{t("inspector.emptyRedacted")}</li>
            <li>{t("inspector.emptyPaths")}</li>
          </ul>
        </section>
      )}
    </aside>
  );
}

function getSelectedNode(
  activeView: WorkflowViewModel | null,
  activeIssues: RiskIssue[],
  selectedNodeId: string | null,
  t: Translator
): DoctorNodeData | undefined {
  if (!activeView) {
    return undefined;
  }

  const viewNode = activeView.nodes.find((node) => node.id === selectedNodeId) ?? activeView.nodes[0];
  if (!viewNode) {
    return undefined;
  }

  const issues = activeIssues.filter((issue) => issue.nodeId === viewNode.id);
  return {
    ...viewNode,
    issues,
    issueCountLabel: `${viewNode.issueCount} ${t("graph.risks")}`,
    severityLabel: viewNode.highestSeverity ? getSeverityLabel(viewNode.highestSeverity, t) : t("inspector.clear")
  };
}

function getSelectedNodeParameters(
  workflow: { nodes: { id: string; parameters: NodeParameterSummary[] }[] },
  nodeId: string
) {
  return workflow.nodes.find((node) => node.id === nodeId)?.parameters ?? [];
}

function getGraphContext(workflow: WorkflowIR, nodeId: string) {
  const nodesById = new Map(workflow.nodes.map((node) => [node.id, node.name]));
  const incoming = workflow.edges
    .filter((edge) => edge.targetNodeId === nodeId)
    .map((edge) => nodesById.get(edge.sourceNodeId) ?? edge.sourceNodeId);
  const outgoing = workflow.edges
    .filter((edge) => edge.sourceNodeId === nodeId)
    .map((edge) => nodesById.get(edge.targetNodeId) ?? edge.targetNodeId);

  return { incoming, outgoing };
}

function formatWarnings(warnings: string[], t: Translator): string {
  if (warnings.length === 0) {
    return t("inspector.none");
  }

  const preview = warnings.slice(0, 2).join(" | ");
  return warnings.length > 2 ? `${preview} (+${warnings.length - 2})` : preview;
}

function formatRedactionSummary(count: number, keys: string[], t: Translator): string {
  if (count === 0) {
    return t("inspector.none");
  }

  const keyPreview = keys.slice(0, 4).join(", ");
  return keyPreview ? `${count}: ${keyPreview}` : String(count);
}
