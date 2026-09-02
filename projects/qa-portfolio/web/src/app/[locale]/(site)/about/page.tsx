import { setRequestLocale, getTranslations } from "next-intl/server";
import { PlaceholderPage } from "@/components/site/placeholder-page";

// Hakkımda sayfası - faz 1 iskeleti (planning/04 §4.5).
export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const nav = await getTranslations("nav");
  const p = await getTranslations("pages");
  return (
    <PlaceholderPage title={nav("about")} description={p("aboutDesc")} phaseNote={p("phaseNote")} />
  );
}
