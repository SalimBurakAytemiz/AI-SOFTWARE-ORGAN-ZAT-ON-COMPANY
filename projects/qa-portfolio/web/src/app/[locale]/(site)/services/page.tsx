import { setRequestLocale, getTranslations } from "next-intl/server";
import { PlaceholderPage } from "@/components/site/placeholder-page";

// Hizmetler sayfası - faz 1 iskeleti (planning/04 §4.6).
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
