import "server-only";
import { unstable_cache } from "next/cache";
import type { DbLocale } from "@/lib/db/database.types";
import type { ProjectSummary, ProjectCaseStudy } from "@/lib/domain/project";
import type {
  ContentRepository,
  ProjectListFilters,
  ProjectFilterFacets,
} from "./content-repository";

/**
 * ÖNBELLEKLİ İÇERİK REPOSITORY'Sİ - public okuma yolu için (FAZ 4).
 *
 * İŞ KURALI (planning/01 §1.5, planning/14 R19): Admin içerik yayınladığında
 * public site MANUEL DEPLOYMENT GEREKTİRMEDEN güncellenmeli. Bunu sağlamak için
 * bu dekoratör her okumayı `unstable_cache` ile `projects` / `qa-lab` / `home` /
 * `settings` etiketlerine bağlar. `revalidateContent` (admin action sonrası) bu
 * etiketleri geçersiz kılar -> bir sonraki istekte taze veri çekilir.
 *
 * Fixture kaynağında bu sarmalayıcı kullanılmaz (fixture zaten deterministik).
 */
export class CachedContentRepository implements ContentRepository {
  constructor(private readonly inner: ContentRepository) {}

  listProjects(locale: DbLocale, filters?: ProjectListFilters): Promise<ProjectSummary[]> {
    const key = ["listProjects", locale, JSON.stringify(filters ?? {})];
    return unstable_cache(() => this.inner.listProjects(locale, filters), key, {
      tags: ["projects"],
      revalidate: 3600,
    })();
  }

  getProjectBySlug(locale: DbLocale, slug: string): Promise<ProjectCaseStudy | null> {
    return unstable_cache(
      () => this.inner.getProjectBySlug(locale, slug),
      ["getProjectBySlug", locale, slug],
      { tags: ["projects", `project:slug:${slug}`], revalidate: 3600 },
    )();
  }

  listPublishedSlugs(): Promise<string[]> {
    return unstable_cache(() => this.inner.listPublishedSlugs(), ["listPublishedSlugs"], {
      tags: ["projects", "sitemap"],
      revalidate: 3600,
    })();
  }

  listQaLab(locale: DbLocale): Promise<ProjectSummary[]> {
    return unstable_cache(() => this.inner.listQaLab(locale), ["listQaLab", locale], {
      tags: ["projects", "qa-lab"],
      revalidate: 3600,
    })();
  }

  listFilterFacets(locale: DbLocale): Promise<ProjectFilterFacets> {
    return unstable_cache(() => this.inner.listFilterFacets(locale), ["listFilterFacets", locale], {
      tags: ["projects"],
      revalidate: 3600,
    })();
  }
}
