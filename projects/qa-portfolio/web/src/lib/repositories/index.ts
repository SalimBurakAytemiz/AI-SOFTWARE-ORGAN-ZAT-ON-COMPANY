import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import type { ContentRepository } from "./content-repository";
import { FixtureContentRepository } from "./fixture-content-repository";
import { SupabaseContentRepository } from "./supabase-content-repository";

export type {
  ContentRepository,
  ProjectListFilters,
  ProjectFilterFacets,
} from "./content-repository";
export { RepositoryNotConfiguredError } from "./content-repository";

/**
 * İÇERİK REPOSITORY FABRİKASI - TEK GEÇİŞ NOKTASI (planning/14 review R8).
 *
 * Supabase yapılandırılmışsa gerçek repository, değilse fixture repository
 * kullanılır. Sayfalar bu fonksiyonu çağırır; hangi kaynağın kullanıldığını
 * bilmez.
 *
 * FAZ 4 GEÇİŞİ: `.env.local`'e NEXT_PUBLIC_SUPABASE_URL + ANON_KEY eklendiğinde
 * `isSupabaseConfigured` true olur ve BU DALLANMA otomatik olarak
 * SupabaseContentRepository'ye geçer. Başka hiçbir sayfa değişmez.
 * (SupabaseContentRepository metotları henüz iskelet; gerçek sorgular T-0411'de.)
 */
let cached: ContentRepository | null = null;

export function getContentRepository(): ContentRepository {
  if (cached) return cached;
  cached = isSupabaseConfigured
    ? new SupabaseContentRepository()
    : new FixtureContentRepository();
  return cached;
}

/** Test izolasyonu için önbelleği sıfırlar. */
export function _resetContentRepositoryCache(): void {
  cached = null;
}
