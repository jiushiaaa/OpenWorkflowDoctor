import { describe, expect, test } from "vitest";
import contentAutomationWorkflow from "../../../samples/n8n/content-automation.workflow.json";
import messyLegacyWorkflow from "../../../samples/n8n/messy-legacy.workflow.json";
import refundRiskyWorkflow from "../../../samples/n8n/refund-risky.workflow.json";
import { createDoctorReport, createDoctorReviewPacket, diagnoseWorkflow, parseN8nWorkflow } from "../src/index";
import type { WorkflowIR } from "../src/index";

const sampleFixtures = [
  {
    name: "refund-risky.workflow.json",
    workflow: refundRiskyWorkflow,
    request: "请全面修复所有支持的可靠性问题"
  },
  {
    name: "content-automation.workflow.json",
    workflow: contentAutomationWorkflow,
    request: "检查内容自动化工作流风险"
  },
  {
    name: "messy-legacy.workflow.json",
    workflow: messyLegacyWorkflow,
    request: "检查遗留工作流风险"
  }
];

const realLookingSecretPatterns = [
  /\bsk_(live|test)_[A-Za-z0-9]{12,}\b/,
  /\bpk_(live|test)_[A-Za-z0-9]{12,}\b/,
  /\brk_(live|test)_[A-Za-z0-9]{12,}\b/,
  /\bwhsec_[A-Za-z0-9]{12,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bghp_[A-Za-z0-9]{20,}\b/,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}\b/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/
];

describe("sample n8n workflow fixtures", () => {
  test.each(sampleFixtures)("$name parses and generates a secret-safe review packet", ({ workflow, request }) => {
    const parsedWorkflow = parseN8nWorkflow(workflow);
    const report = createDoctorReport(workflow, request);
    const packet = createDoctorReviewPacket(report, "2026-06-24T00:00:00.000Z");
    const serializedPacket = JSON.stringify(packet);

    expect(parsedWorkflow.nodes.length).toBeGreaterThan(0);
    expect(report.workflow.nodes.length).toBe(parsedWorkflow.nodes.length);
    expect(report.summary.workflowName).toBe(parsedWorkflow.name);
    expect(packet.workflowName).toBe(parsedWorkflow.name);
    expect(serializedPacket).not.toMatch(/\b(live|production|prod)\b.*\b(secret|token|key)\b/i);
    expect(serializedPacket).not.toMatch(/\b(secret|token|key)\b.*\b(live|production|prod)\b/i);
  });

  test.each(sampleFixtures)("$name does not contain real-looking secrets", ({ workflow }) => {
    const serializedFixture = JSON.stringify(workflow);

    for (const pattern of realLookingSecretPatterns) {
      expect(serializedFixture).not.toMatch(pattern);
    }
  });

  test("refund-risky.workflow.json contains the requested risky refund automation shape", () => {
    const workflow = parseN8nWorkflow(refundRiskyWorkflow);
    const issues = diagnoseWorkflow(workflow).map((issue) => issue.id);

    expect(nodeTypes(workflow)).toEqual(
      expect.arrayContaining([
        "n8n-nodes-base.webhook",
        "n8n-nodes-base.httpRequest",
        "n8n-nodes-base.if",
        "n8n-nodes-base.stripe",
        "n8n-nodes-base.hubspot",
        "n8n-nodes-base.emailSend",
        "n8n-nodes-base.slack"
      ])
    );
    expect(issues).toEqual(
      expect.arrayContaining([
        "webhook_without_dedupe:refund-webhook",
        "payment_without_idempotency:create-refund",
        "database_update_without_fallback:update-crm",
        "email_without_send_log:send-customer-email"
      ])
    );
    expect(hasEdge(workflow, "large-refund-stop-marker", "create-refund")).toBe(true);
  });

  test("content-automation.workflow.json stays lower risk without critical issues", () => {
    const workflow = parseN8nWorkflow(contentAutomationWorkflow);
    const report = createDoctorReport(contentAutomationWorkflow, "检查内容自动化工作流风险");

    expect(nodeTypes(workflow)).toEqual(
      expect.arrayContaining([
        "n8n-nodes-base.rssFeedRead",
        "n8n-nodes-base.httpRequest",
        "n8n-nodes-base.openAi",
        "n8n-nodes-base.notion",
        "n8n-nodes-base.slack"
      ])
    );
    expect(report.summary.riskCounts.critical).toBe(0);
    expect(report.summary.riskCounts.medium).toBeGreaterThan(0);
  });

  test("messy-legacy.workflow.json exposes legacy graph problems", () => {
    const workflow = parseN8nWorkflow(messyLegacyWorkflow);
    const issues = diagnoseWorkflow(workflow).map((issue) => issue.id);

    expect(workflow.nodes.filter((node) => node.typeFamily === "unknown").map((node) => node.id)).toContain(
      "custom-transform"
    );
    expect(workflow.nodes.map((node) => node.name)).toEqual(
      expect.arrayContaining(["Notify Ops", "Notify Ops Copy", "Dead Legacy Helper"])
    );
    expect(issues).toEqual(
      expect.arrayContaining([
        "isolated_node:dead-helper",
        "control_branch_without_route:legacy-switch:2"
      ])
    );
    expect(hasEdge(workflow, "notify-ops", "audit-append")).toBe(true);
    expect(hasEdge(workflow, "notify-ops-copy", "audit-append")).toBe(true);
  });
});

function nodeTypes(workflow: WorkflowIR): string[] {
  return workflow.nodes.map((node) => node.type);
}

function hasEdge(workflow: WorkflowIR, sourceNodeId: string, targetNodeId: string): boolean {
  return workflow.edges.some((edge) => edge.sourceNodeId === sourceNodeId && edge.targetNodeId === targetNodeId);
}
