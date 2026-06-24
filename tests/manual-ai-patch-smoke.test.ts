import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { aiPatchProposalCandidateSchema } from "../packages/workflow-ir/src/index";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const smokeLibPath = path.join(repoRoot, "scripts", "manual-ai-patch-smoke-lib.mjs");

async function loadSmokeLib() {
  return import(`${pathToFileUrl(smokeLibPath)}?t=${Date.now()}`);
}

describe("manual AI patch smoke script", () => {
  test("skips without requiring AI provider environment variables", () => {
    const env = { ...process.env };
    delete env.OPENWORKFLOWDOCTOR_AI_BASE_URL;
    delete env.OPENWORKFLOWDOCTOR_AI_API_KEY;
    delete env.OPENWORKFLOWDOCTOR_AI_MODEL;

    const result = spawnSync(process.execPath, ["scripts/manual-ai-patch-smoke.mjs"], {
      cwd: repoRoot,
      env,
      encoding: "utf8"
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Skipped manual AI patch smoke test");
    expect(result.stdout).toContain("OPENWORKFLOWDOCTOR_AI_BASE_URL");
    expect(result.stdout).toContain("OPENWORKFLOWDOCTOR_AI_API_KEY");
    expect(result.stdout).toContain("OPENWORKFLOWDOCTOR_AI_MODEL");
  });

  test("filters cases and caps repeat count from environment", async () => {
    const { createSelectedRuns } = await loadSmokeLib();
    const runs = createSelectedRuns(
      [
        { id: "normal_repair", name: "normal", request: "normal" },
        { id: "prompt_injection", name: "injection", request: "injection" }
      ],
      {
        caseFilter: "normal_repair",
        repeat: "9"
      }
    );

    expect(runs).toHaveLength(5);
    expect(runs.every((run: { testCase: { id: string }; repeatIndex: number }) =>
      run.testCase.id === "normal_repair" && run.repeatIndex >= 1
    )).toBe(true);
  });

  test("filters normal timeout repair case and repeats it", async () => {
    const { createSelectedRuns } = await loadSmokeLib();
    const runs = createSelectedRuns(
      [
        { id: "normal_repair", name: "normal", request: "normal" },
        { id: "normal_timeout_repair", name: "timeout", request: "timeout" },
        { id: "prompt_injection", name: "injection", request: "injection" }
      ],
      {
        caseFilter: "normal_timeout_repair",
        repeat: "3"
      }
    );

    expect(runs.map((run: { testCase: { id: string }; repeatIndex: number }) => `${run.testCase.id}:${run.repeatIndex}`)).toEqual([
      "normal_timeout_repair:1",
      "normal_timeout_repair:2",
      "normal_timeout_repair:3"
    ]);
  });

  test("includes normal timeout repair when running all cases", async () => {
    const { createSelectedRuns } = await loadSmokeLib();
    const runs = createSelectedRuns(
      [
        { id: "normal_repair", name: "normal", request: "normal" },
        { id: "normal_timeout_repair", name: "timeout", request: "timeout" },
        { id: "prompt_injection", name: "injection", request: "injection" }
      ],
      { caseFilter: "all" }
    );

    expect(runs.map((run: { testCase: { id: string } }) => run.testCase.id)).toContain("normal_timeout_repair");
  });

  test("declares normal timeout repair case and safe summary fields in the manual script", () => {
    const script = readFileSync(path.join(repoRoot, "scripts", "manual-ai-patch-smoke.mjs"), "utf8");

    expect(script).toContain("normal_timeout_repair");
    expect(script).toContain("给 HTTP request 节点添加 timeout");
    expect(script).toContain("operation count:");
    expect(script).toContain("verifier status:");
    expect(script).toContain("elapsed ms:");
  });

  test("defaults to all cases with one repeat", async () => {
    const { createSelectedRuns } = await loadSmokeLib();
    const runs = createSelectedRuns(
      [
        { id: "normal_repair", name: "normal", request: "normal" },
        { id: "prompt_injection", name: "injection", request: "injection" }
      ],
      {}
    );

    expect(runs.map((run: { testCase: { id: string }; repeatIndex: number }) => `${run.testCase.id}:${run.repeatIndex}`)).toEqual([
      "normal_repair:1",
      "prompt_injection:1"
    ]);
  });

  test("defaults Volcengine Ark providers to chat completions transport", async () => {
    const { normalizeTransport } = await loadSmokeLib();

    expect(normalizeTransport(undefined, {
      baseUrl: "https://ark.cn-beijing.volces.com/api/v3"
    })).toBe("chat_completions");
    expect(normalizeTransport(undefined, {
      providerPreset: "volcengine_ark"
    })).toBe("chat_completions");
    expect(normalizeTransport("responses", {
      baseUrl: "https://ark.cn-beijing.volces.com/api/v3"
    })).toBe("responses");
  });

  test("defaults Alibaba Bailian providers to chat completions transport", async () => {
    const { normalizeTransport } = await loadSmokeLib();

    expect(normalizeTransport(undefined, {
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1"
    })).toBe("chat_completions");
    expect(normalizeTransport(undefined, {
      baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
    })).toBe("chat_completions");
    expect(normalizeTransport(undefined, {
      providerPreset: "alibaba_bailian"
    })).toBe("chat_completions");
    expect(normalizeTransport("responses", {
      providerPreset: "alibaba_bailian"
    })).toBe("responses");
  });

  test("resolves provider preset defaults for manual smoke runs", async () => {
    const { resolveManualProviderConfig } = await loadSmokeLib();
    const resolved = resolveManualProviderConfig({
      OPENWORKFLOWDOCTOR_AI_PROVIDER_PRESET: "alibaba_bailian",
      OPENWORKFLOWDOCTOR_AI_API_KEY: "sk-local-test",
      OPENWORKFLOWDOCTOR_AI_CASE: "normal_timeout_repair"
    });

    expect(resolved.providerPreset).toBe("alibaba-bailian");
    expect(resolved.baseUrl).toBe("https://dashscope.aliyuncs.com/compatible-mode/v1");
    expect(resolved.model).toBe("qwen3.7-plus");
    expect(resolved.transport).toBe("chat_completions");
    expect(resolved.responseFormat).toBe("json_object");
  });
});

describe("manual AI patch smoke diagnostics", () => {
  test("classifies provider timeout", async () => {
    const { runManualAiPatchCase } = await loadSmokeLib();
    const summary = await runManualAiPatchCase(createPipelineInput({
      fetchImplementation: async (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
      timeoutMs: 1
    }));

    expect(summary.failureStage).toBe("provider_timeout");
  });

  test("classifies HTTP errors without printing response bodies", async () => {
    const { runManualAiPatchCase } = await loadSmokeLib();
    const summary = await runManualAiPatchCase(createPipelineInput({
      fetchImplementation: async () => new Response("do not print this body", { status: 429 })
    }));

    expect(summary.failureStage).toBe("provider_http_error");
    expect(summary.httpStatus).toBe(429);
  });

  test("classifies missing output text and reports safe response shape", async () => {
    const { runManualAiPatchCase } = await loadSmokeLib();
    const summary = await runManualAiPatchCase(createPipelineInput({
      fetchImplementation: async () => jsonResponse({ output: [{ content: [{ type: "refusal" }] }] })
    }));

    expect(summary.failureStage).toBe("missing_output_text");
    expect(summary.responseShape).toMatchObject({
      hasOutput: true,
      hasChoices: false,
      hasMessageContent: false,
      hasOutputText: false,
      contentType: "unknown"
    });
  });

  test("classifies malformed model JSON text", async () => {
    const { runManualAiPatchCase } = await loadSmokeLib();
    const summary = await runManualAiPatchCase(createPipelineInput({
      fetchImplementation: async () => jsonResponse({ output_text: "not json" })
    }));

    expect(summary.failureStage).toBe("json_parse_failed");
    expect(summary.schema).toBe("invalid");
  });

  test("classifies parsed JSON that fails Zod validation", async () => {
    const { runManualAiPatchCase } = await loadSmokeLib();
    const summary = await runManualAiPatchCase(createPipelineInput({
      fetchImplementation: async () => jsonResponse({ output_text: JSON.stringify({ schemaVersion: "wrong" }) })
    }));

    expect(summary.failureStage).toBe("zod_invalid");
    expect(summary.schema).toBe("invalid");
    expect(summary.zodIssueCount).toBeGreaterThan(1);
    expect(summary.zodIssues.length).toBeLessThanOrEqual(5);
    expect(summary.zodIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "schemaVersion",
          category: "wrong_literal"
        })
      ])
    );
  });

  test("classifies Zod-valid proposals that fail semantic validation", async () => {
    const { runManualAiPatchCase } = await loadSmokeLib();
    const summary = await runManualAiPatchCase(createPipelineInput({
      candidate: createValidCandidate(),
      validateAiPatchProposalCandidate: () => ({
        proposal: { operations: [] },
        conflicts: [],
        patchSource: { validation: { semantic: "fail" } }
      })
    }));

    expect(summary.failureStage).toBe("semantic_invalid");
    expect(summary.schema).toBe("valid");
    expect(summary.semantic).toBe("invalid");
  });

  test("classifies blocking conflicts after schema validation", async () => {
    const { runManualAiPatchCase } = await loadSmokeLib();
    const summary = await runManualAiPatchCase(createPipelineInput({
      candidate: createValidCandidate(),
      validateAiPatchProposalCandidate: () => ({
        proposal: { operations: [] },
        conflicts: [{ severity: "blocker" }],
        patchSource: { validation: { semantic: "fail" } }
      })
    }));

    expect(summary.failureStage).toBe("conflict_blocker");
    expect(summary.conflicts).toBe(1);
  });

  test("classifies the full verifier path", async () => {
    const { runManualAiPatchCase } = await loadSmokeLib();
    const summary = await runManualAiPatchCase(createPipelineInput({
      candidate: createValidCandidate(),
      validateAiPatchProposalCandidate: () => ({
        proposal: { operations: [{ type: "update_node_parameters" }] },
        conflicts: [],
        patchSource: { validation: { semantic: "pass" } }
      }),
      verifyPatch: () => ({ status: "hold" })
    }));

    expect(summary.failureStage).toBe("verifier_completed");
    expect(summary.schema).toBe("valid");
    expect(summary.semantic).toBe("valid");
    expect(summary.operations).toBe(1);
    expect(summary.verifier).toBe("hold");
    expect(typeof summary.elapsedMs).toBe("number");
  });

  test("supports chat completions transport response extraction", async () => {
    const { createEndpoint, runManualAiPatchCase } = await loadSmokeLib();
    const summary = await runManualAiPatchCase(createPipelineInput({
      transport: "chat_completions",
      candidate: createValidCandidate()
    }));

    expect(createEndpoint("https://example.test/v1", "chat_completions")).toBe("https://example.test/v1/chat/completions");
    expect(summary.transport).toBe("chat_completions");
    expect(summary.responseShape).toMatchObject({
      hasChoices: true,
      hasMessageContent: true,
      contentType: "string"
    });
  });

  test("shapes chat completions request without response_format when mode is none", async () => {
    const { createRequestBody } = await loadSmokeLib();
    const body = createRequestBody({ inputFingerprint: "aip1-test" }, {
      model: "test-model",
      transport: "chat_completions",
      responseFormat: "none"
    });

    expect(body.response_format).toBeUndefined();
    expect(JSON.stringify(body)).toContain("root output must be a single JSON object");
    expect(JSON.stringify(body)).toContain("minimal valid AiPatchProposalCandidate envelope example");
  });

  test("includes a minimal valid synthetic newNode example in the prompt", async () => {
    const { createEnvelopeInstruction } = await loadSmokeLib();
    const instruction = createEnvelopeInstruction("aip1-test");

    expect(instruction).toContain("minimal valid synthetic newNode example");
    expect(instruction).toContain('"id":"ai-node-1"');
    expect(instruction).toContain('"name":"Audit Log"');
    expect(instruction).toContain('"type":"openworkflowdoctor.audit.log"');
    expect(instruction).toContain('"typeFamily":"unknown"');
    expect(instruction).toContain('"parameters":[]');
    expect(instruction).toContain("newNode.parameters must be an array");
  });

  test("includes a minimal valid timeout update operation example in the prompt", async () => {
    const { createEnvelopeInstruction } = await loadSmokeLib();
    const instruction = createEnvelopeInstruction("aip1-test");

    expect(instruction).toContain("minimal valid update_node_parameters timeout operation example");
    expect(instruction).toContain('"type":"update_node_parameters"');
    expect(instruction).toContain('"targetNodeId":"COPY_NODE_ID_FROM_SAFE_INPUT"');
    expect(instruction).toContain('"timeout":30000');
    expect(instruction).toContain("Use targetNodeId exactly; do not use nodeId, nodeName, target, or id for operation targets.");
  });

  test("shapes chat completions request with json_object response_format", async () => {
    const { createRequestBody } = await loadSmokeLib();
    const body = createRequestBody({ inputFingerprint: "aip1-test" }, {
      model: "test-model",
      transport: "chat_completions",
      responseFormat: "json_object"
    });

    expect(body.response_format).toEqual({ type: "json_object" });
  });

  test("shapes chat completions request with json_schema response_format", async () => {
    const { createRequestBody } = await loadSmokeLib();
    const body = createRequestBody({ inputFingerprint: "aip1-test" }, {
      model: "test-model",
      transport: "chat_completions",
      responseFormat: "json_schema"
    });

    expect(body.response_format).toMatchObject({
      type: "json_schema",
      json_schema: {
        name: "ai_patch_proposal",
        strict: true
      }
    });
    expect(body.response_format.json_schema.schema.required).toContain("proposal");
  });

  test("prints response format and parsed envelope diagnostics", async () => {
    const { runManualAiPatchCase } = await loadSmokeLib();
    const summary = await runManualAiPatchCase(createPipelineInput({
      transport: "chat_completions",
      responseFormat: "json_object",
      jsonOutput: {
        schemaVersion: "openworkflowdoctor.ai-patch-proposal.v1",
        operations: []
      }
    }));

    expect(summary.responseFormat).toBe("json_object");
    expect(summary.parsedRootType).toBe("object");
    expect(summary.envelopeMissingFields).toEqual(
      expect.arrayContaining(["source", "createdAt", "inputFingerprint", "proposal", "conflicts", "safetyNotes"])
    );
  });

  test("classifies array root without raw values", async () => {
    const { runManualAiPatchCase } = await loadSmokeLib();
    const summary = await runManualAiPatchCase(createPipelineInput({
      jsonOutput: [{ type: "insert_error_branch", secret: "sk-secret-should-not-print" }]
    }));

    expect(summary.failureStage).toBe("zod_invalid");
    expect(summary.parsedRootType).toBe("array");
    expect(summary.zodIssues[0]).toMatchObject({
      path: "$",
      category: "wrong_type",
      received: "array"
    });
    expect(JSON.stringify(summary.zodIssues)).not.toContain("sk-secret-should-not-print");
  });

  test("provider rejecting response_format is classified as HTTP error", async () => {
    const { runManualAiPatchCase } = await loadSmokeLib();
    const summary = await runManualAiPatchCase(createPipelineInput({
      responseFormat: "json_schema",
      fetchImplementation: async (_url: string, init: RequestInit) => {
        expect(String(init.body)).toContain("json_schema");
        return new Response("response_format not supported", { status: 400 });
      }
    }));

    expect(summary.failureStage).toBe("provider_http_error");
    expect(summary.httpStatus).toBe(400);
  });

  test("summarizes missing proposal without raw values", async () => {
    const { runManualAiPatchCase } = await loadSmokeLib();
    const summary = await runManualAiPatchCase(createPipelineInput({
      jsonOutput: {
        schemaVersion: "openworkflowdoctor.ai-patch-proposal.v1",
        source: "ai",
        createdAt: "2026-06-24T00:00:00.000Z",
        inputFingerprint: "aip1-test",
        conflicts: [],
        safetyNotes: []
      }
    }));

    expect(summary.failureStage).toBe("zod_invalid");
    expect(summary.zodIssues[0]).toMatchObject({
      path: "proposal",
      code: "invalid_type",
      category: "missing_required_field",
      expected: "object",
      received: "undefined"
    });
    expect(JSON.stringify(summary.zodIssues)).not.toContain("sk-secret");
  });

  test("summarizes missing proposal operations", async () => {
    const { runManualAiPatchCase } = await loadSmokeLib();
    const candidate = createValidCandidate();
    delete (candidate as { proposal: Record<string, unknown> }).proposal.operations;
    const summary = await runManualAiPatchCase(createPipelineInput({ jsonOutput: candidate }));

    expect(summary.failureStage).toBe("zod_invalid");
    expect(summary.zodIssues[0]).toMatchObject({
      path: "proposal.operations",
      category: "missing_required_field"
    });
  });

  test("summarizes requiresHumanReview false as a wrong literal", async () => {
    const { runManualAiPatchCase } = await loadSmokeLib();
    const candidate = createValidCandidate();
    candidate.proposal.requiresHumanReview = false;
    const summary = await runManualAiPatchCase(createPipelineInput({ jsonOutput: candidate }));

    expect(summary.failureStage).toBe("zod_invalid");
    expect(summary.zodIssues[0]).toMatchObject({
      path: "proposal.requiresHumanReview",
      category: "wrong_literal"
    });
  });

  test("summarizes unsupported operation types", async () => {
    const { runManualAiPatchCase } = await loadSmokeLib();
    const candidate = createValidCandidate();
    candidate.proposal.operations = [{ type: "delete_node", targetNodeId: "node-1" }];
    const summary = await runManualAiPatchCase(createPipelineInput({ jsonOutput: candidate }));

    expect(summary.failureStage).toBe("zod_invalid");
    expect(summary.zodIssues[0]).toMatchObject({
      path: "proposal.operations.0.type",
      category: "unsupported_enum_value"
    });
  });

  test("summarizes unknown extra fields without raw values", async () => {
    const { runManualAiPatchCase } = await loadSmokeLib();
    const candidate = { ...createValidCandidate(), rawSecret: "sk-secret-should-not-print" };
    const summary = await runManualAiPatchCase(createPipelineInput({ jsonOutput: candidate }));

    expect(summary.failureStage).toBe("zod_invalid");
    expect(summary.zodIssues[0]).toMatchObject({
      path: "$",
      code: "unrecognized_keys",
      category: "unknown_field"
    });
    expect(JSON.stringify(summary.zodIssues)).not.toContain("sk-secret-should-not-print");
    expect(JSON.stringify(summary.zodIssues)).not.toContain("rawSecret");
  });

  test("summarizes wrong schemaVersion as a wrong literal", async () => {
    const { runManualAiPatchCase } = await loadSmokeLib();
    const candidate = createValidCandidate();
    candidate.schemaVersion = "wrong";
    const summary = await runManualAiPatchCase(createPipelineInput({ jsonOutput: candidate }));

    expect(summary.failureStage).toBe("zod_invalid");
    expect(summary.zodIssues[0]).toMatchObject({
      path: "schemaVersion",
      category: "wrong_literal"
    });
  });

  test("summarizes invalid newNode shape", async () => {
    const { runManualAiPatchCase } = await loadSmokeLib();
    const candidate = createValidCandidate();
    candidate.proposal.operations = [
      {
        type: "insert_error_branch",
        targetNodeId: "node-1",
        newNode: {
          id: "new-node",
          name: "New node",
          type: "openworkflowdoctor.error.handler"
        }
      }
    ];
    const summary = await runManualAiPatchCase(createPipelineInput({ jsonOutput: candidate }));

    expect(summary.failureStage).toBe("zod_invalid");
    expect(summary.zodIssues.some((issue: { path: string; category: string }) =>
      issue.path.endsWith("newNode.parameters") && issue.category === "missing_required_field"
    )).toBe(true);
  });

  test("builds aggregate summaries for recurring Zod failures", async () => {
    const { buildAggregateSummary } = await loadSmokeLib();
    const aggregate = buildAggregateSummary([
      {
        httpStatus: 200,
        reachedOutputText: true,
        parsedJson: true,
        failedZod: true,
        zodIssues: [
          { path: "proposal", category: "missing_required_field" },
          { path: "schemaVersion", category: "wrong_literal" }
        ]
      },
      {
        httpStatus: 200,
        reachedOutputText: true,
        parsedJson: true,
        failedZod: true,
        zodIssues: [{ path: "proposal", category: "missing_required_field" }]
      }
    ]);

    expect(aggregate).toMatchObject({
      reachedProvider: 2,
      reachedOutputText: 2,
      parsedJson: 2,
      failedZod: 2
    });
    expect(aggregate.topZodPaths[0]).toEqual({ value: "proposal", count: 2 });
    expect(aggregate.topZodCategories[0]).toEqual({ value: "missing_required_field", count: 2 });
  });

  test("builds manual run aggregate stage counts", async () => {
    const { buildAggregateSummary } = await loadSmokeLib();
    const aggregate = buildAggregateSummary([
      { failureStage: "verifier_completed", httpStatus: 200, reachedOutputText: true, parsedJson: true, failedZod: false, zodIssues: [] },
      { failureStage: "zod_invalid", httpStatus: 200, reachedOutputText: true, parsedJson: true, failedZod: true, zodIssues: [] },
      { failureStage: "provider_timeout", httpStatus: "n/a", reachedOutputText: false, parsedJson: false, failedZod: false, zodIssues: [] },
      { failureStage: "provider_http_error", httpStatus: 400, reachedOutputText: false, parsedJson: false, failedZod: false, zodIssues: [] },
      { failureStage: "semantic_invalid", httpStatus: 200, reachedOutputText: true, parsedJson: true, failedZod: false, zodIssues: [] },
      { failureStage: "conflict_blocker", httpStatus: 200, reachedOutputText: true, parsedJson: true, failedZod: false, zodIssues: [] }
    ]);

    expect(aggregate).toMatchObject({
      attempts: 6,
      verifierCompleted: 1,
      zodInvalid: 1,
      timeout: 1,
      providerError: 1,
      semanticInvalid: 1,
      conflictBlocker: 1,
      bestReachedStage: "verifier_completed"
    });
  });
});

function createPipelineInput(overrides: Record<string, unknown> = {}) {
  const candidate = overrides.candidate ?? createValidCandidate();
  const jsonOutput = overrides.jsonOutput ?? candidate;
  const fetchImplementation =
    overrides.fetchImplementation ??
    (async () =>
      overrides.transport === "chat_completions"
        ? jsonResponse({ choices: [{ message: { content: JSON.stringify(jsonOutput) } }] })
        : jsonResponse({ output_text: JSON.stringify(jsonOutput) }));

  return {
    testCase: { name: "case", request: "request" },
    workflow: {},
    provider: {
      label: "manual",
      baseUrl: "https://example.test/v1",
      apiKey: "test-key",
      model: "test-model",
      transport: overrides.transport ?? "responses",
      responseFormat: overrides.responseFormat ?? "json_object",
      timeoutMs: overrides.timeoutMs ?? 1000,
      fetchImplementation
    },
    helpers: {
      buildAiPatchProposalInput: () => ({ inputFingerprint: "aip1-test" }),
      createDoctorReportFromWorkflow: () => ({}),
      aiPatchProposalCandidateSchema,
      parseAiPatchProposalCandidate: (value: unknown) => {
        if (!isRecord(value) || value.schemaVersion !== "openworkflowdoctor.ai-patch-proposal.v1") {
          throw new Error("Invalid AI PatchProposal.");
        }
        return value;
      },
      validateAiPatchProposalCandidate:
        overrides.validateAiPatchProposalCandidate ??
        (() => ({
          proposal: { operations: [] },
          conflicts: [],
          patchSource: { validation: { semantic: "pass" } }
        })),
      applyPatchOperations: () => ({}),
      verifyPatch: overrides.verifyPatch ?? (() => ({ status: "pass" }))
    }
  };
}

function createValidCandidate() {
  return {
    schemaVersion: "openworkflowdoctor.ai-patch-proposal.v1",
    source: "ai",
    createdAt: "2026-06-24T00:00:00.000Z",
    inputFingerprint: "aip1-test",
    proposal: {
      summary: "Review-only proposal.",
      operations: [],
      risksAddressed: [],
      expectedImpact: [],
      risksIntroduced: [],
      requiresHumanReview: true
    },
    conflicts: [],
    safetyNotes: []
  };
}

function jsonResponse(value: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init
  });
}

function pathToFileUrl(filePath: string): string {
  return `file://${filePath.replace(/\\/gu, "/")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
