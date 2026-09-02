import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { PlaceholderPage } from "@/components/site/placeholder-page";

/**
 * Yasal metinler: /legal/privacy ve /legal/imprint (planning/03, planning/12 RISK-044).
 * İletişim formu kişisel veri topladığı için KVKK + GDPR bildirimi zorunludur.
 * Faz 2'de nihai metin girilecek; faz 1'de yalnızca iskelet.
 */
const DOCS = ["privacy", "imprint"] as const;
type Doc = (typeof DOCS)[number];

export function generateStaticParams() {
  return DOCS.map((doc) => ({ doc }));
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ locale: string; doc: string }>;
}) {
  const { locale, doc } = await params;
  if (!DOCS.includes(doc as Doc)) notFound();
  setRequestLocale(locale);

  const p = await getTranslations("pages");
  const title = doc === "privacy" ? p("legalPrivacyTitle") : p("legalImprintTitle");

  return <PlaceholderPage title={title} description={p("legalDesc")} phaseNote={p("phaseNote")} />;
}
