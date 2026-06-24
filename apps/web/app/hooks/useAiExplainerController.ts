import { useState } from "react";
import {
  createDeterministicWorkflowExplanation,
  type WorkflowExplanationInput,
  type WorkflowExplanationResult
} from "@openworkflowdoctor/workflow-ai";
import { toRequestProviderSettings, type WorkbenchSettings } from "../lib/settings";
import type { AiExplainerStatus, SettingsTestStatus } from "../components/workbench-shared";

export function useAiExplainerController({
  aiInput,
  settings,
  setSettingsTestStatus
}: {
  aiInput: WorkflowExplanationInput | null;
  settings: WorkbenchSettings;
  setSettingsTestStatus: (status: SettingsTestStatus) => void;
}) {
  const [aiResult, setAiResult] = useState<WorkflowExplanationResult | null>(null);
  const [aiStatus, setAiStatus] = useState<AiExplainerStatus>("idle");
  const [aiError, setAiError] = useState<string | null>(null);

  function resetAiExplainer() {
    setAiResult(null);
    setAiStatus("idle");
    setAiError(null);
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

  return {
    aiResult,
    aiStatus,
    aiError,
    resetAiExplainer,
    generateAiExplanation,
    testAiConnection
  };
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
