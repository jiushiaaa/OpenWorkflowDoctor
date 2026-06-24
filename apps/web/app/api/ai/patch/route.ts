import {
  createOptionalOpenAiProvider,
  generatePatchProposal,
  type AiPatchProposalResult
} from "@openworkflowdoctor/workflow-ai";
import type { AiPatchProposalInput } from "@openworkflowdoctor/workflow-ir";
import { NextResponse } from "next/server";
import { z } from "zod";

const aiProviderRequestSchema = z.object({
  enabled: z.boolean().optional().default(true),
  providerType: z.literal("openai-compatible").optional().default("openai-compatible"),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  model: z.string().optional()
});

const patchRequestSchema = z.object({
  input: z.unknown(),
  provider: aiProviderRequestSchema.optional()
});

export type AiPatchProposalApiResult =
  | AiPatchProposalResult
  | {
      source: "unavailable";
      unavailableReason: string;
    };

export async function POST(request: Request) {
  const body = await request.json();
  const parsedRequest = patchRequestSchema.parse(body);
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

  if (!provider) {
    return NextResponse.json({
      source: "unavailable",
      unavailableReason: "No AI provider configured."
    } satisfies AiPatchProposalApiResult);
  }

  try {
    const result = await generatePatchProposal(parsedRequest.input as AiPatchProposalInput, provider);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      source: "unavailable",
      unavailableReason: error instanceof Error ? error.message : "AI patch proposal failed."
    } satisfies AiPatchProposalApiResult);
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
