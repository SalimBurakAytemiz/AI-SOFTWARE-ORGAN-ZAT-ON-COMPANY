import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { buttonClasses } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { SkillsMatrix } from "@/components/about/skills-matrix";
import { JsonLd } from "@/components/seo/json-ld";
import { isLocale } from "@/i18n/routing";
import type { DbLocale } from "@/lib/db/database.types";
import { fixtureProfile, fixtureSkills, fixtureSocialLinks } from "@/content/fixtures";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { personJsonLd, webSiteJsonLd, breadcrumbJsonLd } from "@/lib/seo/structured-data";

/**
 * Hakkımda sayfası (planning/04 §4.5).
 *
 * FAZ 3 VERİ KAYNAĞI: fixtures.ts (PLACEHOLDER). Faz 4'te profil, yetkinlik,
 * sertifika ve eğitim Supabase'ten gelecek. Gerçek profesyonel bilgi
 * UYDURULMAZ (ADR-0008).
 *
 * JSON-LD: schema.org/Person (`sameAs` gerçek profillere işaret etmeli - şu an
 * PLACEHOLDER filtreleniyor) + WebSite + BreadcrumbList (planning/15 T-1504).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "about" });
  const p = await getTranslations({ locale, namespace: "pages" });
  return buildPageMetadata({
    locale,
    path: "/about",
    title: t("title"),
    description: p("aboutDesc"),
  });
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("about");
  const nav = await getTranslations("nav");
  const profile = fixtureProfile.translations[locale as DbLocale];

  return (
    <section className="py-14">
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
          breadcrumbJsonLd(locale, [
            { name: nav("home"), path: "" },
            { name: nav("about"), path: "/about" },
          ]),
        ]}
      />
      <Container prose>
        <h1 className="text-4xl font-semibold tracking-tight text-[var(--text)]">{t("title")}</h1>

        <p className="mt-2 rounded-[var(--radius-md)] border border-[var(--warn)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] p-3 font-mono text-xs text-[var(--warn)]">
          {(await getTranslations())("placeholderNotice")}
        </p>

        <h2 className="mt-8 text-xl font-semibold text-[var(--text)]">{t("bioHeading")}</h2>
        <p className="mt-2 text-[var(--text-muted)]">{profile.summary}</p>
        <p className="mt-2 text-[var(--text-faint)]">[PLACEHOLDER: 2–4 paragraflık biyografi]</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/experience" className={buttonClasses("secondary", "md", "no-underline")}>
            {nav("experience")}
          </Link>
          <Link href="/contact" className={buttonClasses("primary", "md", "no-underline")}>
            {t("contactCta")}
          </Link>
        </div>
      </Container>

      <Container className="mt-12">
        <h2 className="mb-4 text-xl font-semibold text-[var(--text)]">{t("skillsHeading")}</h2>
        <SkillsMatrix categories={fixtureSkills} locale={locale as DbLocale} />
      </Container>

      <Container prose className="mt-12">
        <h2 className="text-xl font-semibold text-[var(--text)]">{t("certsHeading")}</h2>
        <p className="mt-2 text-[var(--text-faint)]">
          [PLACEHOLDER: sertifika listesi — content intake checklist F]
        </p>

        <h2 className="mt-8 text-xl font-semibold text-[var(--text)]">{t("educationHeading")}</h2>
        <p className="mt-2 text-[var(--text-faint)]">
          [PLACEHOLDER: eğitim geçmişi — content intake checklist E]
        </p>
      </Container>
    </section>
  );
}
