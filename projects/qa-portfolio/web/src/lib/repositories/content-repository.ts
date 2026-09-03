import type { DbLocale } from "@/lib/db/database.types";
import type { ProjectSummary, ProjectCaseStudy } from "@/lib/domain/project";

/**
 * İÇERİK REPOSITORY ARAYÜZÜ - okuma tarafı.
 *
 * Public sayfalar bu arayüzü kullanır; somut implementasyon:
 *   - FixtureContentRepository  (faz 2, Supabase yok)
 *   - SupabaseContentRepository (faz 3, credential geldiğinde)
 *
 * İŞ KURALI (planning/02 §2.8): "list" ve "getBySlug" YALNIZCA yayınlanmış ve
 * görünür (published + visible) içeriği döndürür. Taslak/gizli/arşiv asla
 * public'e sızmaz - bu kural implementasyonlarda ve (Supabase'te) RLS'te ayrıca
 * zorlanır.
 */
export interface ProjectListFilters {
  classification?: string;
  platform?: string;
  tool?: string;
  testType?: string;
  featuredOnly?: boolean;
}

/** Filtre çubuğunda gösterilecek kullanılabilir değerler (facet'ler). */
export interface ProjectFilterFacets {
  classifications: string[];
  platforms: string[];
  tools: string[];
  testTypes: string[];
}

export interface ContentRepository {
  /** Yayınlanmış projeleri (aktif dile çözülmüş) filtreleyerek listeler. */
  listProjects(locale: DbLocale, filters?: ProjectListFilters): Promise<ProjectSummary[]>;

  /** Yayınlanmış bir projenin tam vaka çalışmasını döndürür; yoksa null. */
  getProjectBySlug(locale: DbLocale, slug: string): Promise<ProjectCaseStudy | null>;

  /** Statik üretim (generateStaticParams) için yayınlanmış tüm slug'lar. */
  listPublishedSlugs(): Promise<string[]>;

  /** QA Lab girişleri (classification='qa_lab'). */
  listQaLab(locale: DbLocale): Promise<ProjectSummary[]>;

  /** Filtre çubuğu için kullanılabilir facet değerleri (yalnızca yayınlanmışlardan). */
  listFilterFacets(locale: DbLocale): Promise<ProjectFilterFacets>;
}

/** Repository katmanının fırlattığı sınıflandırılmış hata. */
export class RepositoryNotConfiguredError extends Error {
  constructor(what: string) {
    super(`${what} için Supabase yapılandırması gerekli (bir insan işlemi).`);
    this.name = "RepositoryNotConfiguredError";
  }
}
