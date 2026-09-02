import { defineRouting } from "next-intl/routing";

/**
 * Dil (locale) yönlendirme yapılandırması - planning/11-localization + planning/03.
 *
 * - Desteklenen diller: Türkçe ve İngilizce.
 * - "as-needed" DEĞİL "always": her public URL bir dil önekiyle başlar
 *   (/tr/... , /en/...). Bu, SEO için net hreflang alternatifleri sağlar
 *   (planning/12 RISK-061).
 * - Varsayılan dil şimdilik "en" (uluslararası erişim). Founder onayı ile
 *   değişebilir (planning/12 OQ-001). Faz 2'de site_settings.default_locale
 *   veritabanından okunacak.
 */
export const routing = defineRouting({
  locales: ["tr", "en"],
  defaultLocale: "en",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];

/**
 * Bir dizenin desteklenen bir dil kodu olup olmadığını kontrol eder ve tipi
 * daraltır. next-intl'in `hasLocale` yardımcısı bu sürümde dışa aktarılmadığı
 * için elle tanımlanmıştır.
 */
export function isLocale(value: string): value is Locale {
  return (routing.locales as readonly string[]).includes(value);
}
