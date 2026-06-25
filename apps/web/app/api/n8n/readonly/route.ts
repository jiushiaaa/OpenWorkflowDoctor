import { NextResponse } from "next/server";
import { z } from "zod";

const n8nReadonlyRequestSchema = z.object({
  action: z.enum(["listWorkflows", "getWorkflow", "testConnection"]),
  connection: z.object({
    baseUrl: z.string().min(1),
    authHeaderName: z.literal("X-N8N-API-KEY")
  }).strict(),
  apiKey: z.string().min(1),
  workflowId: z.string().optional(),
  cursor: z.string().optional()
}).strict();

type N8nReadonlyRequest = z.infer<typeof n8nReadonlyRequestSchema>;

const FORBIDDEN_WORKFLOW_ID_PATTERN = /(^|\/|\.\.)(credentials?|executions?|activate|deactivate|webhook)(\/|$)/iu;

export async function POST(request: Request) {
  let parsedRequest: N8nReadonlyRequest;
  try {
    parsedRequest = n8nReadonlyRequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid n8n read-only request." }, { status: 400 });
  }

  const targetUrl = createN8nReadonlyUrl(parsedRequest);
  if (!targetUrl) {
    return NextResponse.json({ error: "Invalid n8n read-only request." }, { status: 400 });
  }

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        [parsedRequest.connection.authHeaderName]: parsedRequest.apiKey
      }
    });

    if (!response.ok) {
      return NextResponse.json({ error: `n8n read-only request failed with ${response.status}.` }, { status: 502 });
    }

    if (parsedRequest.action === "testConnection") {
      return NextResponse.json({ ok: true, status: response.status });
    }

    return NextResponse.json(await response.json());
  } catch {
    return NextResponse.json({ error: "n8n read-only request failed." }, { status: 502 });
  }
}

function createN8nReadonlyUrl(request: N8nReadonlyRequest): string | null {
  const apiRoot = normalizeApiRoot(request.connection.baseUrl);
  if (!apiRoot) {
    return null;
  }

  if (request.action === "testConnection") {
    const params = new URLSearchParams();
    params.set("limit", "1");
    params.set("excludePinnedData", "true");
    return `${apiRoot}/workflows?${params.toString()}`;
  }

  if (request.action === "listWorkflows") {
    const params = new URLSearchParams();
    params.set("excludePinnedData", "true");
    if (request.cursor) {
      params.set("cursor", request.cursor);
    }
    return `${apiRoot}/workflows?${params.toString()}`;
  }

  if (!request.workflowId || !isSafeWorkflowId(request.workflowId)) {
    return null;
  }

  const params = new URLSearchParams();
  params.set("excludePinnedData", "true");
  return `${apiRoot}/workflows/${encodeURIComponent(request.workflowId)}?${params.toString()}`;
}

function normalizeApiRoot(value: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(value.trim().replace(/\/+$/u, ""));
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return null;
  }
  if (!/\/api\/v\d+$/u.test(parsed.pathname)) {
    return null;
  }

  return parsed.toString().replace(/\/+$/u, "");
}

function isSafeWorkflowId(value: string): boolean {
  return /^[a-zA-Z0-9_-]+$/u.test(value) && !FORBIDDEN_WORKFLOW_ID_PATTERN.test(value);
}
