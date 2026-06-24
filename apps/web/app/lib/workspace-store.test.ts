import { createDoctorReportFromWorkflow, createDoctorReviewPacket, parseN8nWorkflow } from "@openworkflowdoctor/workflow-ir";
import { describe, expect, test } from "vitest";
import branchWorkflow from "../../../../packages/workflow-ir/tests/fixtures/refund-branch-workflow.json";
import {
  createMemoryWorkspaceRepository,
  createReviewPacketArtifact,
  createWorkflowDocumentFromWorkflowIr,
  parseWorkflowDocument
} from "./workspace-store";
import { loadWorkbenchSettings, saveWorkbenchSettings } from "./settings";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  length = 0;

  clear(): void {
    this.values.clear();
    this.length = 0;
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
    this.length = this.values.size;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
    this.length = this.values.size;
  }
}

describe("local workspace repository", () => {
  test("creates, loads, updates, and deletes workflow documents", async () => {
    const repository = createMemoryWorkspaceRepository();
    const workspace = await repository.initialize();
    const workflow = parseN8nWorkflow(branchWorkflow);
    const document = createWorkflowDocumentFromWorkflowIr({
      workflow,
      sourceKind: "imported-file",
      sourceLabel: "refund-branch-workflow.json",
      request: "检查风险"
    });

    await repository.saveWorkflowDocument(document);
    await repository.setActiveWorkflowDocument(document.id);

    expect((await repository.listWorkflowDocuments()).map((item) => item.id)).toEqual([document.id]);
    expect((await repository.getWorkspace()).activeWorkflowDocumentId).toBe(document.id);
    expect((await repository.getWorkflowDocument(document.id))?.displayName).toBe("Refund Workflow");

    await repository.updateWorkflowDocument(document.id, (current) => ({
      ...current,
      currentRequest: "请全面修复所有支持的可靠性问题",
      latestReportState: "stale"
    }));

    expect((await repository.getWorkflowDocument(document.id))?.latestReportState).toBe("stale");

    await repository.deleteWorkflowDocument(document.id);

    expect(await repository.listWorkflowDocuments()).toEqual([]);
    expect((await repository.getWorkspace()).activeWorkflowDocumentId).toBeNull();
    expect((await repository.getWorkspace()).id).toBe(workspace.id);
  });

  test("stores review packet artifacts per workflow document", async () => {
    const repository = createMemoryWorkspaceRepository();
    await repository.initialize();
    const firstWorkflow = parseN8nWorkflow(branchWorkflow);
    const secondWorkflow = {
      ...firstWorkflow,
      id: "second-workflow",
      name: "Second Workflow"
    };
    const firstDocument = createWorkflowDocumentFromWorkflowIr({
      workflow: firstWorkflow,
      sourceKind: "imported-file",
      sourceLabel: "first.json"
    });
    const secondDocument = createWorkflowDocumentFromWorkflowIr({
      workflow: secondWorkflow,
      sourceKind: "sample",
      sourceLabel: "second.json"
    });
    const packet = createDoctorReviewPacket(createDoctorReportFromWorkflow(firstWorkflow, "请全面修复所有支持的可靠性问题"));

    await repository.saveWorkflowDocument(firstDocument);
    await repository.saveWorkflowDocument(secondDocument);
    await repository.saveReviewPacketArtifact(
      createReviewPacketArtifact({
        workflowDocumentId: firstDocument.id,
        packet,
        exportedAt: "2026-06-24T00:00:00.000Z"
      })
    );

    expect(await repository.listReviewPacketArtifacts(firstDocument.id)).toHaveLength(1);
    expect(await repository.listReviewPacketArtifacts(secondDocument.id)).toHaveLength(0);
  });

  test("restores active workflow state without leaking reports, review drafts, or packet history", async () => {
    const repository = createMemoryWorkspaceRepository();
    await repository.initialize();
    const firstWorkflow = parseN8nWorkflow(branchWorkflow);
    const secondWorkflow = {
      ...firstWorkflow,
      id: "second-workflow",
      name: "Second Workflow"
    };
    const firstDocument = createWorkflowDocumentFromWorkflowIr({
      workflow: firstWorkflow,
      sourceKind: "imported-file",
      sourceLabel: "first.json",
      request: "修复退款工作流"
    });
    const secondDocument = createWorkflowDocumentFromWorkflowIr({
      workflow: secondWorkflow,
      sourceKind: "imported-file",
      sourceLabel: "second.json",
      request: "检查第二个工作流"
    });
    const firstReport = createDoctorReportFromWorkflow(firstWorkflow, firstDocument.currentRequest);
    const firstPacket = createReviewPacketArtifact({
      workflowDocumentId: firstDocument.id,
      packet: createDoctorReviewPacket(firstReport),
      exportedAt: "2026-06-24T01:00:00.000Z",
      now: "2026-06-24T01:00:00.000Z"
    });

    await repository.saveWorkflowDocument(firstDocument);
    await repository.saveWorkflowDocument(secondDocument);
    await repository.updateWorkflowDocument(firstDocument.id, (current) => ({
      ...current,
      latestReport: firstReport,
      latestReportState: "ready",
      selectedNodeId: "branch",
      activeTab: "verification",
      reviewMode: "patched",
      humanReviewDraft: {
        decision: "held",
        reviewerNote: "Needs payment-owner review.",
        confirmedChecklistItemIds: ["side_effect_human_review"]
      }
    }));
    await repository.saveReviewPacketArtifact(firstPacket);
    await repository.setActiveWorkflowDocument(secondDocument.id);

    const activeSecond = await repository.getWorkflowDocument(secondDocument.id);
    expect((await repository.getWorkspace()).activeWorkflowDocumentId).toBe(secondDocument.id);
    expect(activeSecond?.latestReport).toBeUndefined();
    expect(activeSecond?.latestReportState).toBe("not-run");
    expect(activeSecond?.activeTab).toBe("summary");
    expect(activeSecond?.reviewMode).toBe("original");
    expect(activeSecond?.humanReviewDraft.decision).toBe("undecided");
    expect(activeSecond?.reviewPacketArtifactIds).toEqual([]);
    expect(await repository.listReviewPacketArtifacts(secondDocument.id)).toEqual([]);

    await repository.setActiveWorkflowDocument(firstDocument.id);
    const activeFirst = await repository.getWorkflowDocument(firstDocument.id);
    expect((await repository.getWorkspace()).activeWorkflowDocumentId).toBe(firstDocument.id);
    expect(activeFirst?.latestReport?.workflow.name).toBe("Refund Workflow");
    expect(activeFirst?.latestReportState).toBe("ready");
    expect(activeFirst?.selectedNodeId).toBe("branch");
    expect(activeFirst?.activeTab).toBe("verification");
    expect(activeFirst?.reviewMode).toBe("patched");
    expect(activeFirst?.humanReviewDraft.reviewerNote).toBe("Needs payment-owner review.");
    expect(activeFirst?.reviewPacketArtifactIds).toEqual([firstPacket.id]);
    expect(await repository.listReviewPacketArtifacts(firstDocument.id)).toHaveLength(1);
  });

  test("stores multiple packet artifacts while keeping exported packets canonical", async () => {
    const repository = createMemoryWorkspaceRepository();
    await repository.initialize();
    const workflow = parseN8nWorkflow(branchWorkflow);
    const document = createWorkflowDocumentFromWorkflowIr({
      workflow,
      sourceKind: "imported-file",
      sourceLabel: "refund.json"
    });
    const packet = createDoctorReviewPacket(createDoctorReportFromWorkflow(workflow, "请全面修复所有支持的可靠性问题"));

    await repository.saveWorkflowDocument(document);
    await repository.saveReviewPacketArtifact(
      createReviewPacketArtifact({
        workflowDocumentId: document.id,
        packet,
        exportedAt: "2026-06-24T01:00:00.000Z",
        now: "2026-06-24T01:00:00.000Z"
      })
    );
    await repository.saveReviewPacketArtifact(
      createReviewPacketArtifact({
        workflowDocumentId: document.id,
        packet,
        exportedAt: "2026-06-24T02:00:00.000Z",
        now: "2026-06-24T02:00:00.000Z"
      })
    );

    const artifacts = await repository.listReviewPacketArtifacts(document.id);
    const reloadedDocument = await repository.getWorkflowDocument(document.id);
    expect(artifacts).toHaveLength(2);
    expect(reloadedDocument?.reviewPacketArtifactIds).toHaveLength(2);
    expect(artifacts[0]?.packet.schemaVersion).toBe("openworkflowdoctor.review-packet.v1");
    expect(artifacts[0]?.packet).toEqual(packet);
    expect(JSON.stringify(artifacts[0]?.packet)).not.toContain("workflowDocumentId");
    expect(JSON.stringify(artifacts[0]?.packet)).not.toContain("exportedAt");
  });

  test("keeps local AI API keys out of workflow documents and packet artifacts", async () => {
    const repository = createMemoryWorkspaceRepository();
    const storage = new MemoryStorage();
    const workflow = parseN8nWorkflow(branchWorkflow);
    const document = createWorkflowDocumentFromWorkflowIr({
      workflow,
      sourceKind: "imported-file",
      sourceLabel: "refund.json"
    });
    const packet = createDoctorReviewPacket(createDoctorReportFromWorkflow(workflow, "请全面修复所有支持的可靠性问题"));

    saveWorkbenchSettings(storage, {
      ...loadWorkbenchSettings(storage),
      ai: {
        ...loadWorkbenchSettings(storage).ai,
        apiKey: "sk-local-browser-only"
      }
    });
    await repository.initialize();
    await repository.saveWorkflowDocument(document);
    await repository.saveReviewPacketArtifact(
      createReviewPacketArtifact({
        workflowDocumentId: document.id,
        packet
      })
    );

    expect(JSON.stringify(await repository.getWorkflowDocument(document.id))).not.toContain("sk-local-browser-only");
    expect(JSON.stringify(await repository.listReviewPacketArtifacts(document.id))).not.toContain("sk-local-browser-only");
    expect(loadWorkbenchSettings(storage).ai.apiKey).toBe("sk-local-browser-only");
  });

  test("creates sample workflow documents and keeps WorkflowIR secret-safe", () => {
    const workflow = parseN8nWorkflow({
      name: "Secret Workflow",
      nodes: [
        {
          id: "http",
          name: "HTTP Request",
          type: "n8n-nodes-base.httpRequest",
          parameters: {
            apiKey: "sk_live_should_not_be_stored",
            headers: {
              Authorization: "Bearer live-token-should-not-be-stored"
            }
          }
        }
      ],
      connections: {}
    });
    const document = createWorkflowDocumentFromWorkflowIr({
      workflow,
      sourceKind: "sample",
      sourceLabel: "secret-sample.json"
    });
    const serialized = JSON.stringify(document);

    expect(document.sourceKind).toBe("sample");
    expect(serialized).toContain("[redacted]");
    expect(serialized).not.toContain("sk_live_should_not_be_stored");
    expect(serialized).not.toContain("live-token-should-not-be-stored");
  });

  test("rejects raw imported workflow fields in stored workflow documents", () => {
    const workflow = parseN8nWorkflow(branchWorkflow);
    const document = createWorkflowDocumentFromWorkflowIr({
      workflow,
      sourceKind: "imported-file",
      sourceLabel: "refund.json"
    });

    expect(() =>
      parseWorkflowDocument({
        ...document,
        rawWorkflowJson: branchWorkflow
      })
    ).toThrow("Invalid WorkflowDocument.");
  });

  test("persists AI patch proposal state per workflow without leaking raw model or provider data", async () => {
    const repository = createMemoryWorkspaceRepository();
    await repository.initialize();
    const firstWorkflow = parseN8nWorkflow(branchWorkflow);
    const secondWorkflow = {
      ...firstWorkflow,
      id: "second-workflow",
      name: "Second Workflow"
    };
    const firstDocument = createWorkflowDocumentFromWorkflowIr({
      workflow: firstWorkflow,
      sourceKind: "imported-file",
      sourceLabel: "first.json"
    });
    const secondDocument = createWorkflowDocumentFromWorkflowIr({
      workflow: secondWorkflow,
      sourceKind: "sample",
      sourceLabel: "second.json"
    });

    expect(firstDocument.aiPatchProposalState).toEqual({ status: "idle" });

    await repository.saveWorkflowDocument(firstDocument);
    await repository.saveWorkflowDocument(secondDocument);
    await repository.updateWorkflowDocument(firstDocument.id, (current) => ({
      ...current,
      aiPatchProposalState: {
        status: "ready",
        generatedAt: "2026-06-24T00:00:00.000Z",
        inputFingerprint: "aip1-test",
        candidate: {
          schemaVersion: "openworkflowdoctor.ai-patch-proposal.v1",
          source: "ai",
          createdAt: "2026-06-24T00:00:00.000Z",
          inputFingerprint: "aip1-test",
          proposal: {
            summary: "No operation needed.",
            operations: [],
            risksAddressed: [],
            expectedImpact: [],
            risksIntroduced: [],
            requiresHumanReview: true
          },
          conflicts: [],
          safetyNotes: ["Review only."]
        }
      }
    }));

    expect((await repository.getWorkflowDocument(firstDocument.id))?.aiPatchProposalState.status).toBe("ready");
    expect((await repository.getWorkflowDocument(secondDocument.id))?.aiPatchProposalState).toEqual({ status: "idle" });
    expect(JSON.stringify(await repository.getWorkflowDocument(firstDocument.id))).not.toContain("rawPrompt");
    expect(JSON.stringify(await repository.getWorkflowDocument(firstDocument.id))).not.toContain("rawResponse");
    expect(JSON.stringify(await repository.getWorkflowDocument(firstDocument.id))).not.toContain("sk-provider-secret");
  });

  test("rejects unsafe AI patch proposal workspace fields", () => {
    const workflow = parseN8nWorkflow(branchWorkflow);
    const document = createWorkflowDocumentFromWorkflowIr({
      workflow,
      sourceKind: "imported-file",
      sourceLabel: "refund.json"
    });

    expect(() =>
      parseWorkflowDocument({
        ...document,
        aiPatchProposalState: {
          status: "ready",
          rawPrompt: "do not store",
          rawResponse: "do not store",
          provider: {
            apiKey: "sk-provider-secret"
          }
        }
      })
    ).toThrow("Invalid WorkflowDocument.");
  });

  test("clears workflow data without clearing local settings", async () => {
    const repository = createMemoryWorkspaceRepository();
    const storage = new MemoryStorage();
    const settings = loadWorkbenchSettings(storage);
    const document = createWorkflowDocumentFromWorkflowIr({
      workflow: parseN8nWorkflow(branchWorkflow),
      sourceKind: "imported-file",
      sourceLabel: "refund.json"
    });

    saveWorkbenchSettings(storage, {
      ...settings,
      language: "en-US",
      theme: "dark",
      ai: {
        ...settings.ai,
        apiKey: "sk-local-browser-only"
      }
    });
    await repository.initialize();
    await repository.saveWorkflowDocument(document);
    await repository.setActiveWorkflowDocument(document.id);
    await repository.clearWorkspaceData();

    expect(await repository.listWorkflowDocuments()).toEqual([]);
    expect(await repository.listReviewPacketArtifacts(document.id)).toEqual([]);
    expect((await repository.getWorkspace()).activeWorkflowDocumentId).toBeNull();
    expect(loadWorkbenchSettings(storage).language).toBe("en-US");
    expect(loadWorkbenchSettings(storage).theme).toBe("dark");
    expect(loadWorkbenchSettings(storage).ai.apiKey).toBe("sk-local-browser-only");
  });
});
