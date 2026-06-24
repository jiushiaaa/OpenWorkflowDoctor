import { describe, expect, test } from "vitest";
import branchWorkflow from "./fixtures/refund-branch-workflow.json";
import { createDoctorReport, createDoctorReportFromWorkflow, parseN8nWorkflow } from "../src/index";

describe("createDoctorReport", () => {
  test("creates an end-to-end doctor report for a supported repair request", () => {
    const report = createDoctorReport(branchWorkflow, "帮我修复支付和通知相关风险");

    expect(report.workflow.name).toBe("Refund Workflow");
    expect(report.summary.workflowName).toBe("Refund Workflow");
    expect(report.view.nodes.find((node) => node.id === "refund")).toMatchObject({
      issueCount: 4,
      highestSeverity: "critical"
    });
    expect(report.issues.map((issue) => issue.id)).toEqual(
      expect.arrayContaining(["payment_without_idempotency:refund", "webhook_without_dedupe:webhook"])
    );
    expect(report.proposal.operations).toHaveLength(2);
    expect(report.patchDiff.map((line) => line.title)).toEqual([
      "Update parameters on Stripe Refund",
      "Add Webhook Dedupe Check after Webhook Trigger"
    ]);
    expect(report.patchedWorkflow.nodes.map((node) => node.id)).toContain("webhook-dedupe-check");
    expect(report.patchedView.nodes.map((node) => node.id)).toContain("webhook-dedupe-check");
    expect(report.patchedView.nodes.find((node) => node.id === "refund")).toMatchObject({
      issueCount: 3,
      highestSeverity: "high"
    });
    expect(report.patchedSummary.riskCounts.critical).toBe(0);
    expect(report.verification.status).toBe("hold");
    expect(report.acceptanceRecommendation).toBe("hold");
  });

  test("creates a fail report for malformed workflow input", () => {
    const report = createDoctorReport({ name: "Broken", nodes: "bad", connections: null }, "帮我修复支付风险");

    expect(report.workflow.name).toBe("Broken");
    expect(report.summary.overview).toBe("Broken has no parsed workflow nodes.");
    expect(report.view).toEqual({ nodes: [], edges: [] });
    expect(report.patchedView).toEqual({ nodes: [], edges: [] });
    expect(report.proposal.operations).toEqual([]);
    expect(report.verification.status).toBe("fail");
    expect(report.acceptanceRecommendation).toBe("fail");
  });

  test("creates a doctor report from already parsed secret-safe WorkflowIR", () => {
    const workflow = parseN8nWorkflow({
      name: "Secret Rerun Workflow",
      nodes: [
        {
          id: "http",
          name: "HTTP Request",
          type: "n8n-nodes-base.httpRequest",
          parameters: {
            apiKey: "sk_live_rerun_secret"
          }
        }
      ],
      connections: {}
    });
    const report = createDoctorReportFromWorkflow(workflow, "检查风险");
    const serialized = JSON.stringify(report);

    expect(report.workflow.nodes[0]?.parameters).toContainEqual({
      key: "apiKey",
      valueType: "string",
      preview: "[redacted]",
      redacted: true
    });
    expect(serialized).not.toContain("sk_live_rerun_secret");
  });

  test("creates a comprehensive review packet shape for all supported repairs", () => {
    const report = createDoctorReport(branchWorkflow, "请全面修复所有支持的可靠性问题");

    expect(report.proposal.operations).toHaveLength(5);
    expect(report.patchDiff.map((line) => line.title)).toEqual([
      "Update parameters on Stripe Refund",
      "Add Webhook Dedupe Check after Webhook Trigger",
      "Add Stripe Refund Success Audit Log after Stripe Refund",
      "Update parameters on Lookup Order",
      "Add Stripe Refund Error Handler as error branch for Stripe Refund"
    ]);
    expect(report.patchedIssues.map((issue) => issue.id)).not.toEqual(
      expect.arrayContaining([
        "payment_without_idempotency:refund",
        "webhook_without_dedupe:webhook",
        "side_effect_without_audit_trail:refund",
        "http_without_timeout:lookup",
        "missing_error_branch:refund"
      ])
    );
    expect(report.verification.status).toBe("hold");
  });
});
