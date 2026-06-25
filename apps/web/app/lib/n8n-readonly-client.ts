import type { N8nConnectionSettings } from "./n8n-connections";

export type N8nWorkflowListItem = {
  id: string;
  name: string;
  active?: boolean;
  updatedAt?: string;
  tags: string[];
};

export type N8nReadonlyRequest = {
  connection: N8nConnectionSettings;
  apiKey: string;
};

export type GetN8nWorkflowRequest = N8nReadonlyRequest & {
  workflowId: string;
};

export type N8nConnectionTestResult = {
  ok: boolean;
  status: number;
};

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export function createN8nReadonlyClient(fetchLike: FetchLike = fetch) {
  return {
    async listWorkflows(request: N8nReadonlyRequest): Promise<N8nWorkflowListItem[]> {
      const workflows: N8nWorkflowListItem[] = [];
      let cursor: string | null = null;

      do {
        const url = createWorkflowListUrl(request.connection, cursor);
        const response = await fetchJson(url, request);
        const page = parseWorkflowListResponse(response);
        workflows.push(...page.data);
        cursor = page.nextCursor;
      } while (cursor);

      return workflows;
    },

    async getWorkflow(request: GetN8nWorkflowRequest): Promise<unknown> {
      if (!isSafeWorkflowId(request.workflowId)) {
        throw new Error("Invalid n8n workflow id.");
      }

      return fetchJson(`${request.connection.baseUrl}/workflows/${encodeURIComponent(request.workflowId)}?excludePinnedData=true`, request);
    },

    async testConnection(request: N8nReadonlyRequest): Promise<N8nConnectionTestResult> {
      const response = await fetchLike(`${request.connection.baseUrl}/workflows?limit=1&excludePinnedData=true`, {
        method: "GET",
        headers: createHeaders(request)
      });
      return {
        ok: response.ok,
        status: response.status
      };
    }
  };

  async function fetchJson(url: string, request: N8nReadonlyRequest): Promise<unknown> {
    const response = await fetchLike(url, {
      method: "GET",
      headers: createHeaders(request)
    });
    if (!response.ok) {
      throw new Error(`n8n read-only request failed with ${response.status}.`);
    }
    return response.json() as Promise<unknown>;
  }
}

function createWorkflowListUrl(connection: N8nConnectionSettings, cursor: string | null): string {
  const params = new URLSearchParams();
  params.set("excludePinnedData", "true");
  if (cursor) {
    params.set("cursor", cursor);
  }
  return `${connection.baseUrl}/workflows?${params.toString()}`;
}

function createHeaders(request: N8nReadonlyRequest): Record<string, string> {
  return {
    Accept: "application/json",
    [request.connection.authHeaderName]: request.apiKey
  };
}

function parseWorkflowListResponse(value: unknown): { data: N8nWorkflowListItem[]; nextCursor: string | null } {
  if (!isRecord(value)) {
    return { data: [], nextCursor: null };
  }

  return {
    data: Array.isArray(value.data)
      ? value.data.map(parseWorkflowListItem).filter((item): item is N8nWorkflowListItem => Boolean(item))
      : [],
    nextCursor: typeof value.nextCursor === "string" && value.nextCursor.trim() ? value.nextCursor : null
  };
}

function parseWorkflowListItem(value: unknown): N8nWorkflowListItem | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") {
    return null;
  }

  return {
    id: value.id,
    name: value.name,
    ...(typeof value.active === "boolean" ? { active: value.active } : {}),
    ...(typeof value.updatedAt === "string" ? { updatedAt: value.updatedAt } : {}),
    tags: extractTagNames(value.tags)
  };
}

function extractTagNames(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((tag) => (isRecord(tag) && typeof tag.name === "string" ? tag.name.trim() : ""))
    .filter((tagName) => tagName.length > 0);
}

function isSafeWorkflowId(value: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
