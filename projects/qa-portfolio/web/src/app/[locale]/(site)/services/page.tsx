import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { PlaceholderPage } from "@/components/site/placeholder-page";
import { isLocale } from "@/i18n/routing";
import { buildPageMetadata } from "@/lib/seo/metadata";

// Hizmetler sayfası - faz 1 iskeleti (planning/04 §4.6). İçerik faz 4+ (checklist G).
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
    path: "/services",
    title: nav("services"),
    description: p("servicesDesc"),
  });
}

export default async function ServicesPage({
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
      title={nav("services")}
      description={p("servicesDesc")}
      phaseNote={p("phaseNote")}
    />
  );
}
