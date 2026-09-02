import { z } from "zod";
import { isValidSlug } from "@/lib/utils/slug";

/**
 * Proje (case study) doğrulama şemaları - admin editörü, server action ve
 * yayın kontrol listesi bu şemaları kullanır (planning/07 T-0801, planning/05 §5.4).
 *
 * Bölüm bazlı "zorunlu alan" kuralları burada tanımlanır: yayın (publish)
 * diyaloğu bu kuralları çalıştırır ve yarım çevrilmiş / eksik bir sayfanın
 * yanlışlıkla yayınlanmasını engeller (planning/12 RISK-030).
 */

export const projectClassification = z.enum(["professional", "supported", "personal", "qa_lab"]);
export const contentStatus = z.enum(["draft", "published", "archived"]);
export const dbLocale = z.enum(["tr", "en"]);

/** Dilden bağımsız proje meta verisi (projects tablosu). */
export const projectMetaSchema = z.object({
  slug: z.string().refine(isValidSlug, "Slug 2-80 karakter, küçük harf ve tire olmalı"),
  classification: projectClassification,
  status: contentStatus,
  visible: z.boolean(),
  featured: z.boolean(),
  displayOrder: z.number().int(),
  company: z.string().trim().max(200).nullable(),
  companyHidden: z.boolean(),
  nda: z.boolean(),
  startDate: z.string().date().nullable(),
  endDate: z.string().date().nullable(),
  isOngoing: z.boolean(),
  githubUrl: z.string().url().nullable().or(z.literal("")),
  externalUrl: z.string().url().nullable().or(z.literal("")),
});

/** Dile özgü proje içeriği (project_translations tablosu). */
export const projectTranslationSchema = z.object({
  locale: dbLocale,
  title: z.string().trim().min(2).max(200),
  summary: z.string().trim().min(10).max(400),
  roleTitle: z.string().trim().max(160).nullable(),
  overviewMd: z.string().max(20000).nullable(),
  testingScopeMd: z.string().max(20000).nullable(),
  testStrategyMd: z.string().max(20000).nullable(),
  testCoverageMd: z.string().max(20000).nullable(),
  challengesMd: z.string().max(20000).nullable(),
  impactMd: z.string().max(20000).nullable(),
  lessonsMd: z.string().max(20000).nullable(),
  seoTitle: z.string().max(70).nullable(),
  seoDescription: z.string().max(200).nullable(),
  translationStatus: contentStatus,
});

export type ProjectMeta = z.infer<typeof projectMetaSchema>;
export type ProjectTranslation = z.infer<typeof projectTranslationSchema>;

/**
 * Bir dilin yayınlanabilmesi için gereken minimum alanlar (planning/05 publish
 * dialog). Bir alan boşsa o dil yayınlanamaz.
 */
const REQUIRED_TRANSLATION_FIELDS = [
  "title",
  "summary",
  "overviewMd",
  "testingScopeMd",
  "testStrategyMd",
] as const;

export interface PublishCheckResult {
  ok: boolean;
  missing: string[];
}

/** Verilen dildeki çevirinin yayınlanmaya hazır olup olmadığını kontrol eder. */
export function checkTranslationReadyToPublish(t: ProjectTranslation): PublishCheckResult {
  const missing = REQUIRED_TRANSLATION_FIELDS.filter((field) => {
    const value = t[field];
    return value === null || value === undefined || String(value).trim().length === 0;
  });
  return { ok: missing.length === 0, missing };
}
