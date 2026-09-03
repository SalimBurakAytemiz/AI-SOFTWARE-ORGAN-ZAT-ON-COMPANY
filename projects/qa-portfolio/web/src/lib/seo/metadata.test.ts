import { describe, it, expect } from "vitest";
import { buildPageMetadata, languageAlternates, absoluteUrl } from "./metadata";

/**
 * SEO metadata testleri (planning/15, planning/14 review R20).
 * NEXT_PUBLIC_SITE_URL ayarlı değilse http://localhost:3000 varsayılır.
 */
describe("absoluteUrl", () => {
  it("dil öneki ekler", () => {
    expect(absoluteUrl("tr", "/projects")).toContain("/tr/projects");
    expect(absoluteUrl("en", "")).toMatch(/\/en$/);
  });
});

describe("languageAlternates", () => {
  it("her dil için karşılıklı URL + x-default üretir (RISK-061)", () => {
    const alt = languageAlternates("/projects");
    expect(alt.tr).toContain("/tr/projects");
    expect(alt.en).toContain("/en/projects");
    expect(alt["x-default"]).toBe(alt.en); // varsayılan dil = en
  });
});

describe("buildPageMetadata", () => {
  it("canonical'ı verilen yola ayarlar", () => {
    const m = buildPageMetadata({
      locale: "en",
      path: "/about",
      title: "About",
      description: "d",
    });
    expect(m.alternates?.canonical).toContain("/en/about");
    expect(m.robots).toMatchObject({ index: true });
  });

  it("filtreli sayfa: noindex + canonical FİLTRESİZ yola (review R20)", () => {
    const m = buildPageMetadata({
      locale: "en",
      path: "/projects",
      canonicalPath: "/projects",
      title: "Projects — Filters",
      description: "d",
      noindex: true,
    });
    expect(m.robots).toMatchObject({ index: false, follow: true });
    expect(m.alternates?.canonical).toMatch(/\/en\/projects$/);
    // hreflang alternatifleri filtresiz yola işaret eder
    const langs = m.alternates?.languages as Record<string, string>;
    expect(langs.tr).toMatch(/\/tr\/projects$/);
  });

  it("Open Graph görselini AYARLAMAZ (dosya kuralı yönetir)", () => {
    const m = buildPageMetadata({ locale: "en", path: "", title: "T", description: "d" });
    expect(m.openGraph && "images" in m.openGraph).toBe(false);
  });
});
