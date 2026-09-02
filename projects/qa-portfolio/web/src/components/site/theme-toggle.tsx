"use client";

import { useTranslations } from "next-intl";

/**
 * Tema değiştirme butonu. Seçimi <html data-theme> ve localStorage'a yazar
 * (ThemeInit ile birlikte çalışır). Kayıt erişilemezse sessizce geçilir.
 */
export function ThemeToggle() {
  const t = useTranslations("theme");

  function toggle() {
    const root = document.documentElement;
    const current =
      root.getAttribute("data-theme") ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("qa-theme", next);
    } catch {
      // localStorage kapalı olabilir - önemli değil
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t("toggle")}
      className="rounded-[var(--radius-sm)] border border-[var(--border-strong)] px-2 py-1 font-mono text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
    >
      ◑
    </button>
  );
}
