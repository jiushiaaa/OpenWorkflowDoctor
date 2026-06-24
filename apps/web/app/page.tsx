"use client";

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
import {
  createDoctorReport,
  createDoctorReportFromWorkflow,
  createDoctorReviewPacket,
  type DoctorReport,
  type HumanReview,
  type HumanReviewDecision,
  type NodeParameterSummary,
  type RiskIssue,
  type RiskSeverity,
  type VerificationStatus,
  type WorkflowIR,
  type WorkflowViewNode
} from "@openworkflowdoctor/workflow-ir";
import { useMemo, useState } from "react";
import sampleWorkflow from "../../../samples/n8n/refund-workflow.json";

type ReviewMode = "original" | "patched";

type DoctorNodeData = WorkflowViewNode & {
  issues: RiskIssue[];
};

const severityLabels: Record<RiskSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical"
};

const statusLabels: Record<VerificationStatus, string> = {
  pass: "Pass",
  hold: "Hold",
  fail: "Fail"
};

const humanDecisionLabels: Record<HumanReviewDecision, string> = {
  undecided: "Undecided",
  accepted: "Accept",
  held: "Hold",
  rejected: "Reject"
};

const defaultRequest =
  "帮我修复支付和通知相关风险，优先补 webhook 去重和退款幂等性。";

function DoctorGraphNode({ data, selected }: NodeProps<Node<DoctorNodeData>>) {
  const severity = data.highestSeverity;

  return (
    <div className={`graph-node ${selected ? "is-selected" : ""}`}>
      <Handle type="target" position={Position.Left} />
      <div className="graph-node__type">{data.type}</div>
      <div className="graph-node__label">{data.label}</div>
      <div className="graph-node__footer">
        <span>{data.issueCount} risks</span>
        {severity ? (
          <span className={`severity severity--${severity}`}>
            {severityLabels[severity]}
          </span>
        ) : (
          <span className="severity severity--clear">Clear</span>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = {
  doctor: DoctorGraphNode
};

function createInitialReport() {
  return createDoctorReport(sampleWorkflow, defaultRequest);
}

export default function Home() {
  const [request, setRequest] = useState(defaultRequest);
  const [report, setReport] = useState<DoctorReport>(() => createInitialReport());
  const [workflowInput, setWorkflowInput] = useState<WorkflowIR>(() => createInitialReport().workflow);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("refund");
  const [reviewMode, setReviewMode] = useState<ReviewMode>("original");
  const [humanDecision, setHumanDecision] = useState<HumanReviewDecision>("undecided");
  const [humanReviewNote, setHumanReviewNote] = useState("");
  const [humanDecidedAt, setHumanDecidedAt] = useState<string | undefined>();
  const [confirmedChecklistItemIds, setConfirmedChecklistItemIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const hasPatchOperations = report.proposal.operations.length > 0;
  const activeWorkflow =
    reviewMode === "patched" ? report.patchedWorkflow : report.workflow;
  const activeSummary = reviewMode === "patched" ? report.patchedSummary : report.summary;
  const activeIssues = reviewMode === "patched" ? report.patchedIssues : report.issues;
  const activeView = reviewMode === "patched" ? report.patchedView : report.view;
  const humanReview = useMemo<HumanReview>(() => {
    const nextHumanReview: HumanReview = {
      decision: humanDecision,
      reviewerNote: humanReviewNote.trim(),
      confirmedChecklistItemIds: humanDecision === "accepted" ? confirmedChecklistItemIds : []
    };

    if (humanDecidedAt) {
      nextHumanReview.decidedAt = humanDecidedAt;
    }

    return nextHumanReview;
  }, [confirmedChecklistItemIds, humanDecidedAt, humanDecision, humanReviewNote]);
  const reviewPacket = useMemo(
    () => createDoctorReviewPacket(report, undefined, humanReview),
    [humanReview, report]
  );
  const requiredChecklistItems = reviewPacket.acceptanceChecklist.filter(
    (item) => item.status !== "pass"
  );
  const missingChecklistItemIds = requiredChecklistItems
    .filter((item) => !confirmedChecklistItemIds.includes(item.id))
    .map((item) => item.id);
  const canAcceptHumanReview =
    report.verification.status !== "fail" && missingChecklistItemIds.length === 0;

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
    return activeView.nodes.map((viewNode) => ({
      id: viewNode.id,
      type: "doctor",
      position: viewNode.position,
      data: {
        ...viewNode,
        issues: issuesByNode.get(viewNode.id) ?? []
      }
    }));
  }, [activeView.nodes, issuesByNode]);

  const flowEdges = useMemo<Edge[]>(() => {
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
  }, [activeView.edges]);

  const selectedNode =
    flowNodes.find((node) => node.id === selectedNodeId)?.data ?? flowNodes[0]?.data;

  async function importWorkflow(file: File | undefined) {
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const json = JSON.parse(text) as unknown;
      const nextReport = createDoctorReport(json, request);
      setWorkflowInput(nextReport.workflow);
      setReport(nextReport);
      setReviewMode("original");
      setSelectedNodeId(nextReport.view.nodes[0]?.id ?? null);
      resetHumanReview();
      setError(null);
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Unable to import workflow JSON."
      );
    }
  }

  function rerunDoctor() {
    const nextReport = createDoctorReportFromWorkflow(workflowInput, request);
    setReport(nextReport);
    setReviewMode("original");
    setSelectedNodeId(nextReport.view.nodes[0]?.id ?? null);
    resetHumanReview();
    setError(null);
  }

  function exportReviewPacket() {
    downloadJson(`${slugify(report.workflow.name)}-review-packet.json`, reviewPacket);
  }

  function exportPatchedWorkflowIr() {
    downloadJson(`${slugify(report.workflow.name)}-patched-workflow-ir.json`, {
      schemaVersion: "openworkflowdoctor.workflow-ir.v1",
      workflow: report.patchedWorkflow,
      verification: report.verification,
      acceptanceRecommendation: report.acceptanceRecommendation,
      humanReview
    });
  }

  function resetHumanReview() {
    setHumanDecision("undecided");
    setHumanReviewNote("");
    setHumanDecidedAt(undefined);
    setConfirmedChecklistItemIds([]);
  }

  function recordHumanDecision(decision: HumanReviewDecision) {
    setHumanDecision(decision);
    setHumanDecidedAt(decision === "undecided" ? undefined : new Date().toISOString());
  }

  function toggleChecklistConfirmation(itemId: string) {
    setConfirmedChecklistItemIds((current) =>
      current.includes(itemId)
        ? current.filter((currentId) => currentId !== itemId)
        : [...current, itemId]
    );
  }

  return (
    <main className="doctor-shell">
      <aside className="side-rail" aria-label="Workflow import">
        <div>
          <p className="product-kicker">OpenWorkflowDoctor</p>
          <h1>Workflow Doctor</h1>
          <p className="side-copy">
            Import an existing n8n workflow JSON, diagnose static risks, propose
            structured fixes, then let the verifier decide whether it is safe.
          </p>
        </div>

        <section className="demo-limit-panel" aria-label="v0.1 demo limits">
          <span>v0.1 demo limits</span>
          <ul>
            <li>Local exported n8n JSON only.</li>
            <li>Static heuristic diagnostics, not runtime proof.</li>
            <li>No workflow execution, credential access, or external calls.</li>
            <li>Patched export is WorkflowIR, not n8n-importable JSON.</li>
          </ul>
        </section>

        <label className="upload-target">
          <span>Import JSON</span>
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => void importWorkflow(event.target.files?.[0])}
          />
        </label>

        <section className="request-panel" aria-label="Patch request">
          <label htmlFor="patch-request">Patch request</label>
          <textarea
            id="patch-request"
            value={request}
            onChange={(event) => setRequest(event.target.value)}
          />
          <button type="button" onClick={rerunDoctor}>
            Run Doctor
          </button>
        </section>

        {error ? <p className="error-text">{error}</p> : null}

        <section className="status-card" aria-label="Acceptance status">
          <span>Acceptance</span>
          <strong className={`status status--${report.acceptanceRecommendation}`}>
            {statusLabels[report.acceptanceRecommendation]}
          </strong>
        </section>

        <section className="review-panel" aria-label="Patch confirmation">
          <div>
            <span>Review state</span>
            <strong>{reviewMode === "patched" ? "Patched preview" : "Original workflow"}</strong>
          </div>
          <button
            type="button"
            onClick={() => {
              setReviewMode("patched");
              setSelectedNodeId(report.patchedView.nodes[0]?.id ?? null);
            }}
            disabled={!hasPatchOperations || reviewMode === "patched"}
          >
            {reviewMode === "patched" ? "Patch Preview Applied" : "Apply Reviewed Patch"}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setReviewMode("original");
              setSelectedNodeId(report.view.nodes[0]?.id ?? null);
            }}
          >
            Back to Original
          </button>
        </section>

        <section className="human-review-panel" aria-label="Human review decision">
          <div>
            <span>Human review</span>
            <strong>{humanDecisionLabels[humanDecision]}</strong>
          </div>
          <div className="decision-buttons">
            {(["accepted", "held", "rejected"] as const).map((decision) => (
              <button
                key={decision}
                type="button"
                className={humanDecision === decision ? "is-selected" : ""}
                onClick={() => recordHumanDecision(decision)}
                disabled={decision === "accepted" && !canAcceptHumanReview}
              >
                {humanDecisionLabels[decision]}
              </button>
            ))}
          </div>
          {requiredChecklistItems.length > 0 ? (
            <div className="confirmation-list" aria-label="Required human confirmations">
              {requiredChecklistItems.map((item) => (
                <label key={item.id}>
                  <input
                    type="checkbox"
                    checked={confirmedChecklistItemIds.includes(item.id)}
                    onChange={() => toggleChecklistConfirmation(item.id)}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          ) : null}
          {reviewPacket.humanReviewValidation.status === "hold" ? (
            <p className="review-warning">{reviewPacket.humanReviewValidation.explanation}</p>
          ) : null}
          <textarea
            aria-label="Reviewer note"
            value={humanReviewNote}
            onChange={(event) => setHumanReviewNote(event.target.value)}
          />
        </section>

        <section className="export-panel" aria-label="Export review artifacts">
          <span>Artifacts</span>
          <div className="fingerprint-block">
            <small>Target fingerprint</small>
            <code>{reviewPacket.reviewTargetFingerprint}</code>
          </div>
          <button type="button" onClick={exportReviewPacket}>
            Export Review Packet
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={exportPatchedWorkflowIr}
            disabled={reviewMode !== "patched" || !hasPatchOperations}
          >
            Export Patched WorkflowIR
          </button>
        </section>
      </aside>

      <section className="workspace" aria-label="Workflow graph and report">
        <header className="workspace-header">
          <div>
            <p>Workflow Graph</p>
            <h2>{activeWorkflow.name}</h2>
          </div>
          <div className="metric-strip">
            <Metric label="View" value={reviewMode === "patched" ? "Patched" : "Original"} />
            <Metric label="Nodes" value={String(activeWorkflow.nodes.length)} />
            <Metric label="Risks" value={String(activeIssues.length)} />
            <Metric label="Patch Ops" value={String(report.proposal.operations.length)} />
            <Metric
              label="Verifier"
              value={statusLabels[report.verification.status]}
            />
          </div>
        </header>

        <div className="graph-region">
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.35}
            maxZoom={1.4}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          >
            <Background gap={24} color="#dde4ee" />
            <Controls />
          </ReactFlow>
        </div>

        <section className="report-grid" aria-label="Doctor report">
          <Panel title="Summary">
            <p className="panel-lead">{activeSummary.overview}</p>
            <KeyValue label="Entry nodes" value={activeSummary.entryNodes.join(", ")} />
            <KeyValue
              label="Terminal nodes"
              value={activeSummary.terminalNodes.join(", ")}
            />
            <KeyValue
              label="Side effects"
              value={activeSummary.sideEffectNodes.join(", ") || "None"}
            />
          </Panel>

          <Panel title="Risks">
            <IssueList issues={activeIssues} />
          </Panel>

          <Panel title="Patch Proposal">
            <p className="panel-lead">{report.proposal.summary}</p>
            <div className="patch-review-note">
              <strong>{reviewMode === "patched" ? "Preview applied" : "Pending human review"}</strong>
              <span>
                {reviewMode === "patched"
                  ? "The graph and risk panels now show the patched WorkflowIR."
                  : "Patch operations are not shown as applied until you confirm review."}
              </span>
            </div>
            <ul className="diff-list">
              {report.patchDiff.map((line) => (
                <li key={line.id}>
                  <div className={`diff-marker diff-marker--${line.marker === "+" ? "add" : "update"}`}>
                    {line.marker}
                  </div>
                  <div>
                    <strong>{line.title}</strong>
                    <small>{line.operationType}</small>
                    <ul>
                      {line.details.map((detail) => (
                        <li key={detail}>{detail}</li>
                      ))}
                    </ul>
                  </div>
                </li>
              ))}
              {report.patchDiff.length === 0 ? (
                <li>No structured operations proposed.</li>
              ) : null}
            </ul>
          </Panel>

          <Panel title="Verification Report">
            <ul className="compact-list">
              {report.verification.checkedGates.map((gate) => (
                <li key={gate.id}>
                  <span className={`status status--${gate.status}`}>
                    {statusLabels[gate.status]}
                  </span>
                  <strong>{gate.title}</strong>
                  <small>{gate.explanation}</small>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Acceptance Checklist">
            <ul className="compact-list">
              {reviewPacket.acceptanceChecklist.map((item) => (
                <li key={item.id}>
                  <span className={`status status--${item.status}`}>
                    {statusLabels[item.status]}
                  </span>
                  <strong>{item.label}</strong>
                  <small>{item.action}</small>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Issue Delta">
            <IssueDeltaList
              title="Resolved"
              issueIds={reviewPacket.issueDelta.resolvedIssueIds}
            />
            <IssueDeltaList
              title="Remaining"
              issueIds={reviewPacket.issueDelta.remainingIssueIds}
            />
            <IssueDeltaList
              title="Introduced"
              issueIds={reviewPacket.issueDelta.introducedIssueIds}
            />
          </Panel>
        </section>
      </section>

      <aside className="inspector" aria-label="Node inspector">
        <div className="inspector-header">
          <span>Inspector</span>
          <strong>{selectedNode?.label ?? "No node selected"}</strong>
        </div>
        {selectedNode ? (
          <>
            <KeyValue label="Node type" value={selectedNode.type} />
            <KeyValue label="Risk count" value={String(selectedNode.issueCount)} />
            <KeyValue
              label="Highest severity"
              value={
                selectedNode.highestSeverity
                  ? severityLabels[selectedNode.highestSeverity]
                  : "Clear"
              }
            />
            <ParameterList parameters={getSelectedNodeParameters(activeWorkflow, selectedNode.id)} />
            <IssueList issues={selectedNode.issues} emptyLabel="No risks on this node." />
          </>
        ) : null}
      </aside>
    </main>
  );
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "workflow";
}

function getSelectedNodeParameters(workflow: { nodes: { id: string; parameters: NodeParameterSummary[] }[] }, nodeId: string) {
  return workflow.nodes.find((node) => node.id === nodeId)?.parameters ?? [];
}

function ParameterList({ parameters }: { parameters: NodeParameterSummary[] }) {
  if (parameters.length === 0) {
    return <p className="empty-text">No parameter summary.</p>;
  }

  return (
    <section className="parameter-list" aria-label="Parameter summary">
      <span>Parameters</span>
      <ul>
        {parameters.map((parameter) => (
          <li key={parameter.key}>
            <strong>{parameter.key}</strong>
            <code>{parameter.preview}</code>
            {parameter.redacted ? <small>Sensitive values redacted</small> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Panel({
  title,
  children
}: Readonly<{
  title: string;
  children: React.ReactNode;
}>) {
  return (
    <article className="panel">
      <h3>{title}</h3>
      {children}
    </article>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="key-value">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function IssueList({
  issues,
  emptyLabel = "No risks detected."
}: {
  issues: RiskIssue[];
  emptyLabel?: string;
}) {
  if (issues.length === 0) {
    return <p className="empty-text">{emptyLabel}</p>;
  }

  return (
    <ul className="issue-list">
      {issues.map((issue) => (
        <li key={issue.id}>
          <span className={`severity severity--${issue.severity}`}>
            {severityLabels[issue.severity]}
          </span>
          <strong>{issue.title}</strong>
          <small>{issue.explanation}</small>
        </li>
      ))}
    </ul>
  );
}

function IssueDeltaList({
  title,
  issueIds
}: {
  title: string;
  issueIds: string[];
}) {
  return (
    <section className="issue-delta-group">
      <div>
        <span>{title}</span>
        <strong>{issueIds.length}</strong>
      </div>
      {issueIds.length > 0 ? (
        <ul>
          {issueIds.map((issueId) => (
            <li key={issueId}>
              <code>{issueId}</code>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-text">None</p>
      )}
    </section>
  );
}
