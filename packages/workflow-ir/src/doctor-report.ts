import { parseN8nWorkflow } from "./n8n-parser.js";
import { applyPatchOperations } from "./patch.js";
import { formatPatchDiff } from "./patch-diff.js";
import { createRuleBasedPatchProposal } from "./patch-proposal.js";
import { diagnoseWorkflow } from "./risk-rules.js";
import { summarizeWorkflow } from "./summary.js";
import { verifyPatch } from "./verifier.js";
import { createWorkflowViewModel } from "./view-model.js";
import type { DoctorReport, VerificationStatus, VerificationReport, WorkflowIR } from "./types.js";

export function createDoctorReport(rawWorkflow: unknown, request: string): DoctorReport {
  const workflow = parseN8nWorkflow(rawWorkflow);
  return createDoctorReportFromWorkflow(workflow, request);
}

export function createDoctorReportFromWorkflow(workflow: WorkflowIR, request: string): DoctorReport {
  const summary = summarizeWorkflow(workflow);
  const issues = diagnoseWorkflow(workflow);
  const view = createWorkflowViewModel(workflow, issues);
  const proposal = createRuleBasedPatchProposal(workflow, request);
  const patchDiff = formatPatchDiff(workflow, proposal.operations);
  const patchedWorkflow = applyPatchOperations(workflow, proposal.operations);
  const patchedSummary = summarizeWorkflow(patchedWorkflow);
  const patchedIssues = diagnoseWorkflow(patchedWorkflow);
  const patchedView = createWorkflowViewModel(patchedWorkflow, patchedIssues);
  const verification = verifyPatch({
    original: workflow,
    patched: patchedWorkflow,
    operations: proposal.operations
  });

  return {
    workflow,
    summary,
    view,
    issues,
    proposal,
    patchDiff,
    patchedWorkflow,
    patchedSummary,
    patchedView,
    patchedIssues,
    verification,
    acceptanceRecommendation: recommendAcceptance(summary.recommendedStatus, verification)
  };
}

function recommendAcceptance(summaryStatus: VerificationStatus, verification: VerificationReport): VerificationStatus {
  if (summaryStatus === "fail" || verification.status === "fail") {
    return "fail";
  }
  if (summaryStatus === "hold" || verification.status === "hold") {
    return "hold";
  }
  return "pass";
}
