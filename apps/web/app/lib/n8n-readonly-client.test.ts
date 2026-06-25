import { describe, expect, test } from "vitest";
import { createN8nReadonlyClient } from "./n8n-readonly-client";
import type { N8nConnectionSettings } from "./n8n-connections";

type FetchCall = {
  url: string;
  init: RequestInit | undefined;
};

const connection: N8nConnectionSettings = {
  connectionId: "conn_1",
  label: "Production n8n",
  baseUrl: "https://n8n.example.test/api/v1",
  authHeaderName: "X-N8N-API-KEY",
  createdAt: "2026-06-25T02:00:00.000Z",
  lastConnectionStatus: "untested"
};

function createFetchStub(responses: unknown[]) {
  const calls: FetchCall[] = [];
  const fetchStub = async (input: string | URL | Request, init?: RequestInit) => {
    const responseBody = responses.shift();
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  return { calls, fetchStub };
}

describe("createN8nReadonlyClient", () => {
  test("lists workflows through GET /workflows with excludePinnedData and pagination", async () => {
    const { calls, fetchStub } = createFetchStub([
      {
        data: [{ id: "wf_1", name: "First", active: true, updatedAt: "2026-06-25T01:00:00.000Z" }],
        nextCursor: "next-page"
      },
      {
        data: [{ id: "wf_2", name: "Second", active: false, updatedAt: "2026-06-25T02:00:00.000Z" }],
        nextCursor: null
      }
    ]);
    const client = createN8nReadonlyClient(fetchStub);

    const workflows = await client.listWorkflows({ connection, apiKey: "n8n_secret" });

    expect(workflows.map((workflow) => workflow.id)).toEqual(["wf_1", "wf_2"]);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.url).toBe("https://n8n.example.test/api/v1/workflows?excludePinnedData=true");
    expect(calls[1]?.url).toBe("https://n8n.example.test/api/v1/workflows?excludePinnedData=true&cursor=next-page");
    for (const call of calls) {
      expect(call.init?.method).toBe("GET");
      expect(call.init?.headers).toEqual({
        Accept: "application/json",
        "X-N8N-API-KEY": "n8n_secret"
      });
    }
  });

  test("gets one workflow and tests connection without exposing mutation methods", async () => {
    const { calls, fetchStub } = createFetchStub([
      { id: "wf_1", name: "Selected", nodes: [], connections: {} },
      { data: [] }
    ]);
    const client = createN8nReadonlyClient(fetchStub);

    await expect(client.getWorkflow({ connection, apiKey: "n8n_secret", workflowId: "wf_1" })).resolves.toMatchObject({
      id: "wf_1",
      name: "Selected"
    });
    await expect(client.testConnection({ connection, apiKey: "n8n_secret" })).resolves.toEqual({
      ok: true,
      status: 200
    });

    expect(calls.map((call) => call.url)).toEqual([
      "https://n8n.example.test/api/v1/workflows/wf_1?excludePinnedData=true",
      "https://n8n.example.test/api/v1/workflows?limit=1&excludePinnedData=true"
    ]);
    expect("updateWorkflow" in client).toBe(false);
    expect("activateWorkflow" in client).toBe(false);
    expect("getExecutions" in client).toBe(false);
    expect("getCredentials" in client).toBe(false);
  });

  test("rejects unsafe workflow ids before building a URL", async () => {
    const { calls, fetchStub } = createFetchStub([]);
    const client = createN8nReadonlyClient(fetchStub);

    await expect(
      client.getWorkflow({ connection, apiKey: "n8n_secret", workflowId: "../credentials" })
    ).rejects.toThrow("Invalid n8n workflow id.");
    expect(calls).toEqual([]);
  });
});
