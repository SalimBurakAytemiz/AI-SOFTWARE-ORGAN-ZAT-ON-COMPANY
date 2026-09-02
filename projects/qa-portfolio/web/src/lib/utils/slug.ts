/**
 * Slug (URL anahtarı) yardımcıları.
 *
 * İŞ KURALI (planning/02 §2.4, planning/14 review R9):
 *   - Slug dilden bağımsızdır (tek `projects.slug`), İngilizce/kebab-case.
 *   - Yayınlandıktan sonra değiştirilirse eski URL 404 verir; bu yüzden
 *     yayın sonrası değişiklik uyarı gösterir ve faz 2'de slug geçmişi +
 *     yönlendirme (project_slug_history) eklenecek.
 */

const TURKISH_MAP: Record<string, string> = {
  ç: "c", Ç: "c", ğ: "g", Ğ: "g", ı: "i", İ: "i", ö: "o", Ö: "o", ş: "s", Ş: "s", ü: "u", Ü: "u",
};

// Unicode birleşik aksan işaretleri aralığı (U+0300 - U+036F).
// RegExp constructor kullanılır ki kaynak dosyada çıplak birleşik karakter olmasın.
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

/** Serbest metinden güvenli bir slug üretir (Türkçe karakterleri translitere eder). */
export function slugify(input: string): string {
  const transliterated = input
    .split("")
    .map((ch) => TURKISH_MAP[ch] ?? ch)
    .join("");

  return transliterated
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-") // harf/rakam dışını tireye çevir
    .replace(/^-+|-+$/g, "") // baştaki/sondaki tireleri temizle
    .replace(/-{2,}/g, "-"); // ardışık tireleri tekleştir
}

/** Bir dizenin geçerli bir slug olup olmadığını kontrol eder. */
export function isValidSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length >= 2 && value.length <= 80;
}
