import { setRequestLocale, getTranslations } from "next-intl/server";
import { PlaceholderPage } from "@/components/site/placeholder-page";

// QA Lab sayfası - faz 1 iskeleti (planning/04 §4.4).
// Faz 2: projects tablosunda classification='qa_lab' satırlar, hafif şablon.
export default async function QaLabPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const nav = await getTranslations("nav");
  const p = await getTranslations("pages");
  return (
    <PlaceholderPage title={nav("qaLab")} description={p("qaLabDesc")} phaseNote={p("phaseNote")} />
  );
}
