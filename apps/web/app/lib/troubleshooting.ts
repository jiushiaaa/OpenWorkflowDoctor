import { maskApiKey, type AiProviderSettings } from "./settings";

export type TroubleshootingStatus = "pass" | "hold" | "fail" | "pending";

export type TroubleshootingCheck = {
  id: string;
  label: string;
  status: TroubleshootingStatus;
  detail: string;
  action?: string | undefined;
};

export type N8nTroubleshootingInput = {
  proxyReachable: boolean;
  baseUrl: string;
  apiKeyPresent: boolean;
  apiKeyAccepted: boolean | null;
  n8nReachable: boolean | null;
  workflowsListWorks: boolean | null;
  selectedWorkflowImportWorks: boolean | null;
  excludePinnedDataUsed: boolean;
  writeEndpointCalled: boolean;
};

export type AiTroubleshootingInput = {
  settings: AiProviderSettings;
  testRequestStatus: "idle" | "testing" | "ready" | "fallback" | "error";
};

export type ResetActionKind =
  | "imported-workflows"
  | "n8n-connection"
  | "ai-provider"
  | "onboarding"
  | "entire-workspace";

export type ResetActionPlan = {
  kind: ResetActionKind;
  title: string;
  removes: string[];
  preserves: string[];
};

export function buildN8nTroubleshootingChecks(input: N8nTroubleshootingInput): TroubleshootingCheck[] {
  const baseUrlValid = isValidN8nApiUrl(input.baseUrl);

  return [
    {
      id: "local-proxy",
      label: "Local proxy reachable",
      status: input.proxyReachable ? "pass" : "fail",
      detail: input.proxyReachable
        ? "The in-app read-only proxy endpoint is available."
        : "The app could not reach its local read-only proxy endpoint.",
      action: input.proxyReachable ? undefined : "Reload the app or restart the local Docker/Node process."
    },
    {
      id: "base-url",
      label: "n8n base URL valid",
      status: baseUrlValid ? "pass" : "fail",
      detail: baseUrlValid
        ? "The n8n URL is a valid http(s) API URL."
        : "The n8n URL must be an http(s) URL ending in /api/v1.",
      action: baseUrlValid ? undefined : "Use the n8n instance URL or API root, for example http://localhost:5678/api/v1."
    },
    {
      id: "n8n-reachable",
      label: "n8n reachable through proxy",
      status: baseUrlValid ? toStatus(input.n8nReachable, true) : "fail",
      detail: input.n8nReachable
        ? "n8n responded to a read-only workflow request."
        : "n8n has not responded successfully through the local proxy.",
      action: input.n8nReachable ? undefined : "Check the n8n URL, local network, and whether n8n is running."
    },
    {
      id: "api-key-present",
      label: "API key present",
      status: input.apiKeyPresent ? "pass" : "fail",
      detail: input.apiKeyPresent
        ? "A session-only API key is available for this browser tab."
        : "No session-only n8n API key is available.",
      action: input.apiKeyPresent ? undefined : "Enter an n8n API key in Settings. It is kept in sessionStorage only."
    },
    {
      id: "api-key-accepted",
      label: "API key accepted",
      status: toStatus(input.apiKeyAccepted, input.apiKeyPresent),
      detail: input.apiKeyAccepted
        ? "n8n accepted the session API key."
        : "The key has not been accepted by n8n yet.",
      action: input.apiKeyAccepted ? undefined : "Test the connection or generate a fresh n8n API key."
    },
    {
      id: "workflows-list",
      label: "Workflows list endpoint works",
      status: toStatus(input.workflowsListWorks, input.apiKeyAccepted === true),
      detail: input.workflowsListWorks
        ? "The read-only workflow list endpoint returned data."
        : "The workflow list endpoint has not returned data yet."
    },
    {
      id: "selected-workflow-import",
      label: "Selected workflow import works",
      status: toStatus(input.selectedWorkflowImportWorks, input.workflowsListWorks === true),
      detail: input.selectedWorkflowImportWorks
        ? "The selected workflow can be imported as a local review copy."
        : "Select a workflow and import it as a local review copy."
    },
    {
      id: "exclude-pinned-data",
      label: "excludePinnedData=true",
      status: input.excludePinnedDataUsed ? "pass" : "fail",
      detail: input.excludePinnedDataUsed
        ? "Read-only n8n requests exclude pinned data."
        : "Read-only n8n requests must exclude pinned data."
    },
    {
      id: "no-write-endpoint",
      label: "No write endpoint called",
      status: input.writeEndpointCalled ? "fail" : "pass",
      detail: input.writeEndpointCalled
        ? "A write-like endpoint was detected and must be blocked."
        : "Only read-only workflow endpoints are used."
    }
  ];
}

export function buildAiTroubleshootingChecks(input: AiTroubleshootingInput): TroubleshootingCheck[] {
  const apiKey = input.settings.apiKey.trim();

  return [
    {
      id: "provider-selected",
      label: "Provider selected",
      status: input.settings.providerPreset.trim() ? "pass" : "fail",
      detail: input.settings.providerPreset.trim()
        ? `Provider preset: ${input.settings.providerPreset}`
        : "Choose an OpenAI-compatible provider preset."
    },
    {
      id: "base-url-present",
      label: "Base URL present",
      status: input.settings.baseUrl.trim() ? "pass" : "fail",
      detail: input.settings.baseUrl.trim() ? input.settings.baseUrl.trim() : "Enter a provider base URL."
    },
    {
      id: "model-present",
      label: "Model present",
      status: input.settings.model.trim() ? "pass" : "fail",
      detail: input.settings.model.trim() ? input.settings.model.trim() : "Enter a model name."
    },
    {
      id: "api-key-present",
      label: "API key present and masked",
      status: apiKey ? "pass" : "hold",
      detail: apiKey
        ? `Stored locally as ${maskApiKey(apiKey)}.`
        : "No API key is configured; diagnostics-only mode is still available."
    },
    {
      id: "test-request",
      label: "Lightweight test request",
      status: mapTestRequestStatus(input.testRequestStatus),
      detail: getTestRequestDetail(input.testRequestStatus)
    },
    {
      id: "diagnostics-fallback",
      label: "Diagnostics-only fallback available",
      status: "pass",
      detail: "Rule-based diagnostics and verifier checks work without AI."
    }
  ];
}

export function buildResetActionPlan(kind: ResetActionKind): ResetActionPlan {
  if (kind === "imported-workflows") {
    return {
      kind,
      title: "Clear imported workflows",
      removes: ["imported workflows and review packets"],
      preserves: ["n8n connection config", "AI provider config", "first-run onboarding state", "bundled demo workflows"]
    };
  }

  if (kind === "n8n-connection") {
    return {
      kind,
      title: "Clear n8n connection config",
      removes: ["n8n connection config", "session-only n8n API keys"],
      preserves: ["imported workflows and review packets", "AI provider config", "bundled demo workflows"]
    };
  }

  if (kind === "ai-provider") {
    return {
      kind,
      title: "Clear AI provider config",
      removes: ["AI provider config and API key"],
      preserves: ["imported workflows and review packets", "n8n connection config", "bundled demo workflows"]
    };
  }

  if (kind === "onboarding") {
    return {
      kind,
      title: "Reset first-run onboarding",
      removes: ["first-run onboarding state"],
      preserves: ["imported workflows and review packets", "n8n connection config", "AI provider config", "bundled demo workflows"]
    };
  }

  return {
    kind,
    title: "Reset entire local workspace",
    removes: [
      "imported workflows and review packets",
      "n8n connection config",
      "session-only n8n API keys",
      "AI provider config and API key",
      "first-run onboarding state"
    ],
    preserves: ["bundled demo workflows", "application source files"]
  };
}

function toStatus(value: boolean | null, prerequisiteMet: boolean): TroubleshootingStatus {
  if (!prerequisiteMet) {
    return "pending";
  }
  if (value === null) {
    return "pending";
  }
  return value ? "pass" : "fail";
}

function isValidN8nApiUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && /\/api\/v\d+$/u.test(parsed.pathname);
  } catch {
    return false;
  }
}

function mapTestRequestStatus(status: AiTroubleshootingInput["testRequestStatus"]): TroubleshootingStatus {
  if (status === "ready") {
    return "pass";
  }
  if (status === "fallback") {
    return "hold";
  }
  if (status === "error") {
    return "fail";
  }
  return "pending";
}

function getTestRequestDetail(status: AiTroubleshootingInput["testRequestStatus"]): string {
  switch (status) {
    case "ready":
      return "The provider test request completed successfully.";
    case "fallback":
      return "The provider returned a deterministic fallback.";
    case "error":
      return "The provider test request failed. Check the base URL, key, and model.";
    case "testing":
      return "Testing provider connectivity.";
    default:
      return "Run a lightweight test request when provider config is available.";
  }
}
