import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { ProjectCard } from "@/components/projects/project-card";
import { isLocale } from "@/i18n/routing";
import { getContentRepository } from "@/lib/repositories";

/**
 * Proje kataloğu (planning/04 §4.2).
 *
 * Veri repository katmanından gelir (fixture veya - faz 3 - Supabase); sayfa
 * kaynağı bilmez. Repository "published + visible" kuralını uygular.
 * Faz 3: URL parametreli filtreler + sayfalama.
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
  const repo = getContentRepository();
  const projects = await repo.listProjects(locale);

  return (
    <section className="py-14">
      <Container>
        <h1 className="text-4xl font-semibold tracking-tight text-[var(--text)]">{t("title")}</h1>
        <p className="mt-3 max-w-2xl text-[var(--text-muted)]">{t("subtitle")}</p>
        <p className="mt-2 font-mono text-xs text-[var(--text-faint)]">
          {t("resultCount", { count: projects.length })}
        </p>

        {projects.length === 0 ? (
          <p className="mt-10 text-[var(--text-muted)]">{t("empty")}</p>
        ) : (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <ProjectCard key={p.slug} project={p} />
            ))}
          </div>
        )}
      </Container>
    </section>
  );
}
