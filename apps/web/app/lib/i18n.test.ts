import { describe, expect, test } from "vitest";
import { DEFAULT_LANGUAGE, createTranslator, resolveLanguage } from "./i18n";

describe("workbench i18n", () => {
  test("defaults to zh-CN", () => {
    expect(DEFAULT_LANGUAGE).toBe("zh-CN");
    expect(resolveLanguage(null)).toBe("zh-CN");
    expect(createTranslator(undefined)("toolbar.settings")).toBe("设置");
  });

  test("falls back to zh-CN for unsupported languages", () => {
    expect(resolveLanguage("fr-FR")).toBe("zh-CN");
    expect(createTranslator("fr-FR")("empty.title")).toBe("本地静态审查导出的 n8n JSON");
  });

  test("returns en-US copy when requested", () => {
    expect(createTranslator("en-US")("toolbar.settings")).toBe("Settings");
  });
});
