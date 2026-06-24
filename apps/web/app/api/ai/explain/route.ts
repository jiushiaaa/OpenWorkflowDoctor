import {
  createDeterministicWorkflowExplanation,
  createOptionalOpenAiProvider,
  explainWorkflow,
  workflowExplanationInputSchema,
  type WorkflowExplanationResult
} from "@openworkflowdoctor/workflow-ai";
import { NextResponse } from "next/server";
import { z } from "zod";

const aiProviderRequestSchema = z.object({
  enabled: z.boolean().optional().default(true),
  providerType: z.literal("openai-compatible").optional().default("openai-compatible"),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  model: z.string().optional()
});

const explainRequestSchema = z.object({
  input: workflowExplanationInputSchema,
  provider: aiProviderRequestSchema.optional()
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsedRequest = explainRequestSchema.parse(body);
  const providerConfig = parsedRequest.provider;
  const providerOptions: {
    apiKey?: string;
    model?: string;
    endpoint?: string;
  } = {};
  const endpoint = createResponsesEndpoint(providerConfig?.baseUrl);

  if (providerConfig?.apiKey !== undefined) {
    providerOptions.apiKey = providerConfig.apiKey;
  }
  if (providerConfig?.model !== undefined) {
    providerOptions.model = providerConfig.model;
  }
  if (endpoint !== undefined) {
    providerOptions.endpoint = endpoint;
  }

  const provider =
    providerConfig?.enabled === false
      ? null
      : createOptionalOpenAiProvider(providerOptions);

  try {
    const result = await explainWorkflow(parsedRequest.input, provider);
    return NextResponse.json(result);
  } catch (error) {
    const unavailableReason = error instanceof Error ? error.message : "AI explanation failed.";
    const result: WorkflowExplanationResult = {
      source: "deterministic",
      unavailableReason,
      explanation: createDeterministicWorkflowExplanation(parsedRequest.input, unavailableReason)
    };

    return NextResponse.json(result);
  }
}

function createResponsesEndpoint(baseUrl: string | undefined): string | undefined {
  const trimmed = baseUrl?.trim();
  if (!trimmed) {
    return undefined;
  }

  const withoutTrailingSlash = trimmed.replace(/\/+$/u, "");
  return withoutTrailingSlash.endsWith("/responses")
    ? withoutTrailingSlash
    : `${withoutTrailingSlash}/responses`;
}
