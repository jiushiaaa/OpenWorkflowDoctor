import { describe, expect, test, vi } from "vitest";
import { POST } from "./route";

function createRequest(body: unknown) {
  return new Request("http://localhost/api/n8n/readonly", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

describe("/api/n8n/readonly", () => {
  test("lists workflows through the allowlisted n8n GET endpoint with pinned data excluded", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe("https://n8n.example.test/api/v1/workflows?excludePinnedData=true");
      expect(init?.method).toBe("GET");
      expect(init?.headers).toEqual({
        Accept: "application/json",
        "X-N8N-API-KEY": "n8n-session-key"
      });
      return Response.json({
        data: [{ id: "wf_1", name: "Real Workflow" }],
        nextCursor: null
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      createRequest({
        action: "listWorkflows",
        connection: {
          baseUrl: "https://n8n.example.test/api/v1",
          authHeaderName: "X-N8N-API-KEY"
        },
        apiKey: "n8n-session-key"
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [{ id: "wf_1", name: "Real Workflow" }],
      nextCursor: null
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test("gets one workflow through the allowlisted n8n GET endpoint", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe("https://n8n.example.test/api/v1/workflows/wf_1?excludePinnedData=true");
      expect(init?.method).toBe("GET");
      return Response.json({ id: "wf_1", name: "Selected Workflow", nodes: [], connections: {} });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      createRequest({
        action: "getWorkflow",
        connection: {
          baseUrl: "https://n8n.example.test/api/v1",
          authHeaderName: "X-N8N-API-KEY"
        },
        apiKey: "n8n-session-key",
        workflowId: "wf_1"
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: "wf_1",
      name: "Selected Workflow"
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test("rejects unsafe actions, methods, workflow ids, and forbidden endpoint-shaped ids before fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    for (const body of [
      {
        action: "deleteWorkflow",
        connection: { baseUrl: "https://n8n.example.test/api/v1", authHeaderName: "X-N8N-API-KEY" },
        apiKey: "n8n-session-key"
      },
      {
        action: "getWorkflow",
        connection: { baseUrl: "https://n8n.example.test/api/v1", authHeaderName: "X-N8N-API-KEY" },
        apiKey: "n8n-session-key",
        workflowId: "../credentials"
      },
      {
        action: "getWorkflow",
        connection: { baseUrl: "https://n8n.example.test/api/v1", authHeaderName: "X-N8N-API-KEY" },
        apiKey: "n8n-session-key",
        workflowId: "executions"
      },
      {
        action: "listWorkflows",
        connection: { baseUrl: "https://n8n.example.test/api/v1/workflows", authHeaderName: "X-N8N-API-KEY" },
        apiKey: "n8n-session-key"
      }
    ]) {
      const response = await POST(createRequest(body));
      expect(response.status).toBe(400);
    }

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("does not expose the n8n API key in proxy error responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Unauthorized n8n-session-key", { status: 401 }))
    );

    const response = await POST(
      createRequest({
        action: "listWorkflows",
        connection: {
          baseUrl: "https://n8n.example.test/api/v1",
          authHeaderName: "X-N8N-API-KEY"
        },
        apiKey: "n8n-session-key"
      })
    );
    const resultText = JSON.stringify(await response.json());

    expect(response.status).toBe(502);
    expect(resultText).not.toContain("n8n-session-key");
  });
});
