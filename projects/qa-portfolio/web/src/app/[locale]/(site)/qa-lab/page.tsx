import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { ProjectCard } from "@/components/projects/project-card";
import { isLocale } from "@/i18n/routing";
import { getContentRepository } from "@/lib/repositories";
import { buildPageMetadata } from "@/lib/seo/metadata";

/**
 * QA Lab listesi (planning/04 §4.4).
 *
 * İŞ KURALI (ADR-0004): QA Lab girişleri ayrı bir tablo değil; classification=
 * 'qa_lab' olan projelerdir. Repository.listQaLab() bunları döndürür.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const nav = await getTranslations({ locale, namespace: "nav" });
  const p = await getTranslations({ locale, namespace: "pages" });
  return buildPageMetadata({
    locale,
    path: "/qa-lab",
    title: nav("qaLab"),
    description: p("qaLabDesc"),
  });
}

export default async function QaLabPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const nav = await getTranslations("nav");
  const p = await getTranslations("pages");
  const t = await getTranslations("projects");
  const repo = getContentRepository();
  const entries = await repo.listQaLab(locale);

  return (
    <section className="py-14">
      <Container>
        <h1 className="text-4xl font-semibold tracking-tight text-[var(--text)]">{nav("qaLab")}</h1>
        <p className="mt-3 max-w-2xl text-[var(--text-muted)]">{p("qaLabDesc")}</p>

        {/* Kart başlıkları <h3> - başlık sırası atlanmasın diye gizli <h2>. */}
        <h2 className="sr-only">{nav("qaLab")}</h2>
        {entries.length === 0 ? (
          <p className="mt-10 text-[var(--text-muted)]">{t("empty")}</p>
        ) : (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((e) => (
              <ProjectCard key={e.slug} project={e} />
            ))}
          </div>
        )}
      </Container>
    </section>
  );
}
