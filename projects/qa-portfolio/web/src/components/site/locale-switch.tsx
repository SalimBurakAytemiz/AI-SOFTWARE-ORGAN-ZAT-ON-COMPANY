"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils/cn";

/**
 * Dil değiştirici (TR | EN).
 *
 * İŞ KURALI (planning/12 CF-18, review R2): dil değiştirildiğinde kullanıcı
 * AYNI sayfada ve aynı sorgu parametreleriyle kalır. usePathname/useRouter
 * next-intl navigation'dan gelir; dil önekini otomatik yönetir.
 */
export function LocaleSwitch() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div
      className="inline-flex overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border-strong)]"
      role="group"
      aria-label="Dil seçimi"
    >
      {routing.locales.map((code) => (
        <button
          key={code}
          type="button"
          aria-pressed={code === locale}
          onClick={() => router.replace(pathname, { locale: code })}
          className={cn(
            "px-2.5 py-1 font-mono text-xs uppercase transition-colors",
            code === locale
              ? "bg-[var(--surface-raised)] text-[var(--text)]"
              : "text-[var(--text-muted)] hover:text-[var(--text)]",
          )}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
