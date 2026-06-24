import { describe, expect, test } from "vitest";
import {
  parsePatchProposal,
  parseVerificationReport,
  patchProposalSchema,
  verificationReportSchema
} from "../src/index";

describe("structured output schemas", () => {
  test("accepts a valid structured patch proposal", () => {
    const proposal = parsePatchProposal({
      summary: "Add idempotency to refund.",
      operations: [
        {
          type: "update_node_parameters",
          targetNodeId: "refund",
          parameters: {
            idempotencyKey: "={{$json.requestId}}"
          }
        }
      ],
      risksAddressed: ["payment_without_idempotency:refund"],
      expectedImpact: ["Adds an idempotency key to Stripe Refund."],
      risksIntroduced: [],
      requiresHumanReview: true
    });

    expect(proposal.operations[0]).toEqual({
      type: "update_node_parameters",
      targetNodeId: "refund",
      parameters: {
        idempotencyKey: "={{$json.requestId}}"
      }
    });
    expect(patchProposalSchema.safeParse(proposal).success).toBe(true);
  });

  test("accepts explicit error-branch patch operations", () => {
    const proposal = parsePatchProposal({
      summary: "Add error handling to refund.",
      operations: [
        {
          type: "insert_error_branch",
          targetNodeId: "refund",
          newNode: {
            id: "refund-error-handler",
            name: "Stripe Refund Error Handler",
            type: "openworkflowdoctor.error.handler",
            typeFamily: "unknown",
            parameters: []
          }
        }
      ],
      risksAddressed: ["missing_error_branch:refund"],
      expectedImpact: ["Adds an explicit error handler for Stripe Refund."],
      risksIntroduced: [],
      requiresHumanReview: true
    });

    expect(proposal.operations[0]).toMatchObject({
      type: "insert_error_branch",
      targetNodeId: "refund"
    });
  });

  test("accepts explicit control branch route patch operations", () => {
    const proposal = parsePatchProposal({
      summary: "Route missing IF output.",
      operations: [
        {
          type: "insert_branch_route",
          targetNodeId: "branch",
          sourceOutputIndex: 1,
          newNode: {
            id: "branch-output-1-stop",
            name: "Branch Output 1 Stop",
            type: "openworkflowdoctor.flow.stop",
            typeFamily: "unknown",
            parameters: []
          }
        }
      ],
      risksAddressed: ["control_branch_without_route:branch:1"],
      expectedImpact: ["Adds a stop route for IF refund amount > 500 output 1."],
      risksIntroduced: [],
      requiresHumanReview: true
    });

    expect(proposal.operations[0]).toMatchObject({
      type: "insert_branch_route",
      targetNodeId: "branch",
      sourceOutputIndex: 1
    });
  });

  test("rejects patch proposals that are not explicitly reviewable", () => {
    expect(() =>
      parsePatchProposal({
        summary: "I fixed it.",
        operations: [],
        risksAddressed: [],
        expectedImpact: [],
        risksIntroduced: [],
        requiresHumanReview: false
      })
    ).toThrow("PatchProposal must require human review.");
  });

  test("accepts a valid verification report", () => {
    const report = parseVerificationReport({
      status: "hold",
      checkedGates: [
        {
          id: "remaining_high_risks",
          title: "No high or critical risks remain",
          status: "hold",
          explanation: "Patched workflow still has high or critical risks."
        }
      ],
      passedScenarios: [],
      failedScenarios: [],
      warnings: ["Patched workflow still has high or critical risks."],
      requiredRemediation: ["Resolve remaining high and critical risk issues before accepting."]
    });

    expect(report.status).toBe("hold");
    expect(verificationReportSchema.safeParse(report).success).toBe(true);
  });

  test("rejects free-form verifier output", () => {
    expect(() => parseVerificationReport("looks good to me")).toThrow("Invalid VerificationReport.");
  });
});
