import { describe, it, expect } from "vitest";
import {
  parseProjectFilters,
  hasActiveFilters,
  filtersToQuery,
  toggleFilter,
} from "./filters";

// Proje filtreleri - URL parametre senkronizasyonu testleri (planning/14 R20).
describe("parseProjectFilters", () => {
  it("URL parametrelerini tekil değerli filtreye çevirir", () => {
    expect(parseProjectFilters({ type: "professional", tool: "Playwright" })).toEqual({
      classification: "professional",
      platform: undefined,
      tool: "Playwright",
      testType: undefined,
    });
  });

  it("dizi değerlerden ilkini alır, boşları yok sayar", () => {
    expect(parseProjectFilters({ type: ["personal", "x"], platform: "  " }).classification).toBe(
      "personal",
    );
    expect(parseProjectFilters({ platform: "  " }).platform).toBeUndefined();
  });
});

describe("hasActiveFilters", () => {
  it("hiç filtre yoksa false", () => {
    expect(hasActiveFilters({})).toBe(false);
  });
  it("bir filtre varsa true", () => {
    expect(hasActiveFilters({ tool: "k6" })).toBe(true);
  });
});

describe("filtersToQuery", () => {
  it("yalnızca dolu alanları query'e koyar", () => {
    expect(filtersToQuery({ classification: "supported", tool: "k6" })).toEqual({
      type: "supported",
      tool: "k6",
    });
  });
});

describe("toggleFilter", () => {
  it("seçili değilse ekler", () => {
    expect(toggleFilter({}, "type", "professional").classification).toBe("professional");
  });
  it("zaten seçiliyse kaldırır (toggle)", () => {
    expect(
      toggleFilter({ classification: "professional" }, "type", "professional").classification,
    ).toBeUndefined();
  });
  it("aynı boyutta farklı değeri değiştirir", () => {
    expect(toggleFilter({ tool: "k6" }, "tool", "Playwright").tool).toBe("Playwright");
  });
});
