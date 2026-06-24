import { describe, expect, test } from "vitest";
import branchWorkflow from "./fixtures/refund-branch-workflow.json";
import isolatedWorkflow from "./fixtures/isolated-workflow.json";
import { diagnoseWorkflow, parseN8nWorkflow } from "../src/index";

describe("diagnoseWorkflow", () => {
  test("detects payment and webhook safety risks in a refund workflow", () => {
    const workflow = parseN8nWorkflow(branchWorkflow);
    const issues = diagnoseWorkflow(workflow);

    expect(issues.map((issue) => issue.id)).toEqual(
      expect.arrayContaining([
        "webhook_without_dedupe:webhook",
        "http_without_timeout:lookup",
        "high_risk_side_effect_node:refund",
        "payment_without_idempotency:refund",
        "missing_error_branch:refund"
      ])
    );
    expect(issues.find((issue) => issue.id === "payment_without_idempotency:refund")).toMatchObject({
      severity: "critical",
      nodeId: "refund",
      title: "Payment action has no idempotency guard"
    });
  });

  test("detects isolated nodes and notification risks", () => {
    const workflow = parseN8nWorkflow(isolatedWorkflow);
    const issues = diagnoseWorkflow(workflow);

    expect(issues.map((issue) => issue.id)).toEqual(
      expect.arrayContaining([
        "isolated_node:orphan",
        "http_without_timeout:orphan",
        "high_risk_side_effect_node:email",
        "email_without_send_log:email",
        "missing_error_branch:email"
      ])
    );
  });

  test("detects database update nodes without fallback", () => {
    const workflow = parseN8nWorkflow({
      name: "CRM Update",
      nodes: [
        {
          id: "crm",
          name: "Update CRM",
          type: "n8n-nodes-base.postgres",
          parameters: {
            operation: "update",
            table: "customers"
          }
        }
      ],
      connections: {}
    });

    const issues = diagnoseWorkflow(workflow);

    expect(issues.map((issue) => issue.id)).toEqual(
      expect.arrayContaining([
        "high_risk_side_effect_node:crm",
        "database_update_without_fallback:crm",
        "missing_error_branch:crm"
      ])
    );
  });

  test("detects control-flow nodes with an unconnected branch output", () => {
    const workflow = parseN8nWorkflow({
      name: "Incomplete Approval Branch",
      nodes: [
        {
          id: "branch",
          name: "IF refund amount > 500",
          type: "n8n-nodes-base.if",
          parameters: {}
        },
        {
          id: "approval",
          name: "Manual Approval",
          type: "n8n-nodes-base.manualTrigger",
          parameters: {}
        }
      ],
      connections: {
        "IF refund amount > 500": {
          main: [
            [
              {
                node: "Manual Approval",
                type: "main",
                index: 0
              }
            ]
          ]
        }
      }
    });

    const issues = diagnoseWorkflow(workflow);

    expect(issues.find((issue) => issue.id === "control_branch_without_route:branch:1")).toMatchObject({
      severity: "medium",
      nodeId: "branch",
      title: "Control branch has no route"
    });
  });

  test("detects high-risk side effects without a downstream audit trail", () => {
    const workflow = parseN8nWorkflow({
      name: "Refund With Error Handling",
      nodes: [
        {
          id: "refund",
          name: "Stripe Refund",
          type: "n8n-nodes-base.stripe",
          parameters: {
            resource: "charge",
            operation: "refund",
            idempotencyKey: "={{$json.requestId}}"
          }
        },
        {
          id: "failure",
          name: "Record Refund Failure",
          type: "n8n-nodes-base.postgres",
          parameters: {}
        }
      ],
      connections: {
        "Stripe Refund": {
          error: [
            [
              {
                node: "Record Refund Failure",
                type: "main",
                index: 0
              }
            ]
          ]
        }
      }
    });

    const issues = diagnoseWorkflow(workflow);

    expect(issues.find((issue) => issue.id === "side_effect_without_audit_trail:refund")).toMatchObject({
      severity: "medium",
      nodeId: "refund",
      title: "Side effect has no success audit trail"
    });
  });

  test("does not classify refund failure logs as payment actions", () => {
    const workflow = parseN8nWorkflow({
      name: "Refund Failure Log",
      nodes: [
        {
          id: "failure",
          name: "Record Refund Failure",
          type: "n8n-nodes-base.postgres",
          parameters: {}
        }
      ],
      connections: {}
    });

    const issues = diagnoseWorkflow(workflow);
    const issueIds = issues.map((issue) => issue.id);

    expect(issueIds).not.toContain("payment_without_idempotency:failure");
    expect(issueIds).not.toContain("side_effect_without_audit_trail:failure");
  });

  test("does not classify generated error handlers as payment side effects", () => {
    const workflow = parseN8nWorkflow({
      name: "Generated Error Handler",
      nodes: [
        {
          id: "refund-error-handler",
          name: "Stripe Refund Error Handler",
          type: "openworkflowdoctor.error.handler",
          parameters: {}
        }
      ],
      connections: {}
    });

    const issueIds = diagnoseWorkflow(workflow).map((issue) => issue.id);

    expect(issueIds).not.toContain("high_risk_side_effect_node:refund-error-handler");
    expect(issueIds).not.toContain("payment_without_idempotency:refund-error-handler");
    expect(issueIds).not.toContain("missing_error_branch:refund-error-handler");
  });

  test("does not classify generated stop routes as payment side effects", () => {
    const workflow = parseN8nWorkflow({
      name: "Generated Stop Route",
      nodes: [
        {
          id: "branch-output-1-stop",
          name: "IF refund amount > 500 Output 1 Stop",
          type: "openworkflowdoctor.flow.stop",
          parameters: {}
        }
      ],
      connections: {}
    });

    const issueIds = diagnoseWorkflow(workflow).map((issue) => issue.id);

    expect(issueIds).not.toContain("high_risk_side_effect_node:branch-output-1-stop");
    expect(issueIds).not.toContain("payment_without_idempotency:branch-output-1-stop");
    expect(issueIds).not.toContain("missing_error_branch:branch-output-1-stop");
  });

  test("treats a direct downstream dedupe guard as webhook duplicate protection", () => {
    const workflow = parseN8nWorkflow({
      name: "Webhook With Dedupe Guard",
      nodes: [
        {
          id: "webhook",
          name: "Webhook Trigger",
          type: "n8n-nodes-base.webhook",
          parameters: {
            path: "refund"
          }
        },
        {
          id: "webhook-dedupe-check",
          name: "Webhook Dedupe Check",
          type: "openworkflowdoctor.guard.dedupe",
          parameters: {
            dedupeKey: "={{$json.requestId}}"
          }
        }
      ],
      connections: {
        "Webhook Trigger": {
          main: [
            [
              {
                node: "Webhook Dedupe Check",
                type: "main",
                index: 0
              }
            ]
          ]
        }
      }
    });

    const issueIds = diagnoseWorkflow(workflow).map((issue) => issue.id);

    expect(issueIds).not.toContain("webhook_without_dedupe:webhook");
  });

  test("does not classify log nodes as unsafe email, payment, or database side effects", () => {
    const workflow = parseN8nWorkflow({
      name: "Log Nodes",
      nodes: [
        {
          id: "email-log",
          name: "Email Send Log",
          type: "custom.log",
          parameters: {}
        },
        {
          id: "refund-log",
          name: "Refund Audit Log",
          type: "custom.log",
          parameters: {}
        },
        {
          id: "database-log",
          name: "Database Update Log",
          type: "custom.log",
          parameters: {}
        }
      ],
      connections: {}
    });

    const issueIds = diagnoseWorkflow(workflow).map((issue) => issue.id);

    expect(issueIds).not.toContain("high_risk_side_effect_node:email-log");
    expect(issueIds).not.toContain("email_without_send_log:email-log");
    expect(issueIds).not.toContain("payment_without_idempotency:refund-log");
    expect(issueIds).not.toContain("database_update_without_fallback:database-log");
  });

  test("does not classify status or failure notification records as business mutation nodes", () => {
    const workflow = parseN8nWorkflow({
      name: "Status Records",
      nodes: [
        {
          id: "failure-notification",
          name: "Failure Notification Status",
          type: "custom.status",
          parameters: {}
        },
        {
          id: "crm-status",
          name: "CRM Update Failure Record",
          type: "custom.status",
          parameters: {}
        }
      ],
      connections: {}
    });

    const issueIds = diagnoseWorkflow(workflow).map((issue) => issue.id);

    expect(issueIds).not.toContain("high_risk_side_effect_node:failure-notification");
    expect(issueIds).not.toContain("email_without_send_log:failure-notification");
    expect(issueIds).not.toContain("database_update_without_fallback:crm-status");
  });

  test("recognizes downstream audit trail nodes as reducing success audit risks", () => {
    const workflow = parseN8nWorkflow({
      name: "Refund With Audit Trail",
      nodes: [
        {
          id: "refund",
          name: "Stripe Refund",
          type: "n8n-nodes-base.stripe",
          parameters: {
            idempotencyKey: "={{$json.requestId}}"
          }
        },
        {
          id: "audit",
          name: "Refund Success Audit Log",
          type: "custom.audit",
          parameters: {}
        }
      ],
      connections: {
        "Stripe Refund": {
          main: [[{ node: "Refund Success Audit Log", type: "main", index: 0 }]]
        }
      }
    });

    const issueIds = diagnoseWorkflow(workflow).map((issue) => issue.id);

    expect(issueIds).not.toContain("side_effect_without_audit_trail:refund");
  });
});
