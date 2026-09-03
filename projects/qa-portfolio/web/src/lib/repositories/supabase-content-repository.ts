import "server-only";
import type { DbLocale } from "@/lib/db/database.types";
import type { ProjectSummary, ProjectCaseStudy } from "@/lib/domain/project";
import type { ContentRepository, ProjectListFilters } from "./content-repository";
import { RepositoryNotConfiguredError } from "./content-repository";

/**
 * SUPABASE İÇERİK REPOSITORY'Sİ - faz 3 entegrasyon noktası.
 *
 * Şu an İSKELET: her metot RepositoryNotConfiguredError fırlatır çünkü gerçek
 * bir Supabase projesi / anon anahtarı yok. Factory (index.ts) Supabase
 * yapılandırılmadıkça bu sınıfı ASLA seçmez, bu yüzden faz 2'de çalıştırılmaz.
 *
 * Faz 3'te yapılacak (planning/07 T-0411, T-0403, T-0409):
 *   - `supabase gen types` ile üretilen tiplerle sorgu yaz,
 *   - listProjects / getProjectBySlug -> `public_projects` görünümü + çeviri join,
 *   - RLS zaten "published + visible" filtrelediği için sorgular sade kalır,
 *   - DB satırlarını domain tiplerine (src/lib/domain/project.ts) map'le.
 *
 * ARAYÜZ DEĞİŞMEZ: sayfalar ContentRepository'yi kullanır; yalnızca bu dosya
 * ve factory değişir (minimum kod değişikliğiyle gerçek data layer'a geçiş).
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
}
