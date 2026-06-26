import { buildAiPatchProposalInput } from "./ai-patch-proposal.js";
import { createDoctorReportFromWorkflow } from "./doctor-report.js";
import { createDoctorReviewPacket } from "./review-packet.js";
import { importWorkflowSourceArtifact } from "./import-pipeline.js";
import type { WorkflowSourceArtifactImportInput } from "./import-pipeline.js";

export type AdapterConformanceInput = {
  adapterId: string;
  validInput: Omit<WorkflowSourceArtifactImportInput, "adapterId">;
  malformedInput: Omit<WorkflowSourceArtifactImportInput, "adapterId">;
  sentinelSecrets: string[];
};

export type AdapterConformanceCheck = {
  id: string;
  status: "pass" | "fail";
  message: string;
};

export type AdapterConformanceResult = {
  status: "pass" | "fail";
  checks: AdapterConformanceCheck[];
};

export function runWorkflowSourceAdapterConformance(input: AdapterConformanceInput): AdapterConformanceResult {
  const checks: AdapterConformanceCheck[] = [];

  let malformedFailed = false;
  try {
    importWorkflowSourceArtifact({ adapterId: input.adapterId, ...input.malformedInput });
  } catch {
    malformedFailed = true;
  }
  checks.push(createCheck(
    "malformed_input_creates_no_document",
    malformedFailed,
    "Malformed input must fail before an import result is created."
  ));

  const result = importWorkflowSourceArtifact({ adapterId: input.adapterId, ...input.validInput });
  const report = createDoctorReportFromWorkflow(result.workflowIR, `Review ${input.sentinelSecrets.join(" ")}`);
  const packet = createDoctorReviewPacket(report);
  const aiInput = buildAiPatchProposalInput(report, {
    request: `Review ${input.sentinelSecrets.join(" ")}`
  });
  const serializedResult = JSON.stringify(result);
  const serializedDownstream = JSON.stringify({ packet, aiInput });
  const combinedSerialized = JSON.stringify({ result, packet, aiInput });

  checks.push(createCheck(
    "raw_input_not_stored",
    !serializedResult.includes(input.validInput.content),
    "Adapter import result must not store raw source content."
  ));
  checks.push(createCheck(
    "sentinel_secrets_do_not_leak",
    input.sentinelSecrets.every((secret) => !combinedSerialized.includes(secret)),
    "Sentinel secrets must not leak into WorkflowIR, Review Packet, or AI context."
  ));
  checks.push(createCheck(
    "review_packet_records_source_metadata",
    packet.source?.adapterId === input.adapterId &&
      packet.source?.sourceKind === result.adapterInfo.sourceKind &&
      packet.source?.sourcePlatform === result.adapterInfo.sourcePlatform &&
      packet.source?.importMethod === result.adapterInfo.importMethod,
    "Review Packet must record adapterId, sourceKind, sourcePlatform, and importMethod."
  ));
  checks.push(createCheck(
    "source_metadata_is_sanitized",
    input.sentinelSecrets.every((secret) => !JSON.stringify(result.sourceMetadata).includes(secret)),
    "Source metadata must be sanitized."
  ));
  checks.push(createCheck(
    "parser_warnings_preserved",
    Array.isArray(result.parserWarnings),
    "Parser warnings must be exposed as an array."
  ));
  checks.push(createCheck(
    "redaction_summary_records_sanitization",
    result.redactionSummary.redactedValueCount > 0 || result.redactionSummary.notes.length > 0,
    "Redaction summary must record redacted or summarized values."
  ));
  checks.push(createCheck(
    "ai_context_is_sanitized",
    input.sentinelSecrets.every((secret) => !JSON.stringify(aiInput).includes(secret)),
    "AI context must not contain sentinel secrets."
  ));
  checks.push(createCheck(
    "review_packet_is_sanitized",
    input.sentinelSecrets.every((secret) => !serializedDownstream.includes(secret)),
    "Review Packet must not contain sentinel secrets."
  ));

  return {
    status: checks.every((check) => check.status === "pass") ? "pass" : "fail",
    checks
  };
}

function createCheck(id: string, passed: boolean, message: string): AdapterConformanceCheck {
  return {
    id,
    status: passed ? "pass" : "fail",
    message
  };
}
