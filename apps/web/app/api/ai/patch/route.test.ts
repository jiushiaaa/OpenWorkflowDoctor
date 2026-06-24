import { buildAiPatchProposalInput, createDoctorReport } from "@openworkflowdoctor/workflow-ir";
import { describe, expect, test, vi } from "vitest";
import { POST } from "./route";

const rawWorkflow = {
  name: "Patch Route Test Workflow",
  nodes: [
    {
      id: "webhook",
      name: "Webhook Trigger",
      type: "n8n-nodes-base.webhook",
      parameters: {}
    }
  ],
  connections: {}
};

describe("/api/ai/patch", () => {
  test("returns unavailable when no user API key is configured", async () => {
    const input = buildAiPatchProposalInput(createDoctorReport(rawWorkflow, "Patch"), { request: "Patch" });
    const response = await POST(
      new Request("http://localhost/api/ai/patch", {
        method: "POST",
        body: JSON.stringify({
          input,
          provider: {
            enabled: true,
            providerType: "openai-compatible",
            baseUrl: "https://api.openai.com/v1",
            apiKey: "",
            model: "gpt-4.1-mini"
          }
        })
      })
    );
    const result = await response.json();

    expect(result).toEqual({
      source: "unavailable",
      unavailableReason: "No AI provider configured."
    });
  });

  test("does not use environment OPENAI_API_KEY as browser configuration", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-env-must-not-be-used");
    const input = buildAiPatchProposalInput(createDoctorReport(rawWorkflow, "Patch"), { request: "Patch" });
    const response = await POST(
      new Request("http://localhost/api/ai/patch", {
        method: "POST",
        body: JSON.stringify({ input })
      })
    );
    const result = await response.json();

    expect(result.source).toBe("unavailable");
    expect(result.unavailableReason).toBe("No AI provider configured.");
  });
});
