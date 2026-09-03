import type { ProjectClassification, DbLocale } from "@/lib/db/database.types";

/**
 * ALAN (domain) MODELİ - veritabanından bağımsız.
 *
 * Sayfalar ve bileşenler YALNIZCA bu tipleri kullanır; hangi kaynaktan
 * (fixture / Supabase) geldiğini bilmezler. Böylece Supabase bağlandığında
 * yalnızca repository implementasyonu değişir, sayfa kodu değişmez
 * (planning/14 review R8, "repository/service abstraction").
 */

/** Liste kartlarında kullanılan hafif proje özeti (tek dile çözülmüş). */
export interface ProjectSummary {
  slug: string;
  classification: ProjectClassification;
  featured: boolean;
  supported: boolean;
  nda: boolean;
  /** NDA/gizli kuralı uygulanmış görünen şirket etiketi (veya null). */
  company: string | null;
  companyHidden: boolean;
  displayOrder: number;
  title: string;
  summary: string;
  roleTitle: string | null;
  /** Görünen taksonomi etiketleri (aktif dilde). */
  taxonomy: string[];
  /** İçerik demo/sanitized mı? (gerçek profesyonel veri değil - ADR-0008). */
  demo: boolean;
}

/** Vaka çalışması sayfasının tam içeriği (tek dile çözülmüş). */
export interface ProjectCaseStudy extends ProjectSummary {
  period: { start: string | null; end: string | null; ongoing: boolean };
  links: { github: string | null; external: string | null };
  industry: string | null;
  platforms: string[];
  tools: string[];
  testTypes: string[];
  /** Sabit sıralı düzyazı bölümleri - boş olanlar sayfada gösterilmez. */
  sections: {
    overviewMd: string | null;
    testingScopeMd: string | null;
    testStrategyMd: string | null;
    testCoverageMd: string | null;
    challengesMd: string | null;
    impactMd: string | null;
    lessonsMd: string | null;
  };
  coverage: { area: string; value: number }[];
  scenarios: TestScenario[];
  bugs: BugReport[];
  apiExamples: ApiExample[];
  sqlExamples: SqlExample[];
  seo: { title: string | null; description: string | null };
}

export interface TestScenario {
  code: string;
  priority: "p0" | "p1" | "p2" | "p3";
  kind: string;
  automated: boolean;
  title: string;
  preconditionsMd: string | null;
  stepsMd: string;
  expectedMd: string;
  notesMd: string | null;
}

export interface BugReport {
  code: string;
  severity: "blocker" | "critical" | "major" | "minor" | "trivial";
  state: "open" | "fixed" | "wont_fix" | "deferred" | "by_design";
  environment: string | null;
  title: string;
  summaryMd: string | null;
  stepsMd: string | null;
  expectedMd: string | null;
  actualMd: string | null;
  rootCauseMd: string | null;
  resolutionMd: string | null;
}

export interface ApiExample {
  code: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  endpoint: string;
  requestBody: string | null;
  responseStatus: number | null;
  responseBody: string | null;
  title: string;
  notesMd: string | null;
}

export interface SqlExample {
  code: string;
  dialect: string;
  querySql: string;
  sampleResult: string | null;
  title: string;
  explanationMd: string | null;
}

/** Vaka çalışmasının hangi düzyazı bölümlerinin gerçekten dolu olduğunu döndürür. */
export function nonEmptySections(cs: ProjectCaseStudy): {
  key: keyof ProjectCaseStudy["sections"];
  md: string;
}[] {
  return (Object.keys(cs.sections) as (keyof ProjectCaseStudy["sections"])[])
    .map((key) => ({ key, md: cs.sections[key] }))
    .filter((s): s is { key: keyof ProjectCaseStudy["sections"]; md: string } =>
      Boolean(s.md && s.md.trim().length > 0),
    );
}

export type { DbLocale };
