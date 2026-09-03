import { getTranslations } from "next-intl/server";
import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/seo/og";
import { isLocale, routing } from "@/i18n/routing";

/**
 * Site geneli Open Graph görseli - tüm /[locale]/* sayfaları (daha spesifik
 * opengraph-image dosyası olan rotalar hariç, ör. projects/[slug]).
 */
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function OgImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const loc = isLocale(locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: loc, namespace: "home" });
  const site = await getTranslations({ locale: loc, namespace: "site" });
  return renderOgImage({ eyebrow: t("heroKicker"), title: site("title"), footer: site("tagline") });
}
