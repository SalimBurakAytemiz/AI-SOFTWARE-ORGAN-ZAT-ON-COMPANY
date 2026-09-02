import { getRequestConfig } from "next-intl/server";
import { routing, isLocale } from "./routing";

/**
 * İstek başına i18n yapılandırması (next-intl eklentisi tarafından çağrılır).
 *
 * - Gelen [locale] segmenti geçersizse varsayılan dile düşülür.
 * - Arayüz metinleri (menü, buton, form etiketleri, hata mesajları) buradaki
 *   JSON kataloglarından gelir; bunlar KODLA birlikte değişir, veritabanında
 *   TUTULMAZ (planning/02 §2.7). İçerik çevirileri (proje metinleri vb.)
 *   ayrı olarak veritabanı *_translations tablolarından gelir.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && isLocale(requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
