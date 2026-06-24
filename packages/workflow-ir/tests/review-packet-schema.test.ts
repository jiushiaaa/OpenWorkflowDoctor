import { describe, expect, test } from "vitest";
import branchWorkflow from "./fixtures/refund-branch-workflow.json";
import { createDoctorReport, createDoctorReviewPacket, parseDoctorReviewPacket } from "../src/index";

describe("DoctorReviewPacket schema", () => {
  test("accepts a complete exported review packet", () => {
    const report = createDoctorReport(branchWorkflow, "请全面修复所有支持的可靠性问题");
    const packet = createDoctorReviewPacket(report, "2026-06-23T00:00:00.000Z");

    expect(parseDoctorReviewPacket(packet)).toMatchObject({
      schemaVersion: "openworkflowdoctor.review-packet.v1",
      workflowName: "Refund Workflow",
      reviewTargetFingerprint: packet.reviewTargetFingerprint,
      original: {
        workflow: expect.any(Object),
        summary: expect.any(Object),
        issues: expect.any(Array)
      },
      patch: {
        proposal: expect.any(Object),
        patchDiff: expect.any(Array),
        patchedWorkflow: expect.any(Object),
        patchedSummary: expect.any(Object),
        patchedIssues: expect.any(Array)
      },
      verification: expect.any(Object),
      acceptanceChecklist: expect.any(Array),
      humanReviewValidation: expect.any(Object),
      issueDelta: expect.any(Object)
    });
  });

  test("allows humanReview to be omitted from externally supplied packets", () => {
    const report = createDoctorReport(branchWorkflow, "请全面修复所有支持的可靠性问题");
    const packet = createDoctorReviewPacket(report, "2026-06-23T00:00:00.000Z");
    const packetWithoutHumanReview: Partial<typeof packet> = { ...packet };
    delete packetWithoutHumanReview.humanReview;

    expect(parseDoctorReviewPacket(packetWithoutHumanReview).humanReview).toBeUndefined();
  });

  test("rejects packets without required trust fields", () => {
    const report = createDoctorReport(branchWorkflow, "请全面修复所有支持的可靠性问题");
    const packet = createDoctorReviewPacket(report, "2026-06-23T00:00:00.000Z");

    expect(() =>
      parseDoctorReviewPacket({
        ...packet,
        reviewTargetFingerprint: undefined
      })
    ).toThrow("Invalid DoctorReviewPacket.");

    expect(() =>
      parseDoctorReviewPacket({
        ...packet,
        issueDelta: undefined
      })
    ).toThrow("Invalid DoctorReviewPacket.");
  });
});
