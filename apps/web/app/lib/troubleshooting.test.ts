import { describe, expect, test } from "vitest";
import { defaultWorkbenchSettings } from "./settings";
import {
  buildAiTroubleshootingChecks,
  buildN8nTroubleshootingChecks,
  buildResetActionPlan
} from "./troubleshooting";

describe("troubleshooting checks", () => {
  test("returns actionable n8n failures without calling write endpoints", () => {
    const checks = buildN8nTroubleshootingChecks({
      proxyReachable: true,
      baseUrl: "not a url",
      apiKeyPresent: false,
      apiKeyAccepted: false,
      n8nReachable: false,
      workflowsListWorks: false,
      selectedWorkflowImportWorks: false,
      excludePinnedDataUsed: true,
      writeEndpointCalled: false
    });

    expect(checks.map((check) => [check.id, check.status])).toEqual([
      ["local-proxy", "pass"],
      ["base-url", "fail"],
      ["n8n-reachable", "fail"],
      ["api-key-present", "fail"],
      ["api-key-accepted", "pending"],
      ["workflows-list", "pending"],
      ["selected-workflow-import", "pending"],
      ["exclude-pinned-data", "pass"],
      ["no-write-endpoint", "pass"]
    ]);
    expect(checks.find((check) => check.id === "base-url")?.action).toContain("/api/v1");
    expect(JSON.stringify(checks)).not.toContain("sk-");
    expect(JSON.stringify(checks)).not.toContain("n8n-session-key");
  });

  test("shows AI diagnostics fallback when provider config is missing", () => {
    const checks = buildAiTroubleshootingChecks({
      settings: {
        ...defaultWorkbenchSettings.ai,
        enabled: false,
        apiKey: ""
      },
      testRequestStatus: "idle"
    });

    expect(checks.map((check) => [check.id, check.status])).toEqual([
      ["provider-selected", "pass"],
      ["base-url-present", "pass"],
      ["model-present", "pass"],
      ["api-key-present", "hold"],
      ["test-request", "pending"],
      ["diagnostics-fallback", "pass"]
    ]);
    expect(checks.find((check) => check.id === "api-key-present")?.detail).toContain("diagnostics-only");
  });

  test("describes reset actions before destructive local cleanup", () => {
    const plan = buildResetActionPlan("entire-workspace");

    expect(plan.title).toBe("Reset entire local workspace");
    expect(plan.removes).toEqual([
      "imported workflows and review packets",
      "n8n connection config",
      "session-only n8n API keys",
      "AI provider config and API key",
      "first-run onboarding state"
    ]);
    expect(plan.preserves).toContain("bundled demo workflows");
  });
});
