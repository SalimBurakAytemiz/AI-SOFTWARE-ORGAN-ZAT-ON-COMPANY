import type { ProjectListFilters } from "@/lib/repositories";

/**
 * PROJE FİLTRELERİ - URL PARAMETRE SENKRONİZASYONU (planning/04 §4.2,
 * planning/14 review R20).
 *
 * İŞ KURALI:
 *   - Filtre durumu YALNIZCA URL'de tutulur (?type=professional&tool=playwright).
 *     Bu sayede filtreli görünüm paylaşılabilir, SSR ile render edilir ve
 *     tarayıcı geri/ileri düğmeleri çalışır. İstemci state'i yok.
 *   - Filtresiz /projects sayfası dizine eklenir (indexable "temel" sayfa).
 *   - Herhangi bir filtre aktifse sayfa `noindex` olur ve canonical filtresiz
 *     /projects'e işaret eder (yinelenen/ince içerik önlenir - review R20).
 */

/** Desteklenen filtre parametre anahtarları. */
export const FILTER_KEYS = ["type", "platform", "tool", "testType"] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

export type RawSearchParams = Record<string, string | string[] | undefined>;

/** URL arama parametrelerinden temiz, tekil değerli bir filtre nesnesi çıkarır. */
export function parseProjectFilters(sp: RawSearchParams): ProjectListFilters {
  const one = (k: string): string | undefined => {
    const v = sp[k];
    const s = Array.isArray(v) ? v[0] : v;
    return s && s.trim() ? s.trim() : undefined;
  };
  return {
    classification: one("type"),
    platform: one("platform"),
    tool: one("tool"),
    testType: one("testType"),
  };
}

/** En az bir filtre aktif mi? */
export function hasActiveFilters(f: ProjectListFilters): boolean {
  return Boolean(f.classification || f.platform || f.tool || f.testType);
}

/** Filtreleri geri bir query nesnesine çevirir (Link href için). */
export function filtersToQuery(f: ProjectListFilters): Record<string, string> {
  const q: Record<string, string> = {};
  if (f.classification) q.type = f.classification;
  if (f.platform) q.platform = f.platform;
  if (f.tool) q.tool = f.tool;
  if (f.testType) q.testType = f.testType;
  return q;
}

/**
 * Bir filtre değerini aç/kapa. Zaten seçiliyse kaldırır (toggle), değilse
 * o boyuttaki diğer seçimin yerine geçer.
 */
type StringFilterField = "classification" | "platform" | "tool" | "testType";

export function toggleFilter(
  current: ProjectListFilters,
  key: FilterKey,
  value: string,
): ProjectListFilters {
  const map: Record<FilterKey, StringFilterField> = {
    type: "classification",
    platform: "platform",
    tool: "tool",
    testType: "testType",
  };
  const field = map[key];
  const next: ProjectListFilters = { ...current };
  next[field] = current[field] === value ? undefined : value;
  return next;
}
