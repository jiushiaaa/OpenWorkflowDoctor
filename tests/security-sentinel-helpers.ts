import { expect } from "vitest";

export const v091SecuritySentinels = {
  apiKey: "SECRET_V091_API_KEY_SHOULD_NOT_LEAK",
  bearerToken: "SECRET_V091_BEARER_TOKEN_SHOULD_NOT_LEAK",
  cookie: "SECRET_V091_COOKIE_SHOULD_NOT_LEAK",
  password: "SECRET_V091_PASSWORD_SHOULD_NOT_LEAK",
  privateKey: "-----BEGIN PRIVATE KEY-----\nSECRET_V091_PRIVATE_KEY_SHOULD_NOT_LEAK\n-----END PRIVATE KEY-----",
  webhookPath: "SECRET_V091_WEBHOOK_PATH_SHOULD_NOT_LEAK",
  signedUrl: "SECRET_V091_SIGNED_URL_SHOULD_NOT_LEAK",
  pluginId: "SECRET_V091_PLUGIN_ID_SHOULD_NOT_LEAK",
  datasetId: "SECRET_V091_DATASET_ID_SHOULD_NOT_LEAK",
  fileId: "SECRET_V091_FILE_ID_SHOULD_NOT_LEAK",
  workspaceId: "SECRET_V091_WORKSPACE_ID_SHOULD_NOT_LEAK",
  appId: "SECRET_V091_APP_ID_SHOULD_NOT_LEAK",
  botId: "SECRET_V091_BOT_ID_SHOULD_NOT_LEAK",
  orgId: "SECRET_V091_ORG_ID_SHOULD_NOT_LEAK",
  tenantId: "SECRET_V091_TENANT_ID_SHOULD_NOT_LEAK",
  userId: "SECRET_V091_USER_ID_SHOULD_NOT_LEAK",
  rawPrompt: "SECRET_V091_RAW_PROMPT_SHOULD_NOT_LEAK",
  rawCode: "SECRET_V091_RAW_CODE_SHOULD_NOT_LEAK",
  rawSql: "SECRET_V091_RAW_SQL_SHOULD_NOT_LEAK",
  aiProviderKey: "SECRET_V091_AI_PROVIDER_KEY_SHOULD_NOT_LEAK",
  n8nApiKey: "SECRET_V091_N8N_API_KEY_SHOULD_NOT_LEAK",
  difySecretEnv: "SECRET_V091_DIFY_ENV_VALUE_SHOULD_NOT_LEAK",
  cozeRawPayload: "SECRET_V091_COZE_RAW_PAYLOAD_SHOULD_NOT_LEAK",
  customGraphSensitiveContent: "SECRET_V091_CUSTOM_GRAPH_CONTENT_SHOULD_NOT_LEAK"
} as const;

export const v091SecuritySentinelValues = Object.values(v091SecuritySentinels);

export function assertNoSecuritySentinelLeak(value: unknown): void {
  const serialized = JSON.stringify(value);

  for (const sentinel of v091SecuritySentinelValues) {
    expect(serialized).not.toContain(sentinel);
  }
}
