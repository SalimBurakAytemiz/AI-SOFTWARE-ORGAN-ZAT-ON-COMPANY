import type { DbLocale } from "@/lib/db/database.types";
import type { ProjectSummary, ProjectCaseStudy } from "@/lib/domain/project";
import { getDemoCaseStudies, DEMO_SLUGS } from "@/content/demo-projects";
import { getPlaceholderCaseStudies } from "@/content/fixtures";
import type {
  ContentRepository,
  ProjectListFilters,
  ProjectFilterFacets,
} from "./content-repository";

/**
 * Faz 2/3 içerik repository'si - DEMO ve PLACEHOLDER veriden okur.
 *
 * Supabase yokken uygulamanın çalışabilmesini sağlar. Tüm veri:
 *   - DEMO / SANITIZED (demo-projects.ts) - gerçekçi ama kurgusal, "demo:true",
 *   - PLACEHOLDER (fixtures.ts) - gerçek içerik girilene kadar iskelet.
 *
 * "published + visible" kuralı: fixture'daki her proje yayınlanmış kabul edilir.
 * Taslak/gizli senaryolar admin mock katmanında (in-memory) test edilir.
 */
export class FixtureContentRepository implements ContentRepository {
  private all(locale: DbLocale): ProjectCaseStudy[] {
    return [...getDemoCaseStudies(locale), ...getPlaceholderCaseStudies(locale)];
  }

  async listProjects(locale: DbLocale, filters?: ProjectListFilters): Promise<ProjectSummary[]> {
    let items = this.all(locale).filter((p) => p.classification !== "qa_lab");

    if (filters?.featuredOnly) items = items.filter((p) => p.featured);
    if (filters?.classification) {
      items = items.filter((p) => p.classification === filters.classification);
    }
    // Taksonomi filtreleri: ilgili TÜR listesinde (büyük/küçük harf duyarsız) arar.
    if (filters?.platform) items = items.filter((p) => hasTerm(p.platforms, filters.platform!));
    if (filters?.tool) items = items.filter((p) => hasTerm(p.tools, filters.tool!));
    if (filters?.testType) items = items.filter((p) => hasTerm(p.testTypes, filters.testType!));

    return items.sort((a, b) => a.displayOrder - b.displayOrder).map(toSummary);
  }

  async getProjectBySlug(locale: DbLocale, slug: string): Promise<ProjectCaseStudy | null> {
    return this.all(locale).find((p) => p.slug === slug) ?? null;
  }

  async listPublishedSlugs(): Promise<string[]> {
    const placeholders = getPlaceholderCaseStudies("en").map((p) => p.slug);
    return [...DEMO_SLUGS, ...placeholders];
  }

  async listQaLab(locale: DbLocale): Promise<ProjectSummary[]> {
    return this.all(locale)
      .filter((p) => p.classification === "qa_lab")
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map(toSummary);
  }

  async listFilterFacets(locale: DbLocale): Promise<ProjectFilterFacets> {
    const items = this.all(locale).filter((p) => p.classification !== "qa_lab");
    return {
      classifications: unique(items.map((p) => p.classification)),
      platforms: unique(items.flatMap((p) => p.platforms)),
      tools: unique(items.flatMap((p) => p.tools)),
      testTypes: unique(items.flatMap((p) => p.testTypes)),
    };
  }
}

function hasTerm(list: string[], needle: string): boolean {
  const n = needle.toLowerCase();
  return list.some((t) => t.toLowerCase() === n);
}

function unique(list: string[]): string[] {
  return [...new Set(list.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function toSummary(p: ProjectCaseStudy): ProjectSummary {
  return {
    slug: p.slug,
    classification: p.classification,
    featured: p.featured,
    supported: p.supported,
    nda: p.nda,
    company: p.company,
    companyHidden: p.companyHidden,
    displayOrder: p.displayOrder,
    title: p.title,
    summary: p.summary,
    roleTitle: p.roleTitle,
    taxonomy: p.taxonomy,
    demo: p.demo,
  };
}
