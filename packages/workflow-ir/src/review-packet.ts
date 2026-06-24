import { sanitizeForExport } from "./redaction.js";
import type {
  DoctorReport,
  DoctorReviewPacket,
  HumanReview,
  HumanReviewValidation,
  IssueDelta,
  VerificationStatus
} from "./types.js";

const undecidedHumanReview: HumanReview = {
  decision: "undecided",
  reviewerNote: "",
  confirmedChecklistItemIds: []
};

export function createDoctorReviewPacket(
  report: DoctorReport,
  generatedAt = new Date().toISOString(),
  humanReview: HumanReview = undecidedHumanReview
): DoctorReviewPacket {
  const acceptanceChecklist = report.verification.checkedGates.map((gate) => ({
    id: gate.id,
    label: gate.title,
    status: gate.status,
    action: gate.status === "pass" ? "No action needed." : remediationForGate(gate.id)
  }));

  return sanitizeForExport({
    schemaVersion: "openworkflowdoctor.review-packet.v1",
    generatedAt,
    workflowName: report.workflow.name,
    reviewTargetFingerprint: createReviewTargetFingerprint(report, acceptanceChecklist),
    acceptanceRecommendation: report.acceptanceRecommendation,
    riskDelta: {
      before: { ...report.summary.riskCounts },
      after: { ...report.patchedSummary.riskCounts }
    },
    issueDelta: createIssueDelta(report),
    humanReview: cloneJson(humanReview),
    humanReviewValidation: validateHumanReview(humanReview, acceptanceChecklist),
    acceptanceChecklist,
    original: {
      workflow: cloneJson(report.workflow),
      summary: cloneJson(report.summary),
      issues: cloneJson(report.issues)
    },
    patch: {
      proposal: cloneJson(report.proposal),
      ...(report.patchSource ? { proposalSource: cloneJson(report.patchSource) } : {}),
      patchDiff: cloneJson(report.patchDiff),
      patchedWorkflow: cloneJson(report.patchedWorkflow),
      patchedSummary: cloneJson(report.patchedSummary),
      patchedIssues: cloneJson(report.patchedIssues)
    },
    verification: cloneJson(report.verification)
  });
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function remediationForGate(gateId: string): string {
  switch (gateId) {
    case "patch_has_operations":
      return "Provide at least one structured PatchOperation before verification.";
    case "workflow_has_nodes":
      return "Restore the workflow graph before accepting the patch.";
    case "critical_risk_count":
      return "Reduce critical risks to the original count or lower before accepting.";
    case "remaining_repairable_high_risks":
      return "Resolve remaining repairable high and critical risk issues before accepting.";
    case "side_effect_human_review":
      return "Human reviewer must confirm the remaining side-effect nodes are expected before accepting.";
    default:
      return `Review verifier gate ${gateId}.`;
  }
}

function validateHumanReview(
  humanReview: HumanReview,
  acceptanceChecklist: { id: string; status: VerificationStatus }[]
): HumanReviewValidation {
  const requiredChecklistItemIds = acceptanceChecklist
    .filter((item) => item.status !== "pass")
    .map((item) => item.id);
  const failedChecklistItemIds = acceptanceChecklist
    .filter((item) => item.status === "fail")
    .map((item) => item.id);
  const confirmed = new Set(humanReview.confirmedChecklistItemIds);
  const missingChecklistItemIds = requiredChecklistItemIds.filter((id) => !confirmed.has(id));

  if (humanReview.decision === "accepted" && failedChecklistItemIds.length > 0) {
    return {
      status: "fail",
      missingChecklistItemIds: [],
      explanation: "Accepted human review cannot override failed verifier gates."
    };
  }

  if (humanReview.decision === "accepted" && missingChecklistItemIds.length > 0) {
    return {
      status: "hold",
      missingChecklistItemIds,
      explanation: "Accepted human review is missing required checklist confirmations."
    };
  }

  if (humanReview.decision === "undecided") {
    return {
      status: "hold",
      missingChecklistItemIds: requiredChecklistItemIds,
      explanation: "Human review decision has not been recorded."
    };
  }

  return {
    status: "pass",
    missingChecklistItemIds: [],
    explanation: "Human review decision is internally consistent with the acceptance checklist."
  };
}

function createIssueDelta(report: DoctorReport): IssueDelta {
  const originalIssueIds = report.issues.map((issue) => issue.id);
  const patchedIssueIds = report.patchedIssues.map((issue) => issue.id);
  const originalIssueIdSet = new Set(originalIssueIds);
  const patchedIssueIdSet = new Set(patchedIssueIds);

  return {
    resolvedIssueIds: originalIssueIds.filter((issueId) => !patchedIssueIdSet.has(issueId)),
    remainingIssueIds: patchedIssueIds.filter((issueId) => originalIssueIdSet.has(issueId)),
    introducedIssueIds: patchedIssueIds.filter((issueId) => !originalIssueIdSet.has(issueId))
  };
}

function createReviewTargetFingerprint(
  report: DoctorReport,
  acceptanceChecklist: { id: string; status: VerificationStatus; action?: string; label?: string }[]
): string {
  return `owd1-${fnv1a64Hex(stableStringify(sanitizeForExport({
    acceptanceRecommendation: report.acceptanceRecommendation,
    workflowName: report.workflow.name,
    originalWorkflow: report.workflow,
    originalSummary: report.summary,
    originalIssues: report.issues,
    proposal: report.proposal,
    patchSource: report.patchSource,
    patchDiff: report.patchDiff,
    patchedWorkflow: report.patchedWorkflow,
    patchedSummary: report.patchedSummary,
    patchedIssues: report.patchedIssues,
    issueDelta: createIssueDelta(report),
    verification: report.verification,
    acceptanceChecklist
  })))}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`)
    .join(",")}}`;
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
