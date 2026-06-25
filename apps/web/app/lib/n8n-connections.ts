export type N8nConnectionStatus = "untested" | "ready" | "error";

export type N8nConnectionSettings = {
  connectionId: string;
  label: string;
  baseUrl: string;
  environmentLabel?: string;
  authHeaderName: "X-N8N-API-KEY";
  createdAt: string;
  lastUsedAt?: string;
  lastConnectionStatus: N8nConnectionStatus;
};

export type SaveN8nConnectionInput = {
  connectionId?: string;
  label: string;
  baseUrl: string;
  environmentLabel?: string;
  now?: string;
};

const CONNECTIONS_STORAGE_KEY = "openworkflowdoctor.n8n.connections.v1";
const SESSION_KEY_PREFIX = "openworkflowdoctor.n8n.session-api-key.";

export function normalizeN8nBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/g, "");
  if (!trimmed) {
    return "";
  }

  return /\/api\/v\d+$/i.test(trimmed) ? trimmed : `${trimmed}/api/v1`;
}

export function getN8nBaseUrlOrigin(baseUrl: string): string {
  try {
    return new URL(baseUrl).origin;
  } catch {
    return baseUrl;
  }
}

export function loadN8nConnections(storage: Storage | undefined): N8nConnectionSettings[] {
  if (!storage) {
    return [];
  }

  const rawValue = storage.getItem(CONNECTIONS_STORAGE_KEY);
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map(normalizeConnection).filter((connection): connection is N8nConnectionSettings => Boolean(connection));
  } catch {
    return [];
  }
}

export function saveN8nConnection(storage: Storage | undefined, input: SaveN8nConnectionInput): N8nConnectionSettings {
  const now = input.now ?? new Date().toISOString();
  const connection: N8nConnectionSettings = {
    connectionId: input.connectionId ?? createLocalId("n8n-connection"),
    label: input.label.trim() || "n8n",
    baseUrl: normalizeN8nBaseUrl(input.baseUrl),
    ...(input.environmentLabel?.trim() ? { environmentLabel: input.environmentLabel.trim() } : {}),
    authHeaderName: "X-N8N-API-KEY",
    createdAt: now,
    lastConnectionStatus: "untested"
  };

  if (!storage) {
    return connection;
  }

  const connections = loadN8nConnections(storage);
  const nextConnections = connections.some((current) => current.connectionId === connection.connectionId)
    ? connections.map((current) =>
        current.connectionId === connection.connectionId ? { ...current, ...connection, createdAt: current.createdAt } : current
      )
    : [...connections, connection];
  storage.setItem(CONNECTIONS_STORAGE_KEY, JSON.stringify(nextConnections));
  return connection;
}

export function updateN8nConnectionStatus(
  storage: Storage | undefined,
  connectionId: string,
  status: N8nConnectionStatus,
  now: string = new Date().toISOString()
): N8nConnectionSettings[] {
  const connections = loadN8nConnections(storage);
  const nextConnections = connections.map((connection) =>
    connection.connectionId === connectionId
      ? {
          ...connection,
          lastConnectionStatus: status,
          lastUsedAt: now
        }
      : connection
  );
  storage?.setItem(CONNECTIONS_STORAGE_KEY, JSON.stringify(nextConnections));
  return nextConnections;
}

export function deleteN8nConnection(
  localStorage: Storage | undefined,
  sessionStorage: Storage | undefined,
  connectionId: string
): void {
  const nextConnections = loadN8nConnections(localStorage).filter(
    (connection) => connection.connectionId !== connectionId
  );
  localStorage?.setItem(CONNECTIONS_STORAGE_KEY, JSON.stringify(nextConnections));
  clearN8nSessionApiKey(sessionStorage, connectionId);
}

export function saveN8nSessionApiKey(storage: Storage | undefined, connectionId: string, apiKey: string): void {
  if (!storage) {
    return;
  }
  storage.setItem(createSessionKey(connectionId), apiKey);
}

export function getN8nSessionApiKey(storage: Storage | undefined, connectionId: string): string {
  return storage?.getItem(createSessionKey(connectionId)) ?? "";
}

export function clearN8nSessionApiKey(storage: Storage | undefined, connectionId: string): void {
  storage?.removeItem(createSessionKey(connectionId));
}

function normalizeConnection(value: unknown): N8nConnectionSettings | null {
  if (!isRecord(value)) {
    return null;
  }

  const connectionId = typeof value.connectionId === "string" ? value.connectionId.trim() : "";
  const label = typeof value.label === "string" ? value.label.trim() : "";
  const baseUrl = typeof value.baseUrl === "string" ? normalizeN8nBaseUrl(value.baseUrl) : "";
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : "";
  if (!connectionId || !label || !baseUrl || !createdAt) {
    return null;
  }

  return {
    connectionId,
    label,
    baseUrl,
    ...(typeof value.environmentLabel === "string" && value.environmentLabel.trim()
      ? { environmentLabel: value.environmentLabel.trim() }
      : {}),
    authHeaderName: "X-N8N-API-KEY",
    createdAt,
    ...(typeof value.lastUsedAt === "string" ? { lastUsedAt: value.lastUsedAt } : {}),
    lastConnectionStatus: normalizeStatus(value.lastConnectionStatus)
  };
}

function normalizeStatus(value: unknown): N8nConnectionStatus {
  return value === "ready" || value === "error" || value === "untested" ? value : "untested";
}

function createSessionKey(connectionId: string): string {
  return `${SESSION_KEY_PREFIX}${connectionId}`;
}

function createLocalId(prefix: string): string {
  const randomId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${randomId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
