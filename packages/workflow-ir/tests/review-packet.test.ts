import { describe, expect, test } from "vitest";
import branchWorkflow from "./fixtures/refund-branch-workflow.json";
import { createDoctorReport, createDoctorReviewPacket, parseN8nWorkflow, type DoctorReport } from "../src/index";

describe("createDoctorReviewPacket", () => {
  test("creates a serializable review packet with before and after risk counts", () => {
    const report = createDoctorReport(branchWorkflow, "帮我修复支付和通知相关风险");
    const packet = createDoctorReviewPacket(report, "2026-06-23T00:00:00.000Z");

    expect(packet).toMatchObject({
      schemaVersion: "openworkflowdoctor.review-packet.v1",
      generatedAt: "2026-06-23T00:00:00.000Z",
      workflowName: "Refund Workflow",
      acceptanceRecommendation: "hold",
      riskDelta: {
        before: {
          critical: 1,
          high: 3,
          medium: 2,
          low: 0
        },
        after: {
          critical: 0,
          high: 2,
          medium: 2,
          low: 0
        }
      }
    });
    expect(packet.patch.proposal.operations).toHaveLength(2);
    expect(packet.patch.patchDiff.map((line) => line.marker)).toEqual(["~", "+"]);
    expect(packet.patch.patchedWorkflow.nodes.map((node) => node.id)).toContain("webhook-dedupe-check");
    expect(() => JSON.stringify(packet)).not.toThrow();
  });

  test("does not share mutable workflow references with the source report", () => {
    const report = createDoctorReport(branchWorkflow, "帮我修复支付风险");
    const packet = createDoctorReviewPacket(report, "2026-06-23T00:00:00.000Z");

    packet.original.workflow.nodes[0]!.name = "Changed";

    expect(report.workflow.nodes[0]!.name).toBe("Webhook Trigger");
  });

  test("keeps redacted parameter previews in exported packets", () => {
    const report = createDoctorReport(
      {
        name: "Secret Workflow",
        nodes: [
          {
            id: "http",
            name: "HTTP Request",
            type: "n8n-nodes-base.httpRequest",
            parameters: {
              apiKey: "sk_live_should_not_leak",
              headers: {
                Authorization: "Bearer secret-token"
              }
            }
          }
        ],
        connections: {}
      },
      "检查风险"
    );
    const packet = createDoctorReviewPacket(report, "2026-06-23T00:00:00.000Z");
    const serialized = JSON.stringify(packet);

    expect(serialized).toContain("[redacted]");
    expect(serialized).not.toContain("sk_live_should_not_leak");
    expect(serialized).not.toContain("secret-token");
  });

  test("does not leak secrets from raw imported workflow shapes into exported packets", () => {
    const report = createDoctorReport(
      {
        name: "Secret Export Workflow",
        nodes: [
          {
            id: "webhook",
            name: "Webhook Trigger",
            type: "n8n-nodes-base.webhook",
            parameters: {
              credentials: {
                id: "cred_live_secret",
                name: "Live API Account"
              },
              headers: [
                {
                  name: "Authorization",
                  value: "Bearer live-array-token"
                }
              ],
              requestBody: {
                password: "plaintext-body-password"
              },
              queryParameters: [
                {
                  name: "api_key",
                  value: "query-api-secret"
                }
              ]
            }
          }
        ],
        connections: {}
      },
      "检查风险"
    );
    const packet = createDoctorReviewPacket(report, "2026-06-23T00:00:00.000Z");
    const serialized = JSON.stringify(packet);

    expect(serialized).toContain("[redacted]");
    expect(serialized).not.toContain("cred_live_secret");
    expect(serialized).not.toContain("Live API Account");
    expect(serialized).not.toContain("live-array-token");
    expect(serialized).not.toContain("plaintext-body-password");
    expect(serialized).not.toContain("query-api-secret");
  });

  test("does not leak sensitive patch operation payloads into exported packets", () => {
    const workflow = parseN8nWorkflow(branchWorkflow);
    const baseReport = createDoctorReport(branchWorkflow, "检查风险");
    const report: DoctorReport = {
      ...baseReport,
      workflow,
      proposal: {
        summary: "Sensitive proposal",
        operations: [
          {
            type: "update_node_parameters",
            targetNodeId: "refund",
            parameters: {
              Authorization: "Bearer packet-secret",
              url: "https://api.example.test/refunds?access_token=query-secret&safe=1"
            }
          }
        ],
        risksAddressed: [],
        expectedImpact: [],
        risksIntroduced: [],
        requiresHumanReview: true
      },
      patchDiff: [
        {
          id: "patch-0-update_node_parameters-refund",
          marker: "~",
          operationType: "update_node_parameters",
          targetNodeId: "refund",
          targetNodeName: "Stripe Refund",
          title: "Update parameters on Stripe Refund",
          details: ["Set Authorization to Bearer packet-secret"]
        }
      ],
      patchedWorkflow: {
        ...workflow,
        nodes: workflow.nodes.map((node) =>
          node.id === "refund"
            ? {
                ...node,
                parameters: [
                  ...node.parameters,
                  {
                    key: "Authorization",
                    valueType: "string",
                    preview: "Bearer packet-secret"
                  }
                ]
              }
            : node
        )
      }
    };
    const packet = createDoctorReviewPacket(report, "2026-06-23T00:00:00.000Z");
    const serialized = JSON.stringify(packet);

    expect(serialized).toContain("[redacted]");
    expect(serialized).not.toContain("packet-secret");
    expect(serialized).not.toContain("query-secret");
    expect(serialized).toContain("safe=1");
  });

  test("adds a human-readable acceptance checklist from verifier gates", () => {
    const report = createDoctorReport(branchWorkflow, "请全面修复所有支持的可靠性问题");
    const packet = createDoctorReviewPacket(report, "2026-06-23T00:00:00.000Z");

    expect(packet.acceptanceChecklist).toEqual([
      {
        id: "patch_has_operations",
        label: "Patch contains reviewable operations",
        status: "pass",
        action: "No action needed."
      },
      {
        id: "workflow_has_nodes",
        label: "Workflow still has nodes",
        status: "pass",
        action: "No action needed."
      },
      {
        id: "critical_risk_count",
        label: "Critical risks are not increased",
        status: "pass",
        action: "No action needed."
      },
      {
        id: "remaining_repairable_high_risks",
        label: "No repairable high or critical risks remain",
        status: "pass",
        action: "No action needed."
      },
      {
        id: "side_effect_human_review",
        label: "Remaining side effects need human confirmation",
        status: "hold",
        action: "Human reviewer must confirm the remaining side-effect nodes are expected before accepting."
      }
    ]);
  });

  test("records a human review decision separately from the verifier recommendation", () => {
    const report = createDoctorReport(branchWorkflow, "请全面修复所有支持的可靠性问题");
    const packet = createDoctorReviewPacket(report, "2026-06-23T00:00:00.000Z", {
      decision: "accepted",
      reviewerNote: "Confirmed Stripe Refund is an expected business side effect.",
      decidedAt: "2026-06-23T00:01:00.000Z",
      confirmedChecklistItemIds: ["side_effect_human_review"]
    });

    expect(packet.acceptanceRecommendation).toBe("hold");
    expect(packet.humanReview).toEqual({
      decision: "accepted",
      reviewerNote: "Confirmed Stripe Refund is an expected business side effect.",
      decidedAt: "2026-06-23T00:01:00.000Z",
      confirmedChecklistItemIds: ["side_effect_human_review"]
    });
  });

  test("holds an accepted human review when required checklist confirmations are missing", () => {
    const report = createDoctorReport(branchWorkflow, "请全面修复所有支持的可靠性问题");
    const packet = createDoctorReviewPacket(report, "2026-06-23T00:00:00.000Z", {
      decision: "accepted",
      reviewerNote: "Accepting without explicit confirmation should be flagged.",
      decidedAt: "2026-06-23T00:01:00.000Z",
      confirmedChecklistItemIds: []
    });

    expect(packet.humanReview.decision).toBe("accepted");
    expect(packet.humanReviewValidation).toEqual({
      status: "hold",
      missingChecklistItemIds: ["side_effect_human_review"],
      explanation: "Accepted human review is missing required checklist confirmations."
    });
  });

  test("fails an accepted human review when verifier gates failed even if confirmations are checked", () => {
    const report = createDoctorReport({ name: "Broken", nodes: "bad", connections: null }, "帮我修复支付风险");
    const packet = createDoctorReviewPacket(report, "2026-06-23T00:00:00.000Z", {
      decision: "accepted",
      reviewerNote: "Trying to accept a failed verifier result.",
      decidedAt: "2026-06-23T00:01:00.000Z",
      confirmedChecklistItemIds: ["patch_has_operations", "workflow_has_nodes"]
    });

    expect(packet.verification.status).toBe("fail");
    expect(packet.humanReviewValidation).toEqual({
      status: "fail",
      missingChecklistItemIds: [],
      explanation: "Accepted human review cannot override failed verifier gates."
    });
  });

  test("keeps a stable review target fingerprint across generated time and human review changes", () => {
    const report = createDoctorReport(branchWorkflow, "请全面修复所有支持的可靠性问题");
    const firstPacket = createDoctorReviewPacket(report, "2026-06-23T00:00:00.000Z", {
      decision: "undecided",
      reviewerNote: "",
      confirmedChecklistItemIds: []
    });
    const secondPacket = createDoctorReviewPacket(report, "2026-06-23T00:05:00.000Z", {
      decision: "accepted",
      reviewerNote: "Confirmed expected side effect.",
      decidedAt: "2026-06-23T00:06:00.000Z",
      confirmedChecklistItemIds: ["side_effect_human_review"]
    });

    expect(firstPacket.reviewTargetFingerprint).toMatch(/^owd1-[0-9a-f]{16}$/);
    expect(secondPacket.reviewTargetFingerprint).toBe(firstPacket.reviewTargetFingerprint);
  });

  test("changes the review target fingerprint when the proposed patch changes", () => {
    const paymentOnlyReport = createDoctorReport(branchWorkflow, "帮我修复支付风险");
    const comprehensiveReport = createDoctorReport(branchWorkflow, "请全面修复所有支持的可靠性问题");

    expect(createDoctorReviewPacket(paymentOnlyReport).reviewTargetFingerprint).not.toBe(
      createDoctorReviewPacket(comprehensiveReport).reviewTargetFingerprint
    );
  });

  test("changes the review target fingerprint when issue delta inputs change", () => {
    const report = createDoctorReport(branchWorkflow, "请全面修复所有支持的可靠性问题");
    const changedIssueReport = {
      ...report,
      issues: report.issues.slice(1)
    };

    expect(createDoctorReviewPacket(changedIssueReport).issueDelta).not.toEqual(
      createDoctorReviewPacket(report).issueDelta
    );
    expect(createDoctorReviewPacket(changedIssueReport).reviewTargetFingerprint).not.toBe(
      createDoctorReviewPacket(report).reviewTargetFingerprint
    );
  });

  test("summarizes resolved, remaining, and introduced issues", () => {
    const report = createDoctorReport(branchWorkflow, "请全面修复所有支持的可靠性问题");
    const packet = createDoctorReviewPacket(report, "2026-06-23T00:00:00.000Z");

    expect(packet.issueDelta).toEqual({
      resolvedIssueIds: [
        "webhook_without_dedupe:webhook",
        "http_without_timeout:lookup",
        "missing_error_branch:refund",
        "side_effect_without_audit_trail:refund",
        "payment_without_idempotency:refund"
      ],
      remainingIssueIds: ["high_risk_side_effect_node:refund"],
      introducedIssueIds: []
    });
  });
});
