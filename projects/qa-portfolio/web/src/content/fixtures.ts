import type { DbLocale } from "@/lib/db/database.types";
import type { ProjectCaseStudy } from "@/lib/domain/project";

/**
 * PLACEHOLDER İÇERİK - GERÇEK PROFESYONEL BİLGİ DEĞİLDİR.
 *
 * Faz 2'de uygulama, gerçek bir Supabase projesi olmadan çalışabilsin diye
 * public sayfalar bu sahte verilerden okur (repository katmanı üzerinden).
 * Gerçekçi, kurgusal örnekler için ayrıca demo-projects.ts vardır (DEMO/SANITIZED).
 *
 * KURAL (planning/12 RISK-052, ADR-0008): ekip profesyonel bilgi UYDURMAZ.
 * Buradaki her değer açıkça "[PLACEHOLDER]" işaretlidir. Doldurulacak alanların
 * tam listesi: projects/qa-portfolio/planning/13-content-intake-checklist.md
 */

export interface FixtureProfile {
  fullName: string;
  translations: Record<DbLocale, { headline: string; summary: string }>;
}

export const fixtureProfile: FixtureProfile = {
  fullName: "[PLACEHOLDER: Ad Soyad]",
  translations: {
    tr: {
      headline: "[PLACEHOLDER: Kıdemli Yazılım QA Mühendisi]",
      summary:
        "[PLACEHOLDER: Bir-iki cümlelik Türkçe özet - test stratejisi, otomasyon, API/DB doğrulama.]",
    },
    en: {
      headline: "[PLACEHOLDER: Senior Software QA Engineer]",
      summary:
        "[PLACEHOLDER: One or two sentence English summary - test strategy, automation, API/DB validation.]",
    },
  },
};

export const fixtureSkills: { category: Record<DbLocale, string>; items: string[] }[] = [
  {
    category: { tr: "Test Otomasyonu", en: "Test Automation" },
    items: ["Playwright", "Cypress", "Selenium"],
  },
  {
    category: { tr: "API ve Veritabanı", en: "API & Database" },
    items: ["Postman", "REST Assured", "SQL"],
  },
  { category: { tr: "Performans", en: "Performance" }, items: ["k6", "JMeter"] },
  { category: { tr: "CI/CD", en: "CI/CD" }, items: ["GitHub Actions"] },
];

const EMPTY_SECTIONS: ProjectCaseStudy["sections"] = {
  overviewMd:
    "> **PLACEHOLDER** — Bu vaka çalışmasının içeriği henüz girilmedi. Gerçek metin site sahibi tarafından admin panelden eklenecek (planning/13).",
  testingScopeMd: null,
  testStrategyMd: null,
  testCoverageMd: null,
  challengesMd: null,
  impactMd: null,
  lessonsMd: null,
};

interface PlaceholderDef {
  slug: string;
  classification: ProjectCaseStudy["classification"];
  featured: boolean;
  supported: boolean;
  nda: boolean;
  companyHidden: boolean;
  displayOrder: number;
  taxonomy: string[];
  tr: { title: string; summary: string; roleTitle: string };
  en: { title: string; summary: string; roleTitle: string };
}

const PLACEHOLDER_DEFS: PlaceholderDef[] = [
  {
    slug: "placeholder-personal-project",
    classification: "personal",
    featured: false,
    supported: false,
    nda: false,
    companyHidden: false,
    displayOrder: 10,
    taxonomy: ["Web", "Otomasyon"],
    tr: {
      title: "[PLACEHOLDER: Kişisel proje]",
      summary: "[PLACEHOLDER: Kişisel bir deneme veya açık kaynak katkısı.]",
      roleTitle: "[PLACEHOLDER: Geliştirici / Test]",
    },
    en: {
      title: "[PLACEHOLDER: Personal project]",
      summary: "[PLACEHOLDER: A personal experiment or open-source contribution.]",
      roleTitle: "[PLACEHOLDER: Developer / QA]",
    },
  },
  {
    slug: "placeholder-qa-lab-entry",
    classification: "qa_lab",
    featured: false,
    supported: false,
    nda: false,
    companyHidden: false,
    displayOrder: 20,
    taxonomy: ["API", "Deneysel"],
    tr: {
      title: "[PLACEHOLDER: QA Lab denemesi]",
      summary: "[PLACEHOLDER: Küçük bir demo, teardown veya araç denemesi.]",
      roleTitle: "[PLACEHOLDER: —]",
    },
    en: {
      title: "[PLACEHOLDER: QA Lab experiment]",
      summary: "[PLACEHOLDER: A small demo, teardown or tool experiment.]",
      roleTitle: "[PLACEHOLDER: —]",
    },
  },
];

function toPlaceholderCaseStudy(def: PlaceholderDef, locale: DbLocale): ProjectCaseStudy {
  const c = def[locale];
  return {
    slug: def.slug,
    classification: def.classification,
    featured: def.featured,
    supported: def.supported,
    nda: def.nda,
    company: null,
    companyHidden: def.companyHidden,
    displayOrder: def.displayOrder,
    title: c.title,
    summary: c.summary,
    roleTitle: c.roleTitle,
    taxonomy: def.taxonomy,
    demo: false,
    period: { start: null, end: null, ongoing: false },
    links: { github: null, external: null },
    industry: null,
    platforms: [],
    tools: [],
    testTypes: [],
    sections: EMPTY_SECTIONS,
    coverage: [],
    scenarios: [],
    bugs: [],
    apiExamples: [],
    sqlExamples: [],
    seo: { title: null, description: null },
  };
}

export function getPlaceholderCaseStudies(locale: DbLocale): ProjectCaseStudy[] {
  return PLACEHOLDER_DEFS.map((d) => toPlaceholderCaseStudy(d, locale));
}
