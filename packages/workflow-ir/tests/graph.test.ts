import { describe, expect, test } from "vitest";
import isolatedWorkflow from "./fixtures/isolated-workflow.json";
import branchWorkflow from "./fixtures/refund-branch-workflow.json";
import {
  buildAdjacencyMap,
  getDownstreamNodes,
  getIsolatedNodes,
  getSinkNodes,
  getSourceNodes,
  getUpstreamNodes,
  parseN8nWorkflow
} from "../src/index";

describe("graph helpers", () => {
  test("builds incoming and outgoing adjacency maps", () => {
    const workflow = parseN8nWorkflow(branchWorkflow);
    const adjacency = buildAdjacencyMap(workflow);

    expect(adjacency.outgoing.get("branch")).toEqual(["approval", "refund"]);
    expect(adjacency.incoming.get("refund")).toEqual(["branch"]);
  });

  test("finds source, sink, and isolated nodes", () => {
    const workflow = parseN8nWorkflow(isolatedWorkflow);

    expect(getSourceNodes(workflow).map((node) => node.id)).toEqual(["manual", "orphan"]);
    expect(getSinkNodes(workflow).map((node) => node.id)).toEqual(["email", "orphan"]);
    expect(getIsolatedNodes(workflow).map((node) => node.id)).toEqual(["orphan"]);
  });

  test("walks downstream and upstream nodes without looping forever", () => {
    const workflow = parseN8nWorkflow(branchWorkflow);

    expect(getDownstreamNodes(workflow, "webhook").map((node) => node.id)).toEqual([
      "lookup",
      "branch",
      "approval",
      "refund"
    ]);
    expect(getUpstreamNodes(workflow, "refund").map((node) => node.id)).toEqual([
      "branch",
      "lookup",
      "webhook"
    ]);
  });
});
