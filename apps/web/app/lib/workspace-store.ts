import type {
  AiPatchProposalCandidate,
  DoctorReport,
  DoctorReviewPacket,
  HumanReview,
  HumanReviewDecision,
  WorkflowIR,
  WorkflowSourceMetadata
} from "@openworkflowdoctor/workflow-ir";
import { aiPatchProposalCandidateSchema } from "@openworkflowdoctor/workflow-ir";
import { z } from "zod";

export type WorkflowDocumentSourceKind =
  | "imported-file"
  | "sample"
  | "migrated-v0.2"
  | "n8n-readonly"
  | "dify-dsl"
  | "coze-definition";
export type LatestReportState = "not-run" | "ready" | "stale";
export type ReviewMode = "original" | "patched";
export type WorkspaceConsoleTab = "summary" | "risks" | "ai" | "patch" | "verification" | "packet" | "logs";
export type AiPatchProposalStateStatus =
  | "idle"
  | "generating"
  | "ready"
  | "validation_failed"
  | "conflict"
  | "provider_unavailable"
  | "error"
  | "stale";

export type AiPatchProposalState = {
  status: AiPatchProposalStateStatus;
  candidate?: AiPatchProposalCandidate;
  safeError?: string;
  generatedAt?: string;
  inputFingerprint?: string;
};

export type LocalWorkspace = {
  schemaVersion: "openworkflowdoctor.workspace.v1";
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  activeWorkflowDocumentId: string | null;
  workflowDocumentIds: string[];
};

export type WorkflowDocument = {
  schemaVersion: "openworkflowdoctor.workflow-document.v1";
  id: string;
  displayName: string;
  sourceKind: WorkflowDocumentSourceKind;
  sourceLabel: string;
  importedAt: string;
  updatedAt: string;
  originalWorkflowIr: WorkflowIR;
  currentRequest: string;
  latestReport?: DoctorReport;
  latestReportState: LatestReportState;
  humanReviewDraft: HumanReview;
  reviewMode: ReviewMode;
  activeTab: WorkspaceConsoleTab;
  selectedNodeId: string | null;
  reviewPacketArtifactIds: string[];
  aiPatchProposalState: AiPatchProposalState;
  readOnlySource?: N8nReadOnlySourceMetadata;
  sourceMetadata?: WorkflowSourceMetadata;
};

export type ReviewPacketArtifact = {
  schemaVersion: "openworkflowdoctor.review-packet-artifact.v1";
  id: string;
  workflowDocumentId: string;
  reviewTargetFingerprint: string;
  label: string;
  createdAt: string;
  exportedAt?: string;
  packet: DoctorReviewPacket;
};

export type WorkflowDocumentInput = {
  workflow: WorkflowIR;
  sourceKind: WorkflowDocumentSourceKind;
  sourceLabel: string;
  request?: string;
  now?: string;
  readOnlySource?: N8nReadOnlySourceMetadata;
  sourceMetadata?: WorkflowSourceMetadata;
};

export type N8nReadOnlySourceMetadata = {
  provider: "n8n";
  connectionId: string;
  connectionLabel: string;
  environmentLabel?: string;
  baseUrlOrigin: string;
  externalWorkflowId: string;
  importedAt: string;
  lastFetchedAt: string;
  upstreamUpdatedAt?: string;
  upstreamVersionId?: string;
  upstreamActive?: boolean;
  upstreamTags?: string[];
};

export type N8nReadonlyRefreshInput = {
  document: WorkflowDocument;
  workflow: WorkflowIR;
  now?: string;
  upstreamUpdatedAt?: string;
  upstreamVersionId?: string;
  upstreamActive?: boolean;
  upstreamTags?: string[];
};

export type ReviewPacketArtifactInput = {
  workflowDocumentId: string;
  packet: DoctorReviewPacket;
  exportedAt?: string;
  now?: string;
};

export type WorkspaceRepository = {
  initialize: () => Promise<LocalWorkspace>;
  getWorkspace: () => Promise<LocalWorkspace>;
  saveWorkspace: (workspace: LocalWorkspace) => Promise<void>;
  setActiveWorkflowDocument: (documentId: string | null) => Promise<void>;
  listWorkflowDocuments: () => Promise<WorkflowDocument[]>;
  getWorkflowDocument: (documentId: string) => Promise<WorkflowDocument | null>;
  saveWorkflowDocument: (document: WorkflowDocument) => Promise<void>;
  updateWorkflowDocument: (
    documentId: string,
    updater: (document: WorkflowDocument) => WorkflowDocument
  ) => Promise<WorkflowDocument>;
  deleteWorkflowDocument: (documentId: string) => Promise<void>;
  listReviewPacketArtifacts: (workflowDocumentId: string) => Promise<ReviewPacketArtifact[]>;
  saveReviewPacketArtifact: (artifact: ReviewPacketArtifact) => Promise<void>;
  clearWorkspaceData: () => Promise<void>;
};

const WORKSPACE_STORE_NAME = "workspace";
const WORKFLOW_DOCUMENT_STORE_NAME = "workflowDocuments";
const REVIEW_PACKET_ARTIFACT_STORE_NAME = "reviewPacketArtifacts";
const WORKSPACE_RECORD_ID = "default";
const WORKSPACE_DB_NAME = "openworkflowdoctor.workspace.db";
const WORKSPACE_DB_VERSION = 1;
const DEFAULT_REQUEST = "帮我修复支付和通知相关风险，优先补 webhook 去重和退款幂等性。";

const humanReviewDecisionSchema = z.enum(["undecided", "accepted", "held", "rejected"]);
const latestReportStateSchema = z.enum(["not-run", "ready", "stale"]);
const reviewModeSchema = z.enum(["original", "patched"]);
const workspaceConsoleTabSchema = z.enum(["summary", "risks", "ai", "patch", "verification", "packet", "logs"]);
const sourceKindSchema = z.enum([
  "imported-file",
  "sample",
  "migrated-v0.2",
  "n8n-readonly",
  "dify-dsl",
  "coze-definition"
]);
const nodeTypeFamilySchema = z.enum(["known", "unknown"]);
const parameterValueTypeSchema = z.enum(["array", "boolean", "null", "number", "object", "string", "unknown"]);
const aiPatchProposalStateStatusSchema = z.enum([
  "idle",
  "generating",
  "ready",
  "validation_failed",
  "conflict",
  "provider_unavailable",
  "error",
  "stale"
]);

const nodeParameterSummarySchema = z.object({
  key: z.string().min(1),
  valueType: parameterValueTypeSchema,
  preview: z.string(),
  redacted: z.boolean().optional()
}).strict();

const credentialSummarySchema = z.object({
  credentialReferencePresent: z.boolean(),
  credentialTypes: z.array(z.string().min(1)),
  credentialCount: z.number().int().nonnegative()
}).strict();

const nodeIrSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  typeFamily: nodeTypeFamilySchema,
  parameters: z.array(nodeParameterSummarySchema),
  credentialSummary: credentialSummarySchema.optional()
}).strict();

const edgeIrSchema = z.object({
  id: z.string().min(1),
  sourceNodeId: z.string().min(1),
  targetNodeId: z.string().min(1),
  sourceOutput: z.string().min(1),
  sourceOutputIndex: z.number().int().nonnegative(),
  targetInput: z.string().min(1).optional()
}).strict();

const workflowSourceDiagnosticSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]),
  nodeId: z.string().min(1).optional(),
  evidence: z.array(z.string())
}).strict();

const workflowSourceMetadataSchema = z.object({
  sourceKind: z.enum(["n8n-json", "n8n-readonly", "dify-dsl", "coze-definition"]),
  sourcePlatform: z.string().min(1),
  sourceVersion: z.string().min(1).optional(),
  sourceAppMode: z.string().min(1).optional(),
  sourceLabel: z.string().min(1).optional(),
  app: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    mode: z.string().min(1).optional(),
    icon: z.string().optional(),
    iconBackground: z.string().optional(),
    useIconAsAnswerIcon: z.boolean().optional()
  }).strict().optional(),
  nodeCount: z.number().int().nonnegative(),
  edgeCount: z.number().int().nonnegative(),
  redactionSummary: z.object({
    redactedValueCount: z.number().int().nonnegative(),
    redactedKeys: z.array(z.string()),
    notes: z.array(z.string())
  }).strict(),
  parserWarnings: z.array(z.string()),
  diagnostics: z.array(workflowSourceDiagnosticSchema),
  environmentVariables: z.array(z.object({
    name: z.string().min(1),
    declaredType: z.string().min(1).optional(),
    valueExisted: z.boolean(),
    redacted: z.boolean(),
    redactionReason: z.string().min(1).optional()
  }).strict()).optional()
}).strict();

const workflowIrSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  nodes: z.array(nodeIrSchema),
  edges: z.array(edgeIrSchema),
  source: workflowSourceMetadataSchema.optional()
}).strict();

const humanReviewSchema = z.object({
  decision: humanReviewDecisionSchema,
  reviewerNote: z.string(),
  decidedAt: z.string().optional(),
  confirmedChecklistItemIds: z.array(z.string())
}).strict();

const aiPatchProposalStateSchema = z.object({
  status: aiPatchProposalStateStatusSchema,
  candidate: aiPatchProposalCandidateSchema.optional(),
  safeError: z.string().optional(),
  generatedAt: z.string().optional(),
  inputFingerprint: z.string().optional()
}).strict();

const n8nReadOnlySourceMetadataSchema = z.object({
  provider: z.literal("n8n"),
  connectionId: z.string().min(1),
  connectionLabel: z.string().min(1),
  environmentLabel: z.string().min(1).optional(),
  baseUrlOrigin: z.string().min(1),
  externalWorkflowId: z.string().min(1),
  importedAt: z.string().min(1),
  lastFetchedAt: z.string().min(1),
  upstreamUpdatedAt: z.string().min(1).optional(),
  upstreamVersionId: z.string().min(1).optional(),
  upstreamActive: z.boolean().optional(),
  upstreamTags: z.array(z.string()).optional()
}).strict();

const localWorkspaceSchema = z.object({
  schemaVersion: z.literal("openworkflowdoctor.workspace.v1"),
  id: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  activeWorkflowDocumentId: z.string().min(1).nullable(),
  workflowDocumentIds: z.array(z.string().min(1))
}).strict();

const workflowDocumentSchema = z.object({
  schemaVersion: z.literal("openworkflowdoctor.workflow-document.v1"),
  id: z.string().min(1),
  displayName: z.string().min(1),
  sourceKind: sourceKindSchema,
  sourceLabel: z.string().min(1),
  importedAt: z.string().min(1),
  updatedAt: z.string().min(1),
  originalWorkflowIr: workflowIrSchema,
  currentRequest: z.string(),
  latestReport: z.unknown().optional(),
  latestReportState: latestReportStateSchema,
  humanReviewDraft: humanReviewSchema,
  reviewMode: reviewModeSchema,
  activeTab: workspaceConsoleTabSchema,
  selectedNodeId: z.string().min(1).nullable(),
  reviewPacketArtifactIds: z.array(z.string().min(1)),
  aiPatchProposalState: aiPatchProposalStateSchema,
  readOnlySource: n8nReadOnlySourceMetadataSchema.optional(),
  sourceMetadata: workflowSourceMetadataSchema.optional()
}).strict();

const reviewPacketArtifactSchema = z.object({
  schemaVersion: z.literal("openworkflowdoctor.review-packet-artifact.v1"),
  id: z.string().min(1),
  workflowDocumentId: z.string().min(1),
  reviewTargetFingerprint: z.string().min(1),
  label: z.string().min(1),
  createdAt: z.string().min(1),
  exportedAt: z.string().min(1).optional(),
  packet: z.unknown()
}).strict();

export function createWorkflowDocumentFromWorkflowIr(input: WorkflowDocumentInput): WorkflowDocument {
  const now = input.now ?? new Date().toISOString();
  const workflow = parseWorkflowIr(input.workflow);

  const document: WorkflowDocument = {
    schemaVersion: "openworkflowdoctor.workflow-document.v1",
    id: createLocalId("workflow"),
    displayName: workflow.name,
    sourceKind: input.sourceKind,
    sourceLabel: input.sourceLabel,
    importedAt: now,
    updatedAt: now,
    originalWorkflowIr: workflow,
    currentRequest: input.request ?? DEFAULT_REQUEST,
    latestReportState: "not-run",
    humanReviewDraft: createEmptyHumanReview(),
    reviewMode: "original",
    activeTab: "summary",
    selectedNodeId: workflow.nodes[0]?.id ?? null,
    reviewPacketArtifactIds: [],
    aiPatchProposalState: createEmptyAiPatchProposalState(),
    ...(input.sourceMetadata || workflow.source ? { sourceMetadata: input.sourceMetadata ?? workflow.source } : {})
  };

  if (input.readOnlySource) {
    document.readOnlySource = {
      ...input.readOnlySource,
      importedAt: input.readOnlySource.importedAt || now,
      lastFetchedAt: input.readOnlySource.lastFetchedAt || now
    };
  }

  return parseWorkflowDocument(document);
}

export function refreshN8nReadonlyWorkflowDocument(input: N8nReadonlyRefreshInput): WorkflowDocument {
  if (input.document.sourceKind !== "n8n-readonly" || !input.document.readOnlySource) {
    throw new Error("Workflow document is not an n8n read-only import.");
  }

  const now = input.now ?? new Date().toISOString();
  const workflow = parseWorkflowIr(input.workflow);
  const changed = fingerprintWorkflow(input.document.originalWorkflowIr) !== fingerprintWorkflow(workflow);
  const readOnlySource: N8nReadOnlySourceMetadata = {
    ...input.document.readOnlySource,
    lastFetchedAt: now,
    ...(input.upstreamUpdatedAt ? { upstreamUpdatedAt: input.upstreamUpdatedAt } : {}),
    ...(input.upstreamVersionId ? { upstreamVersionId: input.upstreamVersionId } : {}),
    ...(typeof input.upstreamActive === "boolean" ? { upstreamActive: input.upstreamActive } : {}),
    ...(input.upstreamTags ? { upstreamTags: input.upstreamTags } : {})
  };

  if (!changed) {
    return parseWorkflowDocument({
      ...input.document,
      updatedAt: now,
      readOnlySource
    });
  }

  return parseWorkflowDocument({
    ...input.document,
    displayName: workflow.name,
    updatedAt: now,
    originalWorkflowIr: workflow,
    latestReportState: input.document.latestReport ? "stale" : input.document.latestReportState,
    reviewMode: "original",
    selectedNodeId: workflow.nodes[0]?.id ?? null,
    aiPatchProposalState:
      input.document.aiPatchProposalState.status === "idle"
        ? input.document.aiPatchProposalState
        : {
            ...input.document.aiPatchProposalState,
            status: "stale"
          },
    readOnlySource
  });
}

export function createReviewPacketArtifact(input: ReviewPacketArtifactInput): ReviewPacketArtifact {
  const now = input.now ?? new Date().toISOString();
  const artifact: ReviewPacketArtifact = {
    schemaVersion: "openworkflowdoctor.review-packet-artifact.v1",
    id: createLocalId("packet"),
    workflowDocumentId: input.workflowDocumentId,
    reviewTargetFingerprint: input.packet.reviewTargetFingerprint,
    label: `${input.packet.workflowName} ${input.packet.reviewTargetFingerprint}`,
    createdAt: now,
    packet: cloneJson(input.packet)
  };

  if (input.exportedAt) {
    artifact.exportedAt = input.exportedAt;
  }

  return artifact;
}

export function createEmptyHumanReview(decision: HumanReviewDecision = "undecided"): HumanReview {
  return {
    decision,
    reviewerNote: "",
    confirmedChecklistItemIds: []
  };
}

export function createEmptyAiPatchProposalState(): AiPatchProposalState {
  return {
    status: "idle"
  };
}

export function parseLocalWorkspace(value: unknown): LocalWorkspace {
  const result = localWorkspaceSchema.safeParse(value);
  if (!result.success) {
    throw new Error("Invalid LocalWorkspace.");
  }
  return result.data;
}

export function parseWorkflowDocument(value: unknown): WorkflowDocument {
  const result = workflowDocumentSchema.safeParse(value);
  if (!result.success) {
    throw new Error("Invalid WorkflowDocument.");
  }
  return result.data as WorkflowDocument;
}

export function parseReviewPacketArtifact(value: unknown): ReviewPacketArtifact {
  const result = reviewPacketArtifactSchema.safeParse(value);
  if (!result.success) {
    throw new Error("Invalid ReviewPacketArtifact.");
  }
  return result.data as ReviewPacketArtifact;
}

export function createMemoryWorkspaceRepository(): WorkspaceRepository {
  const workspaces = new Map<string, LocalWorkspace>();
  const documents = new Map<string, WorkflowDocument>();
  const artifacts = new Map<string, ReviewPacketArtifact>();

  return createRepository({
    async getWorkspaceRecord() {
      return cloneNullable(workspaces.get(WORKSPACE_RECORD_ID));
    },
    async putWorkspaceRecord(workspace) {
      workspaces.set(WORKSPACE_RECORD_ID, cloneJson(workspace));
    },
    async listDocumentRecords() {
      return Array.from(documents.values()).map(cloneJson);
    },
    async getDocumentRecord(documentId) {
      return cloneNullable(documents.get(documentId));
    },
    async putDocumentRecord(document) {
      documents.set(document.id, cloneJson(document));
    },
    async deleteDocumentRecord(documentId) {
      documents.delete(documentId);
    },
    async listArtifactRecords() {
      return Array.from(artifacts.values()).map(cloneJson);
    },
    async putArtifactRecord(artifact) {
      artifacts.set(artifact.id, cloneJson(artifact));
    },
    async deleteArtifactRecord(artifactId) {
      artifacts.delete(artifactId);
    },
    async clearDocumentRecords() {
      documents.clear();
    },
    async clearArtifactRecords() {
      artifacts.clear();
    }
  });
}

export function createIndexedDbWorkspaceRepository(indexedDb: IDBFactory): WorkspaceRepository {
  const openDatabase = () => openWorkspaceDatabase(indexedDb);

  return createRepository({
    async getWorkspaceRecord() {
      const database = await openDatabase();
      return getStoreValue<LocalWorkspace>(database, WORKSPACE_STORE_NAME, WORKSPACE_RECORD_ID);
    },
    async putWorkspaceRecord(workspace) {
      const database = await openDatabase();
      await putStoreValue(database, WORKSPACE_STORE_NAME, workspace, WORKSPACE_RECORD_ID);
    },
    async listDocumentRecords() {
      const database = await openDatabase();
      return getAllStoreValues<WorkflowDocument>(database, WORKFLOW_DOCUMENT_STORE_NAME);
    },
    async getDocumentRecord(documentId) {
      const database = await openDatabase();
      return getStoreValue<WorkflowDocument>(database, WORKFLOW_DOCUMENT_STORE_NAME, documentId);
    },
    async putDocumentRecord(document) {
      const database = await openDatabase();
      await putStoreValue(database, WORKFLOW_DOCUMENT_STORE_NAME, document);
    },
    async deleteDocumentRecord(documentId) {
      const database = await openDatabase();
      await deleteStoreValue(database, WORKFLOW_DOCUMENT_STORE_NAME, documentId);
    },
    async listArtifactRecords() {
      const database = await openDatabase();
      return getAllStoreValues<ReviewPacketArtifact>(database, REVIEW_PACKET_ARTIFACT_STORE_NAME);
    },
    async putArtifactRecord(artifact) {
      const database = await openDatabase();
      await putStoreValue(database, REVIEW_PACKET_ARTIFACT_STORE_NAME, artifact);
    },
    async deleteArtifactRecord(artifactId) {
      const database = await openDatabase();
      await deleteStoreValue(database, REVIEW_PACKET_ARTIFACT_STORE_NAME, artifactId);
    },
    async clearDocumentRecords() {
      const database = await openDatabase();
      await clearStore(database, WORKFLOW_DOCUMENT_STORE_NAME);
    },
    async clearArtifactRecords() {
      const database = await openDatabase();
      await clearStore(database, REVIEW_PACKET_ARTIFACT_STORE_NAME);
    }
  });
}

type WorkspaceRecordDriver = {
  getWorkspaceRecord: () => Promise<LocalWorkspace | null>;
  putWorkspaceRecord: (workspace: LocalWorkspace) => Promise<void>;
  listDocumentRecords: () => Promise<WorkflowDocument[]>;
  getDocumentRecord: (documentId: string) => Promise<WorkflowDocument | null>;
  putDocumentRecord: (document: WorkflowDocument) => Promise<void>;
  deleteDocumentRecord: (documentId: string) => Promise<void>;
  listArtifactRecords: () => Promise<ReviewPacketArtifact[]>;
  putArtifactRecord: (artifact: ReviewPacketArtifact) => Promise<void>;
  deleteArtifactRecord: (artifactId: string) => Promise<void>;
  clearDocumentRecords: () => Promise<void>;
  clearArtifactRecords: () => Promise<void>;
};

function createRepository(driver: WorkspaceRecordDriver): WorkspaceRepository {
  async function initialize(): Promise<LocalWorkspace> {
    const existing = await driver.getWorkspaceRecord();
    if (existing) {
      return parseLocalWorkspace(existing);
    }

    const now = new Date().toISOString();
    const workspace: LocalWorkspace = {
      schemaVersion: "openworkflowdoctor.workspace.v1",
      id: createLocalId("workspace"),
      name: "Local Workspace",
      createdAt: now,
      updatedAt: now,
      activeWorkflowDocumentId: null,
      workflowDocumentIds: []
    };
    await driver.putWorkspaceRecord(workspace);
    return workspace;
  }

  async function getWorkspace(): Promise<LocalWorkspace> {
    return initialize();
  }

  async function saveWorkspace(workspace: LocalWorkspace): Promise<void> {
    await driver.putWorkspaceRecord(parseLocalWorkspace(workspace));
  }

  async function saveWorkflowDocument(document: WorkflowDocument): Promise<void> {
    const parsedDocument = parseWorkflowDocument(document);
    const workspace = await getWorkspace();
    const nextDocumentIds = workspace.workflowDocumentIds.includes(parsedDocument.id)
      ? workspace.workflowDocumentIds
      : [...workspace.workflowDocumentIds, parsedDocument.id];

    await driver.putDocumentRecord(parsedDocument);
    await saveWorkspace({
      ...workspace,
      updatedAt: new Date().toISOString(),
      activeWorkflowDocumentId: workspace.activeWorkflowDocumentId ?? parsedDocument.id,
      workflowDocumentIds: nextDocumentIds
    });
  }

  async function setActiveWorkflowDocument(documentId: string | null): Promise<void> {
    const workspace = await getWorkspace();
    const nextActiveId = documentId && workspace.workflowDocumentIds.includes(documentId) ? documentId : null;
    await saveWorkspace({
      ...workspace,
      updatedAt: new Date().toISOString(),
      activeWorkflowDocumentId: nextActiveId
    });
  }

  async function listWorkflowDocuments(): Promise<WorkflowDocument[]> {
    const workspace = await getWorkspace();
    const byId = new Map((await driver.listDocumentRecords()).map((document) => [document.id, parseWorkflowDocument(document)]));
    return workspace.workflowDocumentIds
      .map((documentId) => byId.get(documentId))
      .filter((document): document is WorkflowDocument => Boolean(document));
  }

  async function getWorkflowDocument(documentId: string): Promise<WorkflowDocument | null> {
    const document = await driver.getDocumentRecord(documentId);
    return document ? parseWorkflowDocument(document) : null;
  }

  async function updateWorkflowDocument(
    documentId: string,
    updater: (document: WorkflowDocument) => WorkflowDocument
  ): Promise<WorkflowDocument> {
    const document = await getWorkflowDocument(documentId);
    if (!document) {
      throw new Error(`Workflow document ${documentId} was not found.`);
    }

    const nextDocument = parseWorkflowDocument(updater(document));
    await driver.putDocumentRecord({
      ...nextDocument,
      updatedAt: new Date().toISOString()
    });
    return nextDocument;
  }

  async function deleteWorkflowDocument(documentId: string): Promise<void> {
    const workspace = await getWorkspace();
    const artifacts = await listReviewPacketArtifacts(documentId);
    await Promise.all(artifacts.map((artifact) => driver.deleteArtifactRecord(artifact.id)));
    await driver.deleteDocumentRecord(documentId);
    const nextDocumentIds = workspace.workflowDocumentIds.filter((currentId) => currentId !== documentId);

    await saveWorkspace({
      ...workspace,
      updatedAt: new Date().toISOString(),
      activeWorkflowDocumentId:
        workspace.activeWorkflowDocumentId === documentId
          ? nextDocumentIds[0] ?? null
          : workspace.activeWorkflowDocumentId,
      workflowDocumentIds: nextDocumentIds
    });
  }

  async function listReviewPacketArtifacts(workflowDocumentId: string): Promise<ReviewPacketArtifact[]> {
    return (await driver.listArtifactRecords())
      .map(parseReviewPacketArtifact)
      .filter((artifact) => artifact.workflowDocumentId === workflowDocumentId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async function saveReviewPacketArtifact(artifact: ReviewPacketArtifact): Promise<void> {
    const parsedArtifact = parseReviewPacketArtifact(artifact);
    const document = await getWorkflowDocument(parsedArtifact.workflowDocumentId);
    if (!document) {
      throw new Error(`Workflow document ${parsedArtifact.workflowDocumentId} was not found.`);
    }

    await driver.putArtifactRecord(parsedArtifact);
    await updateWorkflowDocument(document.id, (current) => ({
      ...current,
      reviewPacketArtifactIds: current.reviewPacketArtifactIds.includes(parsedArtifact.id)
        ? current.reviewPacketArtifactIds
        : [...current.reviewPacketArtifactIds, parsedArtifact.id]
    }));
  }

  async function clearWorkspaceData(): Promise<void> {
    const workspace = await getWorkspace();
    await driver.clearDocumentRecords();
    await driver.clearArtifactRecords();
    await saveWorkspace({
      ...workspace,
      updatedAt: new Date().toISOString(),
      activeWorkflowDocumentId: null,
      workflowDocumentIds: []
    });
  }

  return {
    initialize,
    getWorkspace,
    saveWorkspace,
    setActiveWorkflowDocument,
    listWorkflowDocuments,
    getWorkflowDocument,
    saveWorkflowDocument,
    updateWorkflowDocument,
    deleteWorkflowDocument,
    listReviewPacketArtifacts,
    saveReviewPacketArtifact,
    clearWorkspaceData
  };
}

function parseWorkflowIr(value: unknown): WorkflowIR {
  const result = workflowIrSchema.safeParse(value);
  if (!result.success) {
    throw new Error("Invalid WorkflowIR.");
  }
  return result.data as WorkflowIR;
}

function createLocalId(prefix: string): string {
  const randomId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${randomId}`;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneNullable<T>(value: T | undefined): T | null {
  return value ? cloneJson(value) : null;
}

function fingerprintWorkflow(workflow: WorkflowIR): string {
  return JSON.stringify(workflow);
}

function openWorkspaceDatabase(indexedDb: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDb.open(WORKSPACE_DB_NAME, WORKSPACE_DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(WORKSPACE_STORE_NAME)) {
        database.createObjectStore(WORKSPACE_STORE_NAME);
      }
      if (!database.objectStoreNames.contains(WORKFLOW_DOCUMENT_STORE_NAME)) {
        database.createObjectStore(WORKFLOW_DOCUMENT_STORE_NAME, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(REVIEW_PACKET_ARTIFACT_STORE_NAME)) {
        database.createObjectStore(REVIEW_PACKET_ARTIFACT_STORE_NAME, { keyPath: "id" });
      }
    };

    request.onerror = () => reject(request.error ?? new Error("Unable to open workspace database."));
    request.onsuccess = () => resolve(request.result);
  });
}

function getStoreValue<T>(database: IDBDatabase, storeName: string, key: IDBValidKey): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).get(key);
    request.onerror = () => reject(request.error ?? new Error(`Unable to read ${storeName}.`));
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
  });
}

function getAllStoreValues<T>(database: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();
    request.onerror = () => reject(request.error ?? new Error(`Unable to list ${storeName}.`));
    request.onsuccess = () => resolve(request.result as T[]);
  });
}

function putStoreValue<T>(
  database: IDBDatabase,
  storeName: string,
  value: T,
  key?: IDBValidKey
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = key ? store.put(value, key) : store.put(value);
    request.onerror = () => reject(request.error ?? new Error(`Unable to write ${storeName}.`));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error(`Unable to complete ${storeName} write.`));
  });
}

function deleteStoreValue(database: IDBDatabase, storeName: string, key: IDBValidKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    const request = transaction.objectStore(storeName).delete(key);
    request.onerror = () => reject(request.error ?? new Error(`Unable to delete from ${storeName}.`));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error(`Unable to complete ${storeName} delete.`));
  });
}

function clearStore(database: IDBDatabase, storeName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    const request = transaction.objectStore(storeName).clear();
    request.onerror = () => reject(request.error ?? new Error(`Unable to clear ${storeName}.`));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error(`Unable to complete ${storeName} clear.`));
  });
}
