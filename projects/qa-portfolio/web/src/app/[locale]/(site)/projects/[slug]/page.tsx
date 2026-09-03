import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { SafeMarkdown } from "@/components/content/safe-markdown";
import { CoverageMeter } from "@/components/ui/coverage-meter";
import { ScenarioTable } from "@/components/qa/scenario-table";
import { BugReportCard } from "@/components/qa/bug-report-card";
import { ApiExampleBlock } from "@/components/qa/api-example";
import { SqlExampleBlock } from "@/components/qa/sql-example";
import { SectionNavMobile, SectionNavRail, type SectionLink } from "@/components/qa/section-nav";
import { JsonLd } from "@/components/seo/json-ld";
import { isLocale, routing } from "@/i18n/routing";
import type { DbLocale } from "@/lib/db/database.types";
import { getContentRepository } from "@/lib/repositories";
import { nonEmptySections } from "@/lib/domain/project";
import { formatMonth } from "@/i18n/format";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { caseStudyJsonLd, breadcrumbJsonLd } from "@/lib/seo/structured-data";

/**
 * VAKA ÇALIŞMASI SAYFA ŞABLONU (planning/04 §4.3, planning/09, planning/14 R2).
 *
 * İŞ KURALLARI:
 *   - Bölüm sırası SABİT; boş bölümler HİÇ gösterilmez.
 *   - Sayfanın en üstünde bir "Özet (TL;DR)" bandı: rol, yığın, sonuç - meşgul
 *     bir ziyaretçi uzun metni okumadan önce derinliği görsün (review R2).
 *   - Mobil: bölümler arası "sayfada gezin" açılır menüsü; geniş ekran: sabit
 *     çapa listesi (review R2).
 *   - NDA: nda=true -> şirket "—", bağlantılar gizli, NDA bandı.
 *   - DEMO içerik açıkça "DEMO / SANITIZED" bandıyla sunulur (ADR-0008).
 *   - JSON-LD: CreativeWork + BreadcrumbList (planning/15 T-1504).
 *   - Repository "published + visible" filtreler; bilinmeyen slug -> gerçek 404
 *     (dynamicParams=false, RISK-060).
 */
export const dynamicParams = false;

export async function generateStaticParams() {
  const repo = getContentRepository();
  const slugs = await repo.listPublishedSlugs();
  return routing.locales.flatMap((locale) => slugs.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const cs = await getContentRepository().getProjectBySlug(locale, slug);
  if (!cs) return { robots: { index: false } };
  return buildPageMetadata({
    locale,
    path: `/projects/${slug}`,
    title: cs.seo.title ?? cs.title,
    description: cs.seo.description ?? cs.summary,
    type: "article",
  });
}

export default async function CaseStudyPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const repo = getContentRepository();
  const cs = await repo.getProjectBySlug(locale, slug);
  if (!cs) notFound();

  const t = await getTranslations("caseStudy");
  const nav = await getTranslations("nav");
  const cls = await getTranslations("projects.classification");
  const sectionLabels = await getTranslations("caseStudy.sections");

  // Önceki / sonraki: aynı sınıflandırma içinde display_order sırası.
  const siblings = (await repo.listProjects(locale as DbLocale)).filter(
    (p) => p.classification === cs.classification,
  );
  const idx = siblings.findIndex((p) => p.slug === cs.slug);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;

  const proseSections = nonEmptySections(cs);
  const hasQaEvidence =
    cs.scenarios.length + cs.bugs.length + cs.apiExamples.length + cs.sqlExamples.length > 0 ||
    cs.coverage.length > 0;

  // Çapa navigasyonu için bölüm listesi (dolu olanlar).
  const navSections: SectionLink[] = [
    ...proseSections.map((s) => ({ id: s.key.replace("Md", ""), label: sectionLabels(s.key) })),
    ...(cs.coverage.length > 0 ? [{ id: "coverage", label: t("coverage") }] : []),
    ...(cs.scenarios.length > 0 ? [{ id: "scenarios", label: t("scenarios") }] : []),
    ...(cs.bugs.length > 0 ? [{ id: "bugs", label: t("bugs") }] : []),
    ...(cs.apiExamples.length > 0 ? [{ id: "api", label: t("apiTesting") }] : []),
    ...(cs.sqlExamples.length > 0 ? [{ id: "sql", label: t("dbValidation") }] : []),
  ];

  const stack = [...cs.platforms, ...cs.tools].slice(0, 6).join(" · ");

  return (
    <article className="py-10">
      <JsonLd data={[caseStudyJsonLd(cs, locale), breadcrumbJsonLd(locale, [
        { name: nav("home"), path: "" },
        { name: nav("projects"), path: "/projects" },
        { name: cs.title, path: `/projects/${cs.slug}` },
      ])]} />

      <Container>
        {cs.demo && (
          <p className="mb-4 rounded-[var(--radius-md)] border border-[var(--info)] bg-[color-mix(in_srgb,var(--info)_10%,transparent)] px-4 py-2 font-mono text-xs text-[var(--info)]">
            {t("demoBanner")}
          </p>
        )}

        {/* Breadcrumb: link metin bloğu içinde ayırt edilebilir olmalı (link-in-text-block). */}
        <nav aria-label="Breadcrumb" className="text-sm text-[var(--text-muted)]">
          <Link href="/projects" className="text-[var(--accent)] underline underline-offset-2">
            {t("backToProjects")}
          </Link>
          <span aria-hidden> / </span>
          <span className="text-[var(--text)]">{cs.title}</span>
        </nav>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone={cs.classification === "supported" ? "accent" : "neutral"}>
            {cls(cs.classification)}
          </Badge>
          {cs.nda && <Badge tone="warn">NDA</Badge>}
          {cs.demo && <Badge tone="info">DEMO</Badge>}
        </div>

        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-[var(--text)] text-balance">
          {cs.title}
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-[var(--text-muted)]">{cs.summary}</p>

        {/* TL;DR bandı (review R2) - meşgul ziyaretçi için üç satırlık özet */}
        <dl
          data-testid="case-study-tldr"
          className="mt-6 grid gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4 text-sm sm:grid-cols-3"
        >
          <div>
            <dt className="font-mono text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
              {t("tldrRole")}
            </dt>
            <dd className="mt-0.5 text-[var(--text)]">{cs.roleTitle ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-mono text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
              {t("tldrStack")}
            </dt>
            <dd className="mt-0.5 text-[var(--text)]">{stack || "—"}</dd>
          </div>
          <div>
            <dt className="font-mono text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
              {t("tldrOutcome")}
            </dt>
            <dd className="mt-0.5 text-[var(--text)]">
              {cs.coverage.length > 0
                ? `${cs.coverage.length} ${t("coverage").toLowerCase()} · ${cs.bugs.length} bug`
                : cs.summary.split(/[.·]/)[0]}
            </dd>
          </div>
        </dl>

        {cs.nda && (
          <p className="mt-4 max-w-2xl rounded-[var(--radius-md)] border border-[var(--warn)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] px-4 py-2 text-sm text-[var(--warn)]">
            ⚠ {t("ndaBanner")}
          </p>
        )}

        {/* Mobil bölüm menüsü */}
        <SectionNavMobile sections={navSections} heading={t("onThisPage")} />

        {/* İçerik + meta kenar çubuğu (+ geniş ekranda çapa listesi) */}
        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            {proseSections.map((s) => (
              <section key={s.key} id={s.key.replace("Md", "")} className="mb-8 scroll-mt-24">
                <h2 className="mb-2 text-xl font-semibold text-[var(--text)]">
                  {sectionLabels(s.key)}
                </h2>
                <SafeMarkdown>{s.md}</SafeMarkdown>
              </section>
            ))}

            {cs.coverage.length > 0 && (
              <section id="coverage" className="mb-8 scroll-mt-24">
                <h2 className="mb-3 text-xl font-semibold text-[var(--text)]">{t("coverage")}</h2>
                <div className="space-y-2">
                  {cs.coverage.map((c) => (
                    <CoverageMeter key={c.area} label={c.area} value={c.value} />
                  ))}
                </div>
              </section>
            )}

            {cs.scenarios.length > 0 && (
              <section id="scenarios" className="mb-8 scroll-mt-24">
                <h2 className="mb-3 text-xl font-semibold text-[var(--text)]">{t("scenarios")}</h2>
                <ScenarioTable
                  scenarios={cs.scenarios}
                  labels={{
                    preconditions: t("scenario.preconditions"),
                    steps: t("scenario.steps"),
                    expected: t("scenario.expected"),
                    notes: t("scenario.notes"),
                    automated: t("scenario.automated"),
                  }}
                />
              </section>
            )}

            {cs.bugs.length > 0 && (
              <section id="bugs" className="mb-8 scroll-mt-24">
                <h2 className="mb-3 text-xl font-semibold text-[var(--text)]">{t("bugs")}</h2>
                {cs.bugs.map((b) => (
                  <BugReportCard
                    key={b.code}
                    bug={b}
                    labels={{
                      steps: t("bug.steps"),
                      expected: t("bug.expected"),
                      actual: t("bug.actual"),
                      rootCause: t("bug.rootCause"),
                      resolution: t("bug.resolution"),
                      environment: t("bug.environment"),
                    }}
                  />
                ))}
              </section>
            )}

            {cs.apiExamples.length > 0 && (
              <section id="api" className="mb-8 scroll-mt-24">
                <h2 className="mb-3 text-xl font-semibold text-[var(--text)]">{t("apiTesting")}</h2>
                {cs.apiExamples.map((a) => (
                  <ApiExampleBlock key={a.code} example={a} notesLabel={t("api.notes")} />
                ))}
              </section>
            )}

            {cs.sqlExamples.length > 0 && (
              <section id="sql" className="mb-8 scroll-mt-24">
                <h2 className="mb-3 text-xl font-semibold text-[var(--text)]">{t("dbValidation")}</h2>
                {cs.sqlExamples.map((q) => (
                  <SqlExampleBlock
                    key={q.code}
                    example={q}
                    sampleResultLabel={t("sql.sampleResult")}
                    explanationLabel={t("sql.explanation")}
                  />
                ))}
              </section>
            )}

            {!hasQaEvidence && proseSections.length <= 1 && (
              <p className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text-muted)]">
                {t("notEnoughEvidence")}
              </p>
            )}
          </div>

          {/* META KENAR ÇUBUĞU + çapa listesi (dt/dd bir <dl> içinde - dlitem) */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="hidden xl:block">
              <SectionNavRail sections={navSections} heading={t("onThisPage")} />
            </div>
            <dl className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
              <MetaRow label={t("company")}>
                {cs.companyHidden || cs.company === null ? (
                  <span className="text-[var(--text-muted)]">—</span>
                ) : (
                  cs.company
                )}
              </MetaRow>
              {cs.roleTitle && <MetaRow label={t("role")}>{cs.roleTitle}</MetaRow>}
              {cs.industry && <MetaRow label={t("industry")}>{cs.industry}</MetaRow>}
              <MetaRow label={t("period")}>
                {formatPeriod(cs.period, t("ongoing"), locale)}
              </MetaRow>
              {cs.platforms.length > 0 && (
                <MetaRow label={t("platforms")}>{cs.platforms.join(", ")}</MetaRow>
              )}
              {cs.tools.length > 0 && <MetaRow label={t("tools")}>{cs.tools.join(", ")}</MetaRow>}
              {cs.testTypes.length > 0 && (
                <MetaRow label={t("testTypes")}>{cs.testTypes.join(", ")}</MetaRow>
              )}
              {!cs.nda && (cs.links.github || cs.links.external) && (
                <MetaRow label={t("links")}>
                  <span className="flex flex-col gap-1">
                    {cs.links.github && (
                      <a href={cs.links.github} className="text-[var(--accent)]" rel="noopener noreferrer">
                        {t("github")}
                      </a>
                    )}
                    {cs.links.external && (
                      <a href={cs.links.external} className="text-[var(--accent)]" rel="noopener noreferrer">
                        {t("liveSite")}
                      </a>
                    )}
                  </span>
                </MetaRow>
              )}
            </dl>
          </aside>
        </div>

        {/* Önceki / sonraki */}
        <nav className="mt-12 flex items-center justify-between gap-4 border-t border-[var(--border)] pt-6 text-sm">
          <span>
            {prev && (
              <Link href={`/projects/${prev.slug}`} className="text-[var(--accent)]">
                ‹ {t("prev")}: {prev.title}
              </Link>
            )}
          </span>
          <span className="text-right">
            {next && (
              <Link href={`/projects/${next.slug}`} className="text-[var(--accent)]">
                {t("next")}: {next.title} ›
              </Link>
            )}
          </span>
        </nav>
      </Container>
    </article>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-[var(--border)] py-2 first:pt-0 last:border-b-0 last:pb-0">
      <dt className="font-mono text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
        {label}
      </dt>
      <dd className="mt-0.5 text-[var(--text)]">{children}</dd>
    </div>
  );
}

function formatPeriod(
  period: { start: string | null; end: string | null; ongoing: boolean },
  ongoingLabel: string,
  locale: "tr" | "en",
): string {
  const start = formatMonth(period.start, locale);
  if (!start) return "—";
  if (period.ongoing) return `${start} – ${ongoingLabel}`;
  const end = formatMonth(period.end, locale);
  return end ? `${start} – ${end}` : start;
}
