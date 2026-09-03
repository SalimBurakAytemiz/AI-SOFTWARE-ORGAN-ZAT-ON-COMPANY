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

/**
 * Yetkinlik matrisi verisi.
 *
 * Araç ADLARI uydurma değildir (yaygın QA araçları). Ancak `proficiency`
 * (1-5) ve `years` alanları GERÇEK profesyonel değerlendirme gerektirir ve şu an
 * doldurulmamıştır (null). Bunlar content intake checklist C bölümünden gelecek
 * (ADR-0008: uydurma yok). null iken UI seviye çubuğu göstermez.
 */
export interface FixtureSkill {
  label: string;
  proficiency: number | null; // TODO: gerçek değer (1-5)
  years: number | null; // TODO: gerçek değer
}
export interface FixtureSkillCategory {
  category: Record<DbLocale, string>;
  items: FixtureSkill[];
}

const skill = (label: string): FixtureSkill => ({ label, proficiency: null, years: null });

export const fixtureSkills: FixtureSkillCategory[] = [
  {
    category: { tr: "Test Otomasyonu", en: "Test Automation" },
    items: [skill("Playwright"), skill("Cypress"), skill("Selenium")],
  },
  {
    category: { tr: "API ve Veritabanı", en: "API & Database" },
    items: [skill("Postman"), skill("REST Assured"), skill("SQL")],
  },
  {
    category: { tr: "Performans", en: "Performance" },
    items: [skill("k6"), skill("JMeter")],
  },
  {
    category: { tr: "CI/CD ve Araçlar", en: "CI/CD & Tooling" },
    items: [skill("GitHub Actions"), skill("Docker")],
  },
];

/**
 * Sosyal bağlantılar - JSON-LD Person `sameAs` için. PLACEHOLDER; gerçek
 * profiller content intake checklist B bölümünden. `http` ile başlamayan
 * değerler structured-data.ts tarafından filtrelenir.
 */
export const fixtureSocialLinks: { platform: string; url: string }[] = [
  { platform: "GitHub", url: "[PLACEHOLDER: https://github.com/kullanici]" },
  { platform: "LinkedIn", url: "[PLACEHOLDER: https://linkedin.com/in/kullanici]" },
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
