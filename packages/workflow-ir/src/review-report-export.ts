import { sanitizeForExport } from "./redaction.js";
import type { DoctorReviewPacket, PatchDiffLine, PatchOperation, RiskSeverity, VerificationStatus } from "./types.js";

export type ReviewReportExportKind = "markdown" | "html";

export type ReviewReportExportOptions = {
  generatedAt?: string;
  currentReviewTargetFingerprint?: string;
};

export type ReviewReportMetadata = {
  reportFormatVersion: "openworkflowdoctor.review-report.v1";
  packetSchemaVersion: DoctorReviewPacket["schemaVersion"];
  generatedAt: string;
  reviewTargetFingerprint: string;
  exportKind: ReviewReportExportKind;
  stale: boolean;
};

const severities: RiskSeverity[] = ["critical", "high", "medium", "low"];

export function createReviewReportMetadata(
  packet: DoctorReviewPacket,
  exportKind: ReviewReportExportKind,
  options: ReviewReportExportOptions = {}
): ReviewReportMetadata {
  return {
    reportFormatVersion: "openworkflowdoctor.review-report.v1",
    packetSchemaVersion: packet.schemaVersion,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    reviewTargetFingerprint: packet.reviewTargetFingerprint,
    exportKind,
    stale: Boolean(
      options.currentReviewTargetFingerprint &&
      options.currentReviewTargetFingerprint !== packet.reviewTargetFingerprint
    )
  };
}

export function renderReviewPacketMarkdownReport(
  packet: DoctorReviewPacket,
  options: ReviewReportExportOptions = {}
): string {
  const safePacket = sanitizeForExport(packet);
  const metadata = createReviewReportMetadata(safePacket, "markdown", options);
  const source = safePacket.source;
  const lines = [
    "# Workflow Review Report",
    "",
    `- workflowName: ${md(safePacket.workflowName)}`,
    `- sourcePlatform: ${code(source?.sourcePlatform ?? "unknown")}`,
    `- sourceKind: ${code(source?.sourceKind ?? "unknown")}`,
    `- adapterId: ${code(source?.adapterId ?? "unknown")}`,
    `- importMethod: ${code(source?.importMethod ?? "unknown")}`,
    `- stability: ${code(source?.stability ?? "unknown")}`,
    `- generatedAt: ${code(metadata.generatedAt)}`,
    `- reviewTargetFingerprint: ${code(safePacket.reviewTargetFingerprint)}`,
    `- reportFormatVersion: ${code(metadata.reportFormatVersion)}`,
    `- packetSchemaVersion: ${code(metadata.packetSchemaVersion)}`,
    `- exportKind: ${code(metadata.exportKind)}`,
    ""
  ];

  if (metadata.stale) {
    lines.push(
      "> Stale report warning: Report generated for previous source fingerprint. Refresh or rerun review before relying on this report.",
      ""
    );
  }

  lines.push(
    "## Executive Summary",
    "",
    `- Total risk count: ${totalRisks(safePacket.riskDelta.before)}`,
    `- Risk severity breakdown: ${formatSeverityBreakdown(safePacket.riskDelta.before)}`,
    `- Verifier status: ${code(safePacket.verification.status)}`,
    `- Human review status: ${code(safePacket.humanReview.decision)}`,
    `- Human review validation: ${code(safePacket.humanReviewValidation.status)}`,
    `- Patch proposal status: ${safePacket.patch.proposal.operations.length > 0 ? "present" : "not present"}`,
    `- Stale/current status: ${metadata.stale ? "stale" : "current"}`,
    "",
    "## Source Metadata",
    "",
    ...sourceMetadataLines(safePacket),
    "",
    "## Trust Boundaries",
    "",
    "- OpenWorkflowDoctor did not execute this workflow.",
    "- OpenWorkflowDoctor did not write back to the source platform.",
    "- OpenWorkflowDoctor did not inspect credentials.",
    "- Patch proposals are WorkflowIR previews only.",
    "- Human review remains required.",
    "",
    "## Diagnostics",
    "",
    ...diagnosticLines(safePacket),
    "",
    "## Patch Proposal",
    "",
    ...patchProposalLines(safePacket),
    "",
    "## Patch Diff Summary",
    "",
    ...patchDiffLines(safePacket),
    "",
    "## Verifier Result",
    "",
    ...verifierLines(safePacket),
    "",
    "## Human Review",
    "",
    ...humanReviewLines(safePacket),
    "",
    "## Appendix",
    "",
    ...appendixLines(safePacket, metadata),
    ""
  );

  return `${lines.join("\n")}\n`;
}

export function renderReviewPacketHtmlReport(
  packet: DoctorReviewPacket,
  options: ReviewReportExportOptions = {}
): string {
  const safePacket = sanitizeForExport(packet);
  const metadata = createReviewReportMetadata(safePacket, "html", options);
  const source = safePacket.source;
  const staleBanner = metadata.stale
    ? `<p class="stale">Report generated for previous source fingerprint. Refresh or rerun review before relying on this report.</p>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${html(safePacket.workflowName)} - Workflow Review Report</title>
<style>
body{font-family:Arial,sans-serif;line-height:1.5;margin:32px;color:#1f2933;background:#fff}
h1,h2,h3{line-height:1.2}
table{border-collapse:collapse;width:100%;margin:12px 0}
th,td{border:1px solid #c8d0d9;padding:6px 8px;text-align:left;vertical-align:top}
code{background:#eef2f6;padding:1px 4px;border-radius:3px}
.stale,.hold{border-left:4px solid #b7791f;background:#fff8e6;padding:10px 12px}
.fail{border-left:4px solid #c53030;background:#fff5f5;padding:10px 12px}
@media print{body{margin:16px}.stale,.hold,.fail{break-inside:avoid}}
</style>
</head>
<body>
<header>
<h1>Workflow Review Report</h1>
${staleBanner}
${table([
    ["Workflow name", safePacket.workflowName],
    ["Source platform", source?.sourcePlatform ?? "unknown"],
    ["Source kind", source?.sourceKind ?? "unknown"],
    ["Adapter id", source?.adapterId ?? "unknown"],
    ["Import method", source?.importMethod ?? "unknown"],
    ["Adapter stability", source?.stability ?? "unknown"],
    ["Generated at", metadata.generatedAt],
    ["Review target fingerprint", safePacket.reviewTargetFingerprint],
    ["Report format version", metadata.reportFormatVersion],
    ["Packet schema version", metadata.packetSchemaVersion],
    ["Export kind", metadata.exportKind]
  ])}
</header>
<main>
<section id="executive-summary">
<h2>Executive Summary</h2>
${table([
    ["Total risk count", String(totalRisks(safePacket.riskDelta.before))],
    ["Risk severity breakdown", formatSeverityBreakdown(safePacket.riskDelta.before)],
    ["Verifier status", safePacket.verification.status],
    ["Human review status", safePacket.humanReview.decision],
    ["Human review validation", safePacket.humanReviewValidation.status],
    ["Patch proposal status", safePacket.patch.proposal.operations.length > 0 ? "present" : "not present"],
    ["Stale/current status", metadata.stale ? "stale" : "current"]
  ])}
</section>
<section id="source-metadata">
<h2>Source Metadata</h2>
${table(sourceMetadataPairs(safePacket))}
</section>
<section id="trust-boundaries">
<h2>Trust Boundaries</h2>
${list([
    "OpenWorkflowDoctor did not execute this workflow.",
    "OpenWorkflowDoctor did not write back to the source platform.",
    "OpenWorkflowDoctor did not inspect credentials.",
    "Patch proposals are WorkflowIR previews only.",
    "Human review remains required."
  ])}
</section>
<section id="diagnostics">
<h2>Diagnostics</h2>
${diagnosticHtml(safePacket)}
</section>
<section id="patch-proposal">
<h2>Patch Proposal</h2>
${patchProposalHtml(safePacket)}
</section>
<section id="patch-diff-summary">
<h2>Patch Diff Summary</h2>
${patchDiffHtml(safePacket)}
</section>
<section id="verifier-result">
<h2>Verifier Result</h2>
${verifierHtml(safePacket)}
</section>
<section id="human-review">
<h2>Human Review</h2>
${humanReviewHtml(safePacket)}
</section>
<section id="appendix">
<h2>Appendix</h2>
${appendixHtml(safePacket, metadata)}
</section>
</main>
</body>
</html>
`;
}

function sourceMetadataLines(packet: DoctorReviewPacket): string[] {
  return sourceMetadataPairs(packet).map(([key, value]) => `- ${key}: ${code(value)}`);
}

function sourceMetadataPairs(packet: DoctorReviewPacket): [string, string][] {
  const source = packet.source;
  if (!source) {
    return [["sourcePlatform", "unknown"], ["sourceKind", "unknown"], ["adapterId", "unknown"]];
  }

  return [
    ["sourcePlatform", source.sourcePlatform],
    ["sourceKind", source.sourceKind],
    ["adapterId", source.adapterId],
    ["importMethod", source.importMethod],
    ["stability", source.stability],
    ["origin", describeSourceOrigin(source.sourceKind)],
    ["sourceVersion", source.sourceVersion ?? "not provided"],
    ["sourceAppMode", source.sourceAppMode ?? "not provided"],
    ["sourceLabel", source.sourceLabel ?? "not provided"],
    ["nodeCount", String(source.nodeCount)],
    ["edgeCount", String(source.edgeCount)],
    ["parserWarnings", source.parserWarnings.length ? source.parserWarnings.join("; ") : "none"],
    [
      "redactionSummary",
      `${source.redactionSummary.redactedValueCount} redacted value(s); keys: ${source.redactionSummary.redactedKeys.join(", ") || "none"}`
    ],
    [
      "unsupportedFeatureSummary",
      source.diagnostics.length
        ? source.diagnostics.map((diagnostic) => `${diagnostic.severity}:${diagnostic.code}`).join("; ")
        : "none"
    ]
  ];
}

function diagnosticLines(packet: DoctorReviewPacket): string[] {
  if (packet.original.issues.length === 0) {
    return ["No diagnostic risks were reported."];
  }

  return packet.original.issues.flatMap((issue, index) => [
    `### ${index + 1}. ${md(issue.title)}`,
    "",
    `- id: ${code(issue.id)}`,
    `- severity: ${code(issue.severity)}`,
    `- affected node/path: ${code(issue.nodeId ?? "workflow")}`,
    `- explanation: ${md(issue.explanation)}`,
    `- evidence summary: ${md(issue.evidence.join("; ") || "No evidence provided.")}`,
    `- recommended action: ${md(issue.suggestedFix || "Review manually.")}`,
    ""
  ]);
}

function patchProposalLines(packet: DoctorReviewPacket): string[] {
  const proposal = packet.patch.proposal;
  const proposalSource = packet.patch.proposalSource;
  return [
    `- proposal id: ${code(`proposal-${packet.reviewTargetFingerprint}`)}`,
    `- operation count: ${proposal.operations.length}`,
    `- affected nodes: ${proposal.operations.map((operation) => operation.targetNodeId).join(", ") || "none"}`,
    `- AI provenance: ${proposalSource?.kind === "ai-assisted" ? "AI-assisted proposal" : "deterministic proposal"}`,
    `- validation status: ${code(proposalSource?.validation?.semantic ?? packet.verification.status)}`,
    `- conflict status: ${code(proposalSource?.validation?.conflictStatus ?? "none")}`,
    "",
    proposal.summary ? `Summary: ${md(proposal.summary)}` : "Summary: none",
    "",
    ...(proposal.operations.length ? operationLines(proposal.operations) : ["No PatchOperation objects are present."])
  ];
}

function operationLines(operations: PatchOperation[]): string[] {
  return operations.map((operation, index) => {
    const summary = `${index + 1}. ${operation.type} -> ${operation.targetNodeId}`;
    return summary;
  });
}

function patchDiffLines(packet: DoctorReviewPacket): string[] {
  const added = packet.patch.patchDiff.filter((line) => line.marker === "+").length;
  const changed = packet.patch.patchDiff.filter((line) => line.marker === "~").length;
  return [
    `- added: ${added}`,
    `- changed: ${changed}`,
    "- removed: 0",
    `- resolved issues: ${packet.issueDelta.resolvedIssueIds.length}`,
    `- remaining issues: ${packet.issueDelta.remainingIssueIds.length}`,
    `- introduced issues: ${packet.issueDelta.introducedIssueIds.length}`,
    "- platform-native patch export: not included",
    "",
    ...(packet.patch.patchDiff.length ? diffSummaryLines(packet.patch.patchDiff) : ["No patch diff lines are present."])
  ];
}

function diffSummaryLines(diff: PatchDiffLine[]): string[] {
  return diff.map((line) => `- ${line.marker} ${md(line.title)} (${code(line.targetNodeId)})`);
}

function verifierLines(packet: DoctorReviewPacket): string[] {
  return [
    `- status: ${code(packet.verification.status)}`,
    `- acceptance recommendation: ${code(packet.acceptanceRecommendation)}`,
    `- blockers: ${packet.verification.requiredRemediation.length ? md(packet.verification.requiredRemediation.join("; ")) : "none"}`,
    `- required human checks: ${packet.acceptanceChecklist.filter((item) => item.status !== "pass").map((item) => item.id).join(", ") || "none"}`,
    "",
    ...packet.verification.checkedGates.map(
      (gate) => `- ${code(gate.status)} ${md(gate.title)}: ${md(gate.explanation)}`
    )
  ];
}

function humanReviewLines(packet: DoctorReviewPacket): string[] {
  return [
    `- reviewer decision: ${code(packet.humanReview.decision)}`,
    `- checklist state: ${packet.humanReview.confirmedChecklistItemIds.length} confirmed / ${packet.acceptanceChecklist.length} total`,
    `- accepted hold confirmations: ${packet.humanReview.confirmedChecklistItemIds.join(", ") || "none"}`,
    `- unresolved review items: ${packet.humanReviewValidation.missingChecklistItemIds.join(", ") || "none"}`,
    `- validation: ${code(packet.humanReviewValidation.status)} - ${md(packet.humanReviewValidation.explanation)}`,
    `- reviewer note: ${md(packet.humanReview.reviewerNote || "none")}`
  ];
}

function appendixLines(packet: DoctorReviewPacket, metadata: ReviewReportMetadata): string[] {
  const source = packet.source;
  return [
    `- reportFormatVersion: ${code(metadata.reportFormatVersion)}`,
    `- packetSchemaVersion: ${code(metadata.packetSchemaVersion)}`,
    `- parser warnings: ${md(source?.parserWarnings.join("; ") || "none")}`,
    `- redaction summary: ${md(source ? `${source.redactionSummary.redactedValueCount} redacted value(s)` : "not provided")}`,
    `- adapter metadata: ${md(source ? `${source.adapterId} / ${source.sourceKind} / ${source.sourcePlatform}` : "not provided")}`
  ];
}

function diagnosticHtml(packet: DoctorReviewPacket): string {
  if (packet.original.issues.length === 0) {
    return "<p>No diagnostic risks were reported.</p>";
  }

  return packet.original.issues
    .map(
      (issue) => `<article>
<h3>${html(issue.title)}</h3>
${table([
        ["id", issue.id],
        ["severity", issue.severity],
        ["affected node/path", issue.nodeId ?? "workflow"],
        ["explanation", issue.explanation],
        ["evidence summary", issue.evidence.join("; ") || "No evidence provided."],
        ["recommended action", issue.suggestedFix || "Review manually."]
      ])}
</article>`
    )
    .join("\n");
}

function patchProposalHtml(packet: DoctorReviewPacket): string {
  const proposal = packet.patch.proposal;
  const proposalSource = packet.patch.proposalSource;
  return `${table([
    ["proposal id", `proposal-${packet.reviewTargetFingerprint}`],
    ["operation count", String(proposal.operations.length)],
    ["affected nodes", proposal.operations.map((operation) => operation.targetNodeId).join(", ") || "none"],
    ["AI provenance", proposalSource?.kind === "ai-assisted" ? "AI-assisted proposal" : "deterministic proposal"],
    ["validation status", proposalSource?.validation?.semantic ?? packet.verification.status],
    ["conflict status", proposalSource?.validation?.conflictStatus ?? "none"]
  ])}
<p>${html(proposal.summary || "No proposal summary.")}</p>
${proposal.operations.length ? list(operationLines(proposal.operations)) : "<p>No PatchOperation objects are present.</p>"}`;
}

function patchDiffHtml(packet: DoctorReviewPacket): string {
  const added = packet.patch.patchDiff.filter((line) => line.marker === "+").length;
  const changed = packet.patch.patchDiff.filter((line) => line.marker === "~").length;
  return `${table([
    ["added", String(added)],
    ["changed", String(changed)],
    ["removed", "0"],
    ["resolved issues", String(packet.issueDelta.resolvedIssueIds.length)],
    ["remaining issues", String(packet.issueDelta.remainingIssueIds.length)],
    ["introduced issues", String(packet.issueDelta.introducedIssueIds.length)],
    ["platform-native patch export", "not included"]
  ])}
${packet.patch.patchDiff.length ? list(diffSummaryLines(packet.patch.patchDiff)) : "<p>No patch diff lines are present.</p>"}`;
}

function verifierHtml(packet: DoctorReviewPacket): string {
  return `${table([
    ["status", packet.verification.status],
    ["acceptance recommendation", packet.acceptanceRecommendation],
    ["blockers", packet.verification.requiredRemediation.join("; ") || "none"],
    [
      "required human checks",
      packet.acceptanceChecklist.filter((item) => item.status !== "pass").map((item) => item.id).join(", ") || "none"
    ]
  ])}
${list(packet.verification.checkedGates.map((gate) => `${gate.status} ${gate.title}: ${gate.explanation}`))}`;
}

function humanReviewHtml(packet: DoctorReviewPacket): string {
  return table([
    ["reviewer decision", packet.humanReview.decision],
    ["checklist state", `${packet.humanReview.confirmedChecklistItemIds.length} confirmed / ${packet.acceptanceChecklist.length} total`],
    ["accepted hold confirmations", packet.humanReview.confirmedChecklistItemIds.join(", ") || "none"],
    ["unresolved review items", packet.humanReviewValidation.missingChecklistItemIds.join(", ") || "none"],
    ["validation", `${packet.humanReviewValidation.status} - ${packet.humanReviewValidation.explanation}`],
    ["reviewer note", packet.humanReview.reviewerNote || "none"]
  ]);
}

function appendixHtml(packet: DoctorReviewPacket, metadata: ReviewReportMetadata): string {
  const source = packet.source;
  return table([
    ["reportFormatVersion", metadata.reportFormatVersion],
    ["packetSchemaVersion", metadata.packetSchemaVersion],
    ["parser warnings", source?.parserWarnings.join("; ") || "none"],
    ["redaction summary", source ? `${source.redactionSummary.redactedValueCount} redacted value(s)` : "not provided"],
    ["adapter metadata", source ? `${source.adapterId} / ${source.sourceKind} / ${source.sourcePlatform}` : "not provided"]
  ]);
}

function table(rows: [string, string][]): string {
  return `<table><tbody>${rows
    .map(([key, value]) => `<tr><th scope="row">${html(key)}</th><td>${html(value)}</td></tr>`)
    .join("")}</tbody></table>`;
}

function list(items: string[]): string {
  return `<ul>${items.map((item) => `<li>${html(item)}</li>`).join("")}</ul>`;
}

function totalRisks(counts: Record<RiskSeverity, number>): number {
  return severities.reduce((total, severity) => total + counts[severity], 0);
}

function formatSeverityBreakdown(counts: Record<RiskSeverity, number>): string {
  return severities.map((severity) => `${severity}: ${counts[severity]}`).join(", ");
}

function describeSourceOrigin(sourceKind: string): string {
  switch (sourceKind) {
    case "n8n-exported-json":
      return "n8n exported JSON";
    case "n8n-readonly":
      return "n8n read-only import";
    case "dify-dsl":
      return "Dify DSL YAML";
    case "coze-definition":
      return "Coze definition JSON";
    case "custom-graph-json":
      return "Custom Graph JSON";
    default:
      return "unknown";
  }
}

function code(value: string | VerificationStatus): string {
  return `\`${String(value).replaceAll("`", "'")}\``;
}

function md(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("|", "\\|");
}

function html(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
