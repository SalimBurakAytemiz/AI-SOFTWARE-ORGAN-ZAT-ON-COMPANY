"use client";

import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils/cn";

/**
 * Dil değiştirici (TR | EN).
 *
 * İŞ KURALI (planning/12 CF-18, review R2): dil değiştirildiğinde kullanıcı
 * AYNI sayfada VE AYNI SORGU PARAMETRELERİYLE kalır.
 *
 * next-intl'in usePathname'i sorgu dizesini içermez; bu yüzden useSearchParams
 * ile query'i ayrıca alıp yeni yola ekliyoruz (ör. /projects?type=supported ->
 * dil değişince /tr/projects?type=supported).
 */
export function LocaleSwitch() {
  const locale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const query = searchParams.toString();
  const target = query ? `${pathname}?${query}` : pathname;

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
          onClick={() => router.replace(target, { locale: code })}
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
