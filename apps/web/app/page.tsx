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
  buildWorkflowExplanationInput,
  createDeterministicWorkflowExplanation,
  type WorkflowExplanationInput,
  type WorkflowExplanation,
  type WorkflowExplanationResult
} from "@openworkflowdoctor/workflow-ai";
import {
  createDoctorReportFromWorkflow,
  createDoctorReviewPacket,
  createWorkflowViewModel,
  parseN8nWorkflow,
  type DoctorReport,
  type HumanReview,
  type HumanReviewDecision,
  type NodeParameterSummary,
  type PatchDiffLine,
  type RiskIssue,
  type RiskSeverity,
  type VerificationStatus,
  type WorkflowIR,
  type WorkflowViewNode
} from "@openworkflowdoctor/workflow-ir";
import { useEffect, useMemo, useRef, useState } from "react";
import { createTranslator, type Language, type Translator } from "./lib/i18n";
import {
  clearAiCredentials,
  defaultWorkbenchSettings,
  getAiProviderStatus,
  loadWorkbenchSettings,
  maskApiKey,
  saveWorkbenchSettings,
  toRequestProviderSettings,
  type ThemeMode,
  type WorkbenchSettings
} from "./lib/settings";

type ReviewMode = "original" | "patched";
type ConsoleTab = "summary" | "risks" | "ai" | "patch" | "verification" | "packet" | "logs";
type AiExplainerStatus = "idle" | "loading" | "ready" | "error";
type SettingsTestStatus = "idle" | "testing" | "ready" | "fallback" | "missing-key" | "cleared";
type CommandItem = {
  label: string;
  hint: string;
  disabled: boolean;
  action: () => void;
};

type DoctorNodeData = WorkflowViewNode & {
  issues: RiskIssue[];
  issueCountLabel: string;
  severityLabel: string;
};

const statusLabels: Record<VerificationStatus, string> = {
  pass: "PASS",
  hold: "HOLD",
  fail: "FAIL"
};

const defaultRequest =
  "帮我修复支付和通知相关风险，优先补 webhook 去重和退款幂等性。";

const consoleTabIds: ConsoleTab[] = ["summary", "risks", "ai", "patch", "verification", "packet", "logs"];
const reviewStepKeys = [
  "steps.import",
  "steps.diagnose",
  "steps.patchPreview",
  "steps.verify",
  "steps.humanReview",
  "steps.exportPacket"
] as const;

const emptyIssues: RiskIssue[] = [];

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

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [request, setRequest] = useState(defaultRequest);
  const [workflowInput, setWorkflowInput] = useState<WorkflowIR | null>(null);
  const [report, setReport] = useState<DoctorReport | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [reviewMode, setReviewMode] = useState<ReviewMode>("original");
  const [activeTab, setActiveTab] = useState<ConsoleTab>("summary");
  const [humanDecision, setHumanDecision] = useState<HumanReviewDecision>("undecided");
  const [humanReviewNote, setHumanReviewNote] = useState("");
  const [humanDecidedAt, setHumanDecidedAt] = useState<string | undefined>();
  const [confirmedChecklistItemIds, setConfirmedChecklistItemIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<WorkbenchSettings>(defaultWorkbenchSettings);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [systemTheme, setSystemTheme] = useState<Exclude<ThemeMode, "system">>(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTestStatus, setSettingsTestStatus] = useState<SettingsTestStatus>("idle");
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [packetExported, setPacketExported] = useState(false);
  const [aiResult, setAiResult] = useState<WorkflowExplanationResult | null>(null);
  const [aiStatus, setAiStatus] = useState<AiExplainerStatus>("idle");
  const [aiError, setAiError] = useState<string | null>(null);
  const t = useMemo(() => createTranslator(settings.language), [settings.language]);
  const aiProviderStatus = getAiProviderStatus(settings.ai);
  const resolvedTheme = settings.theme === "system" ? systemTheme : settings.theme;

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
    () => (report ? createDoctorReviewPacket(report, undefined, humanReview) : null),
    [humanReview, report]
  );
  const aiInput = useMemo(() => (report ? buildWorkflowExplanationInput(report) : null), [report]);
  const requiredChecklistItems =
    reviewPacket?.acceptanceChecklist.filter((item) => item.status !== "pass") ?? [];
  const missingChecklistItemIds = requiredChecklistItems
    .filter((item) => !confirmedChecklistItemIds.includes(item.id))
    .map((item) => item.id);
  const canAcceptHumanReview =
    Boolean(report) && report?.verification.status !== "fail" && missingChecklistItemIds.length === 0;
  const humanReviewAccepted =
    reviewPacket?.humanReview.decision === "accepted" &&
    reviewPacket.humanReviewValidation.status === "pass";
  const packetExportStatus = packetExported
    ? t("sidebar.exported")
    : humanReviewAccepted
      ? t("sidebar.readyToExport")
      : t("sidebar.notExported");

  const activeWorkflow =
    report && reviewMode === "patched"
      ? report.patchedWorkflow
      : report?.workflow ?? workflowInput;
  const activeSummary =
    report && reviewMode === "patched" ? report.patchedSummary : report?.summary ?? null;
  const activeIssues = useMemo(() => {
    if (!report) {
      return emptyIssues;
    }

    return reviewMode === "patched" ? report.patchedIssues : report.issues;
  }, [report, reviewMode]);
  const activeView = useMemo(() => {
    if (!activeWorkflow) {
      return null;
    }

    if (report && reviewMode === "patched") {
      return report.patchedView;
    }

    return report?.view ?? createWorkflowViewModel(activeWorkflow, []);
  }, [activeWorkflow, report, reviewMode]);

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
      data: {
        ...viewNode,
        issues: issuesByNode.get(viewNode.id) ?? [],
        issueCountLabel: `${viewNode.issueCount} ${t("graph.risks")}`,
        severityLabel: viewNode.highestSeverity ? getSeverityLabel(viewNode.highestSeverity, t) : t("inspector.clear")
      }
    }));
  }, [activeView, issuesByNode, t]);

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

  const selectedNode =
    flowNodes.find((node) => node.id === selectedNodeId)?.data ?? flowNodes[0]?.data;
  const stepStatuses = getStepStatuses({
    hasWorkflow: Boolean(workflowInput),
    hasReport: Boolean(report),
    hasPatchPreview: reviewMode === "patched",
    hasVerification: Boolean(report?.verification),
    hasHumanReview: humanDecision !== "undecided",
    canExport: Boolean(humanReviewAccepted)
  });

  async function importWorkflow(file: File | undefined) {
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const json = JSON.parse(text) as unknown;
      const parsedWorkflow = parseN8nWorkflow(json);
      setWorkflowInput(parsedWorkflow);
      setReport(null);
      setReviewMode("original");
      setActiveTab("summary");
      setSelectedNodeId(parsedWorkflow.nodes[0]?.id ?? null);
      setPacketExported(false);
      resetHumanReview();
      resetAiExplainer();
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
    if (!workflowInput) {
      return;
    }

    const nextReport = createDoctorReportFromWorkflow(workflowInput, request);
    setReport(nextReport);
    setReviewMode("original");
    setActiveTab("risks");
    setSelectedNodeId(nextReport.view.nodes[0]?.id ?? null);
    setPacketExported(false);
    resetHumanReview();
    resetAiExplainer();
    setError(null);
  }

  async function generateAiExplanation() {
    if (!aiInput) {
      return;
    }

    if (!settings.ai.enabled || settings.ai.apiKey.trim().length === 0) {
      const unavailableReason = settings.ai.enabled
        ? "No AI provider configured."
        : "AI Explainer is disabled in Settings.";
      setAiResult({
        source: "deterministic",
        unavailableReason,
        explanation: createDeterministicWorkflowExplanation(aiInput, unavailableReason)
      });
      setAiStatus("ready");
      setAiError(null);
      return;
    }

    setAiStatus("loading");
    setAiError(null);

    try {
      const response = await fetch("/api/ai/explain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          input: aiInput,
          provider: toRequestProviderSettings(settings.ai)
        })
      });

      if (!response.ok) {
        throw new Error(`AI explainer request failed with ${response.status}`);
      }

      const result = (await response.json()) as WorkflowExplanationResult;
      setAiResult(result);
      setAiStatus("ready");
    } catch (generateError) {
      const unavailableReason =
        generateError instanceof Error ? generateError.message : "AI explanation failed.";

      setAiResult({
        source: "deterministic",
        unavailableReason,
        explanation: createDeterministicWorkflowExplanation(aiInput, unavailableReason)
      });
      setAiStatus("error");
      setAiError(unavailableReason);
    }
  }

  async function testAiConnection() {
    if (!settings.ai.apiKey.trim()) {
      setSettingsTestStatus("missing-key");
      return;
    }

    setSettingsTestStatus("testing");

    try {
      const response = await fetch("/api/ai/explain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          input: createConnectionTestInput(),
          provider: toRequestProviderSettings(settings.ai)
        })
      });

      if (!response.ok) {
        throw new Error(`AI explainer request failed with ${response.status}`);
      }

      const result = (await response.json()) as WorkflowExplanationResult;
      setSettingsTestStatus(result.source === "ai" ? "ready" : "fallback");
    } catch {
      setSettingsTestStatus("fallback");
    }
  }

  function previewPatchedIr() {
    if (!report) {
      return;
    }

    setReviewMode("patched");
    setActiveTab("verification");
    setSelectedNodeId(report.patchedView.nodes[0]?.id ?? null);
  }

  function exportReviewPacket() {
    if (!reviewPacket || !report) {
      return;
    }

    downloadJson(`${slugify(report.workflow.name)}-review-packet.json`, reviewPacket);
    setPacketExported(true);
  }

  function exportPatchedWorkflowIr() {
    if (!report) {
      return;
    }

    downloadJson(`${slugify(report.workflow.name)}-patched-workflow-ir.json`, {
      schemaVersion: "openworkflowdoctor.workflow-ir.v1",
      workflow: report.patchedWorkflow,
      verification: report.verification,
      acceptanceRecommendation: report.acceptanceRecommendation,
      humanReview
    });
  }

  function backToOriginal() {
    if (!report) {
      return;
    }

    setReviewMode("original");
    setSelectedNodeId(report.view.nodes[0]?.id ?? null);
  }

  function resetHumanReview() {
    setHumanDecision("undecided");
    setHumanReviewNote("");
    setHumanDecidedAt(undefined);
    setConfirmedChecklistItemIds([]);
  }

  function resetAiExplainer() {
    setAiResult(null);
    setAiStatus("idle");
    setAiError(null);
  }

  function updateSettings(updater: (current: WorkbenchSettings) => WorkbenchSettings) {
    setSettings((current) => updater(current));
    setSettingsTestStatus("idle");
  }

  function clearCredentials() {
    updateSettings((current) => ({
      ...current,
      ai: clearAiCredentials(current.ai)
    }));
    setSettingsTestStatus("cleared");
  }

  function clearWorkspaceData() {
    setWorkflowInput(null);
    setReport(null);
    setSelectedNodeId(null);
    setReviewMode("original");
    setActiveTab("summary");
    setPacketExported(false);
    resetHumanReview();
    resetAiExplainer();
    setError(null);
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

  function handlePrimaryAction() {
    if (!workflowInput) {
      fileInputRef.current?.click();
      return;
    }

    if (!report) {
      rerunDoctor();
      return;
    }

    if (humanReviewAccepted) {
      exportReviewPacket();
      return;
    }

    if (reviewMode !== "patched") {
      previewPatchedIr();
      return;
    }

    setActiveTab("verification");
  }

  const primaryActionLabel = getPrimaryActionLabel({
    hasWorkflow: Boolean(workflowInput),
    hasReport: Boolean(report),
    hasPatchPreview: reviewMode === "patched",
    humanReviewAccepted: Boolean(humanReviewAccepted),
    t
  });
  const commandItems: CommandItem[] = [
    {
      label: t("actions.importJson"),
      hint: t("command.importHint"),
      disabled: false,
      action: () => {
        fileInputRef.current?.click();
      }
    },
    {
      label: t("actions.runDoctor"),
      hint: t("command.runHint"),
      disabled: !workflowInput,
      action: rerunDoctor
    },
    {
      label: t("actions.previewPatchedIr"),
      hint: t("command.previewHint"),
      disabled: !report || report.proposal.operations.length === 0 || reviewMode === "patched",
      action: previewPatchedIr
    },
    {
      label: t("actions.backToOriginal"),
      hint: t("command.backHint"),
      disabled: !report || reviewMode === "original",
      action: backToOriginal
    },
    {
      label: t("actions.exportReviewPacket"),
      hint: t("command.exportPacketHint"),
      disabled: !reviewPacket || !report,
      action: exportReviewPacket
    },
    {
      label: t("actions.exportPatchedWorkflowIr"),
      hint: t("command.exportIrHint"),
      disabled: !report || reviewMode !== "patched" || report.proposal.operations.length === 0,
      action: exportPatchedWorkflowIr
    }
  ];

  useEffect(() => {
    const loadHandle = window.setTimeout(() => {
      setSettings(loadWorkbenchSettings(window.localStorage));
      setSettingsLoaded(true);
    }, 0);

    return () => window.clearTimeout(loadHandle);
  }, []);

  useEffect(() => {
    if (!settingsLoaded) {
      return;
    }

    saveWorkbenchSettings(window.localStorage, settings);
  }, [settings, settingsLoaded]);

  useEffect(() => {
    document.documentElement.lang = settings.language;
  }, [settings.language]);

  useEffect(() => {
    if (settings.theme !== "system") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystemTheme = () => setSystemTheme(mediaQuery.matches ? "dark" : "light");
    mediaQuery.addEventListener("change", syncSystemTheme);

    return () => mediaQuery.removeEventListener("change", syncSystemTheme);
  }, [settings.theme]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsCommandPaletteOpen(true);
      }

      if (event.key === "Escape") {
        setIsCommandPaletteOpen(false);
        setIsSettingsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <main className="doctor-shell" data-theme={resolvedTheme}>
      <aside className="review-steps" aria-label={t("sidebar.reviewSteps")}>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={(event) => void importWorkflow(event.target.files?.[0])}
        />

        <section className="workflow-card" aria-label={t("sidebar.reviewTarget")}>
          <span>{t("app.version")}</span>
          <h2>{t("sidebar.reviewTarget")}</h2>
          <span>{t("sidebar.workflowName")}</span>
          <h1>{workflowInput?.name ?? "OpenWorkflowDoctor"}</h1>
          {!workflowInput ? (
            <p className="side-copy">
              {t("sidebar.localStaticCopy")}
            </p>
          ) : null}
          <div className="current-view">
            <span>{t("sidebar.currentView")}</span>
            <strong>{reviewMode === "patched" ? t("view.patched") : t("view.original")}</strong>
          </div>
          <KeyValue
            label={t("sidebar.fingerprint")}
            value={reviewPacket?.reviewTargetFingerprint ?? t("sidebar.fingerprintPending")}
          />
          <KeyValue label={t("sidebar.packetExportStatus")} value={packetExportStatus} />
        </section>

        <button type="button" className="primary-action" onClick={handlePrimaryAction}>
          {primaryActionLabel}
        </button>

        <ol className="stepper" aria-label={t("sidebar.reviewSteps")}>
          {reviewStepKeys.map((step, index) => (
            <li key={step} className={`stepper__item stepper__item--${stepStatuses[index]}`}>
              <span>{index + 1}</span>
              <strong>{t(step)}</strong>
            </li>
          ))}
        </ol>

        {workflowInput ? (
          <section className="request-panel" aria-label={t("sidebar.patchRequest")}>
            <label htmlFor="patch-request">{t("sidebar.patchRequest")}</label>
            <textarea
              id="patch-request"
              value={request}
              onChange={(event) => setRequest(event.target.value)}
            />
            <button type="button" onClick={rerunDoctor}>
              {t("actions.runDoctor")}
            </button>
          </section>
        ) : null}

        {error ? <p className="error-text">{error}</p> : null}

        {report ? (
          <section className="side-state" aria-label={`${t("sidebar.verifier")} / ${t("sidebar.humanReview")}`}>
            <div>
              <span>{t("sidebar.verifier")}</span>
              <strong className={`status status--${report.verification.status}`}>
                {statusLabels[report.verification.status]}
              </strong>
            </div>
            <div>
              <span>{t("sidebar.humanReview")}</span>
              <strong>{getHumanDecisionLabel(humanDecision, t)}</strong>
            </div>
          </section>
        ) : null}

        {report ? (
          <section className="preview-note" aria-label={t("sidebar.previewTitle")}>
            <strong>{t("sidebar.previewTitle")}</strong>
            <p>{t("sidebar.previewBody")}</p>
          </section>
        ) : null}
      </aside>

      <section className="workspace" aria-label={t("workspace.label")}>
        <header className="workspace-header">
          <div>
            <p>{t("workspace.graph")}</p>
            <h2>{activeWorkflow?.name ?? t("workspace.importPrompt")}</h2>
          </div>
          <div className="workbench-actions" aria-label="Workbench actions">
            <button type="button" onClick={() => setIsCommandPaletteOpen(true)}>
              {t("toolbar.commandPalette")}
            </button>
            <button type="button" onClick={() => setIsSettingsOpen(true)}>
              {t("toolbar.settings")}
            </button>
          </div>
          <div className="metric-strip" aria-label="Review metrics">
            <Metric label={t("toolbar.metrics.nodes")} value={String(activeWorkflow?.nodes.length ?? 0)} />
            <Metric label={t("toolbar.metrics.risks")} value={report ? String(activeIssues.length) : "-"} />
            <Metric label={t("toolbar.metrics.patchOps")} value={report ? String(report.proposal.operations.length) : "-"} />
            <Metric
              label={t("toolbar.metrics.verifierStatus")}
              value={report ? statusLabels[report.verification.status] : t("toolbar.notRun")}
              {...(report ? { tone: report.verification.status } : {})}
            />
          </div>
        </header>

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
              onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            >
              <Background gap={24} color="#dde4ee" />
              <Controls />
            </ReactFlow>
          ) : (
            <EmptyState t={t} />
          )}
        </div>

        <ReviewConsole
          activeTab={activeTab}
          activeSummary={activeSummary}
          activeIssues={activeIssues}
          activeWorkflow={activeWorkflow}
          report={report}
          reviewMode={reviewMode}
          reviewPacket={reviewPacket}
          requiredChecklistItems={requiredChecklistItems}
          confirmedChecklistItemIds={confirmedChecklistItemIds}
          canAcceptHumanReview={canAcceptHumanReview}
          humanDecision={humanDecision}
          humanReviewNote={humanReviewNote}
          aiResult={aiResult}
          aiStatus={aiStatus}
          aiError={aiError}
          t={t}
          onTabChange={setActiveTab}
          onGenerateAiExplanation={() => void generateAiExplanation()}
          onPreviewPatchedIr={previewPatchedIr}
          onBackToOriginal={backToOriginal}
          onToggleChecklistConfirmation={toggleChecklistConfirmation}
          onRecordHumanDecision={recordHumanDecision}
          onHumanReviewNoteChange={setHumanReviewNote}
          onExportReviewPacket={exportReviewPacket}
          onExportPatchedWorkflowIr={exportPatchedWorkflowIr}
        />
      </section>

      <Inspector
        workflow={activeWorkflow}
        summary={activeSummary}
        selectedNode={selectedNode}
        patchDiff={report?.patchDiff ?? []}
        t={t}
      />

      <StatusBar
        verifierStatus={report?.verification.status}
        reviewMode={reviewMode}
        language={settings.language}
        aiProviderStatus={aiProviderStatus}
        t={t}
      />

      {isCommandPaletteOpen ? (
        <CommandPalette
          commands={commandItems}
          t={t}
          onClose={() => setIsCommandPaletteOpen(false)}
        />
      ) : null}

      {isSettingsOpen ? (
        <SettingsModal
          settings={settings}
          workspaceStatus={report ? t("settings.workspaceReportReady") : workflowInput ? t("settings.workspaceLoaded") : t("settings.workspaceEmpty")}
          testStatus={settingsTestStatus}
          t={t}
          onSettingsChange={updateSettings}
          onTestConnection={() => void testAiConnection()}
          onClearCredentials={clearCredentials}
          onClearWorkspaceData={clearWorkspaceData}
          onClose={() => setIsSettingsOpen(false)}
        />
      ) : null}
    </main>
  );
}

function EmptyState({ t }: { t: Translator }) {
  return (
    <section className="empty-workspace" aria-label={t("empty.title")}>
      <p className="product-kicker">{t("app.version")}</p>
      <h2>{t("empty.title")}</h2>
      <p>{t("empty.body")}</p>
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

function StatusBar({
  verifierStatus,
  reviewMode,
  language,
  aiProviderStatus,
  t
}: {
  verifierStatus: VerificationStatus | undefined;
  reviewMode: ReviewMode;
  language: Language;
  aiProviderStatus: "configured" | "fallback";
  t: Translator;
}) {
  return (
    <footer className="status-bar" role="contentinfo" aria-label="Workbench status">
      <span>{t("status.localMode")}</span>
      <span>{t("status.noRuntime")}</span>
      <span>{t("status.noCredentials")}</span>
      <span>{t("status.workflowIrPreview")}</span>
      <span>{t("status.language")}: {language}</span>
      <span>{t("status.ai")}: {aiProviderStatus === "configured" ? t("status.configured") : t("status.fallback")}</span>
      <span>{t("status.verifier")}: {verifierStatus ? statusLabels[verifierStatus] : t("toolbar.notRun")}</span>
      <span>{t("status.view")}: {reviewMode === "patched" ? t("view.patched") : t("view.original")}</span>
    </footer>
  );
}

function CommandPalette({
  commands,
  t,
  onClose
}: {
  commands: CommandItem[];
  t: Translator;
  onClose: () => void;
}) {
  function runCommand(command: CommandItem) {
    if (command.disabled) {
      return;
    }

    command.action();
    onClose();
  }

  return (
    <div className="command-overlay" role="presentation">
      <section className="command-palette" role="dialog" aria-modal="true" aria-label={t("toolbar.commandPalette")}>
        <header>
          <div>
            <span>{t("toolbar.commandPalette")}</span>
            <h2>{t("command.title")}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={t("actions.close")}>
            {t("actions.close")}
          </button>
        </header>
        <ul>
          {commands.map((command) => (
            <li key={command.label}>
              <button
                type="button"
                disabled={command.disabled}
                onClick={() => runCommand(command)}
              >
                <strong>{command.label}</strong>
                <small>{command.hint}</small>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function SettingsModal({
  settings,
  workspaceStatus,
  testStatus,
  t,
  onSettingsChange,
  onTestConnection,
  onClearCredentials,
  onClearWorkspaceData,
  onClose
}: {
  settings: WorkbenchSettings;
  workspaceStatus: string;
  testStatus: SettingsTestStatus;
  t: Translator;
  onSettingsChange: (updater: (current: WorkbenchSettings) => WorkbenchSettings) => void;
  onTestConnection: () => void;
  onClearCredentials: () => void;
  onClearWorkspaceData: () => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-overlay" role="presentation">
      <section className="settings-modal" role="dialog" aria-modal="true" aria-label={t("settings.title")}>
        <header>
          <div>
            <span>{t("toolbar.settings")}</span>
            <h2>{t("settings.title")}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={t("actions.close")}>
            {t("actions.close")}
          </button>
        </header>

        <div className="settings-body">
          <section className="settings-section">
            <h3>{t("settings.general")}</h3>
            <label>
              <span>{t("settings.language")}</span>
              <select
                value={settings.language}
                onChange={(event) =>
                  onSettingsChange((current) => ({
                    ...current,
                    language: event.target.value as Language
                  }))
                }
              >
                <option value="zh-CN">zh-CN</option>
                <option value="en-US">en-US</option>
              </select>
            </label>
            <label>
              <span>{t("settings.theme")}</span>
              <select
                value={settings.theme}
                onChange={(event) =>
                  onSettingsChange((current) => ({
                    ...current,
                    theme: event.target.value as ThemeMode
                  }))
                }
              >
                <option value="light">{t("settings.themeLight")}</option>
                <option value="dark">{t("settings.themeDark")}</option>
                <option value="system">{t("settings.themeSystem")}</option>
              </select>
            </label>
          </section>

          <section className="settings-section">
            <h3>{t("settings.aiProvider")}</h3>
            <label className="settings-check">
              <input
                type="checkbox"
                checked={settings.ai.enabled}
                onChange={(event) =>
                  onSettingsChange((current) => ({
                    ...current,
                    ai: {
                      ...current.ai,
                      enabled: event.target.checked
                    }
                  }))
                }
              />
              <span>{t("settings.enableAi")}</span>
            </label>
            <label>
              <span>{t("settings.providerType")}</span>
              <select value={settings.ai.providerType} disabled>
                <option value="openai-compatible">OpenAI-compatible</option>
              </select>
            </label>
            <label>
              <span>{t("settings.baseUrl")}</span>
              <input
                value={settings.ai.baseUrl}
                onChange={(event) =>
                  onSettingsChange((current) => ({
                    ...current,
                    ai: {
                      ...current.ai,
                      baseUrl: event.target.value
                    }
                  }))
                }
              />
            </label>
            <label>
              <span>{t("settings.apiKey")}</span>
              <input
                type="password"
                value={settings.ai.apiKey}
                autoComplete="off"
                onChange={(event) =>
                  onSettingsChange((current) => ({
                    ...current,
                    ai: {
                      ...current.ai,
                      apiKey: event.target.value
                    }
                  }))
                }
              />
            </label>
            <p className="settings-help">
              {t("settings.apiKeyStored")}
              {settings.ai.apiKey ? ` ${t("settings.apiKeyMasked")}: ${maskApiKey(settings.ai.apiKey)}` : ""}
            </p>
            <label>
              <span>{t("settings.model")}</span>
              <input
                value={settings.ai.model}
                onChange={(event) =>
                  onSettingsChange((current) => ({
                    ...current,
                    ai: {
                      ...current.ai,
                      model: event.target.value
                    }
                  }))
                }
              />
            </label>
            <div className="settings-actions">
              <button type="button" onClick={onTestConnection} disabled={testStatus === "testing"}>
                {t("actions.testConnection")}
              </button>
              <button type="button" className="secondary-button" onClick={onClearCredentials}>
                {t("actions.clearCredentials")}
              </button>
            </div>
            <p className="settings-help">{getSettingsTestStatusLabel(testStatus, t)}</p>
          </section>

          <section className="settings-section">
            <h3>{t("settings.workspace")}</h3>
            <KeyValue label={t("settings.workspaceStatus")} value={workspaceStatus} />
            <div className="settings-actions">
              <button type="button" className="secondary-button" onClick={onClearWorkspaceData}>
                {t("actions.clearWorkspaceData")}
              </button>
              <button type="button" className="secondary-button" disabled>
                {t("actions.exportWorkspace")} · {t("settings.placeholder")}
              </button>
              <button type="button" className="secondary-button" disabled>
                {t("actions.importWorkspace")} · {t("settings.placeholder")}
              </button>
            </div>
          </section>

          <section className="settings-section">
            <h3>{t("settings.safety")}</h3>
            <ul className="safety-list">
              <li>{t("safety.localStatic")}</li>
              <li>{t("safety.noExecution")}</li>
              <li>{t("safety.noN8nMutation")}</li>
              <li>{t("safety.noCredentialAccess")}</li>
              <li>{t("safety.patchPreview")}</li>
              <li>{t("safety.aiAdvisory")}</li>
              <li>{t("safety.verifierTruth")}</li>
            </ul>
          </section>
        </div>
      </section>
    </div>
  );
}

function ReviewConsole({
  activeTab,
  activeSummary,
  activeIssues,
  activeWorkflow,
  report,
  reviewMode,
  reviewPacket,
  requiredChecklistItems,
  confirmedChecklistItemIds,
  canAcceptHumanReview,
  humanDecision,
  humanReviewNote,
  aiResult,
  aiStatus,
  aiError,
  t,
  onTabChange,
  onGenerateAiExplanation,
  onPreviewPatchedIr,
  onBackToOriginal,
  onToggleChecklistConfirmation,
  onRecordHumanDecision,
  onHumanReviewNoteChange,
  onExportReviewPacket,
  onExportPatchedWorkflowIr
}: {
  activeTab: ConsoleTab;
  activeSummary: DoctorReport["summary"] | null;
  activeIssues: RiskIssue[];
  activeWorkflow: WorkflowIR | null;
  report: DoctorReport | null;
  reviewMode: ReviewMode;
  reviewPacket: ReturnType<typeof createDoctorReviewPacket> | null;
  requiredChecklistItems: NonNullable<ReturnType<typeof createDoctorReviewPacket>>["acceptanceChecklist"];
  confirmedChecklistItemIds: string[];
  canAcceptHumanReview: boolean;
  humanDecision: HumanReviewDecision;
  humanReviewNote: string;
  aiResult: WorkflowExplanationResult | null;
  aiStatus: AiExplainerStatus;
  aiError: string | null;
  t: Translator;
  onTabChange: (tab: ConsoleTab) => void;
  onGenerateAiExplanation: () => void;
  onPreviewPatchedIr: () => void;
  onBackToOriginal: () => void;
  onToggleChecklistConfirmation: (itemId: string) => void;
  onRecordHumanDecision: (decision: HumanReviewDecision) => void;
  onHumanReviewNoteChange: (note: string) => void;
  onExportReviewPacket: () => void;
  onExportPatchedWorkflowIr: () => void;
}) {
  return (
    <section className="review-console" aria-label="Review Console">
      <div className="tab-list" role="tablist" aria-label="Review Console tabs">
        {consoleTabIds.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => onTabChange(tab)}
          >
            {getConsoleTabLabel(tab, t)}
          </button>
        ))}
      </div>

      <div className="tab-panel" role="tabpanel">
        {activeTab === "summary" ? (
          <SummaryTab summary={activeSummary} workflow={activeWorkflow} report={report} t={t} />
        ) : null}
        {activeTab === "risks" ? <RisksTab issues={activeIssues} report={report} t={t} /> : null}
        {activeTab === "ai" ? (
          <AiExplainerTab
            report={report}
            result={aiResult}
            status={aiStatus}
            error={aiError}
            t={t}
            onGenerate={onGenerateAiExplanation}
          />
        ) : null}
        {activeTab === "patch" ? (
          <PatchDiffTab
            report={report}
            reviewMode={reviewMode}
            t={t}
            onPreviewPatchedIr={onPreviewPatchedIr}
            onBackToOriginal={onBackToOriginal}
          />
        ) : null}
        {activeTab === "verification" ? (
          <VerificationTab
            report={report}
            reviewPacket={reviewPacket}
            requiredChecklistItems={requiredChecklistItems}
            confirmedChecklistItemIds={confirmedChecklistItemIds}
            canAcceptHumanReview={canAcceptHumanReview}
            humanDecision={humanDecision}
            humanReviewNote={humanReviewNote}
            t={t}
            onToggleChecklistConfirmation={onToggleChecklistConfirmation}
            onRecordHumanDecision={onRecordHumanDecision}
            onHumanReviewNoteChange={onHumanReviewNoteChange}
          />
        ) : null}
        {activeTab === "packet" ? (
          <ReviewPacketTab
            report={report}
            reviewPacket={reviewPacket}
            reviewMode={reviewMode}
            t={t}
            onExportReviewPacket={onExportReviewPacket}
            onExportPatchedWorkflowIr={onExportPatchedWorkflowIr}
          />
        ) : null}
        {activeTab === "logs" ? (
          <LogsTab workflow={activeWorkflow} report={report} reviewMode={reviewMode} t={t} />
        ) : null}
      </div>
    </section>
  );
}

function SummaryTab({
  summary,
  workflow,
  report,
  t
}: {
  summary: DoctorReport["summary"] | null;
  workflow: WorkflowIR | null;
  report: DoctorReport | null;
  t: Translator;
}) {
  if (!workflow) {
    return <p className="empty-text">{t("summary.importPrompt")}</p>;
  }

  return (
    <div className="console-grid console-grid--summary">
      <section>
        <h3>{t("summary.title")}</h3>
        <p className="panel-lead">
          {summary?.overview ??
            `${workflow.name} ${t("summary.pending")}`}
        </p>
      </section>
      <KeyValue label={t("summary.entryNodes")} value={summary?.entryNodes.join(", ") || t("summary.notDiagnosed")} />
      <KeyValue label={t("summary.terminalNodes")} value={summary?.terminalNodes.join(", ") || t("summary.notDiagnosed")} />
      <KeyValue label={t("summary.sideEffects")} value={summary?.sideEffectNodes.join(", ") || t("summary.notDiagnosed")} />
      <KeyValue
        label={t("summary.patchModel")}
        value={report ? t("summary.patchModelReady") : t("summary.patchModelPending")}
      />
    </div>
  );
}

function RisksTab({ issues, report, t }: { issues: RiskIssue[]; report: DoctorReport | null; t: Translator }) {
  if (!report) {
    return <p className="empty-text">{t("risks.pending")}</p>;
  }

  return (
    <div className="problems-panel">
      <div className="console-toolbar">
        <div>
          <h3>{t("risks.title")}</h3>
          <p>{t("risks.description")}</p>
        </div>
        <strong>{issues.length} {t("risks.count")}</strong>
      </div>
      <IssueList issues={issues} t={t} />
    </div>
  );
}

function AiExplainerTab({
  report,
  result,
  status,
  error,
  t,
  onGenerate
}: {
  report: DoctorReport | null;
  result: WorkflowExplanationResult | null;
  status: AiExplainerStatus;
  error: string | null;
  t: Translator;
  onGenerate: () => void;
}) {
  if (!report) {
    return <p className="empty-text">{t("ai.pending")}</p>;
  }

  const sourceLabel = result?.source === "ai" ? t("ai.aiAdvisory") : t("ai.deterministicFallback");
  const explanation: WorkflowExplanation | null = result?.explanation ?? null;

  return (
    <div className="console-stack" aria-label="AI explainer">
      <div className="console-toolbar">
        <div>
          <h3>{t("ai.title")}</h3>
          <p>{t("ai.advisory")}</p>
        </div>
        <div className="console-actions">
          <button type="button" onClick={onGenerate} disabled={status === "loading"}>
            {status === "loading" ? t("actions.generating") : t("actions.generateExplanation")}
          </button>
        </div>
      </div>

      <p className="callout callout--hold">
        {t("ai.safeInput")} {t("ai.localKeyNotice")}
      </p>

      {status === "idle" ? (
        <p className="empty-text">{t("ai.idle")}</p>
      ) : null}
      {status === "loading" ? (
        <p className="empty-text">{t("ai.loading")}</p>
      ) : null}
      {result?.unavailableReason ? (
        <p className="review-warning">{t("ai.unavailable")} {result.unavailableReason}</p>
      ) : null}
      {error ? <p className="error-text">{error}</p> : null}

      {explanation ? (
        <>
          <section className="verification-summary" aria-label="AI explanation source">
            <Metric label={t("ai.source")} value={sourceLabel} />
            <KeyValue label={t("ai.purpose")} value={explanation.workflowPurpose} />
          </section>

          <section>
            <h3>{t("ai.highRiskPaths")}</h3>
            <ul className="compact-list">
              {explanation.highRiskPaths.map((path) => (
                <li key={`${path.title}:${path.relatedIssueIds.join(",")}`}>
                  <strong>{path.title}</strong>
                  <small>{path.explanation}</small>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3>{t("ai.criticalIssues")}</h3>
            <ul className="compact-list">
              {explanation.criticalIssueExplanations.map((issue) => (
                <li key={issue.issueId}>
                  <span className={`severity severity--${issue.severity}`}>
                    {getSeverityLabel(issue.severity, t)}
                  </span>
                  <strong>{issue.title}</strong>
                  <small>{issue.whyItMatters}</small>
                  <small>{issue.humanCheck}</small>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3>{t("ai.reviewerChecks")}</h3>
            <ul className="compact-list">
              {explanation.reviewerChecklist.map((item) => (
                <li key={item}>
                  <small>{item}</small>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}

function PatchDiffTab({
  report,
  reviewMode,
  t,
  onPreviewPatchedIr,
  onBackToOriginal
}: {
  report: DoctorReport | null;
  reviewMode: ReviewMode;
  t: Translator;
  onPreviewPatchedIr: () => void;
  onBackToOriginal: () => void;
}) {
  if (!report) {
    return <p className="empty-text">{t("patch.pending")}</p>;
  }

  return (
    <div className="console-stack">
      <div className="console-toolbar">
        <div>
          <h3>{t("patch.title")}</h3>
          <p>{t("patch.description")}</p>
        </div>
        <div className="console-actions">
          <button
            type="button"
            onClick={onPreviewPatchedIr}
            disabled={reviewMode === "patched" || report.proposal.operations.length === 0}
          >
            {t("patch.previewLocal")}
          </button>
          <button type="button" className="secondary-button" onClick={onBackToOriginal}>
            {t("patch.original")}
          </button>
        </div>
      </div>
      <h3>{t("patch.operationList")}</h3>
      <p className="panel-lead">{report.proposal.summary}</p>
      <DiffList diff={report.patchDiff} t={t} />
    </div>
  );
}

function VerificationTab({
  report,
  reviewPacket,
  requiredChecklistItems,
  confirmedChecklistItemIds,
  canAcceptHumanReview,
  humanDecision,
  humanReviewNote,
  t,
  onToggleChecklistConfirmation,
  onRecordHumanDecision,
  onHumanReviewNoteChange
}: {
  report: DoctorReport | null;
  reviewPacket: ReturnType<typeof createDoctorReviewPacket> | null;
  requiredChecklistItems: NonNullable<ReturnType<typeof createDoctorReviewPacket>>["acceptanceChecklist"];
  confirmedChecklistItemIds: string[];
  canAcceptHumanReview: boolean;
  humanDecision: HumanReviewDecision;
  humanReviewNote: string;
  t: Translator;
  onToggleChecklistConfirmation: (itemId: string) => void;
  onRecordHumanDecision: (decision: HumanReviewDecision) => void;
  onHumanReviewNoteChange: (note: string) => void;
}) {
  if (!report || !reviewPacket) {
    return <p className="empty-text">{t("verification.pending")}</p>;
  }

  const primaryReason = getPrimaryVerifierReason(report, t);

  return (
    <div className="verification-layout">
      <section className="verification-summary">
        <div>
          <span>{t("verification.status")}</span>
          <strong className={`status status--${report.verification.status}`}>
            {statusLabels[report.verification.status]}
          </strong>
        </div>
        <KeyValue label={t("verification.primaryReason")} value={primaryReason} />
        <Metric label={t("verification.resolved")} value={String(reviewPacket.issueDelta.resolvedIssueIds.length)} />
        <Metric label={t("verification.remaining")} value={String(reviewPacket.issueDelta.remainingIssueIds.length)} />
        <Metric label={t("verification.introduced")} value={String(reviewPacket.issueDelta.introducedIssueIds.length)} />
      </section>

      {report.verification.status === "hold" ? (
        <p className="callout callout--hold">
          {t("verification.holdReason")}
        </p>
      ) : null}
      {report.verification.status === "fail" ? (
        <p className="callout callout--fail">
          {t("verification.failReason")}
        </p>
      ) : null}

      <section className="human-review-panel" aria-label={t("verification.requiredConfirmations")}>
        <div className="section-title-row">
          <div>
            <span>{t("verification.requiredConfirmations")}</span>
            <strong>{requiredChecklistItems.length}</strong>
          </div>
          <strong>{getHumanDecisionLabel(humanDecision, t)}</strong>
        </div>
        {requiredChecklistItems.length > 0 ? (
          <div className="confirmation-list">
            {requiredChecklistItems.map((item) => (
              <label key={item.id}>
                <input
                  type="checkbox"
                  checked={confirmedChecklistItemIds.includes(item.id)}
                  onChange={() => onToggleChecklistConfirmation(item.id)}
                />
                <span>
                  <strong>{item.label}</strong>
                  {item.action}
                </span>
              </label>
            ))}
          </div>
        ) : (
          <p className="empty-text">{t("verification.noConfirmations")}</p>
        )}
        <div className="decision-buttons">
          {(["accepted", "held", "rejected"] as const).map((decision) => (
            <button
              key={decision}
              type="button"
              className={humanDecision === decision ? "is-selected" : ""}
              onClick={() => onRecordHumanDecision(decision)}
              disabled={decision === "accepted" && !canAcceptHumanReview}
            >
              {getHumanDecisionLabel(decision, t)}
            </button>
          ))}
        </div>
        {reviewPacket.humanReviewValidation.status !== "pass" ? (
          <p className="review-warning">{reviewPacket.humanReviewValidation.explanation}</p>
        ) : null}
        <textarea
          aria-label={t("verification.reviewerNote")}
          value={humanReviewNote}
          onChange={(event) => onHumanReviewNoteChange(event.target.value)}
        />
      </section>

      <section>
        <h3>{t("verification.ciChecks")}</h3>
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
      </section>
    </div>
  );
}

function ReviewPacketTab({
  report,
  reviewPacket,
  reviewMode,
  t,
  onExportReviewPacket,
  onExportPatchedWorkflowIr
}: {
  report: DoctorReport | null;
  reviewPacket: ReturnType<typeof createDoctorReviewPacket> | null;
  reviewMode: ReviewMode;
  t: Translator;
  onExportReviewPacket: () => void;
  onExportPatchedWorkflowIr: () => void;
}) {
  if (!report || !reviewPacket) {
    return <p className="empty-text">{t("packet.pending")}</p>;
  }

  return (
    <div className="console-stack">
      <div className="console-toolbar">
        <div>
          <h3>{t("packet.artifactPreview")}</h3>
          <p>{t("packet.description")}</p>
        </div>
        <div className="console-actions">
          <button type="button" onClick={onExportReviewPacket}>
            {t("actions.exportReviewPacket")}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={onExportPatchedWorkflowIr}
            disabled={reviewMode !== "patched" || report.proposal.operations.length === 0}
          >
            {t("actions.exportPatchedWorkflowIr")}
          </button>
        </div>
      </div>
      <div className="fingerprint-block">
        <small>{t("packet.targetFingerprint")}</small>
        <code>{reviewPacket.reviewTargetFingerprint}</code>
      </div>
      <div className="console-grid">
        <IssueDeltaList title={t("packet.resolved")} issueIds={reviewPacket.issueDelta.resolvedIssueIds} t={t} />
        <IssueDeltaList title={t("packet.remaining")} issueIds={reviewPacket.issueDelta.remainingIssueIds} t={t} />
        <IssueDeltaList title={t("packet.introduced")} issueIds={reviewPacket.issueDelta.introducedIssueIds} t={t} />
      </div>
    </div>
  );
}

function LogsTab({
  workflow,
  report,
  reviewMode,
  t
}: {
  workflow: WorkflowIR | null;
  report: DoctorReport | null;
  reviewMode: ReviewMode;
  t: Translator;
}) {
  const logs = [
    workflow ? `${workflow.name} ${t("logs.importedSuffix")}` : t("logs.waiting"),
    report ? t("logs.diagnosticsDone") : t("logs.notRun"),
    report ? `${report.proposal.operations.length} ${t("logs.operationsSuffix")}` : t("logs.noPatch"),
    report ? `${t("logs.verifierPrefix")} ${statusLabels[report.verification.status]}.` : t("logs.verifierNotRun"),
    reviewMode === "patched"
      ? t("logs.patchedVisible")
      : t("logs.originalVisible")
  ];

  return (
    <ul className="log-list">
      {logs.map((log) => (
        <li key={log}>{log}</li>
      ))}
    </ul>
  );
}

function Inspector({
  workflow,
  summary,
  selectedNode,
  patchDiff,
  t
}: {
  workflow: WorkflowIR | null;
  summary: DoctorReport["summary"] | null;
  selectedNode: DoctorNodeData | undefined;
  patchDiff: PatchDiffLine[];
  t: Translator;
}) {
  const parameters = workflow && selectedNode ? getSelectedNodeParameters(workflow, selectedNode.id) : [];
  const sideEffect =
    Boolean(selectedNode?.issues.some((issue) => issue.id.startsWith("high_risk_side_effect_node:"))) ||
    Boolean(selectedNode && summary?.sideEffectNodes.includes(selectedNode.label));
  const patchImpact = selectedNode
    ? patchDiff.filter((line) => line.targetNodeId === selectedNode.id)
    : [];
  const graphContext = workflow && selectedNode ? getGraphContext(workflow, selectedNode.id) : null;

  return (
    <aside className="inspector" aria-label={t("inspector.label")}>
      <div className="inspector-header">
        <span>{t("inspector.title")}</span>
        <strong>{selectedNode?.label ?? t("inspector.noNode")}</strong>
      </div>
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

function DiffList({ diff, t }: { diff: PatchDiffLine[]; t: Translator }) {
  if (diff.length === 0) {
    return <p className="empty-text">{t("patch.noOperations")}</p>;
  }

  return (
    <ul className="diff-list">
      {diff.map((line) => (
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
    </ul>
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

function ParameterList({ parameters, t }: { parameters: NodeParameterSummary[]; t: Translator }) {
  if (parameters.length === 0) {
    return <p className="empty-text">{t("inspector.noParameters")}</p>;
  }

  return (
    <section className="parameter-list" aria-label={t("inspector.parameters")}>
      <ul>
        {parameters.map((parameter) => (
          <li key={parameter.key}>
            <strong>{parameter.key}</strong>
            <code>{parameter.preview}</code>
            {parameter.redacted ? <small>{t("inspector.sensitiveRedacted")}</small> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Metric({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone?: VerificationStatus;
}) {
  return (
    <div className={`metric ${tone ? `metric--${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
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
  t,
  emptyLabel
}: {
  issues: RiskIssue[];
  t: Translator;
  emptyLabel?: string;
}) {
  if (issues.length === 0) {
    return <p className="empty-text">{emptyLabel ?? t("inspector.noRisksNode")}</p>;
  }

  return (
    <ul className="issue-list">
      {issues.map((issue) => (
        <li key={issue.id}>
          <span className={`severity severity--${issue.severity}`}>
            {getSeverityLabel(issue.severity, t)}
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
  issueIds,
  t
}: {
  title: string;
  issueIds: string[];
  t: Translator;
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
        <p className="empty-text">{t("packet.none")}</p>
      )}
    </section>
  );
}

function getPrimaryVerifierReason(report: DoctorReport, t: Translator) {
  return (
    report.verification.checkedGates.find((gate) => gate.status !== "pass")?.explanation ??
    t("verification.allGatesPassed")
  );
}

function getConsoleTabLabel(tab: ConsoleTab, t: Translator): string {
  switch (tab) {
    case "summary":
      return t("tabs.summary");
    case "risks":
      return t("tabs.risks");
    case "ai":
      return t("tabs.ai");
    case "patch":
      return t("tabs.patch");
    case "verification":
      return t("tabs.verification");
    case "packet":
      return t("tabs.packet");
    case "logs":
      return t("tabs.logs");
  }
}

function getHumanDecisionLabel(decision: HumanReviewDecision, t: Translator): string {
  switch (decision) {
    case "undecided":
      return t("decision.undecided");
    case "accepted":
      return t("decision.accepted");
    case "held":
      return t("decision.held");
    case "rejected":
      return t("decision.rejected");
  }
}

function getSeverityLabel(severity: RiskSeverity, t: Translator): string {
  switch (severity) {
    case "low":
      return t("severity.low");
    case "medium":
      return t("severity.medium");
    case "high":
      return t("severity.high");
    case "critical":
      return t("severity.critical");
  }
}

function getSettingsTestStatusLabel(status: SettingsTestStatus, t: Translator): string {
  switch (status) {
    case "idle":
      return t("settings.testIdle");
    case "testing":
      return t("settings.testTesting");
    case "ready":
      return t("settings.testReady");
    case "fallback":
      return t("settings.testFallback");
    case "missing-key":
      return t("settings.testMissingKey");
    case "cleared":
      return t("settings.credentialsCleared");
  }
}

function createConnectionTestInput(): WorkflowExplanationInput {
  return {
    workflow: {
      workflowName: "workflow",
      overview: "Connection test for local AI explainer configuration.",
      entryNodes: [],
      terminalNodes: [],
      sideEffectNodes: [],
      riskCounts: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0
      },
      recommendedStatus: "pass"
    },
    graph: {
      nodes: [],
      edges: [],
      highRiskPaths: []
    },
    issues: [],
    verifier: {
      acceptanceRecommendation: "pass",
      status: "pass",
      checkedGates: []
    }
  };
}

function getPrimaryActionLabel({
  hasWorkflow,
  hasReport,
  hasPatchPreview,
  humanReviewAccepted,
  t
}: {
  hasWorkflow: boolean;
  hasReport: boolean;
  hasPatchPreview: boolean;
  humanReviewAccepted: boolean;
  t: Translator;
}) {
  if (!hasWorkflow) {
    return t("actions.importJson");
  }
  if (!hasReport) {
    return t("actions.runDoctor");
  }
  if (humanReviewAccepted) {
    return t("actions.exportReviewPacket");
  }
  if (!hasPatchPreview) {
    return t("actions.previewPatchedIr");
  }
  return t("actions.completeConfirmations");
}

function getStepStatuses({
  hasWorkflow,
  hasReport,
  hasPatchPreview,
  hasVerification,
  hasHumanReview,
  canExport
}: {
  hasWorkflow: boolean;
  hasReport: boolean;
  hasPatchPreview: boolean;
  hasVerification: boolean;
  hasHumanReview: boolean;
  canExport: boolean;
}) {
  const completed = [
    hasWorkflow,
    hasReport,
    hasPatchPreview,
    hasVerification,
    hasHumanReview,
    canExport
  ];
  const firstOpen = completed.findIndex((isComplete) => !isComplete);

  return completed.map((isComplete, index) => {
    if (isComplete) {
      return "complete";
    }
    return firstOpen === index ? "active" : "locked";
  });
}
