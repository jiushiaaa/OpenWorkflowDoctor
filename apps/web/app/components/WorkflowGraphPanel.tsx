import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps
} from "@xyflow/react";
import { useMemo } from "react";
import type { RiskIssue, WorkflowIR, WorkflowViewModel } from "@openworkflowdoctor/workflow-ir";
import type { SampleWorkflowCatalogItem } from "../lib/sample-workflows";
import type { ReviewMode } from "../lib/workspace-store";
import type { Translator } from "../lib/i18n";
import { getSeverityLabel, type DoctorNodeData } from "./workbench-shared";

function DoctorGraphNode({ data, selected }: NodeProps<Node<DoctorNodeData>>) {
  const severity = data.highestSeverity;

  return (
    <div className={`graph-node ${selected ? "is-selected" : ""}`}>
      <Handle type="target" position={Position.Left} />
      <div className="graph-node__type">{data.type}</div>
      <div className="graph-node__label">{data.label}</div>
      <div className="graph-node__footer">
        <span>{data.issueCountLabel}</span>
        {severity ? (
          <span className={`severity severity--${severity}`}>
            {data.severityLabel}
          </span>
        ) : (
          <span className="severity severity--clear">{data.severityLabel}</span>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = {
  doctor: DoctorGraphNode
};

export function WorkflowGraphPanel({
  activeWorkflow,
  activeView,
  activeIssues,
  selectedNodeId,
  reviewMode,
  samples,
  t,
  onNodeSelect,
  onImportClick,
  onLoadSample
}: {
  activeWorkflow: WorkflowIR | null;
  activeView: WorkflowViewModel | null;
  activeIssues: RiskIssue[];
  selectedNodeId: string | null;
  reviewMode: ReviewMode;
  samples: SampleWorkflowCatalogItem[];
  t: Translator;
  onNodeSelect: (nodeId: string | null) => void;
  onImportClick: () => void;
  onLoadSample: (sample: SampleWorkflowCatalogItem) => void;
}) {
  const issuesByNode = useMemo(() => {
    const grouped = new Map<string, RiskIssue[]>();

    for (const issue of activeIssues) {
      if (!issue.nodeId) {
        continue;
      }

      const issues = grouped.get(issue.nodeId) ?? [];
      issues.push(issue);
      grouped.set(issue.nodeId, issues);
    }

    return grouped;
  }, [activeIssues]);

  const flowNodes = useMemo<Node<DoctorNodeData>[]>(() => {
    if (!activeView) {
      return [];
    }

    return activeView.nodes.map((viewNode) => ({
      id: viewNode.id,
      type: "doctor",
      position: viewNode.position,
      selected: viewNode.id === selectedNodeId,
      data: {
        ...viewNode,
        issues: issuesByNode.get(viewNode.id) ?? [],
        issueCountLabel: `${viewNode.issueCount} ${t("graph.risks")}`,
        severityLabel: viewNode.highestSeverity ? getSeverityLabel(viewNode.highestSeverity, t) : t("inspector.clear")
      }
    }));
  }, [activeView, issuesByNode, selectedNodeId, t]);

  const flowEdges = useMemo<Edge[]>(() => {
    if (!activeView) {
      return [];
    }

    return activeView.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16
      }
    }));
  }, [activeView]);

  return (
    <div className="graph-region">
      {activeWorkflow && activeView ? (
        <ReactFlow
          key={`${reviewMode}-${flowNodes.length}-${flowEdges.length}`}
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.24 }}
          minZoom={0.35}
          maxZoom={1.45}
          onNodeClick={(_, node) => onNodeSelect(node.id)}
        >
          <Background gap={24} color="#dde4ee" />
          <Controls />
        </ReactFlow>
      ) : (
        <EmptyState
          samples={samples}
          t={t}
          onImportClick={onImportClick}
          onLoadSample={onLoadSample}
        />
      )}
    </div>
  );
}

function EmptyState({
  samples,
  t,
  onImportClick,
  onLoadSample
}: {
  samples: SampleWorkflowCatalogItem[];
  t: Translator;
  onImportClick: () => void;
  onLoadSample: (sample: SampleWorkflowCatalogItem) => void;
}) {
  return (
    <section className="empty-workspace" aria-label={t("empty.title")}>
      <p className="product-kicker">{t("app.version")}</p>
      <h2>{t("empty.title")}</h2>
      <p>{t("empty.body")}</p>
      <div className="empty-actions">
        <button type="button" onClick={onImportClick}>
          {t("actions.importJson")}
        </button>
        {samples.map((sample) => (
          <button key={sample.id} type="button" className="secondary-button" onClick={() => onLoadSample(sample)}>
            {t("actions.loadSample")} {sample.label}
          </button>
        ))}
      </div>
      <section className="welcome-checklist" aria-label={t("empty.produces")}>
        <h3>{t("empty.produces")}</h3>
        <ul>
          <li>{t("empty.workflowGraph")}</li>
          <li>{t("empty.staticRiskReport")}</li>
          <li>{t("empty.workflowIrPatchPreview")}</li>
          <li>{t("empty.verifierReport")}</li>
          <li>{t("empty.humanReviewChecklist")}</li>
          <li>{t("empty.exportableReviewPacket")}</li>
        </ul>
      </section>
      <div className="welcome-limits" aria-label={t("settings.safety")}>
        <span>{t("empty.noWorkflowExecution")}</span>
        <span>{t("empty.noCredentialAccess")}</span>
        <span>{t("empty.exportedN8nJsonOnly")}</span>
      </div>
    </section>
  );
}
