import { setRequestLocale, getTranslations } from "next-intl/server";
import { PlaceholderPage } from "@/components/site/placeholder-page";

// Deneyim sayfası - faz 1 iskeleti (planning/04 §4.5).
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
