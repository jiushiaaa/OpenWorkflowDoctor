import { expect, test } from "@playwright/test";
import path from "node:path";

test("first-run onboarding completes demo mode without n8n or AI", async ({ page }) => {
  await page.goto("/");

  const onboarding = page.getByRole("dialog", { name: "First-run onboarding" });
  await expect(onboarding).toBeVisible();
  await expect(onboarding.getByText("OpenWorkflowDoctor does not execute workflows.")).toBeVisible();
  await expect(onboarding.getByText("Patch proposals are review-only.")).toBeVisible();
  await expect(onboarding.getByText("Imported data stays local.")).toBeVisible();
  await expect(onboarding.getByText("Rule-based diagnostics work without AI.")).toBeVisible();

  await onboarding.getByRole("button", { name: "Start demo mode" }).click();

  const reviewSteps = page.getByRole("complementary", { name: "审查步骤" });
  await expect(onboarding).toBeHidden();
  await expect(reviewSteps.getByRole("heading", { name: /Refund Risky|Refund Workflow/ })).toBeVisible();
  await expect(reviewSteps.locator(".primary-action")).toHaveText("预览补丁 IR");
  await expect(page.getByRole("region", { name: "Review Console" }).getByText("问题")).toBeVisible();
  await expect(page.getByRole("contentinfo", { name: "Workbench status" })).toContainText("AI: 兜底");

  await page.reload();
  await expect(page.getByRole("dialog", { name: "First-run onboarding" })).toHaveCount(0);
});

test("workbench supports the deterministic v0.7.0 review packet demo flow", async ({ page }) => {
  test.setTimeout(60000);
  await page.goto("/");

  await expect(page.getByText("OpenWorkflowDoctor v0.7.0").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "本地静态审查工作流定义" })).toBeVisible();
  const welcomeChecklist = page.getByRole("region", { name: "本次审查会产出" });
  await expect(welcomeChecklist).toBeVisible();
  await expect(welcomeChecklist.getByText("WorkflowIR 补丁预览", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "命令面板" })).toBeVisible();
  await expect(page.getByRole("button", { name: "设置" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Dark theme" })).toHaveCount(0);
  await expect(page.locator(".primary-action")).toHaveText("导入 JSON");
  await expect(page.getByRole("contentinfo", { name: "Workbench status" })).toContainText("本地模式");
  await expect(page.getByRole("contentinfo", { name: "Workbench status" })).toContainText("无运行时");
  await expect(page.getByRole("contentinfo", { name: "Workbench status" })).toContainText("无凭据");
  await expect(page.getByRole("contentinfo", { name: "Workbench status" })).toContainText("WorkflowIR 预览");
  await expect(page.getByRole("contentinfo", { name: "Workbench status" })).toContainText("语言: zh-CN");
  await expect(page.getByRole("contentinfo", { name: "Workbench status" })).toContainText("AI: 兜底");

  await page.getByRole("button", { name: "设置" }).click();
  const settingsModal = page.getByRole("dialog", { name: "设置" });
  const providerSelect = settingsModal.getByLabel("Provider", { exact: true });
  await expect(settingsModal).toBeVisible();
  await expect(settingsModal.getByLabel("语言")).toHaveValue("zh-CN");
  await expect(providerSelect).toHaveValue("openai");
  await expect(settingsModal.getByLabel("Provider 类型")).toHaveValue("openai-compatible");
  await expect(settingsModal.getByLabel("Base URL")).toHaveValue("https://api.openai.com/v1");
  await expect(settingsModal.getByLabel("API Key")).toHaveAttribute("type", "password");
  await expect(settingsModal.getByLabel("模型")).toHaveValue("gpt-4.1-mini");
  await expect(settingsModal.getByLabel("Transport")).toHaveValue("responses");
  await expect(settingsModal.getByLabel("Response Format")).toHaveValue("json_schema");
  await providerSelect.selectOption("volcengine-ark");
  await expect(settingsModal.getByText("Verified", { exact: true })).toBeVisible();
  await expect(settingsModal.getByLabel("Base URL")).toHaveValue("https://ark.cn-beijing.volces.com/api/v3");
  await expect(settingsModal.getByLabel("模型")).toHaveValue("doubao-seed-2-0-pro-260215");
  await expect(settingsModal.getByLabel("Transport")).toHaveValue("chat_completions");
  await expect(settingsModal.getByLabel("Response Format")).toHaveValue("json_object");
  await settingsModal.getByLabel("模型").fill("custom-ark-endpoint");
  await expect(settingsModal.getByLabel("模型")).toHaveValue("custom-ark-endpoint");
  await expect(settingsModal.getByText("API key 会为了本地优先使用而存储在此浏览器中。")).toBeVisible();
  await expect(settingsModal.getByText("仅本地静态审查")).toBeVisible();
  await settingsModal.getByLabel("主题").selectOption("dark");
  await expect(page.locator("main.doctor-shell")).toHaveAttribute("data-theme", "dark");
  await settingsModal.getByLabel("主题").selectOption("light");
  await expect(page.locator("main.doctor-shell")).toHaveAttribute("data-theme", "light");
  await settingsModal.getByLabel("API Key").fill("sk-local-browser-only");
  await expect(settingsModal.getByText("已保存: sk-l...only")).toBeVisible();
  await expect(page.getByRole("contentinfo", { name: "Workbench status" })).toContainText("AI: 已配置");
  await settingsModal.getByRole("button", { name: "清除凭据" }).click();
  await expect(settingsModal.getByText("凭据已清除。")).toBeVisible();
  await expect(settingsModal.getByLabel("API Key")).toHaveValue("");
  await expect(page.getByRole("contentinfo", { name: "Workbench status" })).toContainText("AI: 兜底");
  await settingsModal.getByLabel("语言").selectOption("en-US");
  const englishSettingsModal = page.getByRole("dialog", { name: "Settings" });
  await expect(englishSettingsModal).toBeVisible();
  await expect(page.getByRole("button", { name: "Command Palette" })).toBeVisible();
  await expect(page.getByRole("contentinfo", { name: "Workbench status" })).toContainText("Language: en-US");
  await englishSettingsModal.getByLabel("Language").selectOption("zh-CN");
  await expect(settingsModal).toBeVisible();
  await settingsModal.getByRole("button", { name: "关闭" }).click();
  await expect(settingsModal).toBeHidden();

  const importInput = page.locator('input[type="file"]');
  await importInput
    .setInputFiles(path.join(process.cwd(), "samples/n8n/refund-workflow.json"));

  const reviewSteps = page.getByRole("complementary", { name: "审查步骤" });
  await expect(reviewSteps.getByRole("heading", { name: "审查目标" })).toBeVisible();
  await expect(reviewSteps.getByRole("heading", { name: "Refund Workflow" })).toBeVisible();
  await expect(reviewSteps.getByText("审查包导出状态")).toBeVisible();
  await expect(reviewSteps.getByText("未导出")).toBeVisible();
  await expect(page.getByRole("heading", { name: "本地静态审查工作流定义" })).toBeHidden();
  await expect(reviewSteps.getByText("当前视图")).toBeVisible();
  await expect(reviewSteps.getByText("原始")).toBeVisible();
  await expect(reviewSteps.locator(".primary-action")).toHaveText("运行 Doctor");

  await page.getByRole("button", { name: "命令面板" }).click();
  const commandPalette = page.getByRole("dialog", { name: "命令面板" });
  await expect(commandPalette).toBeVisible();
  await expect(commandPalette.getByRole("button", { name: "运行 Doctor" })).toBeEnabled();
  await expect(commandPalette.getByRole("button", { name: "预览补丁 IR" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(commandPalette).toBeHidden();

  await reviewSteps.locator(".primary-action").click();
  const reviewConsole = page.getByRole("region", { name: "Review Console" });
  await expect(reviewSteps.getByRole("button", { name: "预览补丁 IR" })).toBeEnabled();

  await expect(
    page.getByRole("region", { name: "工作流审查 IDE" }).getByRole("heading", { name: "Refund Workflow" })
  ).toBeVisible();
  const metrics = page.getByRole("region", { name: "工作流审查 IDE" }).getByLabel("Review metrics");
  await expect(metrics.getByText("节点", { exact: true })).toBeVisible();
  await expect(metrics.getByText("风险", { exact: true })).toBeVisible();
  await expect(metrics.getByText("补丁操作", { exact: true })).toBeVisible();
  await expect(metrics.getByText("验证器状态", { exact: true })).toBeVisible();
  await expect(reviewConsole.getByRole("tab", { name: "风险" })).toHaveAttribute("aria-selected", "true");
  await expect(reviewConsole.getByText("问题")).toBeVisible();
  await expect(reviewConsole.getByText("Webhook has no dedupe guard", { exact: true })).toBeVisible();
  await expect(reviewConsole.getByRole("tab", { name: "AI 说明" })).toHaveAttribute("aria-selected", "false");

  await reviewConsole.getByRole("tab", { name: "AI 说明" }).click();
  await expect(reviewConsole.getByText("仅供建议。确定性诊断和验证器才是真实依据。")).toBeVisible();
  await expect(
    reviewConsole.getByText("只使用安全的 WorkflowIR 摘要、风险摘要、图摘要和验证器闸门。不会发送原始 n8n JSON 或参数。 API key 会为了本地优先使用而存储在此浏览器中。")
  ).toBeVisible();
  await reviewConsole.getByRole("button", { name: "生成说明" }).click();
  await expect(reviewConsole.getByText("确定性兜底")).toBeVisible();
  await expect(reviewConsole.locator(".review-warning").getByText("AI 不可用： No AI provider configured.")).toBeVisible();

  await reviewConsole.getByRole("tab", { name: "补丁差异" }).click();
  await expect(reviewConsole.getByRole("heading", { name: "WorkflowIR 补丁预览" })).toBeVisible();
  await expect(reviewConsole.getByText("操作列表")).toBeVisible();
  await expect(reviewConsole.getByText("update_node_parameters")).toBeVisible();
  await expect(reviewConsole.getByText("insert_node_after")).toBeVisible();
  await expect(reviewConsole.getByRole("heading", { name: "AI 补丁提案" })).toBeVisible();
  await expect(reviewConsole.getByText("AI 只能提出可审查的 WorkflowIR PatchOperation。确定性验证、Verifier 和人工审查仍然必需。")).toBeVisible();

  await reviewSteps.getByRole("button", { name: "预览补丁 IR" }).click();

  await expect(reviewSteps.getByRole("button", { name: "完成必要确认" })).toBeVisible();
  await expect(page.getByText("这不会修改 n8n，也不会导出可导入 n8n 的 JSON。")).toBeVisible();
  await expect(reviewConsole.getByRole("tab", { name: "验证" })).toHaveAttribute("aria-selected", "true");
  await expect(reviewConsole.getByText("CI 风格验证器检查")).toBeVisible();
  await expect(reviewConsole.getByText("验证器保持 HOLD，因为剩余副作用路径需要人工确认。")).toBeVisible();
  await expect(reviewConsole.getByText("必要人工确认")).toBeVisible();
  await expect(page.getByRole("contentinfo", { name: "Workbench status" })).toContainText("验证器: HOLD");
  await expect(page.getByRole("contentinfo", { name: "Workbench status" })).toContainText("视图: 补丁");

  const acceptButton = reviewConsole.getByRole("button", { name: "接受" });
  await expect(acceptButton).toBeDisabled();

  for (const checkbox of await page.locator(".confirmation-list input[type='checkbox']").all()) {
    await checkbox.check();
  }

  await expect(acceptButton).toBeEnabled();
  await acceptButton.click();
  await expect(reviewSteps.getByRole("button", { name: "导出审查包" })).toBeVisible();
  await reviewConsole.getByRole("tab", { name: "审查包" }).click();
  await expect(reviewConsole.getByText("工件预览")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await reviewSteps.getByRole("button", { name: "导出审查包" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("refund-workflow-review-packet.json");
});

test("workbench previews a mock AI-assisted patch through deterministic verifier gates", async ({ page }) => {
  await page.route("**/api/ai/patch", async (route) => {
    const body = route.request().postDataJSON() as { input: { inputFingerprint: string; graph: { nodes: { id: string; type: string }[] }; issues: { id: string; title: string }[] } };
    const httpNodeId = body.input.graph.nodes.find((node) => node.type === "n8n-nodes-base.httprequest")?.id ?? "node-2";
    const timeoutIssueId = body.input.issues.find((issue) => issue.title === "HTTP request has no timeout")?.id ?? "issue-2";

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        source: "ai",
        candidate: {
          schemaVersion: "openworkflowdoctor.ai-patch-proposal.v1",
          source: "ai",
          createdAt: "2026-06-24T00:00:00.000Z",
          inputFingerprint: body.input.inputFingerprint,
          proposal: {
            summary: "AI-assisted timeout proposal.",
            operations: [
              {
                type: "update_node_parameters",
                targetNodeId: httpNodeId,
                parameters: {
                  timeout: 30000
                }
              }
            ],
            risksAddressed: [timeoutIssueId],
            expectedImpact: ["Adds an HTTP timeout."],
            risksIntroduced: [],
            requiresHumanReview: true
          },
          conflicts: [],
          safetyNotes: ["AI proposal remains review-only."]
        }
      })
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "设置" }).click();
  const settingsModal = page.getByRole("dialog", { name: "设置" });
  await settingsModal.getByLabel("API Key").fill("sk-e2e-local-only");
  await settingsModal.getByRole("button", { name: "关闭" }).click();

  await page.locator('input[type="file"]').setInputFiles(path.join(process.cwd(), "samples/n8n/refund-workflow.json"));
  const reviewSteps = page.getByRole("complementary", { name: "审查步骤" });
  await reviewSteps.locator(".primary-action").click();

  const reviewConsole = page.getByRole("region", { name: "Review Console" });
  await reviewConsole.getByRole("tab", { name: "补丁差异" }).click();
  await reviewConsole.getByRole("button", { name: "生成 AI 补丁提案" }).click();
  await expect(reviewConsole.getByText("AI 辅助")).toBeVisible();
  await expect(reviewConsole.getByText("AI-assisted timeout proposal.")).toBeVisible();
  await expect(reviewConsole.getByRole("button", { name: "预览 AI 补丁" })).toBeEnabled();
  await reviewConsole.getByRole("button", { name: "预览 AI 补丁" }).click();

  await expect(reviewConsole.getByRole("tab", { name: "验证" })).toHaveAttribute("aria-selected", "true");
  await expect(reviewConsole.getByText("AI proposal schema is valid")).toBeVisible();
  await expect(reviewConsole.getByText("AI proposal has no blocking conflicts")).toBeVisible();
  await expect(page.getByRole("contentinfo", { name: "Workbench status" })).toContainText("验证器: HOLD");
});

test("workbench imports two workflows and restores state when switching", async ({ page }) => {
  await page.goto("/");

  const importInput = page.locator('input[type="file"]');
  await importInput.setInputFiles(path.join(process.cwd(), "samples/n8n/refund-workflow.json"));

  const explorer = page.getByRole("region", { name: "工作流浏览器" });
  await expect(explorer).toBeVisible();
  await expect(explorer.getByRole("button", { name: /Refund Workflow/ })).toBeVisible();

  const reviewSteps = page.getByRole("complementary", { name: "审查步骤" });
  await reviewSteps.locator(".primary-action").click();

  const reviewConsole = page.getByRole("region", { name: "Review Console" });
  await expect(reviewConsole.getByText("Webhook has no dedupe guard", { exact: true })).toBeVisible();

  await importInput.setInputFiles(path.join(process.cwd(), "samples/n8n/messy-legacy.workflow.json"));

  await expect(explorer.getByRole("button", { name: /Refund Workflow/ })).toBeVisible();
  await expect(explorer.getByRole("button", { name: /Messy Legacy Workflow/ })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "工作流审查 IDE" }).getByRole("heading", { name: "Messy Legacy Workflow" })
  ).toBeVisible();
  await expect(reviewSteps.locator(".primary-action")).toHaveText("运行 Doctor");
  await expect(reviewConsole.getByText("Webhook has no dedupe guard", { exact: true })).toHaveCount(0);

  await explorer.getByRole("button", { name: /Refund Workflow/ }).click();

  await expect(
    page.getByRole("region", { name: "工作流审查 IDE" }).getByRole("heading", { name: "Refund Workflow" })
  ).toBeVisible();
  await expect(reviewConsole.getByText("Webhook has no dedupe guard", { exact: true })).toBeVisible();

  await explorer.getByRole("button", { name: /Messy Legacy Workflow/ }).click();

  await expect(
    page.getByRole("region", { name: "工作流审查 IDE" }).getByRole("heading", { name: "Messy Legacy Workflow" })
  ).toBeVisible();
  await expect(reviewConsole.getByText("Webhook has no dedupe guard", { exact: true })).toHaveCount(0);
});

test("workbench imports a Dify DSL YAML and runs Doctor", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles(path.join(process.cwd(), "samples/dify/support-workflow.yml"));

  const reviewSteps = page.getByRole("complementary", { name: "审查步骤" });
  await expect(reviewSteps.getByRole("heading", { name: "Dify Support Review" })).toBeVisible();
  await expect(reviewSteps.getByLabel("审查目标").getByText("Dify DSL 来源")).toBeVisible();
  await expect(reviewSteps.getByText("仅用于诊断。OpenWorkflowDoctor 不会运行、发布或写回 Dify。")).toBeVisible();
  await expect(page.getByText("sk-dify-sample-should-not-leak")).toHaveCount(0);
  await expect(page.getByText("dify-sample-token")).toHaveCount(0);

  await reviewSteps.locator(".primary-action").click();

  const reviewConsole = page.getByRole("region", { name: "Review Console" });
  await expect(reviewConsole.getByText("Dify secret environment variable is materialized")).toBeVisible();
  await expect(reviewConsole.getByText("Dify node may perform external side effects")).toBeVisible();
  await expect(reviewConsole.getByText("Dify condition has no fallback route")).toBeVisible();
});

test("workbench imports a Coze definition JSON and runs Doctor", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles(path.join(process.cwd(), "samples/coze/support-workflow.json"));

  const reviewSteps = page.getByRole("complementary", { name: "审查步骤" });
  await expect(reviewSteps.getByRole("heading", { name: "Coze Support Review" })).toBeVisible();
  await expect(reviewSteps.getByLabel("审查目标").getByText("Coze Definition")).toBeVisible();
  await expect(
    reviewSteps.getByText(
      "Imported for diagnosis only. OpenWorkflowDoctor will not connect to Coze, run, publish, fetch resources, or write back."
    )
  ).toBeVisible();
  await expect(page.getByText("SECRET_COZE_SAMPLE_TOKEN_SHOULD_NOT_LEAK")).toHaveCount(0);
  await expect(page.getByText("SECRET_COZE_SAMPLE_PLUGIN_ID_SHOULD_NOT_LEAK")).toHaveCount(0);

  await reviewSteps.locator(".primary-action").click();

  const reviewConsole = page.getByRole("region", { name: "Review Console" });
  await expect(reviewConsole.getByText("Coze definition artifact is best-effort")).toBeVisible();
  await expect(reviewConsole.getByText("Coze plugin/tool may perform external side effects")).toBeVisible();
  await expect(reviewConsole.getByText("Coze HTTP request has no timeout")).toBeVisible();
});

test("workbench imports a workflow from read-only n8n and runs Doctor", async ({ page }) => {
  let workflowFetchCount = 0;
  await page.route("**/api/n8n/readonly", async (route) => {
    const body = route.request().postDataJSON() as {
      action: string;
      connection: { baseUrl: string; authHeaderName: string };
      apiKey: string;
      workflowId?: string;
    };
    expect(route.request().method()).toBe("POST");
    expect(body.connection).toEqual({
      baseUrl: "https://mock-n8n.example.test/api/v1",
      authHeaderName: "X-N8N-API-KEY"
    });
    expect(body.apiKey).toBe("n8n-session-key");
    expect(JSON.stringify(body)).not.toContain("credentials");
    expect(JSON.stringify(body)).not.toContain("executions");

    if (body.action === "getWorkflow" && body.workflowId === "wf_readonly") {
      workflowFetchCount += 1;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          id: "wf_readonly",
          name: "Read-only Refund Workflow",
          active: true,
          updatedAt: workflowFetchCount === 1 ? "2026-06-25T02:00:00.000Z" : "2026-06-25T03:00:00.000Z",
          versionId: workflowFetchCount === 1 ? "version-readonly" : "version-readonly-updated",
          pinData: {
            Webhook: [{ json: { secret: "pinned-secret" } }]
          },
          nodes: [
            {
              id: "webhook",
              name: "Webhook",
              type: "n8n-nodes-base.webhook",
              credentials: {
                httpHeaderAuth: {
                  id: "cred_should_not_leak",
                  name: "Production Header"
                }
              },
              parameters: {
                path: "secret-webhook-path",
                webhookUrl: "https://mock-n8n.example.test/webhook/secret"
              }
            },
            {
              id: "refund",
              name: "Stripe Refund",
              type: "n8n-nodes-base.stripe",
              parameters: {
                operation: "refund"
              }
            },
            ...(workflowFetchCount > 1
              ? [
                  {
                    id: "audit",
                    name: "Audit Log",
                    type: "n8n-nodes-base.noOp",
                    parameters: {}
                  }
                ]
              : [])
          ],
          connections: {
            Webhook: {
              main: [[{ node: "Stripe Refund", type: "main", index: 0 }]]
            }
          },
          tags: [{ id: "tag-secret", name: "Finance" }]
        })
      });
      return;
    }

    expect(body.action).toBe("listWorkflows");
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            id: "wf_readonly",
            name: "Read-only Refund Workflow",
            active: true,
            updatedAt: "2026-06-25T02:00:00.000Z",
            tags: [{ id: "tag-secret", name: "Finance" }]
          }
        ],
        nextCursor: null
      })
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "设置" }).click();
  const settingsModal = page.getByRole("dialog", { name: "设置" });
  await expect(settingsModal.getByRole("heading", { name: "n8n 连接", exact: true })).toBeVisible();
  await settingsModal.getByLabel("连接名称").fill("Mock n8n");
  await settingsModal.getByLabel("n8n 实例地址").fill("https://mock-n8n.example.test");
  await settingsModal.getByLabel("环境标签").fill("test");
  await settingsModal.getByLabel("n8n 会话 Key").fill("n8n-session-key");
  await settingsModal.getByRole("button", { name: "保存 n8n 连接" }).click();
  await expect(settingsModal.getByText("Mock n8n")).toBeVisible();
  await settingsModal.getByRole("button", { name: "关闭" }).click();

  await page.getByRole("button", { name: "从 n8n 导入" }).click();
  const importDialog = page.getByRole("dialog", { name: "从 n8n 导入" });
  await expect(importDialog.getByText("OpenWorkflowDoctor 不会修改 n8n")).toBeVisible();
  await importDialog.getByRole("button", { name: "列出工作流" }).click();
  await expect(importDialog.getByRole("button", { name: /Read-only Refund Workflow/ })).toBeVisible();
  await importDialog.getByRole("button", { name: /Read-only Refund Workflow/ }).click();
  await importDialog.getByRole("button", { name: "导入为本地审查副本" }).click();

  const reviewSteps = page.getByRole("complementary", { name: "审查步骤" });
  await expect(reviewSteps.getByRole("heading", { name: "Read-only Refund Workflow" })).toBeVisible();
  await expect(reviewSteps.getByLabel("审查目标").getByText("只读 n8n 来源")).toBeVisible();
  await expect(page.getByText("Imported as local review copy")).toBeVisible();
  await expect(page.getByText("cred_should_not_leak")).toHaveCount(0);
  await expect(page.getByText("Production Header")).toHaveCount(0);
  await expect(page.getByText("pinned-secret")).toHaveCount(0);
  await expect(page.getByText("secret-webhook-path")).toHaveCount(0);

  await reviewSteps.locator(".primary-action").click();
  await expect(page.getByRole("region", { name: "Review Console" }).getByText("Webhook has no dedupe guard")).toBeVisible();

  await reviewSteps.getByRole("button", { name: "刷新 n8n" }).click();
  await expect(reviewSteps.getByText(/previous upstream version/)).toBeVisible();
});

test("settings can reopen onboarding and confirm reset scope", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("dialog", { name: "First-run onboarding" }).getByRole("button", { name: "Skip for now" }).click();

  await page.getByRole("button", { name: "设置" }).click();
  const settingsModal = page.getByRole("dialog", { name: "设置" });

  await settingsModal.getByRole("button", { name: "重新打开引导" }).click();
  await expect(page.getByRole("dialog", { name: "First-run onboarding" })).toBeVisible();
  await page.getByRole("dialog", { name: "First-run onboarding" }).getByRole("button", { name: "关闭" }).click();

  await page.getByRole("button", { name: "设置" }).click();
  await settingsModal.getByRole("button", { name: "重置整个本地工作区" }).click();
  const resetDialog = page.getByRole("dialog", { name: "重置整个本地工作区" });
  await expect(resetDialog.getByText("将移除：")).toBeVisible();
  await expect(resetDialog.getByText("imported workflows and review packets")).toBeVisible();
  await expect(resetDialog.getByText("AI provider config and API key")).toBeVisible();
  await expect(resetDialog.getByText("将保留：")).toBeVisible();
  await expect(resetDialog.getByText("bundled demo workflows")).toBeVisible();
  await resetDialog.getByRole("button", { name: "取消" }).click();
});
