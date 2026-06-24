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
  providerPreset: z.string().optional(),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  transport: z.enum(["responses", "chat_completions"]).optional().default("responses"),
  responseFormat: z.enum(["none", "json_object", "json_schema"]).optional().default("json_schema")
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
    transport?: "responses" | "chat_completions";
    responseFormat?: "none" | "json_object" | "json_schema";
  } = {};
  const endpoint = createProviderEndpoint(providerConfig?.baseUrl, providerConfig?.transport);

  if (providerConfig?.apiKey !== undefined) {
    providerOptions.apiKey = providerConfig.apiKey;
  }
  if (providerConfig?.model !== undefined) {
    providerOptions.model = providerConfig.model;
  }
  if (endpoint !== undefined) {
    providerOptions.endpoint = endpoint;
  }
  if (providerConfig?.transport !== undefined) {
    providerOptions.transport = providerConfig.transport;
  }
  if (providerConfig?.responseFormat !== undefined) {
    providerOptions.responseFormat = providerConfig.responseFormat;
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

function createProviderEndpoint(baseUrl: string | undefined, transport: "responses" | "chat_completions" | undefined): string | undefined {
  const trimmed = baseUrl?.trim();
  if (!trimmed) {
    return undefined;
  }

  const withoutTrailingSlash = trimmed.replace(/\/+$/u, "");
  if (transport === "chat_completions") {
    return withoutTrailingSlash.endsWith("/chat/completions")
      ? withoutTrailingSlash
      : `${withoutTrailingSlash}/chat/completions`;
  }

  return withoutTrailingSlash.endsWith("/responses") ? withoutTrailingSlash : `${withoutTrailingSlash}/responses`;
}
