import { expect, test } from "@playwright/test";
import path from "node:path";

test("workbench supports the deterministic v0.1 review packet demo flow", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Workflow Doctor" })).toBeVisible();
  await expect(page.getByText("Workflow Graph")).toBeVisible();

  const importInput = page.locator('input[type="file"]');
  await importInput
    .setInputFiles(path.join(process.cwd(), "samples/n8n/refund-workflow.json"));

  await expect(importInput).toHaveJSProperty("files.length", 1);

  await page.getByRole("button", { name: "Run Doctor" }).click();
  const patchConfirmation = page.getByRole("region", { name: "Patch confirmation" });
  const doctorReport = page.getByRole("region", { name: "Doctor report" });
  await expect(patchConfirmation.getByRole("button", { name: "Apply Reviewed Patch" })).toBeEnabled();

  await expect(page.getByRole("heading", { name: "Refund Workflow" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Risks" })).toBeVisible();
  await expect(doctorReport.getByText("Webhook has no dedupe guard")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Patch Proposal" })).toBeVisible();
  await expect(page.getByText("update_node_parameters")).toBeVisible();
  await expect(page.getByText("insert_node_after")).toBeVisible();

  await patchConfirmation.getByRole("button", { name: "Apply Reviewed Patch" }).click();

  await expect(patchConfirmation.getByRole("button", { name: "Patch Preview Applied" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Verification Report" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Acceptance Checklist" })).toBeVisible();

  const acceptButton = page.getByRole("button", { name: "Accept" });
  await expect(acceptButton).toBeDisabled();

  for (const checkbox of await page.locator(".confirmation-list input[type='checkbox']").all()) {
    await checkbox.check();
  }

  await expect(acceptButton).toBeEnabled();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Review Packet" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("refund-workflow-review-packet.json");
});
