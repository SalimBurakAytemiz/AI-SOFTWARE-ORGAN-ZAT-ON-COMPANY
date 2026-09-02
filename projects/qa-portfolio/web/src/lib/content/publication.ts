import type { ContentStatus, DbLocale } from "@/lib/db/database.types";

/**
 * YAYIN DURUMU - TEK DOĞRULUK KAYNAĞI (planning/14 review R8).
 *
 * "Bir içerik şu an public'te görünür mü?" sorusunun cevabı TEK bir yerde
 * tanımlanır ve hem uygulama hem (faz 2'de) veritabanı görünümü (public view)
 * aynı kuralı kullanır. Kuralın birden çok yerde elle yeniden yazılması,
 * "yayınladım ama görünmüyor" / "taslak sızdı" hatalarının klasik kaynağıdır.
 *
 * İŞ KURALI (planning/02 §2.8):
 *   Bir kayıt public'te görünür  <=>  status = 'published' VE visible = true
 *   Arşivlenmiş (archived) veya gizlenmiş (visible=false) kayıt asla görünmez.
 *   Taslak (draft) asla görünmez.
 *   Silme ile arşivleme farklıdır: arşiv veritabanında kalır, public'ten çıkar.
 */
export interface PublishableRecord {
  status: ContentStatus;
  visible: boolean;
}

/** Bu kayıt herhangi bir public yüzeyde gösterilebilir mi? */
export function isPubliclyVisible(record: PublishableRecord): boolean {
  return record.status === "published" && record.visible === true;
}

/**
 * Belirli bir dil için çeviri durumu.
 * İŞ KURALI (planning/02 §2.7): sahibi EN vaka çalışmasını yayınlarken TR'yi
 * taslak tutabilir. İstenen dilde çeviri yayınlanmamışsa fallback davranışı
 * site ayarına bağlıdır (planning/12 OQ-003, varsayılan: diğer dili "EN"/"TR"
 * etiketiyle göster).
 */
export type LocaleFallbackMode = "show_with_tag" | "hide";

export interface LocalizedContent<T> {
  requestedLocale: DbLocale;
  defaultLocale: DbLocale;
  translations: Partial<Record<DbLocale, { translationStatus: ContentStatus; data: T }>>;
}

export interface ResolvedLocalizedContent<T> {
  data: T;
  /** Gösterilen içerik istenen dilde mi, yoksa fallback mı? */
  usedFallback: boolean;
  shownLocale: DbLocale;
}

/**
 * İstenen dildeki yayınlanmış çeviriyi döndürür; yoksa varsayılan dile düşer.
 * Hiçbir dilde yayınlanmış çeviri yoksa null döner (kayıt yayınlanamaz).
 */
export function resolveTranslation<T>(
  content: LocalizedContent<T>,
  fallbackMode: LocaleFallbackMode,
): ResolvedLocalizedContent<T> | null {
  const requested = content.translations[content.requestedLocale];
  if (requested && requested.translationStatus === "published") {
    return { data: requested.data, usedFallback: false, shownLocale: content.requestedLocale };
  }

  if (fallbackMode === "hide") return null;

  const fallback = content.translations[content.defaultLocale];
  if (fallback && fallback.translationStatus === "published") {
    return { data: fallback.data, usedFallback: true, shownLocale: content.defaultLocale };
  }

  return null;
}
