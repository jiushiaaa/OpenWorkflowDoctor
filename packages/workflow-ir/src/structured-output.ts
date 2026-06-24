import { z } from "zod";
import type { DoctorReviewPacket, PatchProposal, VerificationReport } from "./types.js";

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
  parameters: z.array(nodeParameterSummarySchema)
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
  sourceOutputIndex: z.number().int().nonnegative()
}).strict();

const workflowIrSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  nodes: z.array(nodeIrSchema),
  edges: z.array(edgeIrSchema)
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
