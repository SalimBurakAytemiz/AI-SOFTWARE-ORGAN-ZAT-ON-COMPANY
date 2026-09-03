import { describe, it, expect } from "vitest";
import {
  personJsonLd,
  webSiteJsonLd,
  caseStudyJsonLd,
  breadcrumbJsonLd,
} from "./structured-data";
import type { ProjectCaseStudy } from "@/lib/domain/project";

// JSON-LD structured data testleri (planning/15 T-1504, planning/14 R21).

describe("personJsonLd", () => {
  it("geçersiz (PLACEHOLDER) sameAs değerlerini filtreler (ADR-0008)", () => {
    const ld = personJsonLd(
      {
        name: "Ada",
        jobTitle: "QA",
        sameAs: [
          "[PLACEHOLDER: https://github.com/x]",
          "https://github.com/gercek",
          "https://linkedin.com/in/gercek",
        ],
      },
      "en",
    );
    expect(ld.sameAs).toEqual(["https://github.com/gercek", "https://linkedin.com/in/gercek"]);
    expect(ld["@type"]).toBe("Person");
  });
});

describe("webSiteJsonLd", () => {
  it("dile göre inLanguage ayarlar", () => {
    expect(webSiteJsonLd("tr").inLanguage).toBe("tr-TR");
    expect(webSiteJsonLd("en").inLanguage).toBe("en-US");
  });
});

describe("caseStudyJsonLd", () => {
  const base: ProjectCaseStudy = {
    slug: "x",
    classification: "professional",
    featured: false,
    supported: false,
    nda: false,
    company: "Acme",
    companyHidden: false,
    displayOrder: 1,
    title: "Test başlığı",
    summary: "özet",
    roleTitle: "QA",
    taxonomy: [],
    demo: false,
    period: { start: "2024-01", end: null, ongoing: false },
    links: { github: null, external: null },
    industry: null,
    platforms: ["Web"],
    tools: [],
    testTypes: ["Automation"],
    sections: {
      overviewMd: null,
      testingScopeMd: null,
      testStrategyMd: null,
      testCoverageMd: null,
      challengesMd: null,
      impactMd: null,
      lessonsMd: null,
    },
    coverage: [],
    scenarios: [],
    bugs: [],
    apiExamples: [],
    sqlExamples: [],
    seo: { title: null, description: null },
  };

  it("CreativeWork tipi ve about listesi üretir", () => {
    const ld = caseStudyJsonLd(base, "en");
    expect(ld["@type"]).toBe("CreativeWork");
    expect(ld.about).toEqual([
      { "@type": "Thing", name: "Web" },
      { "@type": "Thing", name: "Automation" },
    ]);
  });

  it("DEMO projede creativeWorkStatus 'Demo' içerir", () => {
    const ld = caseStudyJsonLd({ ...base, demo: true }, "en");
    expect(String(ld.creativeWorkStatus)).toContain("Demo");
  });

  it("NDA projede creativeWorkStatus 'NDA' içerir", () => {
    const ld = caseStudyJsonLd({ ...base, nda: true }, "en");
    expect(String(ld.creativeWorkStatus)).toContain("NDA");
  });
});

describe("breadcrumbJsonLd", () => {
  it("sıralı position değerleri üretir", () => {
    const ld = breadcrumbJsonLd("tr", [
      { name: "Ana", path: "" },
      { name: "Projeler", path: "/projects" },
    ]);
    const items = ld.itemListElement as { position: number; name: string }[];
    expect(items[0]?.position).toBe(1);
    expect(items[1]?.position).toBe(2);
    expect(items[1]?.name).toBe("Projeler");
  });
});
