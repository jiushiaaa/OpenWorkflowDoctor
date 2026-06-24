import { expect, test } from "@playwright/test";
import path from "node:path";

test("workbench supports the deterministic v0.2 review packet demo flow", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "OpenWorkflowDoctor" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "本地静态审查导出的 n8n JSON" })).toBeVisible();
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
  await expect(settingsModal).toBeVisible();
  await expect(settingsModal.getByLabel("语言")).toHaveValue("zh-CN");
  await expect(settingsModal.getByLabel("Provider 类型")).toHaveValue("openai-compatible");
  await expect(settingsModal.getByLabel("Base URL")).toHaveValue("https://api.openai.com/v1");
  await expect(settingsModal.getByLabel("API Key")).toHaveAttribute("type", "password");
  await expect(settingsModal.getByLabel("模型")).toHaveValue("gpt-4.1-mini");
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
  await expect(page.getByRole("heading", { name: "本地静态审查导出的 n8n JSON" })).toBeHidden();
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

  await reviewSteps.getByRole("button", { name: "预览补丁 IR" }).click();

  await expect(reviewSteps.getByRole("button", { name: "完成必要确认" })).toBeVisible();
  await expect(page.getByText("这不会修改 n8n，也不会导出可导入 n8n 的 JSON。")).toBeVisible();
  await expect(reviewConsole.getByRole("tab", { name: "验证" })).toHaveAttribute("aria-selected", "true");
  await expect(reviewConsole.getByText("CI 风格验证器检查")).toBeVisible();
  await expect(reviewConsole.getByText("验证器保持 HOLD，因为剩余副作用路径需要人工确认。")).toBeVisible();
  await expect(reviewConsole.getByText("必要人工确认")).toBeVisible();
  await expect(page.getByRole("contentinfo", { name: "Workbench status" })).toContainText("验证器: HOLD");
  await expect(page.getByRole("contentinfo", { name: "Workbench status" })).toContainText("视图: 补丁");

  const acceptButton = page.getByRole("button", { name: "接受" });
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
