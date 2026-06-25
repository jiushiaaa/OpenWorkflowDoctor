import type { NodeIR, NodeParameterSummary, ParameterValueType } from "./types.js";

export const REDACTED_PREVIEW = "[redacted]";

const SENSITIVE_KEY_PATTERN =
  /(^|[^a-z])(api[-_ ]?key|authorization|bearer|client[-_ ]?secret|credentials?|oauth|access[-_ ]?token|password|passphrase|private[-_ ]?key|refresh[-_ ]?token|secret|token|test[-_ ]?url|production[-_ ]?url|webhook[-_ ]?(id|path|url)|upload[-_ ]?file[-_ ]?id|uploaded[-_ ]?id|file[-_ ]?id|dataset[-_ ]?ids?|tenant[-_ ]?id|workspace[-_ ]?id|user[-_ ]?id|app[-_ ]?id|provider[-_ ]?credentials?)($|[^a-z])/i;
const SENSITIVE_QUERY_KEY_PATTERN =
  /(^|[^a-z])(api[-_ ]?key|authorization|auth|client[-_ ]?secret|signature|access[-_ ]?token|refresh[-_ ]?token|secret|token)([^a-z]|$)/i;
const SENSITIVE_STRING_PATTERN =
  /(bearer\s+[^\s,'"}\]]+|basic\s+[^\s,'"}\]]+|-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----|(?:api[-_ ]?key|authorization|client[-_ ]?secret|oauth|access[-_ ]?token|password|private[-_ ]?key|refresh[-_ ]?token|secret|token)\s*[:=]\s*['"]?[^\s,'"}\]]+)/i;

export function createParameterSummary(key: string, value: unknown): NodeParameterSummary {
  const redactedValue = redactSensitiveValue(key, value);
  const summary: NodeParameterSummary = {
    key,
    valueType: getValueType(value),
    preview: createPreview(redactedValue)
  };

  if (containsRedaction(redactedValue)) {
    summary.redacted = true;
  }

  return summary;
}

export function sanitizeNode(node: NodeIR): NodeIR {
  return {
    ...node,
    parameters: node.parameters.map(sanitizeParameterSummary)
  };
}

export function sanitizeParameterSummary(parameter: NodeParameterSummary): NodeParameterSummary {
  const redactedPreview = redactSensitiveValue(parameter.key, parameter.preview);
  const sanitized = {
    ...parameter,
    preview: createPreview(redactedPreview)
  };

  if (containsRedaction(redactedPreview)) {
    sanitized.redacted = true;
  }

  return sanitized;
}

export function formatRedactedValue(key: string, value: unknown): string {
  return createPreview(redactSensitiveValue(key, value));
}

export function sanitizeForExport<T>(value: T): T {
  return redactSensitiveValue("", value) as T;
}

export function redactSensitiveValue(key: string, value: unknown): unknown {
  if (isSensitiveKey(key)) {
    return REDACTED_PREVIEW;
  }

  if (typeof value === "string") {
    return redactSensitiveString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveValue(key, item));
  }

  if (isRecord(value)) {
    const recordDeclaresSensitiveValue = declaresSensitiveValueName(value);
    const redactedEntries = Object.entries(value).map(([entryKey, entryValue]) => {
      if (recordDeclaresSensitiveValue && isValueCarrierKey(entryKey)) {
        return [entryKey, REDACTED_PREVIEW] as const;
      }

      return [entryKey, redactSensitiveValue(entryKey, entryValue)] as const;
    });

    return Object.fromEntries(redactedEntries);
  }

  return value;
}

export function getValueType(value: unknown): ParameterValueType {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  const valueType = typeof value;
  if (
    valueType === "boolean" ||
    valueType === "number" ||
    valueType === "object" ||
    valueType === "string"
  ) {
    return valueType;
  }
  return "unknown";
}

function redactSensitiveString(value: string): string {
  const urlRedacted = redactSensitiveUrl(value);
  if (urlRedacted !== value) {
    return urlRedacted;
  }

  if (SENSITIVE_STRING_PATTERN.test(value) || containsSecretBearingExpression(value)) {
    return REDACTED_PREVIEW;
  }

  return value;
}

function containsSecretBearingExpression(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    (normalized.includes("authorization") && normalized.includes("bearer ")) ||
    normalized.includes("bearer ") ||
    normalized.includes("basic ")
  );
}

function redactSensitiveUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return value;
  }

  let changed = false;
  for (const key of [...parsed.searchParams.keys()]) {
    if (isSensitiveQueryKey(key)) {
      parsed.searchParams.set(key, REDACTED_PREVIEW);
      changed = true;
    }
  }

  return changed ? parsed.toString().replaceAll("%5Bredacted%5D", REDACTED_PREVIEW) : value;
}

function createPreview(value: unknown): string {
  if (typeof value === "string") {
    return value.length > 80 ? `${value.slice(0, 77)}...` : value;
  }
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return String(value);
  }
  return JSON.stringify(value);
}

function declaresSensitiveValueName(value: Record<string, unknown>): boolean {
  const declaredName = value.name ?? value.key ?? value.header;
  return typeof declaredName === "string" && isSensitiveKey(declaredName);
}

function isValueCarrierKey(key: string): boolean {
  return ["value", "default", "content"].includes(key.toLowerCase());
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(normalizeKey(key));
}

function isSensitiveQueryKey(key: string): boolean {
  return SENSITIVE_QUERY_KEY_PATTERN.test(normalizeKey(key));
}

function normalizeKey(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function containsRedaction(value: unknown): boolean {
  if (value === REDACTED_PREVIEW) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some(containsRedaction);
  }

  if (isRecord(value)) {
    return Object.values(value).some(containsRedaction);
  }

  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
