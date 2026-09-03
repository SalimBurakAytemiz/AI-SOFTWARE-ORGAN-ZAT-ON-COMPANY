import { getTranslations } from "next-intl/server";
import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/seo/og";
import { isLocale, routing } from "@/i18n/routing";
import { getContentRepository } from "@/lib/repositories";
import type { DbLocale } from "@/lib/db/database.types";

/**
 * Vaka çalışması Open Graph görseli - başlık + DEMO/NDA işareti.
 */
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export async function generateStaticParams() {
  const slugs = await getContentRepository().listPublishedSlugs();
  return routing.locales.flatMap((locale) => slugs.map((slug) => ({ locale, slug })));
}

export default async function CaseStudyOgImage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const loc = (isLocale(locale) ? locale : routing.defaultLocale) as DbLocale;
  const cs = await getContentRepository().getProjectBySlug(loc, slug);
  const t = await getTranslations({ locale: loc, namespace: "nav" });

  const marker = cs?.demo ? "DEMO" : cs?.nda ? "NDA" : t("projects");
  return renderOgImage({
    eyebrow: `${t("projects")} · ${marker}`,
    title: cs?.title ?? slug,
    footer: cs?.roleTitle ?? "QA Engineer Portfolio",
  });
}
