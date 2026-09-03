import "server-only";
import type { DbLocale } from "@/lib/db/database.types";
import type { ProjectSummary, ProjectCaseStudy } from "@/lib/domain/project";
import type {
  ContentRepository,
  ProjectListFilters,
  ProjectFilterFacets,
} from "./content-repository";
import { RepositoryNotConfiguredError } from "./content-repository";

/**
 * SUPABASE İÇERİK REPOSITORY'Sİ - FAZ 4 ENTEGRASYON NOKTASI.
 *
 * Şu an İSKELET: her metot RepositoryNotConfiguredError fırlatır çünkü gerçek
 * sorgu katmanı henüz yazılmadı (T-0411). Factory (index.ts) yalnızca
 * `contentSource === "supabase"` (bayrak + kimlik bilgisi) olduğunda bu sınıfı
 * seçer, bu yüzden bayrak "fixtures" iken hiç çalıştırılmaz.
 *
 * ARAYÜZ DEĞİŞMEZ: sayfalar ContentRepository'yi kullanır; yalnızca bu dosya
 * ve factory değişir (minimum kod değişikliğiyle gerçek data layer'a geçiş -
 * planning/14 review R8).
 *
 * ----------------------------------------------------------------------------
 * FAZ 4'TE YAPILACAK (planning/07 T-0411, T-0403, T-0409)
 * ----------------------------------------------------------------------------
 * 1. Tipler:  `npx supabase gen types typescript --db-url "$SUPABASE_DB_URL" > src/lib/db/database.generated.ts`
 *    -> üretilen dosya gerçek şemadan yenilenir; takma adlar database.types.ts'te.
 *
 * 2. listProjects(locale, filters):
 *      supabase.from("projects")
 *        .select(`
 *          slug, classification, featured, supported, nda, company, company_hidden,
 *          display_order,
 *          project_translations!inner ( title, summary, role_title, locale ),
 *          project_taxonomy ( taxonomy_terms ( kind, label_tr, label_en ) )
 *        `)
 *        .eq("project_translations.locale", locale)
 *        .order("display_order")
 *    RLS "published + visible" filtrelediği için WHERE gerekmez; taslak asla dönmez.
 *    classification / platform / tool / testType filtreleri .eq / taxonomy join'de
 *    uygulanır. Alternatif: bir `public_projects` VIEW'i (planning/14 review R8).
 *
 * 3. getProjectBySlug(locale, slug): projects + tüm çocuk tablolar
 *    (project_translations, project_highlights, project_media + media,
 *    test_scenarios(+t), bug_reports(+t), api_examples(+t), sql_examples(+t),
 *    project_taxonomy) tek RPC ya da batched select ile (N+1 önlenir - review R "Backend").
 *
 * 4. listPublishedSlugs(): select slug from projects  (RLS filtreli).
 *    generateStaticParams bunu kullanır; ISR için dynamicParams=true'ya dönülür
 *    ve yayında revalidateTag('projects') generateStaticParams'ı yeniden ürettirir.
 *
 * 5. listFilterFacets(locale): distinct taxonomy_terms (yalnızca yayınlanmış
 *    projelere bağlı) - bir VIEW veya RPC ile.
 *
 * DB satırları -> domain tipleri (src/lib/domain/project.ts) map fonksiyonları
 * bu dosyada, arayüzün dışında tutulur.
 * ----------------------------------------------------------------------------
 */
export class SupabaseContentRepository implements ContentRepository {
  async listProjects(
    _locale: DbLocale,
    _filters?: ProjectListFilters,
  ): Promise<ProjectSummary[]> {
    throw new RepositoryNotConfiguredError("Proje listeleme");
  }

  async getProjectBySlug(_locale: DbLocale, _slug: string): Promise<ProjectCaseStudy | null> {
    throw new RepositoryNotConfiguredError("Proje detayı");
  }

  async listPublishedSlugs(): Promise<string[]> {
    throw new RepositoryNotConfiguredError("Yayınlanmış slug listesi");
  }

  async listQaLab(_locale: DbLocale): Promise<ProjectSummary[]> {
    throw new RepositoryNotConfiguredError("QA Lab listeleme");
  }

  async listFilterFacets(_locale: DbLocale): Promise<ProjectFilterFacets> {
    throw new RepositoryNotConfiguredError("Filtre facet'leri");
  }
}
