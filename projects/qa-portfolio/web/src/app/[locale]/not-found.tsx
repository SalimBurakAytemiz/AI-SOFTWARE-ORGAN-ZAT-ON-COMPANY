import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { buttonClasses } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/**
 * Dile özgü 404 sayfası (planning/03 §3.6). Yayınlanmamış veya arşivlenmiş bir
 * içeriğin slug'ına gidildiğinde de bu sayfa gösterilir (RLS 404). noindex.
 */
export const metadata = { robots: { index: false, follow: false } };

export default async function LocaleNotFound() {
  const t = await getTranslations("notFound");
  return (
    <div className="flex min-h-screen items-center bg-[var(--bg)]">
      <Container prose className="py-20 text-center">
        <p className="font-mono text-sm text-[var(--text-faint)]">404</p>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--text)]">{t("title")}</h1>
        <p className="mt-3 text-[var(--text-muted)]">{t("body")}</p>
        <div className="mt-8">
          <Link href="/" className={buttonClasses("secondary", "md", "no-underline")}>
            {t("backHome")}
          </Link>
        </div>
      </Container>
    </div>
  );
}
