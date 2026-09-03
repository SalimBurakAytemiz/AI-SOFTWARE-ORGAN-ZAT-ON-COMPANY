import type { DbLocale } from "@/lib/db/database.types";

/**
 * Yerelleştirilmiş biçimlendirme yardımcıları (planning/11 T-1105).
 * Tarih ve sayılar TR/EN kurallarına göre biçimlenir (Intl API).
 */

/** "2024-02" -> "Şubat 2024" / "February 2024" */
export function formatMonth(value: string | null, locale: DbLocale): string | null {
  if (!value) return null;
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  const d = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    month: "long",
    year: "numeric",
  }).format(d);
}

/** ISO tarih -> yerel kısa tarih */
export function formatDate(iso: string, locale: DbLocale): string {
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    dateStyle: "medium",
  }).format(new Date(iso));
}

/** Sayı biçimleme (binlik ayraç vb.) */
export function formatNumber(n: number, locale: DbLocale): string {
  return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US").format(n);
}

/**
 * Türkçe büyük harf dönüşümü - "i" -> "İ" hatasını önler (planning/11 T-1106).
 * Arayüz metinlerinde büyük harf gerektiğinde bu kullanılır, .toUpperCase() değil.
 */
export function toLocaleUpper(text: string, locale: DbLocale): string {
  return text.toLocaleUpperCase(locale === "tr" ? "tr-TR" : "en-US");
}
