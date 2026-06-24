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

  test("uses provider preset transport without leaking API key in response", async () => {
    const input = buildAiPatchProposalInput(createDoctorReport(rawWorkflow, "Patch"), { request: "Patch" });
    const candidate = createValidCandidate(input.inputFingerprint);
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(String(_url)).toBe("https://ark.cn-beijing.volces.com/api/v3/chat/completions");
      expect(String(init?.body)).toContain('"response_format":{"type":"json_object"}');
      expect(init?.headers).toMatchObject({
        Authorization: "Bearer sk-local-browser-only"
      });
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(candidate) } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://localhost/api/ai/patch", {
        method: "POST",
        body: JSON.stringify({
          input,
          provider: {
            enabled: true,
            providerType: "openai-compatible",
            providerPreset: "volcengine-ark",
            baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
            apiKey: "sk-local-browser-only",
            model: "doubao-seed-2-0-pro-260215",
            transport: "chat_completions",
            responseFormat: "json_object"
          }
        })
      })
    );
    const result = await response.json();

    expect(result.source).toBe("ai");
    expect(JSON.stringify(result)).not.toContain("sk-local-browser-only");
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

function createValidCandidate(inputFingerprint: string) {
  return {
    schemaVersion: "openworkflowdoctor.ai-patch-proposal.v1",
    source: "ai",
    createdAt: "2026-06-24T00:00:00.000Z",
    inputFingerprint,
    proposal: {
      summary: "Review-only proposal.",
      operations: [],
      risksAddressed: [],
      expectedImpact: [],
      risksIntroduced: [],
      requiresHumanReview: true
    },
    conflicts: [],
    safetyNotes: []
  };
}
