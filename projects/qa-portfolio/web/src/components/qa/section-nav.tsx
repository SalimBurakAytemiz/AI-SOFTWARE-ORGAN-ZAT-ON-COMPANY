"use client";

import { useEffect, useState } from "react";

/**
 * VAKA ÇALIŞMASI BÖLÜM NAVİGASYONU (planning/04 §4.3, planning/14 review R2).
 *
 * İki parça:
 *   - <SectionNavMobile>: dar ekranda içeriğin ÜSTÜNDE bir "sayfada gezin"
 *     açılır menüsü (<details>, JS'siz açılır).
 *   - <SectionNavRail>: geniş ekranda (>= xl) sağ kenarda sabit çapa listesi;
 *     aktif bölüm IntersectionObserver ile vurgulanır.
 *
 * Erişilebilirlik: <nav aria-label>, gerçek #id çapaları, aria-current.
 */
export interface SectionLink {
  id: string;
  label: string;
}

export function SectionNavMobile({ sections, heading }: { sections: SectionLink[]; heading: string }) {
  if (sections.length < 2) return null;
  return (
    <details className="my-6 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] xl:hidden">
      <summary className="cursor-pointer px-4 py-2 font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]">
        {heading}
      </summary>
      <nav aria-label={heading} className="border-t border-[var(--border)] p-2">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="block rounded-[var(--radius-sm)] px-3 py-2 text-sm text-[var(--text-muted)] no-underline hover:bg-[var(--surface-raised)] hover:text-[var(--text)]"
          >
            {s.label}
          </a>
        ))}
      </nav>
    </details>
  );
}

export function SectionNavRail({ sections, heading }: { sections: SectionLink[]; heading: string }) {
  const [activeId, setActiveId] = useState<string | null>(sections[0]?.id ?? null);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [sections]);

  if (sections.length < 2) return null;

  return (
    <nav aria-label={heading} className="mb-6 text-sm">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
        {heading}
      </p>
      <ul className="space-y-1">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              aria-current={activeId === s.id ? "true" : undefined}
              className={
                activeId === s.id
                  ? "block border-l-2 border-[var(--accent)] pl-3 text-[var(--accent)] no-underline"
                  : "block border-l-2 border-transparent pl-3 text-[var(--text-muted)] no-underline hover:text-[var(--text)]"
              }
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
