import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/ui/container";
import { buttonClasses } from "@/components/ui/button";
import { LocaleSwitch } from "./locale-switch";
import { ThemeToggle } from "./theme-toggle";
import { MobileNav } from "./mobile-nav";

/**
 * Site başlığı (planning/04 §4.0). Ana gezinme + dil değiştirici + tema +
 * birincil eylem ("Benimle çalış").
 *
 * Faz 1: mobil menü (hamburger) henüz yok; faz 2'de eklenecek (planning/07 T-0207).
 * Erişilebilirlik: <nav aria-label>, atlama bağlantısı (site-layout içinde).
 */
export function SiteHeader() {
  const t = useTranslations("nav");

  const links = [
    { href: "/projects", label: t("projects") },
    { href: "/qa-lab", label: t("qaLab") },
    { href: "/experience", label: t("experience") },
    { href: "/services", label: t("services") },
    { href: "/about", label: t("about") },
    { href: "/contact", label: t("contact") },
  ] as const;

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link href="/" className="font-mono text-sm font-semibold text-[var(--text)] no-underline">
          QA<span className="text-[var(--accent)]">.</span>Engineer
        </Link>

        <nav aria-label="Ana menü" className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-[var(--radius-sm)] px-2.5 py-1.5 text-sm text-[var(--text-muted)] no-underline hover:bg-[var(--surface-raised)] hover:text-[var(--text)]"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {/* LocaleSwitch useSearchParams kullanır -> statik sayfalarda Suspense şart. */}
          <Suspense
            fallback={
              <span className="h-[26px] w-[52px] rounded-[var(--radius-sm)] border border-[var(--border-strong)]" />
            }
          >
            <LocaleSwitch />
          </Suspense>
          <Link
            href="/contact"
            className={buttonClasses("primary", "sm", "hidden no-underline sm:inline-flex")}
          >
            {t("hireMe")}
          </Link>
          <MobileNav />
        </div>
      </Container>
    </header>
  );
}
