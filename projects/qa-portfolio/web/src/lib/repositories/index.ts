import "server-only";
import { contentSource } from "@/lib/env";
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
 * `contentSource` "supabase" ise gerçek repository, değilse fixture repository
 * kullanılır. Sayfalar bu fonksiyonu çağırır; hangi kaynağın kullanıldığını
 * bilmez.
 *
 * FAZ 4 GEÇİŞİ (kademeli): Supabase kimlik bilgilerini `.env.local`'e girmek
 * TEK BAŞINA bu dallanmayı değiştirmez - ayrıca `NEXT_PUBLIC_CONTENT_SOURCE`
 * açıkça `supabase` yapılmalıdır (bkz. `contentSource`, src/lib/env.ts). Bu
 * bayrak yalnızca gerçek sorgu katmanı + migration + seed hazır olduğunda
 * açılır; o zamana kadar site fixture içerikle çalışır.
 * (SupabaseContentRepository metotları henüz iskelet; gerçek sorgular T-0411'de.)
 */
let cached: ContentRepository | null = null;

export function getContentRepository(): ContentRepository {
  if (cached) return cached;
  cached =
    contentSource === "supabase"
      ? new SupabaseContentRepository()
      : new FixtureContentRepository();
  return cached;
}

/** Test izolasyonu için önbelleği sıfırlar. */
export function _resetContentRepositoryCache(): void {
  cached = null;
}
