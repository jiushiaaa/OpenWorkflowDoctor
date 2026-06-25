"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { importN8nReadonlyWorkflow as importN8nReadonlyPayload } from "@openworkflowdoctor/workflow-ir";
import { CommandPalette } from "./components/CommandPalette";
import { InspectorPanel } from "./components/InspectorPanel";
import { OnboardingPanel } from "./components/OnboardingPanel";
import { ReviewConsole } from "./components/ReviewConsole";
import { ReviewSteps } from "./components/ReviewSteps";
import { ResetConfirmationModal } from "./components/ResetConfirmationModal";
import { SettingsModal } from "./components/SettingsModal";
import { StatusBar } from "./components/StatusBar";
import { WorkflowGraphPanel } from "./components/WorkflowGraphPanel";
import {
  getHumanDecisionLabel,
  getPrimaryActionLabel,
  getWorkflowDocumentStatusLabel,
  Metric,
  statusLabels,
  type CommandItem,
  type SettingsTestStatus
} from "./components/workbench-shared";
import { useAiExplainerController } from "./hooks/useAiExplainerController";
import { useDoctorReviewController } from "./hooks/useDoctorReviewController";
import { useWorkspaceController } from "./hooks/useWorkspaceController";
import { createTranslator } from "./lib/i18n";
import { SAMPLE_WORKFLOWS } from "./lib/sample-workflows";
import {
  clearAiCredentials,
  defaultWorkbenchSettings,
  getAiProviderStatus,
  loadWorkbenchSettings,
  saveWorkbenchSettings,
  type ThemeMode,
  type WorkbenchSettings
} from "./lib/settings";
import {
  buildAiTroubleshootingChecks,
  buildN8nTroubleshootingChecks,
  buildResetActionPlan,
  type N8nTroubleshootingInput
} from "./lib/troubleshooting";
import {
  completeOnboarding,
  createDefaultOnboardingState,
  loadOnboardingState,
  resetOnboardingState,
  saveOnboardingState,
  type OnboardingMode,
  type OnboardingState
} from "./lib/onboarding";
import {
  clearN8nConnections,
  clearN8nSessionApiKey,
  deleteN8nConnection,
  getN8nBaseUrlOrigin,
  getN8nSessionApiKey,
  loadN8nConnections,
  saveN8nConnection,
  saveN8nSessionApiKey,
  type N8nConnectionSettings,
  type SaveN8nConnectionInput
} from "./lib/n8n-connections";
import { createN8nReadonlyClient, type N8nWorkflowListItem } from "./lib/n8n-readonly-client";
import type { WorkflowExplorerItem } from "./components/WorkflowExplorer";

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const resetAiExplainerRef = useRef<() => void>(() => {});
  const [settings, setSettings] = useState<WorkbenchSettings>(defaultWorkbenchSettings);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [onboardingState, setOnboardingState] = useState<OnboardingState>(createDefaultOnboardingState);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [n8nConnections, setN8nConnections] = useState<N8nConnectionSettings[]>([]);
  const [n8nDraft, setN8nDraft] = useState<SaveN8nConnectionInput>({
    label: "",
    baseUrl: "",
    environmentLabel: ""
  });
  const [n8nApiKey, setN8nApiKey] = useState("");
  const [isN8nImportOpen, setIsN8nImportOpen] = useState(false);
  const [n8nImportConnectionId, setN8nImportConnectionId] = useState("");
  const [n8nWorkflowList, setN8nWorkflowList] = useState<N8nWorkflowListItem[]>([]);
  const [selectedN8nWorkflowId, setSelectedN8nWorkflowId] = useState("");
  const [n8nImportStatus, setN8nImportStatus] = useState<"idle" | "loading" | "importing" | "error">("idle");
  const [n8nImportError, setN8nImportError] = useState<string | null>(null);
  const [n8nTroubleshooting, setN8nTroubleshooting] = useState<N8nTroubleshootingInput>({
    proxyReachable: true,
    baseUrl: "",
    apiKeyPresent: false,
    apiKeyAccepted: null,
    n8nReachable: null,
    workflowsListWorks: null,
    selectedWorkflowImportWorks: null,
    excludePinnedDataUsed: true,
    writeEndpointCalled: false
  });
  const [systemTheme, setSystemTheme] = useState<Exclude<ThemeMode, "system">>(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTestStatus, setSettingsTestStatus] = useState<SettingsTestStatus>("idle");
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const t = useMemo(() => createTranslator(settings.language), [settings.language]);
  const aiProviderStatus = getAiProviderStatus(settings.ai);
  const resolvedTheme = settings.theme === "system" ? systemTheme : settings.theme;
  const n8nClient = useMemo(() => createN8nReadonlyClient(fetch, { transport: "proxy" }), []);
  const n8nTroubleshootingChecks = useMemo(
    () => buildN8nTroubleshootingChecks(n8nTroubleshooting),
    [n8nTroubleshooting]
  );
  const aiTroubleshootingChecks = useMemo(
    () =>
      buildAiTroubleshootingChecks({
        settings: settings.ai,
        testRequestStatus:
          settingsTestStatus === "ready" || settingsTestStatus === "fallback" || settingsTestStatus === "testing"
            ? settingsTestStatus
            : "idle"
      }),
    [settings.ai, settingsTestStatus]
  );
  const resetEntireWorkspacePlan = useMemo(() => buildResetActionPlan("entire-workspace"), []);

  const workspace = useWorkspaceController({
    onWorkspaceChanged: () => resetAiExplainerRef.current()
  });
  const doctor = useDoctorReviewController({
    activeDocument: workspace.activeDocument,
    activeReviewPacketArtifacts: workspace.activeReviewPacketArtifacts,
    updateActiveDocument: workspace.updateActiveDocument,
    saveReviewPacketArtifact: workspace.saveReviewPacketArtifact,
    loadWorkspaceSnapshot: workspace.loadWorkspaceSnapshot,
    setError: workspace.setError,
    onReviewChanged: () => resetAiExplainerRef.current()
  });
  const ai = useAiExplainerController({
    aiInput: doctor.aiInput,
    settings,
    setSettingsTestStatus
  });

  const packetExportStatus = doctor.currentPacketArtifact?.exportedAt
    ? t("sidebar.exported")
    : doctor.humanReviewAccepted
      ? t("sidebar.readyToExport")
      : t("sidebar.notExported");
  const explorerItems = useMemo<WorkflowExplorerItem[]>(
    () =>
      workspace.workflowDocuments.map((document) => ({
        id: document.id,
        name: document.displayName,
        sourceLabel: document.sourceLabel,
        sourceKind: document.sourceKind,
        statusLabel: getWorkflowDocumentStatusLabel(document, t),
        humanReviewLabel: getHumanDecisionLabel(document.humanReviewDraft.decision, t),
        packetLabel:
          document.reviewPacketArtifactIds.length > 0
            ? `${document.reviewPacketArtifactIds.length} ${t("explorer.packetCount")}`
            : t("explorer.noPackets"),
        isActive: document.id === workspace.activeWorkflowDocumentId
      })),
    [t, workspace.activeWorkflowDocumentId, workspace.workflowDocuments]
  );
  const primaryActionLabel = getPrimaryActionLabel({
    hasWorkflow: Boolean(doctor.workflowInput),
    hasReport: Boolean(doctor.report),
    hasPatchPreview: doctor.reviewMode === "patched",
    humanReviewAccepted: Boolean(doctor.humanReviewAccepted),
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
      label: t("actions.importDifyDsl"),
      hint: t("command.importDifyHint"),
      disabled: false,
      action: () => {
        fileInputRef.current?.click();
      }
    },
    {
      label: t("actions.importFromN8n"),
      hint: t("command.importN8nHint"),
      disabled: n8nConnections.length === 0,
      action: () => setIsN8nImportOpen(true)
    },
    {
      label: t("actions.runDoctor"),
      hint: t("command.runHint"),
      disabled: !doctor.workflowInput,
      action: doctor.rerunDoctor
    },
    {
      label: t("actions.previewPatchedIr"),
      hint: t("command.previewHint"),
      disabled: !doctor.report || doctor.report.proposal.operations.length === 0 || doctor.reviewMode === "patched",
      action: doctor.previewPatchedIr
    },
    {
      label: t("actions.backToOriginal"),
      hint: t("command.backHint"),
      disabled: !doctor.report || doctor.reviewMode === "original",
      action: doctor.backToOriginal
    },
    {
      label: t("actions.exportReviewPacket"),
      hint: t("command.exportPacketHint"),
      disabled: !doctor.reviewPacket || !doctor.report,
      action: () => void doctor.exportReviewPacket()
    },
    {
      label: t("actions.exportPatchedWorkflowIr"),
      hint: t("command.exportIrHint"),
      disabled: !doctor.report || doctor.reviewMode !== "patched" || doctor.report.proposal.operations.length === 0,
      action: doctor.exportPatchedWorkflowIr
    }
  ];

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

  function persistOnboardingCompletion(preferredMode: OnboardingMode) {
    const nextState = completeOnboarding(onboardingState, { preferredMode });
    setOnboardingState(nextState);
    saveOnboardingState(window.localStorage, nextState);
    setIsOnboardingOpen(false);
  }

  async function handleStartDemoMode() {
    const sample = SAMPLE_WORKFLOWS[0];
    if (!sample) {
      return;
    }
    await workspace.loadSampleWorkflow(sample, { runDoctor: true });
    persistOnboardingCompletion("demo");
  }

  function handleStartN8nOnboarding() {
    persistOnboardingCompletion("n8n-readonly");
    setIsSettingsOpen(true);
  }

  function handleSkipOnboarding() {
    persistOnboardingCompletion(onboardingState.preferredMode);
  }

  function handleCloseOnboarding() {
    setIsOnboardingOpen(false);
  }

  function handleOpenOnboarding() {
    setIsSettingsOpen(false);
    setIsOnboardingOpen(true);
  }

  async function handleTestN8nConnection() {
    const connection =
      getSelectedN8nConnection() ??
      (n8nDraft.baseUrl.trim()
        ? saveN8nConnection(undefined, {
            ...n8nDraft,
            label: n8nDraft.label || "n8n"
          })
        : null);
    if (!connection) {
      setN8nTroubleshooting((current) => ({
        ...current,
        baseUrl: n8nDraft.baseUrl,
        apiKeyPresent: n8nApiKey.trim().length > 0,
        n8nReachable: false,
        apiKeyAccepted: null
      }));
      return;
    }
    const apiKey = getN8nSessionApiKey(window.sessionStorage, connection.connectionId) || n8nApiKey.trim();
    if (!apiKey) {
      setN8nTroubleshooting((current) => ({
        ...current,
        baseUrl: connection.baseUrl,
        apiKeyPresent: false,
        apiKeyAccepted: null,
        n8nReachable: null
      }));
      return;
    }

    try {
      const result = await n8nClient.testConnection({ connection, apiKey });
      setN8nTroubleshooting((current) => ({
        ...current,
        baseUrl: connection.baseUrl,
        apiKeyPresent: true,
        n8nReachable: result.ok,
        apiKeyAccepted: result.ok,
        workflowsListWorks: result.ok
      }));
    } catch {
      setN8nTroubleshooting((current) => ({
        ...current,
        baseUrl: connection.baseUrl,
        apiKeyPresent: true,
        n8nReachable: false,
        apiKeyAccepted: false,
        workflowsListWorks: false
      }));
    }
  }

  async function handleResetEntireWorkspace() {
    await workspace.clearWorkspaceData();
    clearN8nConnections(window.localStorage, window.sessionStorage);
    setN8nConnections([]);
    setN8nImportConnectionId("");
    setN8nWorkflowList([]);
    setSelectedN8nWorkflowId("");
    setN8nDraft({ label: "", baseUrl: "", environmentLabel: "" });
    setN8nApiKey("");
    setN8nTroubleshooting({
      proxyReachable: true,
      baseUrl: "",
      apiKeyPresent: false,
      apiKeyAccepted: null,
      n8nReachable: null,
      workflowsListWorks: null,
      selectedWorkflowImportWorks: null,
      excludePinnedDataUsed: true,
      writeEndpointCalled: false
    });
    saveWorkbenchSettings(window.localStorage, defaultWorkbenchSettings);
    setSettings(defaultWorkbenchSettings);
    resetOnboardingState(window.localStorage);
    const nextOnboardingState = createDefaultOnboardingState();
    setOnboardingState(nextOnboardingState);
    setIsResetConfirmOpen(false);
    setIsOnboardingOpen(true);
  }

  function handleSaveN8nConnection() {
    const connection = saveN8nConnection(window.localStorage, n8nDraft);
    if (n8nApiKey.trim()) {
      saveN8nSessionApiKey(window.sessionStorage, connection.connectionId, n8nApiKey.trim());
    }
    const connections = loadN8nConnections(window.localStorage);
    setN8nConnections(connections);
    setN8nImportConnectionId(connection.connectionId);
    setN8nDraft({
      label: "",
      baseUrl: "",
      environmentLabel: ""
    });
    setN8nApiKey("");
    setN8nTroubleshooting((current) => ({
      ...current,
      baseUrl: connection.baseUrl,
      apiKeyPresent: n8nApiKey.trim().length > 0,
      apiKeyAccepted: null,
      n8nReachable: null,
      workflowsListWorks: null,
      selectedWorkflowImportWorks: null
    }));
  }

  function handleDeleteN8nConnection(connectionId: string) {
    deleteN8nConnection(window.localStorage, window.sessionStorage, connectionId);
    setN8nConnections(loadN8nConnections(window.localStorage));
    if (n8nImportConnectionId === connectionId) {
      setN8nImportConnectionId("");
    }
  }

  function handleClearN8nSessionKey(connectionId: string) {
    clearN8nSessionApiKey(window.sessionStorage, connectionId);
  }

  async function handleListN8nWorkflows() {
    const connection = getSelectedN8nConnection();
    if (!connection) {
      setN8nImportError("No n8n connection selected.");
      return;
    }
    const apiKey = getN8nSessionApiKey(window.sessionStorage, connection.connectionId);
    if (!apiKey) {
      setN8nImportError("n8n API key is only stored for this session. Re-enter it in Settings.");
      return;
    }

    try {
      setN8nImportStatus("loading");
      setN8nImportError(null);
      const workflows = await n8nClient.listWorkflows({ connection, apiKey });
      setN8nWorkflowList(workflows);
      setSelectedN8nWorkflowId(workflows[0]?.id ?? "");
      setN8nImportStatus("idle");
      setN8nTroubleshooting((current) => ({
        ...current,
        baseUrl: connection.baseUrl,
        apiKeyPresent: true,
        apiKeyAccepted: true,
        n8nReachable: true,
        workflowsListWorks: true
      }));
    } catch (error) {
      setN8nImportStatus("error");
      setN8nImportError(error instanceof Error ? error.message : "Unable to list n8n workflows.");
      setN8nTroubleshooting((current) => ({
        ...current,
        baseUrl: connection.baseUrl,
        apiKeyPresent: true,
        apiKeyAccepted: false,
        n8nReachable: false,
        workflowsListWorks: false
      }));
    }
  }

  async function handleImportSelectedN8nWorkflow() {
    const connection = getSelectedN8nConnection();
    if (!connection || !selectedN8nWorkflowId) {
      setN8nImportError("Select an n8n workflow first.");
      return;
    }
    const apiKey = getN8nSessionApiKey(window.sessionStorage, connection.connectionId);
    if (!apiKey) {
      setN8nImportError("n8n API key is only stored for this session. Re-enter it in Settings.");
      return;
    }

    try {
      setN8nImportStatus("importing");
      setN8nImportError(null);
      const rawWorkflow = await n8nClient.getWorkflow({ connection, apiKey, workflowId: selectedN8nWorkflowId });
      const imported = importN8nReadonlyPayload(rawWorkflow);
      const now = new Date().toISOString();
      await workspace.importN8nReadonlyWorkflow({
        workflow: imported.workflow,
        sourceLabel: connection.label,
        readOnlySource: {
          provider: "n8n",
          connectionId: connection.connectionId,
          connectionLabel: connection.label,
          ...(connection.environmentLabel ? { environmentLabel: connection.environmentLabel } : {}),
          baseUrlOrigin: getN8nBaseUrlOrigin(connection.baseUrl),
          externalWorkflowId: imported.metadata.externalWorkflowId ?? selectedN8nWorkflowId,
          importedAt: now,
          lastFetchedAt: now,
          ...(imported.metadata.upstreamUpdatedAt ? { upstreamUpdatedAt: imported.metadata.upstreamUpdatedAt } : {}),
          ...(imported.metadata.upstreamVersionId ? { upstreamVersionId: imported.metadata.upstreamVersionId } : {}),
          ...(typeof imported.metadata.active === "boolean" ? { upstreamActive: imported.metadata.active } : {}),
          upstreamTags: imported.metadata.tags
        }
      });
      setIsN8nImportOpen(false);
      setN8nImportStatus("idle");
      setN8nTroubleshooting((current) => ({
        ...current,
        selectedWorkflowImportWorks: true
      }));
    } catch (error) {
      setN8nImportStatus("error");
      setN8nImportError(error instanceof Error ? error.message : "Unable to import selected n8n workflow.");
      setN8nTroubleshooting((current) => ({
        ...current,
        selectedWorkflowImportWorks: false
      }));
    }
  }

  async function handleRefreshActiveN8nWorkflow() {
    const readOnlySource = workspace.activeDocument?.readOnlySource;
    if (!readOnlySource) {
      return;
    }
    const connection = n8nConnections.find((item) => item.connectionId === readOnlySource.connectionId);
    if (!connection) {
      workspace.setError("The n8n connection for this workflow was deleted.");
      return;
    }
    const apiKey = getN8nSessionApiKey(window.sessionStorage, connection.connectionId);
    if (!apiKey) {
      workspace.setError("n8n API key is only stored for this session. Re-enter it in Settings.");
      return;
    }

    const rawWorkflow = await n8nClient.getWorkflow({
      connection,
      apiKey,
      workflowId: readOnlySource.externalWorkflowId
    });
    const imported = importN8nReadonlyPayload(rawWorkflow);
    await workspace.refreshN8nReadonlyDocument({
      workflow: imported.workflow,
      ...(imported.metadata.upstreamUpdatedAt ? { upstreamUpdatedAt: imported.metadata.upstreamUpdatedAt } : {}),
      ...(imported.metadata.upstreamVersionId ? { upstreamVersionId: imported.metadata.upstreamVersionId } : {}),
      ...(typeof imported.metadata.active === "boolean" ? { upstreamActive: imported.metadata.active } : {}),
      upstreamTags: imported.metadata.tags
    });
  }

  function getSelectedN8nConnection() {
    return n8nConnections.find((connection) => connection.connectionId === n8nImportConnectionId) ?? n8nConnections[0] ?? null;
  }

  function handlePrimaryAction() {
    if (!doctor.workflowInput) {
      fileInputRef.current?.click();
      return;
    }

    if (!doctor.report) {
      doctor.rerunDoctor();
      return;
    }

    if (doctor.humanReviewAccepted) {
      void doctor.exportReviewPacket();
      return;
    }

    if (doctor.reviewMode !== "patched") {
      doctor.previewPatchedIr();
      return;
    }

    doctor.updateActiveTab("verification");
  }

  async function handleImportWorkflowFile(file: File | undefined) {
    await workspace.importWorkflow(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  useEffect(() => {
    const loadHandle = window.setTimeout(() => {
      setSettings(loadWorkbenchSettings(window.localStorage));
      const loadedOnboardingState = loadOnboardingState(window.localStorage);
      setOnboardingState(loadedOnboardingState);
      setIsOnboardingOpen(!loadedOnboardingState.completed);
      const connections = loadN8nConnections(window.localStorage);
      setN8nConnections(connections);
      setN8nImportConnectionId(connections[0]?.connectionId ?? "");
      setN8nTroubleshooting((current) => ({
        ...current,
        baseUrl: connections[0]?.baseUrl ?? "",
        apiKeyPresent: connections[0]
          ? getN8nSessionApiKey(window.sessionStorage, connections[0].connectionId).trim().length > 0
          : false
      }));
      setSettingsLoaded(true);
    }, 0);

    return () => window.clearTimeout(loadHandle);
  }, []);

  useEffect(() => {
    resetAiExplainerRef.current = ai.resetAiExplainer;
  }, [ai.resetAiExplainer]);

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
      <ReviewSteps
        fileInputRef={fileInputRef}
        workflows={explorerItems}
        samples={SAMPLE_WORKFLOWS}
        workspaceLoaded={workspace.workspaceLoaded}
        workflowInput={doctor.workflowInput}
        report={doctor.report}
        reviewMode={doctor.reviewMode}
        reviewTargetFingerprint={doctor.reviewPacket?.reviewTargetFingerprint ?? null}
        packetExportStatus={packetExportStatus}
        primaryActionLabel={primaryActionLabel}
        stepStatuses={doctor.stepStatuses}
        request={doctor.request}
        isReportStale={doctor.isReportStale}
        error={workspace.error}
        humanDecision={doctor.humanDecision}
        sourceKind={workspace.activeDocument?.sourceKind}
        sourceLabel={workspace.activeDocument?.sourceLabel}
        t={t}
        onImportFile={(file) => void handleImportWorkflowFile(file)}
        onImportClick={() => fileInputRef.current?.click()}
        onImportN8nClick={() => setIsN8nImportOpen(true)}
        onLoadSample={(sample) => void workspace.loadSampleWorkflow(sample)}
        onSelectWorkflow={(workflowDocumentId) => void workspace.selectWorkflowDocument(workflowDocumentId)}
        onPrimaryAction={handlePrimaryAction}
        onRequestChange={doctor.updatePatchRequest}
        onRunDoctor={doctor.rerunDoctor}
        onRefreshN8n={() => void handleRefreshActiveN8nWorkflow()}
      />

      <section className="workspace" aria-label={t("workspace.label")}>
        <header className="workspace-header">
          <div>
            <p>{t("workspace.graph")}</p>
            <h2>{doctor.activeWorkflow?.name ?? t("workspace.importPrompt")}</h2>
          </div>
          <div className="workbench-actions" aria-label="Workbench actions">
            <button type="button" onClick={() => setIsCommandPaletteOpen(true)}>
              {t("toolbar.commandPalette")}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOnboardingOpen(false);
                setIsSettingsOpen(true);
              }}
            >
              {t("toolbar.settings")}
            </button>
          </div>
          <div className="metric-strip" aria-label="Review metrics">
            <Metric label={t("toolbar.metrics.nodes")} value={String(doctor.activeWorkflow?.nodes.length ?? 0)} />
            <Metric label={t("toolbar.metrics.risks")} value={doctor.report ? String(doctor.activeIssues.length) : "-"} />
            <Metric label={t("toolbar.metrics.patchOps")} value={doctor.report ? String(doctor.report.proposal.operations.length) : "-"} />
            <Metric
              label={t("toolbar.metrics.verifierStatus")}
              value={doctor.report ? statusLabels[doctor.report.verification.status] : t("toolbar.notRun")}
              {...(doctor.report ? { tone: doctor.report.verification.status } : {})}
            />
          </div>
        </header>

        <WorkflowGraphPanel
          activeWorkflow={doctor.activeWorkflow}
          activeView={doctor.activeView}
          activeIssues={doctor.activeIssues}
          selectedNodeId={doctor.selectedNodeId}
          reviewMode={doctor.reviewMode}
          samples={SAMPLE_WORKFLOWS}
          t={t}
          onNodeSelect={doctor.updateSelectedNodeId}
          onImportClick={() => fileInputRef.current?.click()}
          onLoadSample={(sample) => void workspace.loadSampleWorkflow(sample)}
        />

        <ReviewConsole
          activeTab={doctor.activeTab}
          activeSummary={doctor.activeSummary}
          activeIssues={doctor.activeIssues}
          activeWorkflow={doctor.activeWorkflow}
          report={doctor.report}
          reviewMode={doctor.reviewMode}
          reviewPacket={doctor.reviewPacket}
          requiredChecklistItems={doctor.requiredChecklistItems}
          confirmedChecklistItemIds={doctor.confirmedChecklistItemIds}
          canAcceptHumanReview={doctor.canAcceptHumanReview}
          humanDecision={doctor.humanDecision}
          humanReviewNote={doctor.humanReviewNote}
          aiResult={ai.aiResult}
          aiStatus={ai.aiStatus}
          aiError={ai.aiError}
          aiPatchProposalState={doctor.aiPatchProposalState}
          aiPatchValidation={doctor.aiPatchValidation}
          t={t}
          onTabChange={doctor.updateActiveTab}
          onGenerateAiExplanation={() => void ai.generateAiExplanation()}
          onGenerateAiPatchProposal={() => void doctor.generateAiPatchProposal(settings.ai)}
          onPreviewPatchedIr={doctor.previewPatchedIr}
          onPreviewAiPatchProposal={doctor.previewAiPatchProposal}
          onBackToOriginal={doctor.backToOriginal}
          onToggleChecklistConfirmation={doctor.toggleChecklistConfirmation}
          onRecordHumanDecision={doctor.recordHumanDecision}
          onHumanReviewNoteChange={doctor.updateHumanReviewNote}
          onExportReviewPacket={() => void doctor.exportReviewPacket()}
          onExportPatchedWorkflowIr={doctor.exportPatchedWorkflowIr}
        />
      </section>

      <InspectorPanel
        workflow={doctor.activeWorkflow}
        summary={doctor.activeSummary}
        activeView={doctor.activeView}
        activeIssues={doctor.activeIssues}
        selectedNodeId={doctor.selectedNodeId}
        patchDiff={doctor.report?.patchDiff ?? []}
        t={t}
      />

      <StatusBar
        verifierStatus={doctor.report?.verification.status}
        reviewMode={doctor.reviewMode}
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

      {isN8nImportOpen ? (
        <section className="modal-overlay" role="presentation">
          <div className="settings-modal n8n-import-modal" role="dialog" aria-modal="true" aria-label={t("actions.importFromN8n")}>
            <header>
              <div>
                <span>{t("explorer.n8nReadonly")}</span>
                <h2>{t("actions.importFromN8n")}</h2>
              </div>
              <button type="button" onClick={() => setIsN8nImportOpen(false)} aria-label={t("actions.close")}>
                {t("actions.close")}
              </button>
            </header>
            <div className="settings-body">
              <section className="settings-section">
                <h3>{t("n8nImport.warningTitle")}</h3>
                <p className="settings-help">{t("n8nImport.warningBody")}</p>
                <label>
                  <span>{t("n8nImport.connection")}</span>
                  <select
                    value={n8nImportConnectionId}
                    onChange={(event) => {
                      setN8nImportConnectionId(event.target.value);
                      setN8nWorkflowList([]);
                      setSelectedN8nWorkflowId("");
                    }}
                  >
                    {n8nConnections.map((connection) => (
                      <option key={connection.connectionId} value={connection.connectionId}>
                        {connection.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="settings-actions">
                  <button
                    type="button"
                    onClick={() => void handleListN8nWorkflows()}
                    disabled={n8nImportStatus === "loading" || n8nConnections.length === 0}
                  >
                    {n8nImportStatus === "loading" ? t("actions.loading") : t("actions.listN8nWorkflows")}
                  </button>
                </div>
              </section>

              {n8nWorkflowList.length > 0 ? (
                <section className="settings-section">
                  <h3>{t("n8nImport.workflowList")}</h3>
                  <ul className="connection-list">
                    {n8nWorkflowList.map((workflow) => (
                      <li key={workflow.id}>
                        <button
                          type="button"
                          className={selectedN8nWorkflowId === workflow.id ? "is-selected" : ""}
                          onClick={() => setSelectedN8nWorkflowId(workflow.id)}
                        >
                          <strong>{workflow.name}</strong>
                          <small>
                            {workflow.active ? t("n8nImport.active") : t("n8nImport.inactive")}
                            {workflow.updatedAt ? ` · ${workflow.updatedAt}` : ""}
                          </small>
                          {workflow.tags.length > 0 ? <small>{workflow.tags.join(", ")}</small> : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="settings-actions">
                    <button
                      type="button"
                      onClick={() => void handleImportSelectedN8nWorkflow()}
                      disabled={!selectedN8nWorkflowId || n8nImportStatus === "importing"}
                    >
                      {n8nImportStatus === "importing" ? t("actions.importing") : t("actions.importLocalReviewCopy")}
                    </button>
                  </div>
                </section>
              ) : null}

              {n8nImportError ? <p className="error-text">{n8nImportError}</p> : null}
            </div>
          </div>
        </section>
      ) : null}

      {isSettingsOpen ? (
        <SettingsModal
          settings={settings}
          workspaceStatus={doctor.report ? t("settings.workspaceReportReady") : doctor.workflowInput ? t("settings.workspaceLoaded") : t("settings.workspaceEmpty")}
          testStatus={settingsTestStatus}
          t={t}
          onSettingsChange={updateSettings}
          n8nConnections={n8nConnections}
          n8nDraft={n8nDraft}
          n8nApiKey={n8nApiKey}
          onTestConnection={() => void ai.testAiConnection()}
          onClearCredentials={clearCredentials}
          onN8nDraftChange={setN8nDraft}
          onN8nApiKeyChange={setN8nApiKey}
          onSaveN8nConnection={handleSaveN8nConnection}
          onDeleteN8nConnection={handleDeleteN8nConnection}
          onClearN8nSessionKey={handleClearN8nSessionKey}
          onClearWorkspaceData={() => void workspace.clearWorkspaceData()}
          onTestN8nConnection={() => void handleTestN8nConnection()}
          onOpenOnboarding={handleOpenOnboarding}
          onResetEntireWorkspace={() => setIsResetConfirmOpen(true)}
          n8nTroubleshootingChecks={n8nTroubleshootingChecks}
          aiTroubleshootingChecks={aiTroubleshootingChecks}
          onClose={() => setIsSettingsOpen(false)}
        />
      ) : null}

      {isOnboardingOpen ? (
        <OnboardingPanel
          onStartDemo={() => void handleStartDemoMode()}
          onStartN8n={handleStartN8nOnboarding}
          onSkip={handleSkipOnboarding}
          onClose={handleCloseOnboarding}
        />
      ) : null}

      {isResetConfirmOpen ? (
        <ResetConfirmationModal
          plan={resetEntireWorkspacePlan}
          t={t}
          onConfirm={() => void handleResetEntireWorkspace()}
          onCancel={() => setIsResetConfirmOpen(false)}
        />
      ) : null}
    </main>
  );
}
