"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CommandPalette } from "./components/CommandPalette";
import { InspectorPanel } from "./components/InspectorPanel";
import { ReviewConsole } from "./components/ReviewConsole";
import { ReviewSteps } from "./components/ReviewSteps";
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
import type { WorkflowExplorerItem } from "./components/WorkflowExplorer";

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const resetAiExplainerRef = useRef<() => void>(() => {});
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
  const t = useMemo(() => createTranslator(settings.language), [settings.language]);
  const aiProviderStatus = getAiProviderStatus(settings.ai);
  const resolvedTheme = settings.theme === "system" ? systemTheme : settings.theme;

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
        t={t}
        onImportFile={(file) => void handleImportWorkflowFile(file)}
        onImportClick={() => fileInputRef.current?.click()}
        onLoadSample={(sample) => void workspace.loadSampleWorkflow(sample)}
        onSelectWorkflow={(workflowDocumentId) => void workspace.selectWorkflowDocument(workflowDocumentId)}
        onPrimaryAction={handlePrimaryAction}
        onRequestChange={doctor.updatePatchRequest}
        onRunDoctor={doctor.rerunDoctor}
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
            <button type="button" onClick={() => setIsSettingsOpen(true)}>
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
          t={t}
          onTabChange={doctor.updateActiveTab}
          onGenerateAiExplanation={() => void ai.generateAiExplanation()}
          onPreviewPatchedIr={doctor.previewPatchedIr}
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

      {isSettingsOpen ? (
        <SettingsModal
          settings={settings}
          workspaceStatus={doctor.report ? t("settings.workspaceReportReady") : doctor.workflowInput ? t("settings.workspaceLoaded") : t("settings.workspaceEmpty")}
          testStatus={settingsTestStatus}
          t={t}
          onSettingsChange={updateSettings}
          onTestConnection={() => void ai.testAiConnection()}
          onClearCredentials={clearCredentials}
          onClearWorkspaceData={() => void workspace.clearWorkspaceData()}
          onClose={() => setIsSettingsOpen(false)}
        />
      ) : null}
    </main>
  );
}
