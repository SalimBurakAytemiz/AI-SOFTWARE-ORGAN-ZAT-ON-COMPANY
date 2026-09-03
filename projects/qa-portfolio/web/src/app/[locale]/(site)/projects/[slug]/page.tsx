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
import { isLocale, routing } from "@/i18n/routing";
import { getContentRepository } from "@/lib/repositories";
import { nonEmptySections } from "@/lib/domain/project";
import { formatMonth } from "@/i18n/format";

/**
 * VAKA ÇALIŞMASI SAYFA ŞABLONU (planning/04 §4.3, planning/09).
 *
 * İŞ KURALLARI:
 *   - Bölüm sırası SABİT (overview -> scope -> strategy -> coverage -> challenges
 *     -> impact -> lessons); boş bölümler HİÇ gösterilmez.
 *   - NDA: nda=true ise şirket "Gizli" gösterilir, ilgili bağlantılar gizlenir,
 *     bir NDA bandı eklenir.
 *   - DEMO içerik açıkça "DEMO / SANITIZED" bandıyla sunulur (ADR-0008).
 *   - Repository "published + visible" filtreler; yayınlanmamış slug -> 404.
 */

/**
 * Faz 2: yalnızca generateStaticParams'taki slug'lar geçerli; bilinmeyen slug
 * doğrudan gerçek 404 döner (soft-404 önlenir - planning/12 RISK-060).
 * Faz 3: ISR için dynamicParams=true + yayında revalidateTag('projects') ile
 * generateStaticParams yeniden üretilecek.
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
  const repo = getContentRepository();
  const cs = await repo.getProjectBySlug(locale, slug);
  if (!cs) return { robots: { index: false } };
  return {
    title: cs.seo.title ?? cs.title,
    description: cs.seo.description ?? cs.summary,
  };
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
  const cls = await getTranslations("projects.classification");
  const sectionLabels = await getTranslations("caseStudy.sections");

  // Önceki / sonraki gezinme: aynı sınıflandırma içinde display_order sırası.
  const siblings = (await repo.listProjects(locale)).filter(
    (p) => p.classification === cs.classification,
  );
  const idx = siblings.findIndex((p) => p.slug === cs.slug);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;

  const sections = nonEmptySections(cs);
  const hasQaEvidence =
    cs.scenarios.length + cs.bugs.length + cs.apiExamples.length + cs.sqlExamples.length > 0 ||
    cs.coverage.length > 0;

  return (
    <article className="py-10">
      <Container>
        {/* Banner'lar */}
        {cs.demo && (
          <p className="mb-4 rounded-[var(--radius-md)] border border-[var(--info)] bg-[color-mix(in_srgb,var(--info)_10%,transparent)] px-4 py-2 font-mono text-xs text-[var(--info)]">
            {t("demoBanner")}
          </p>
        )}

        {/* Breadcrumb + başlık */}
        {/* Breadcrumb: link metin bloğu içinde ayırt edilebilir olmalı
            (erişilebilirlik: link-in-text-block) - bu yüzden accent + altı çizili. */}
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

        {cs.nda && (
          <p className="mt-4 max-w-2xl rounded-[var(--radius-md)] border border-[var(--warn)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] px-4 py-2 text-sm text-[var(--warn)]">
            ⚠ {t("ndaBanner")}
          </p>
        )}

        {/* 2 kolon: ana içerik + meta kenar çubuğu */}
        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            {sections.map((s) => (
              <section key={s.key} className="mb-8">
                <h2 className="mb-2 text-xl font-semibold text-[var(--text)]">
                  {sectionLabels(s.key)}
                </h2>
                <SafeMarkdown>{s.md}</SafeMarkdown>
              </section>
            ))}

            {cs.coverage.length > 0 && (
              <section className="mb-8">
                <h2 className="mb-3 text-xl font-semibold text-[var(--text)]">{t("coverage")}</h2>
                <div className="space-y-2">
                  {cs.coverage.map((c) => (
                    <CoverageMeter key={c.area} label={c.area} value={c.value} />
                  ))}
                </div>
              </section>
            )}

            {cs.scenarios.length > 0 && (
              <section className="mb-8">
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
              <section className="mb-8">
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
              <section className="mb-8">
                <h2 className="mb-3 text-xl font-semibold text-[var(--text)]">{t("apiTesting")}</h2>
                {cs.apiExamples.map((a) => (
                  <ApiExampleBlock key={a.code} example={a} notesLabel={t("api.notes")} />
                ))}
              </section>
            )}

            {cs.sqlExamples.length > 0 && (
              <section className="mb-8">
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

            {!hasQaEvidence && sections.length <= 1 && (
              <p className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text-muted)]">
                {t("notEnoughEvidence")}
              </p>
            )}
          </div>

          {/* META KENAR ÇUBUĞU - dt/dd bir <dl> içinde olmalı (erişilebilirlik: dlitem) */}
          <aside className="h-fit lg:sticky lg:top-20">
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
        <nav className="mt-12 flex items-center justify-between border-t border-[var(--border)] pt-6 text-sm">
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
