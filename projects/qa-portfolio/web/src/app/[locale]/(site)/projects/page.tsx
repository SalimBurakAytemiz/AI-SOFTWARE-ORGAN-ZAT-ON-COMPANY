import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { ProjectCard } from "@/components/projects/project-card";
import { isLocale } from "@/i18n/routing";
import { getFixtureProjects } from "@/content/fixtures";

/**
 * Proje kataloğu (planning/04 §4.2).
 *
 * Faz 1: placeholder projeler listelenir. Faz 2'de:
 *   - URL parametreli filtreler (?type=professional&tool=k6) - SSR, paylaşılabilir,
 *   - yalnızca status='published' AND visible=true satırlar (RLS + publication.ts),
 *   - sayfalama.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "projects" });
  return { title: t("title"), description: t("subtitle") };
}

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("projects");
  const projects = getFixtureProjects(locale);

  return (
    <section className="py-14">
      <Container>
        <h1 className="text-4xl font-semibold tracking-tight text-[var(--text)]">{t("title")}</h1>
        <p className="mt-3 max-w-2xl text-[var(--text-muted)]">{t("subtitle")}</p>

        {projects.length === 0 ? (
          <p className="mt-10 text-[var(--text-muted)]">{t("empty")}</p>
        ) : (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <ProjectCard
                key={p.slug}
                project={{
                  slug: p.slug,
                  title: p.title,
                  summary: p.summary,
                  roleTitle: p.roleTitle,
                  classification: p.classification,
                  company: p.company,
                  companyHidden: p.companyHidden,
                  nda: p.nda,
                  taxonomy: p.taxonomy,
                }}
              />
            ))}
          </div>
        )}
      </Container>
    </section>
  );
}
