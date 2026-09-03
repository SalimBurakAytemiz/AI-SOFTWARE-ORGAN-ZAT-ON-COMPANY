import { describe, it, expect } from "vitest";
import { formatMonth, toLocaleUpper } from "./format";

// Yerelleştirilmiş biçimlendirme testleri (planning/11 T-1105, T-1106).
describe("formatMonth", () => {
  it("TR için Türkçe ay adı üretir", () => {
    expect(formatMonth("2024-02", "tr")).toContain("2024");
    expect(formatMonth("2024-02", "tr")?.toLowerCase()).toContain("şubat");
  });

  it("EN için İngilizce ay adı üretir", () => {
    expect(formatMonth("2024-02", "en")).toBe("February 2024");
  });

  it("null girdi -> null", () => {
    expect(formatMonth(null, "tr")).toBeNull();
  });
});

describe("toLocaleUpper (Türkçe i sorunu)", () => {
  it("TR'de 'i' -> 'İ' (noktalı)", () => {
    expect(toLocaleUpper("iletişim", "tr")).toBe("İLETİŞİM");
  });

  it("EN'de 'i' -> 'I' (noktasız)", () => {
    expect(toLocaleUpper("contact", "en")).toBe("CONTACT");
  });
});
