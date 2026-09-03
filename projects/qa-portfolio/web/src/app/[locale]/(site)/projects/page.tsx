import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { ProjectCard } from "@/components/projects/project-card";
import { ProjectFilters } from "@/components/projects/project-filters";
import { JsonLd } from "@/components/seo/json-ld";
import { isLocale } from "@/i18n/routing";
import type { DbLocale } from "@/lib/db/database.types";
import { getContentRepository } from "@/lib/repositories";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd } from "@/lib/seo/structured-data";
import { parseProjectFilters, hasActiveFilters, type RawSearchParams } from "@/lib/projects/filters";

/**
 * Proje kataloğu (planning/04 §4.2).
 *
 * Veri repository katmanından gelir (fixture veya faz 4'te Supabase). Filtre
 * durumu YALNIZCA URL'de (?type=&platform=&tool=&testType=). Filtresiz sayfa
 * dizine eklenir; filtreli görünüm noindex + canonical filtresiz /projects'e
 * işaret eder (planning/14 review R20).
 */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawSearchParams>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "projects" });
  const filters = parseProjectFilters(await searchParams);
  const filtered = hasActiveFilters(filters);

  return buildPageMetadata({
    locale,
    path: "/projects",
    // Filtreli sayfa da olsa canonical HER ZAMAN filtresiz /projects.
    canonicalPath: "/projects",
    title: filtered ? `${t("title")} — ${t("filters")}` : t("title"),
    description: t("subtitle"),
    noindex: filtered,
  });
}

export default async function ProjectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("projects");
  const nav = await getTranslations("nav");
  const filters = parseProjectFilters(await searchParams);
  const filtered = hasActiveFilters(filters);

  const repo = getContentRepository();
  const [projects, facets] = await Promise.all([
    repo.listProjects(locale as DbLocale, filters),
    repo.listFilterFacets(locale as DbLocale),
  ]);

  return (
    <section className="py-14">
      <JsonLd
        data={breadcrumbJsonLd(locale, [
          { name: nav("home"), path: "" },
          { name: nav("projects"), path: "/projects" },
        ])}
      />
      <Container>
        <h1 className="text-4xl font-semibold tracking-tight text-[var(--text)]">{t("title")}</h1>
        <p className="mt-3 max-w-2xl text-[var(--text-muted)]">{t("subtitle")}</p>

        <ProjectFilters facets={facets} active={filters} />

        {filtered && (
          <p className="mt-4 font-mono text-xs text-[var(--text-faint)]">{t("filteredNote")}</p>
        )}

        <p className="mt-4 font-mono text-xs text-[var(--text-faint)]">
          {t("resultCount", { count: projects.length })}
        </p>

        {projects.length === 0 ? (
          <p className="mt-8 text-[var(--text-muted)]">{t("empty")}</p>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <ProjectCard key={p.slug} project={p} />
            ))}
          </div>
        )}
      </Container>
    </section>
  );
}
