import type { DbLocale, ProjectClassification } from "@/lib/db/database.types";

/**
 * PLACEHOLDER İÇERİK - GERÇEK PROFESYONEL BİLGİ DEĞİLDİR.
 *
 * Faz 1'de uygulama, gerçek bir Supabase projesi olmadan çalışabilsin diye
 * public sayfalar bu sahte verilerden okur. Gerçek içerik faz 2'de admin panel
 * üzerinden girilecek; doldurulacak alanların tam listesi:
 *   projects/qa-portfolio/planning/13-content-intake-checklist.md
 *
 * KURAL (planning/12 RISK-052, ADR-0008): ekip profesyonel bilgi UYDURMAZ.
 * Buradaki her değer açıkça "[PLACEHOLDER]" işaretlidir.
 */

export interface FixtureProject {
  slug: string;
  classification: ProjectClassification;
  featured: boolean;
  nda: boolean;
  company: string | null;
  companyHidden: boolean;
  taxonomy: string[];
  translations: Record<DbLocale, { title: string; summary: string; roleTitle: string }>;
}

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

export const fixtureProjects: FixtureProject[] = [
  {
    slug: "placeholder-professional-project",
    classification: "professional",
    featured: true,
    nda: false,
    company: "[PLACEHOLDER: Şirket]",
    companyHidden: false,
    taxonomy: ["Web", "API", "Playwright", "CI/CD"],
    translations: {
      tr: {
        title: "[PLACEHOLDER: Profesyonel proje başlığı]",
        summary: "[PLACEHOLDER: Kısa Türkçe özet ve ölçülebilir sonuç.]",
        roleTitle: "[PLACEHOLDER: QA Mühendisi]",
      },
      en: {
        title: "[PLACEHOLDER: Professional project title]",
        summary: "[PLACEHOLDER: Short English summary with a measurable outcome.]",
        roleTitle: "[PLACEHOLDER: QA Engineer]",
      },
    },
  },
  {
    slug: "placeholder-supported-project",
    classification: "supported",
    featured: true,
    nda: true,
    company: null,
    companyHidden: true,
    taxonomy: ["API", "Performance", "k6"],
    translations: {
      tr: {
        title: "[PLACEHOLDER: Destek verilen proje]",
        summary: "[PLACEHOLDER: NDA nedeniyle bazı ayrıntılar gizli.]",
        roleTitle: "[PLACEHOLDER: QA Danışmanı]",
      },
      en: {
        title: "[PLACEHOLDER: Supported project]",
        summary: "[PLACEHOLDER: Some details withheld due to NDA.]",
        roleTitle: "[PLACEHOLDER: QA Consultant]",
      },
    },
  },
  {
    slug: "placeholder-personal-project",
    classification: "personal",
    featured: false,
    nda: false,
    company: null,
    companyHidden: false,
    taxonomy: ["Web", "Automation"],
    translations: {
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
  },
];

/** Faz 1'de tüm placeholder projeler "yayınlanmış" kabul edilir (gösterim amaçlı). */
export function getFixtureProjects(locale: DbLocale) {
  return fixtureProjects.map((p) => ({
    ...p,
    title: p.translations[locale].title,
    summary: p.translations[locale].summary,
    roleTitle: p.translations[locale].roleTitle,
  }));
}
