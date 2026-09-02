import { describe, it, expect } from "vitest";
import { isPubliclyVisible, resolveTranslation } from "./publication";

// Yayın durumu - TEK DOĞRULUK KAYNAĞI testleri (planning/11 §11.5 yayın-durumu matrisi).
describe("isPubliclyVisible", () => {
  it("yalnızca published + visible ise true döner", () => {
    expect(isPubliclyVisible({ status: "published", visible: true })).toBe(true);
  });

  it("taslak asla görünmez", () => {
    expect(isPubliclyVisible({ status: "draft", visible: true })).toBe(false);
  });

  it("gizlenmiş (visible=false) yayınlanmış içerik görünmez", () => {
    expect(isPubliclyVisible({ status: "published", visible: false })).toBe(false);
  });

  it("arşivlenmiş içerik görünmez", () => {
    expect(isPubliclyVisible({ status: "archived", visible: true })).toBe(false);
  });
});

describe("resolveTranslation", () => {
  const content = {
    requestedLocale: "tr" as const,
    defaultLocale: "en" as const,
    translations: {
      en: { translationStatus: "published" as const, data: "english" },
    },
  };

  it("istenen dilde yayınlanmış çeviri varsa onu döner", () => {
    const withTr = {
      ...content,
      translations: {
        ...content.translations,
        tr: { translationStatus: "published" as const, data: "türkçe" },
      },
    };
    expect(resolveTranslation(withTr, "show_with_tag")).toEqual({
      data: "türkçe",
      usedFallback: false,
      shownLocale: "tr",
    });
  });

  it("istenen dil yoksa ve mod 'show_with_tag' ise varsayılan dile düşer", () => {
    expect(resolveTranslation(content, "show_with_tag")).toEqual({
      data: "english",
      usedFallback: true,
      shownLocale: "en",
    });
  });

  it("istenen dil yoksa ve mod 'hide' ise null döner", () => {
    expect(resolveTranslation(content, "hide")).toBeNull();
  });

  it("hiçbir dilde yayınlanmış çeviri yoksa null döner", () => {
    const nonedPublished = {
      ...content,
      translations: { en: { translationStatus: "draft" as const, data: "english" } },
    };
    expect(resolveTranslation(nonedPublished, "show_with_tag")).toBeNull();
  });
});
