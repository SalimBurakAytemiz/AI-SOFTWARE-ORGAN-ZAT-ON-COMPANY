import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { buttonClasses } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { ProjectCard } from "@/components/projects/project-card";
import { JsonLd } from "@/components/seo/json-ld";
import { isLocale } from "@/i18n/routing";
import type { DbLocale } from "@/lib/db/database.types";
import { getContentRepository } from "@/lib/repositories";
import { fixtureProfile, fixtureSkills, fixtureSocialLinks } from "@/content/fixtures";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { personJsonLd, webSiteJsonLd } from "@/lib/seo/structured-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "home" });
  const site = await getTranslations({ locale, namespace: "site" });
  return buildPageMetadata({
    locale,
    path: "",
    title: site("title"),
    description: t("heroSubtitle"),
  });
}

/**
 * Ana sayfa (planning/04 §4.1). Hiyerarşi: Hero -> Öne çıkan iş -> Yetkinlik -> Eylem.
 *
 * Öne çıkan projeler repository'den (repo.listProjects featuredOnly) gelir.
 * Profil/yetkinlik henüz fixtures.ts placeholder; faz 3'te DB'den.
 */
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("home");
  const tRoot = await getTranslations();
  const repo = getContentRepository();
  const projects = await repo.listProjects(locale as DbLocale, { featuredOnly: true });
  const profile = fixtureProfile.translations[locale as DbLocale];

  return (
    <>
      <JsonLd
        data={[
          personJsonLd(
            {
              name: fixtureProfile.fullName,
              jobTitle: profile.headline,
              sameAs: fixtureSocialLinks.map((s) => s.url),
            },
            locale,
          ),
          webSiteJsonLd(locale),
        ]}
      />
      {/* Placeholder içerik uyarısı - gerçek bilgi girilene kadar görünür. */}
      <div className="border-b border-[var(--warn)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)]">
        <Container className="py-2">
          <p className="font-mono text-xs text-[var(--warn)]">{tRoot("placeholderNotice")}</p>
        </Container>
      </div>

      {/* HERO */}
      <section className="border-b border-[var(--border)] py-16 sm:py-24">
        <Container>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
            {t("heroKicker")}
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-[var(--text)] text-balance sm:text-5xl">
            {t("heroTitle")}
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-[var(--text-muted)]">{t("heroSubtitle")}</p>
          <p className="mt-2 max-w-2xl text-sm text-[var(--text-faint)]">{profile.summary}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/projects" className={buttonClasses("primary", "lg", "no-underline")}>
              {t("viewCaseStudies")}
            </Link>
            <Link href="/about" className={buttonClasses("secondary", "lg", "no-underline")}>
              {t("downloadCv")}
            </Link>
          </div>
        </Container>
      </section>

      {/* ÖNE ÇIKAN PROJELER */}
      <section className="py-14">
        <Container>
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="text-2xl font-semibold text-[var(--text)]">{t("featuredTitle")}</h2>
            <Link href="/projects" className="font-mono text-sm text-[var(--accent)]">
              {t("allProjects")} →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <ProjectCard key={p.slug} project={p} />
            ))}
          </div>
        </Container>
      </section>

      {/* NELERİ TEST EDERİM */}
      <section className="border-t border-[var(--border)] py-14">
        <Container>
          <h2 className="mb-6 text-2xl font-semibold text-[var(--text)]">{t("whatITest")}</h2>
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {fixtureSkills.map((group) => (
              <div key={group.category[locale]} className="flex flex-wrap items-baseline gap-2">
                <dt className="font-mono text-sm text-[var(--text-muted)]">
                  {group.category[locale]}:
                </dt>
                <dd className="text-sm text-[var(--text)]">
                  {group.items.map((s) => s.label).join(" · ")}
                </dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      {/* İLETİŞİM ÇAĞRISI */}
      <section className="border-t border-[var(--border)] py-16">
        <Container className="text-center">
          <h2 className="text-2xl font-semibold text-[var(--text)]">{t("contactCtaTitle")}</h2>
          <div className="mt-6">
            <Link href="/contact" className={buttonClasses("primary", "lg", "no-underline")}>
              {t("contactCtaAction")}
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}
