import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/ui/container";
import { fixtureProfile } from "@/content/fixtures";

/**
 * Site alt bilgisi (planning/04 §4.0). Yasal bağlantılar (KVKK/GDPR gizlilik,
 * künye) buradan erişilir - iletişim formu kişisel veri topladığı için zorunlu
 * (planning/03, planning/12 RISK-044).
 */
export function SiteFooter() {
  const t = useTranslations("footer");
  const nav = useTranslations("nav");
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 border-t border-[var(--border)] bg-[var(--bg-subtle)]">
      <Container className="flex flex-col gap-6 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-sm font-semibold text-[var(--text)]">
            {fixtureProfile.fullName}
          </p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            [PLACEHOLDER: Software QA Engineer]
          </p>
        </div>

        <nav aria-label="Alt menü" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link href="/projects" className="text-[var(--text-muted)] hover:text-[var(--text)]">
            {nav("projects")}
          </Link>
          <Link href="/services" className="text-[var(--text-muted)] hover:text-[var(--text)]">
            {nav("services")}
          </Link>
          <Link href="/contact" className="text-[var(--text-muted)] hover:text-[var(--text)]">
            {nav("contact")}
          </Link>
          <Link
            href="/legal/privacy"
            className="text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            {t("privacy")}
          </Link>
          <Link
            href="/legal/imprint"
            className="text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            {t("imprint")}
          </Link>
        </nav>
      </Container>
      <Container className="border-t border-[var(--border)] py-4">
        <p className="text-xs text-[var(--text-faint)]">
          © {year} · {t("rights")}
        </p>
      </Container>
    </footer>
  );
}
