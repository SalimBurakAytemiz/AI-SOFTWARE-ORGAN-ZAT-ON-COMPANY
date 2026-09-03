"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/**
 * Mobil gezinme menüsü (planning/04 §4.0, planning/07 T-0207).
 *
 * Erişilebilirlik: aç/kapa butonu aria-expanded + aria-controls; menü açıkken
 * Esc ile kapanır; bağlantıya tıklanınca kapanır.
 */
const LINKS = [
  { href: "/projects", key: "projects" },
  { href: "/qa-lab", key: "qaLab" },
  { href: "/experience", key: "experience" },
  { href: "/services", key: "services" },
  { href: "/about", key: "about" },
  { href: "/contact", key: "contact" },
] as const;

export function MobileNav() {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? t("close") : t("menu")}
        onClick={() => setOpen((v) => !v)}
        className="rounded-[var(--radius-sm)] border border-[var(--border-strong)] px-2.5 py-1.5 text-sm text-[var(--text-muted)]"
      >
        {open ? "✕" : "☰"}
      </button>

      {open && (
        <div
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 top-16 z-40 bg-[var(--bg)] p-6"
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          <nav aria-label={t("menu")} className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-[var(--radius-sm)] px-3 py-3 text-base text-[var(--text)] no-underline hover:bg-[var(--surface-raised)]"
              >
                {t(l.key)}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
