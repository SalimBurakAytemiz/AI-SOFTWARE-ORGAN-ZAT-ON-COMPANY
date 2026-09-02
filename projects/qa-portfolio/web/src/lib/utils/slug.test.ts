import { describe, it, expect } from "vitest";
import { slugify, isValidSlug } from "./slug";

// slug yardımcıları - Türkçe karakter translitrasyonu ve geçerlilik kuralı testleri.
describe("slugify", () => {
  it("Türkçe karakterleri ASCII'ye çevirir", () => {
    expect(slugify("Ödeme Regresyon Süiti")).toBe("odeme-regresyon-suiti");
    expect(slugify("Çağrı İşleyici Testleri")).toBe("cagri-isleyici-testleri");
  });

  it("boşluk ve özel karakterleri tireye çevirir, ardışıkları tekler", () => {
    expect(slugify("  API  --  Contract Testing!! ")).toBe("api-contract-testing");
  });

  it("baştaki ve sondaki tireleri temizler", () => {
    expect(slugify("--merhaba--")).toBe("merhaba");
  });
});

describe("isValidSlug", () => {
  it("geçerli slug'ları kabul eder", () => {
    expect(isValidSlug("api-contract-testing")).toBe(true);
    expect(isValidSlug("proje1")).toBe(true);
  });

  it("geçersiz slug'ları reddeder", () => {
    expect(isValidSlug("Büyük-Harf")).toBe(false);
    expect(isValidSlug("bosluk var")).toBe(false);
    expect(isValidSlug("-bas-tire")).toBe(false);
    expect(isValidSlug("a")).toBe(false); // çok kısa
  });
});
