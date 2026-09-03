import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { ProjectListFilters, ProjectFilterFacets } from "@/lib/repositories";
import { filtersToQuery, toggleFilter, type FilterKey } from "@/lib/projects/filters";
import { cn } from "@/lib/utils/cn";

/**
 * Proje filtre çubuğu (planning/04 §4.2).
 *
 * SUNUCU BİLEŞENİ - istemci JS yok. Her filtre bir <Link>; tıklanınca URL
 * parametreleri güncellenir ve sayfa SSR ile yeniden render edilir. Aktif
 * filtre `aria-pressed` ile bildirilir (erişilebilirlik).
 */
export async function ProjectFilters({
  facets,
  active,
}: {
  facets: ProjectFilterFacets;
  active: ProjectListFilters;
}) {
  const t = await getTranslations("projects");
  const cls = await getTranslations("projects.classification");

  const groups: { key: FilterKey; label: string; values: string[]; localize?: (v: string) => string }[] = [
    {
      key: "type",
      label: t("filterType"),
      values: facets.classifications,
      localize: (v) => cls(v as "professional"),
    },
    { key: "platform", label: t("filterPlatform"), values: facets.platforms },
    { key: "tool", label: t("filterTool"), values: facets.tools },
    { key: "testType", label: t("filterTestType"), values: facets.testTypes },
  ];

  const anyActive = Boolean(active.classification || active.platform || active.tool || active.testType);

  return (
    <div className="mt-8 space-y-3" data-testid="project-filters">
      {groups
        .filter((g) => g.values.length > 0)
        .map((g) => (
          <div key={g.key} className="flex flex-wrap items-baseline gap-2">
            <span className="min-w-[5.5rem] font-mono text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
              {g.label}
            </span>
            {g.values.map((value) => {
              const next = toggleFilter(active, g.key, value);
              const isActive =
                (g.key === "type" && active.classification === value) ||
                (g.key === "platform" && active.platform === value) ||
                (g.key === "tool" && active.tool === value) ||
                (g.key === "testType" && active.testType === value);
              return (
                <Link
                  key={value}
                  href={{ pathname: "/projects", query: filtersToQuery(next) }}
                  // aria-pressed link'te geçersizdir (aria-allowed-attr); aktif
                  // filtre aria-current ile bildirilir.
                  aria-current={isActive ? "true" : undefined}
                  scroll={false}
                  className={cn(
                    "rounded-[var(--radius-sm)] border px-2 py-0.5 text-xs no-underline transition-colors",
                    isActive
                      ? "border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--accent)]"
                      : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text)]",
                  )}
                >
                  {g.localize ? g.localize(value) : value}
                </Link>
              );
            })}
          </div>
        ))}

      {anyActive && (
        <Link
          href="/projects"
          scroll={false}
          className="inline-block font-mono text-xs text-[var(--accent)]"
        >
          ✕ {t("clear")}
        </Link>
      )}
    </div>
  );
}
