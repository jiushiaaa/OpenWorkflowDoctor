import { z } from "zod";
import type { AiPatchProposalCandidate, DoctorReviewPacket, PatchProposal, VerificationReport } from "./types.js";

export const riskSeveritySchema = z.enum(["low", "medium", "high", "critical"]);
export const verificationStatusSchema = z.enum(["pass", "hold", "fail"]);
export const nodeTypeFamilySchema = z.enum(["known", "unknown"]);
export const parameterValueTypeSchema = z.enum(["array", "boolean", "null", "number", "object", "string", "unknown"]);

export const nodeParameterSummarySchema = z.object({
  key: z.string().min(1),
  valueType: parameterValueTypeSchema,
  preview: z.string(),
  redacted: z.boolean().optional()
}).strict();

export const nodeIrSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  typeFamily: nodeTypeFamilySchema,
  parameters: z.array(nodeParameterSummarySchema),
  credentialSummary: z.object({
    credentialReferencePresent: z.boolean(),
    credentialTypes: z.array(z.string().min(1)),
    credentialCount: z.number().int().nonnegative()
  }).strict().optional()
}).strict();

export const patchOperationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("insert_node_before"),
    targetNodeId: z.string().min(1),
    newNode: nodeIrSchema
  }).strict(),
  z.object({
    type: z.literal("insert_node_after"),
    targetNodeId: z.string().min(1),
    newNode: nodeIrSchema
  }).strict(),
  z.object({
    type: z.literal("insert_error_branch"),
    targetNodeId: z.string().min(1),
    newNode: nodeIrSchema
  }).strict(),
  z.object({
    type: z.literal("insert_branch_route"),
    targetNodeId: z.string().min(1),
    sourceOutputIndex: z.number().int().nonnegative(),
    newNode: nodeIrSchema
  }).strict(),
  z.object({
    type: z.literal("update_node_parameters"),
    targetNodeId: z.string().min(1),
    parameters: z.record(z.string(), z.unknown())
  }).strict()
]);

export const patchProposalSchema = z
  .object({
    summary: z.string().min(1),
    operations: z.array(patchOperationSchema),
    risksAddressed: z.array(z.string()),
    expectedImpact: z.array(z.string()),
    risksIntroduced: z.array(z.string()),
    requiresHumanReview: z.literal(true)
  })
  .strict();

export const patchConflictSchema = z.object({
  id: z.string().min(1),
  severity: z.enum(["info", "hold", "blocker"]),
  operationIndexes: z.array(z.number().int().nonnegative()),
  targetNodeId: z.string().min(1).optional(),
  issueId: z.string().min(1).optional(),
  code: z.enum([
    "target_missing",
    "duplicate_new_node_id",
    "branch_route_exists",
    "unsupported_operation",
    "unsupported_node_type",
    "unsupported_parameter",
    "stale_report",
    "overlapping_operation",
    "unmapped_ai_reference",
    "semantic_validation_failed"
  ]),
  explanation: z.string().min(1)
}).strict();

export const aiPatchProposalCandidateSchema = z.object({
  schemaVersion: z.literal("openworkflowdoctor.ai-patch-proposal.v1"),
  source: z.literal("ai"),
  createdAt: z.string().min(1),
  inputFingerprint: z.string().min(1),
  modelLabel: z.string().min(1).optional(),
  proposal: patchProposalSchema,
  conflicts: z.array(patchConflictSchema),
  safetyNotes: z.array(z.string())
}).strict();

export const verificationGateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  status: verificationStatusSchema,
  explanation: z.string().min(1)
});

export const verificationReportSchema = z
  .object({
    status: verificationStatusSchema,
    checkedGates: z.array(verificationGateSchema),
    passedScenarios: z.array(z.string()),
    failedScenarios: z.array(z.string()),
    warnings: z.array(z.string()),
    requiredRemediation: z.array(z.string())
  })
  .strict();

const riskCountsSchema = z.object({
  low: z.number(),
  medium: z.number(),
  high: z.number(),
  critical: z.number()
}).strict();

const workflowSummarySchema = z.object({
  workflowName: z.string().min(1),
  overview: z.string().min(1),
  entryNodes: z.array(z.string()),
  terminalNodes: z.array(z.string()),
  sideEffectNodes: z.array(z.string()),
  riskCounts: riskCountsSchema,
  recommendedStatus: verificationStatusSchema
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
  severity: riskSeveritySchema,
  nodeId: z.string().min(1).optional(),
  evidence: z.array(z.string())
}).strict();

const workflowSourceMetadataSchema = z.object({
  adapterId: z.string().min(1),
  sourceKind: z.enum(["n8n-exported-json", "n8n-readonly", "dify-dsl", "coze-definition", "custom-graph-json"]),
  sourcePlatform: z.enum(["n8n", "dify", "coze", "custom"]),
  importMethod: z.enum(["file-upload", "read-only-connection", "manual-artifact", "sample"]),
  stability: z.enum(["stable", "experimental", "best-effort"]),
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

const riskIssueSchema = z.object({
  id: z.string().min(1),
  severity: riskSeveritySchema,
  nodeId: z.string().min(1).optional(),
  title: z.string().min(1),
  explanation: z.string().min(1),
  suggestedFix: z.string().min(1),
  evidence: z.array(z.string())
}).strict();

const patchDiffLineSchema = z.object({
  id: z.string().min(1),
  marker: z.enum(["+", "~"]),
  operationType: z.enum([
    "insert_node_before",
    "insert_node_after",
    "insert_error_branch",
    "insert_branch_route",
    "update_node_parameters"
  ]),
  targetNodeId: z.string().min(1),
  targetNodeName: z.string().min(1),
  title: z.string().min(1),
  details: z.array(z.string())
}).strict();

const patchProposalSourceSchema = z.object({
  kind: z.enum(["deterministic", "ai-assisted"]),
  generatedAt: z.string().min(1).optional(),
  inputFingerprint: z.string().min(1).optional(),
  modelLabel: z.string().min(1).optional(),
  validation: z.object({
    schema: verificationStatusSchema,
    semantic: verificationStatusSchema,
    conflictStatus: z.enum(["none", "info", "hold", "blocker"])
  }).strict().optional(),
  safetyNotes: z.array(z.string())
}).strict();

const humanReviewSchema = z.object({
  decision: z.enum(["undecided", "accepted", "held", "rejected"]),
  reviewerNote: z.string(),
  decidedAt: z.string().optional(),
  confirmedChecklistItemIds: z.array(z.string())
}).strict();

const humanReviewValidationSchema = z.object({
  status: verificationStatusSchema,
  missingChecklistItemIds: z.array(z.string()),
  explanation: z.string().min(1)
}).strict();

const issueDeltaSchema = z.object({
  resolvedIssueIds: z.array(z.string()),
  remainingIssueIds: z.array(z.string()),
  introducedIssueIds: z.array(z.string())
}).strict();

const acceptanceChecklistItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  status: verificationStatusSchema,
  action: z.string().min(1)
}).strict();

export const doctorReviewPacketSchema = z.object({
  schemaVersion: z.literal("openworkflowdoctor.review-packet.v1"),
  generatedAt: z.string().min(1),
  workflowName: z.string().min(1),
  source: workflowSourceMetadataSchema.optional(),
  reviewTargetFingerprint: z.string().min(1),
  acceptanceRecommendation: verificationStatusSchema,
  riskDelta: z.object({
    before: riskCountsSchema,
    after: riskCountsSchema
  }).strict(),
  issueDelta: issueDeltaSchema,
  humanReview: humanReviewSchema.optional(),
  humanReviewValidation: humanReviewValidationSchema,
  acceptanceChecklist: z.array(acceptanceChecklistItemSchema),
  original: z.object({
    workflow: workflowIrSchema,
    summary: workflowSummarySchema,
    issues: z.array(riskIssueSchema)
  }).strict(),
  patch: z.object({
    proposal: patchProposalSchema,
    proposalSource: patchProposalSourceSchema.optional(),
    patchDiff: z.array(patchDiffLineSchema),
    patchedWorkflow: workflowIrSchema,
    patchedSummary: workflowSummarySchema,
    patchedIssues: z.array(riskIssueSchema)
  }).strict(),
  verification: verificationReportSchema
}).strict();

export function parsePatchProposal(value: unknown): PatchProposal {
  const result = patchProposalSchema.safeParse(value);
  if (!result.success) {
    if (isObject(value) && value.requiresHumanReview === false) {
      throw new Error("PatchProposal must require human review.");
    }
    throw new Error("Invalid PatchProposal.");
  }
  return result.data as PatchProposal;
}

export function parseAiPatchProposalCandidate(value: unknown): AiPatchProposalCandidate {
  const result = aiPatchProposalCandidateSchema.safeParse(value);
  if (!result.success) {
    if (isRecord(value) && isRecord(value.proposal) && value.proposal.requiresHumanReview === false) {
      throw new Error("PatchProposal must require human review.");
    }
    throw new Error("Invalid AI PatchProposal.");
  }
  return result.data as AiPatchProposalCandidate;
}

export function parseVerificationReport(value: unknown): VerificationReport {
  const result = verificationReportSchema.safeParse(value);
  if (!result.success) {
    throw new Error("Invalid VerificationReport.");
  }
  return result.data;
}

export function parseDoctorReviewPacket(value: unknown): DoctorReviewPacket {
  const result = doctorReviewPacketSchema.safeParse(value);
  if (!result.success) {
    throw new Error("Invalid DoctorReviewPacket.");
  }
  return result.data as DoctorReviewPacket;
}

function isObject(value: unknown): value is { requiresHumanReview?: unknown } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
