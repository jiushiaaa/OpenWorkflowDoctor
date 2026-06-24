import type { VerificationStatus } from "@openworkflowdoctor/workflow-ir";
import type { Language, Translator } from "../lib/i18n";
import type { ReviewMode } from "../lib/workspace-store";
import { statusLabels } from "./workbench-shared";

export function StatusBar({
  verifierStatus,
  reviewMode,
  language,
  aiProviderStatus,
  t
}: {
  verifierStatus: VerificationStatus | undefined;
  reviewMode: ReviewMode;
  language: Language;
  aiProviderStatus: "configured" | "fallback";
  t: Translator;
}) {
  return (
    <footer className="status-bar" role="contentinfo" aria-label="Workbench status">
      <span>{t("status.localMode")}</span>
      <span>{t("status.noRuntime")}</span>
      <span>{t("status.noCredentials")}</span>
      <span>{t("status.workflowIrPreview")}</span>
      <span>{t("status.language")}: {language}</span>
      <span>{t("status.ai")}: {aiProviderStatus === "configured" ? t("status.configured") : t("status.fallback")}</span>
      <span>{t("status.verifier")}: {verifierStatus ? statusLabels[verifierStatus] : t("toolbar.notRun")}</span>
      <span>{t("status.view")}: {reviewMode === "patched" ? t("view.patched") : t("view.original")}</span>
    </footer>
  );
}
