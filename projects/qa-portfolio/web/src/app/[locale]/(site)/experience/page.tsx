import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { PlaceholderPage } from "@/components/site/placeholder-page";
import { isLocale } from "@/i18n/routing";
import { buildPageMetadata } from "@/lib/seo/metadata";

// Deneyim sayfası - faz 1 iskeleti (planning/04 §4.5). İçerik faz 4+ (checklist D/E/F).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const nav = await getTranslations({ locale, namespace: "nav" });
  const p = await getTranslations({ locale, namespace: "pages" });
  return buildPageMetadata({
    locale,
    path: "/experience",
    title: nav("experience"),
    description: p("experienceDesc"),
  });
}

export default async function ExperiencePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const nav = await getTranslations("nav");
  const p = await getTranslations("pages");
  return (
    <PlaceholderPage
      title={nav("experience")}
      description={p("experienceDesc")}
      phaseNote={p("phaseNote")}
    />
  );
}
