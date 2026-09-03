import { isSupabaseConfigured } from "@/lib/env";
import type { ContentRepository } from "./content-repository";
import { FixtureContentRepository } from "./fixture-content-repository";

export type { ContentRepository, ProjectListFilters } from "./content-repository";
export { RepositoryNotConfiguredError } from "./content-repository";

/**
 * İçerik repository fabrikası - TEK GEÇİŞ NOKTASI.
 *
 * Supabase yapılandırılmışsa gerçek repository, değilse fixture repository
 * kullanılır. Sayfalar bu fonksiyonu çağırır; hangi kaynağın kullanıldığını
 * bilmez (planning/14 review - repository abstraction).
 *
 * Faz 3'te: Supabase yapılandırıldığında aşağıdaki dallanma
 * SupabaseContentRepository'yi döndürür - başka hiçbir sayfa değişmez.
 */
let cached: ContentRepository | null = null;

export function getContentRepository(): ContentRepository {
  if (cached) return cached;

  if (isSupabaseConfigured) {
    // Faz 3: dinamik import ile server-only Supabase repository yüklenir.
    // Şu an bu dal çalışmaz (isSupabaseConfigured=false).
    // const { SupabaseContentRepository } = await import("./supabase-content-repository");
    // cached = new SupabaseContentRepository();
    // return cached;
  }

  cached = new FixtureContentRepository();
  return cached;
}
