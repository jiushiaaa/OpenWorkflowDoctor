import { sanitizeForExport } from "./redaction.js";
import type {
  RedactionSummary,
  WorkflowIR,
  WorkflowImportMethod,
  WorkflowSourceDiagnostic,
  WorkflowSourceKind,
  WorkflowSourceMetadata,
  WorkflowSourcePlatform,
  WorkflowSourceStability
} from "./types.js";

export type WorkflowSourceAdapterInput = {
  fileName: string;
  mimeType?: string;
  content: string;
};

export type WorkflowSourceAdapterCapability =
  | "file-upload"
  | "read-only-connection"
  | "manual-artifact"
  | "sample"
  | "source-diagnostics"
  | "source-metadata"
  | "review-packet-metadata";

export type WorkflowSourceAdapterAcceptedInputs = {
  extensions: string[];
  mimeTypes: string[];
};

export type WorkflowSourceAdapterLimits = {
  maxFileBytes: number;
  maxNodes: number;
  maxEdges: number;
  maxNestedDepth: number;
};

export type WorkflowSourceAdapterInfo = {
  adapterId: string;
  label: string;
  sourceKind: WorkflowSourceKind;
  sourcePlatform: WorkflowSourcePlatform;
  importMethod: WorkflowImportMethod;
  stability: WorkflowSourceStability;
};

export type AdapterImportResult = {
  workflowIR: WorkflowIR;
  sourceMetadata: WorkflowSourceMetadata;
  sourceDiagnostics: WorkflowSourceDiagnostic[];
  parserWarnings: string[];
  redactionSummary: RedactionSummary;
  adapterInfo: WorkflowSourceAdapterInfo;
  importFingerprint: string;
};

export type WorkflowSourceAdapter = WorkflowSourceAdapterInfo & {
  id: string;
  acceptedInputs: WorkflowSourceAdapterAcceptedInputs;
  trustModel: "untrusted-user-artifact" | "read-only-platform-import" | "built-in-sample";
  capabilities: WorkflowSourceAdapterCapability[];
  limits: WorkflowSourceAdapterLimits;
  acceptsFile: (fileName: string, mimeType?: string) => boolean;
  import: (input: WorkflowSourceAdapterInput) => AdapterImportResult;
};

export function acceptsInputByExtensionAndMime(
  acceptedInputs: WorkflowSourceAdapterAcceptedInputs,
  fileName: string,
  mimeType?: string
): boolean {
  const lowerName = fileName.toLowerCase();
  const extensionAccepted = acceptedInputs.extensions.some((extension) => lowerName.endsWith(extension));
  const normalizedMimeType = mimeType?.toLowerCase() ?? "";
  const mimeAccepted =
    normalizedMimeType.length === 0 ||
    acceptedInputs.mimeTypes.length === 0 ||
    acceptedInputs.mimeTypes.includes(normalizedMimeType);

  return extensionAccepted && mimeAccepted;
}

export function assertAdapterFileGuardrails(
  adapter: Pick<WorkflowSourceAdapter, "label" | "acceptedInputs" | "limits" | "acceptsFile">,
  input: WorkflowSourceAdapterInput
): void {
  if (!adapter.acceptsFile(input.fileName, input.mimeType)) {
    throw new Error(`${adapter.label} import does not accept ${input.fileName}.`);
  }

  const byteLength = new TextEncoder().encode(input.content).length;
  if (byteLength > adapter.limits.maxFileBytes) {
    throw new Error(`${adapter.label} file exceeds ${adapter.limits.maxFileBytes} bytes.`);
  }

  const nestedDepth = getNestedDepth(input.content);
  if (nestedDepth > adapter.limits.maxNestedDepth) {
    throw new Error(`${adapter.label} file exceeds nested depth ${adapter.limits.maxNestedDepth}.`);
  }
}

export function createAdapterImportResult({
  adapter,
  input,
  workflowIR,
  sourceMetadata
}: {
  adapter: WorkflowSourceAdapter;
  input: WorkflowSourceAdapterInput;
  workflowIR: WorkflowIR;
  sourceMetadata: WorkflowSourceMetadata;
}): AdapterImportResult {
  const adapterInfo = createAdapterInfo(adapter);
  const metadataAdapterInfo = {
    adapterId: adapterInfo.adapterId,
    sourceKind: adapterInfo.sourceKind,
    sourcePlatform: adapterInfo.sourcePlatform,
    importMethod: adapterInfo.importMethod,
    stability: adapterInfo.stability
  };
  const sanitizedMetadata = sanitizeForExport({
    ...sourceMetadata,
    ...metadataAdapterInfo
  });
  const sanitizedWorkflow = sanitizeForExport({
    ...workflowIR,
    source: sanitizedMetadata
  });

  return {
    workflowIR: sanitizedWorkflow,
    sourceMetadata: sanitizedMetadata,
    sourceDiagnostics: sanitizedMetadata.diagnostics,
    parserWarnings: sanitizedMetadata.parserWarnings,
    redactionSummary: sanitizedMetadata.redactionSummary,
    adapterInfo,
    importFingerprint: createImportFingerprint(adapter.adapterId, input.content)
  };
}

export function createAdapterInfo(adapter: WorkflowSourceAdapter): WorkflowSourceAdapterInfo {
  return {
    adapterId: adapter.adapterId,
    label: adapter.label,
    sourceKind: adapter.sourceKind,
    sourcePlatform: adapter.sourcePlatform,
    importMethod: adapter.importMethod,
    stability: adapter.stability
  };
}

export function createEmptyRedactionSummary(notes: string[] = []): RedactionSummary {
  return {
    redactedValueCount: 0,
    redactedKeys: [],
    notes
  };
}

export function mergeRedactionSummaries(...summaries: RedactionSummary[]): RedactionSummary {
  return {
    redactedValueCount: summaries.reduce((total, summary) => total + summary.redactedValueCount, 0),
    redactedKeys: [...new Set(summaries.flatMap((summary) => summary.redactedKeys))].sort(),
    notes: [...new Set(summaries.flatMap((summary) => summary.notes))]
  };
}

export function createImportFingerprint(adapterId: string, content: string): string {
  return `owd-import-${fnv1a64Hex(`${adapterId}\n${content}`)}`;
}

function getNestedDepth(content: string): number {
  let depth = 0;
  let maxDepth = 0;
  let inString = false;
  let escaping = false;

  for (const character of content) {
    if (escaping) {
      escaping = false;
      continue;
    }
    if (character === "\\") {
      escaping = inString;
      continue;
    }
    if (character === '"' || character === "'") {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (character === "{" || character === "[") {
      depth += 1;
      maxDepth = Math.max(maxDepth, depth);
    }
    if (character === "}" || character === "]") {
      depth = Math.max(0, depth - 1);
    }
  }

  return maxDepth;
}

function fnv1a64Hex(value: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;

  for (const character of value) {
    hash ^= BigInt(character.codePointAt(0) ?? 0);
    hash = (hash * prime) & mask;
  }

  return hash.toString(16).padStart(16, "0");
}
