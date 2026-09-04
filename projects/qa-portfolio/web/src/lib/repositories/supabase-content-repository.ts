import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, DbLocale } from "@/lib/db/database.types";
import type {
  ProjectSummary,
  ProjectCaseStudy,
  TestScenario,
  BugReport,
  ApiExample,
  SqlExample,
} from "@/lib/domain/project";
import { createPublicClient } from "@/lib/supabase/public";
import type {
  ContentRepository,
  ProjectListFilters,
  ProjectFilterFacets,
} from "./content-repository";

/**
 * SUPABASE İÇERİK REPOSITORY'Sİ - gerçek okuma sorgu katmanı (FAZ 4, T-0411).
 *
 * ----------------------------------------------------------------------------
 * GÜVENLİK / TASARIM İLKELERİ
 * ----------------------------------------------------------------------------
 * - Bu sınıf `createPublicClient()` (anon, çerezsiz) kullanır. Gördüğü tek şey
 *   RLS'in `anon` rolüne açtığıdır: `projects` için `status='published' AND
 *   visible=true` (0002_functions_rls.sql `projects_read`). Yani "taslak/gizli/
 *   arşiv asla public'e sızmaz" kuralı önce VERİTABANINDA zorlanır; buradaki
 *   ek `.eq()` filtreleri yalnızca katmanlı savunmadır (planning/14 R8).
 * - RLS, çeviri satırlarını `translation_status`'a bakmadan döndürür (policy
 *   `project_tr_read` yalnızca projenin public olup olmadığına bakar). Bu yüzden
 *   dil başına yayın kararı (planning/02 §2.7) BURADA uygulanır: `pickTranslation`.
 * - Arayüz (ContentRepository) değişmez; sayfalar hangi kaynaktan okunduğunu
 *   bilmez (factory: repositories/index.ts).
 *
 * ----------------------------------------------------------------------------
 * BİLİNEN SÖZLEŞMELER (şema kararıyla netleşecek - rapor / decision-log)
 * ----------------------------------------------------------------------------
 * - `demo` (DEMO/SANITIZED içerik işareti): şemada ayrı kolon yok; slug'ın
 *   `demo-` önekiyle başlaması demo kabul edilir (seed bu kurala uyar).
 * - `coverage` (kapsam ölçer): `project_highlights` satırında `kind='coverage'`,
 *   metin biçimi `"<alan etiketi>::<0-100 sayı>"` (planning/02 §2 "use
 *   project_highlights" notunun somutlaştırılması).
 */

// --- Sorgu sonucu şekilleri (PostgREST select string'leriyle birebir) -------
// supabase-js iç içe select tip çıkarımı kırılgan olduğundan, seçilen alanları
// açık arayüzlerle tanımlayıp sonucu TEK sınırda daraltıyoruz (any YOK).

type TrRow = {
  locale: DbLocale;
  title: string;
  summary: string;
  role_title: string | null;
  translation_status: Database["public"]["Enums"]["content_status"];
  overview_md: string | null;
  testing_scope_md: string | null;
  test_strategy_md: string | null;
  test_coverage_md: string | null;
  challenges_md: string | null;
  impact_md: string | null;
  lessons_md: string | null;
  seo_title: string | null;
  seo_description: string | null;
};

type TaxonomyJoinRow = {
  display_order: number;
  taxonomy_terms: {
    kind: Database["public"]["Enums"]["taxonomy_kind"];
    slug: string;
    label_tr: string;
    label_en: string;
  } | null;
};

type ProjectListRow = {
  slug: string;
  classification: Database["public"]["Enums"]["project_classification"];
  featured: boolean;
  supported: boolean;
  nda: boolean;
  company: string | null;
  company_hidden: boolean;
  display_order: number;
  role_title: string | null;
  project_translations: TrRow[];
  project_taxonomy: TaxonomyJoinRow[];
};

type HighlightRow = { locale: DbLocale; kind: string; text: string; display_order: number };

type ScenarioRow = {
  code: string;
  priority: TestScenario["priority"];
  kind: string;
  automated: boolean;
  display_order: number;
  test_scenario_translations: {
    locale: DbLocale;
    title: string;
    preconditions_md: string | null;
    steps_md: string;
    expected_md: string;
    notes_md: string | null;
  }[];
};

type BugRow = {
  code: string;
  severity: BugReport["severity"];
  state: BugReport["state"];
  environment: string | null;
  display_order: number;
  bug_report_translations: {
    locale: DbLocale;
    title: string;
    summary_md: string | null;
    steps_md: string | null;
    expected_md: string | null;
    actual_md: string | null;
    root_cause_md: string | null;
    resolution_md: string | null;
  }[];
};

type ApiRow = {
  code: string;
  method: ApiExample["method"];
  endpoint: string;
  request_body: string | null;
  response_status: number | null;
  response_body: string | null;
  display_order: number;
  api_example_translations: { locale: DbLocale; title: string; notes_md: string | null }[];
};

type SqlRow = {
  code: string;
  dialect: string;
  query_sql: string;
  sample_result: string | null;
  display_order: number;
  sql_example_translations: { locale: DbLocale; title: string; explanation_md: string | null }[];
};

type ProjectDetailRow = ProjectListRow & {
  github_url: string | null;
  external_url: string | null;
  start_date: string | null;
  end_date: string | null;
  is_ongoing: boolean;
  project_highlights: HighlightRow[];
  test_scenarios: ScenarioRow[];
  bug_reports: BugRow[];
  api_examples: ApiRow[];
  sql_examples: SqlRow[];
};

// --- Yardımcılar ------------------------------------------------------------

const DEFAULT_LOCALE: DbLocale = "en";

/** DEMO/SANITIZED içerik mi? (şema kolonu yok - slug öneki sözleşmesi). */
function isDemoSlug(slug: string): boolean {
  return slug.startsWith("demo-");
}

/**
 * Dil başına yayın kuralı (planning/02 §2.7): istenen dilde YAYINLANMIŞ çeviri
 * varsa onu, yoksa varsayılan dilde yayınlanmışı, o da yoksa null döndürür.
 */
function pickTranslation<T extends { locale: DbLocale; translation_status?: string }>(
  rows: T[],
  requested: DbLocale,
): T | null {
  const published = (loc: DbLocale) =>
    rows.find((r) => r.locale === loc && (r.translation_status ?? "published") === "published") ??
    null;
  return published(requested) ?? published(DEFAULT_LOCALE);
}

/** Çeviri tablosu satırı: `translation_status` içermeyen çocuk çevirileri için
 *  istenen dili, yoksa varsayılan dili seçer (çocuk çeviriler ayrı yayınlanmaz). */
function pickChildTranslation<T extends { locale: DbLocale }>(
  rows: T[],
  requested: DbLocale,
): T | null {
  return rows.find((r) => r.locale === requested) ?? rows.find((r) => r.locale === DEFAULT_LOCALE) ?? null;
}

function termLabel(
  term: { label_tr: string; label_en: string } | null,
  locale: DbLocale,
): string | null {
  if (!term) return null;
  return locale === "tr" ? term.label_tr : term.label_en;
}

function taxonomyByKind(
  rows: TaxonomyJoinRow[],
  kind: Database["public"]["Enums"]["taxonomy_kind"],
  locale: DbLocale,
): string[] {
  return rows
    .filter((r) => r.taxonomy_terms?.kind === kind)
    .sort((a, b) => a.display_order - b.display_order)
    .map((r) => termLabel(r.taxonomy_terms, locale))
    .filter((label): label is string => Boolean(label));
}

/** Tam tarihi "YYYY-MM"e indirger (domain dönem biçimi). */
function toMonth(date: string | null): string | null {
  return date ? date.slice(0, 7) : null;
}

/** `project_highlights` (kind='coverage') satırlarını `{area,value}` çözer. */
function parseCoverage(rows: HighlightRow[], locale: DbLocale): { area: string; value: number }[] {
  return rows
    .filter((r) => r.kind === "coverage" && r.locale === locale)
    .sort((a, b) => a.display_order - b.display_order)
    .map((r) => {
      const [area, raw] = r.text.split("::");
      const value = Number.parseInt((raw ?? "").trim(), 10);
      return { area: (area ?? "").trim(), value: Number.isFinite(value) ? value : 0 };
    })
    .filter((c) => c.area.length > 0);
}

// --- Repository -------------------------------------------------------------

const PROJECT_LIST_SELECT = `
  slug, classification, featured, supported, nda, company, company_hidden, display_order, role_title,
  project_translations ( locale, title, summary, role_title, translation_status,
    overview_md, testing_scope_md, test_strategy_md, test_coverage_md, challenges_md, impact_md, lessons_md,
    seo_title, seo_description ),
  project_taxonomy ( display_order, taxonomy_terms ( kind, slug, label_tr, label_en ) )
`;

const PROJECT_DETAIL_SELECT = `
  ${PROJECT_LIST_SELECT},
  github_url, external_url, start_date, end_date, is_ongoing,
  project_highlights ( locale, kind, text, display_order ),
  test_scenarios ( code, priority, kind, automated, display_order,
    test_scenario_translations ( locale, title, preconditions_md, steps_md, expected_md, notes_md ) ),
  bug_reports ( code, severity, state, environment, display_order,
    bug_report_translations ( locale, title, summary_md, steps_md, expected_md, actual_md, root_cause_md, resolution_md ) ),
  api_examples ( code, method, endpoint, request_body, response_status, response_body, display_order,
    api_example_translations ( locale, title, notes_md ) ),
  sql_examples ( code, dialect, query_sql, sample_result, display_order,
    sql_example_translations ( locale, title, explanation_md ) )
`;

export class SupabaseContentRepository implements ContentRepository {
  private readonly db: SupabaseClient<Database>;

  constructor(client?: SupabaseClient<Database>) {
    // Test enjeksiyonu için opsiyonel istemci; üretimde çerezsiz anon istemci.
    this.db = client ?? createPublicClient();
  }

  async listProjects(locale: DbLocale, filters?: ProjectListFilters): Promise<ProjectSummary[]> {
    let query = this.db
      .from("projects")
      .select(PROJECT_LIST_SELECT)
      // Katmanlı savunma: RLS zaten uyguluyor, biz de açıkça istiyoruz.
      .eq("status", "published")
      .eq("visible", true)
      .neq("classification", "qa_lab")
      .order("display_order", { ascending: true });

    if (filters?.featuredOnly) query = query.eq("featured", true);
    if (filters?.classification) {
      // Filtre değeri facet listesinden gelir; geçersiz bir değer basitçe boş
      // sonuç döndürür (enum'a daraltmak tip güvenliği içindir).
      query = query.eq(
        "classification",
        filters.classification as Database["public"]["Enums"]["project_classification"],
      );
    }

    const { data, error } = await query;
    if (error) throw new Error(`listProjects: ${error.message}`);

    const rows = (data ?? []) as unknown as ProjectListRow[];
    let summaries = rows
      .map((row) => this.toSummary(row, locale))
      .filter((s): s is ProjectSummary => s !== null);

    // Taksonomi filtreleri uygulamada (küçük veri kümesi; fixture ile aynı davranış).
    if (filters?.platform) summaries = summaries.filter((s) => hasTerm(s.taxonomy, filters.platform!));
    if (filters?.tool) summaries = summaries.filter((s) => hasTerm(s.taxonomy, filters.tool!));
    if (filters?.testType) summaries = summaries.filter((s) => hasTerm(s.taxonomy, filters.testType!));

    return summaries;
  }

  async getProjectBySlug(locale: DbLocale, slug: string): Promise<ProjectCaseStudy | null> {
    const { data, error } = await this.db
      .from("projects")
      .select(PROJECT_DETAIL_SELECT)
      .eq("status", "published")
      .eq("visible", true)
      // slug citext: büyük/küçük harf duyarsız eşleşme veritabanında.
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw new Error(`getProjectBySlug: ${error.message}`);
    if (!data) return null;

    return this.toCaseStudy(data as unknown as ProjectDetailRow, locale);
  }

  async listPublishedSlugs(): Promise<string[]> {
    const { data, error } = await this.db
      .from("projects")
      .select("slug")
      .eq("status", "published")
      .eq("visible", true);
    if (error) throw new Error(`listPublishedSlugs: ${error.message}`);
    return (data ?? []).map((r) => r.slug as string);
  }

  async listQaLab(locale: DbLocale): Promise<ProjectSummary[]> {
    const { data, error } = await this.db
      .from("projects")
      .select(PROJECT_LIST_SELECT)
      .eq("status", "published")
      .eq("visible", true)
      .eq("classification", "qa_lab")
      .order("display_order", { ascending: true });
    if (error) throw new Error(`listQaLab: ${error.message}`);

    return ((data ?? []) as unknown as ProjectListRow[])
      .map((row) => this.toSummary(row, locale))
      .filter((s): s is ProjectSummary => s !== null);
  }

  async listFilterFacets(locale: DbLocale): Promise<ProjectFilterFacets> {
    const { data, error } = await this.db
      .from("projects")
      .select(
        `classification, project_taxonomy ( display_order, taxonomy_terms ( kind, slug, label_tr, label_en ) )`,
      )
      .eq("status", "published")
      .eq("visible", true)
      .neq("classification", "qa_lab");
    if (error) throw new Error(`listFilterFacets: ${error.message}`);

    const rows = (data ?? []) as unknown as Pick<
      ProjectListRow,
      "classification" | "project_taxonomy"
    >[];
    const collect = (kind: Database["public"]["Enums"]["taxonomy_kind"]) =>
      unique(rows.flatMap((r) => taxonomyByKind(r.project_taxonomy, kind, locale)));

    return {
      classifications: unique(rows.map((r) => r.classification)),
      platforms: collect("platform"),
      tools: collect("tool"),
      testTypes: collect("test_type"),
    };
  }

  // --- Map: DB satırı -> domain -------------------------------------------

  private toSummary(row: ProjectListRow, locale: DbLocale): ProjectSummary | null {
    const tr = pickTranslation(row.project_translations, locale);
    if (!tr) return null; // hiçbir dilde yayınlanmış çevirisi yok -> listede gösterme

    return {
      slug: row.slug,
      classification: row.classification,
      featured: row.featured,
      supported: row.supported,
      nda: row.nda,
      company: row.company_hidden ? null : row.company,
      companyHidden: row.company_hidden,
      displayOrder: row.display_order,
      title: tr.title,
      summary: tr.summary,
      roleTitle: tr.role_title ?? row.role_title,
      taxonomy: taxonomyLabels(row.project_taxonomy, locale),
      demo: isDemoSlug(row.slug),
    };
  }

  private toCaseStudy(row: ProjectDetailRow, locale: DbLocale): ProjectCaseStudy | null {
    const summary = this.toSummary(row, locale);
    if (!summary) return null;
    const tr = pickTranslation(row.project_translations, locale)!;

    return {
      ...summary,
      period: {
        start: toMonth(row.start_date),
        end: toMonth(row.end_date),
        ongoing: row.is_ongoing,
      },
      links: { github: row.github_url, external: row.external_url },
      industry: taxonomyByKind(row.project_taxonomy, "industry", locale)[0] ?? null,
      platforms: taxonomyByKind(row.project_taxonomy, "platform", locale),
      tools: taxonomyByKind(row.project_taxonomy, "tool", locale),
      testTypes: taxonomyByKind(row.project_taxonomy, "test_type", locale),
      sections: {
        overviewMd: tr.overview_md,
        testingScopeMd: tr.testing_scope_md,
        testStrategyMd: tr.test_strategy_md,
        testCoverageMd: tr.test_coverage_md,
        challengesMd: tr.challenges_md,
        impactMd: tr.impact_md,
        lessonsMd: tr.lessons_md,
      },
      coverage: parseCoverage(row.project_highlights, locale),
      scenarios: mapScenarios(row.test_scenarios, locale),
      bugs: mapBugs(row.bug_reports, locale),
      apiExamples: mapApiExamples(row.api_examples, locale),
      sqlExamples: mapSqlExamples(row.sql_examples, locale),
      seo: { title: tr.seo_title, description: tr.seo_description },
    };
  }
}

// --- Serbest fonksiyon map yardımcıları (sınıf dışında, test edilebilir) ----

function taxonomyLabels(rows: TaxonomyJoinRow[], locale: DbLocale): string[] {
  return rows
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .map((r) => termLabel(r.taxonomy_terms, locale))
    .filter((label): label is string => Boolean(label));
}

function mapScenarios(rows: ScenarioRow[], locale: DbLocale): TestScenario[] {
  return rows
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .map((s) => {
      const t = pickChildTranslation(s.test_scenario_translations, locale);
      if (!t) return null;
      return {
        code: s.code,
        priority: s.priority,
        kind: s.kind,
        automated: s.automated,
        title: t.title,
        preconditionsMd: t.preconditions_md,
        stepsMd: t.steps_md,
        expectedMd: t.expected_md,
        notesMd: t.notes_md,
      } satisfies TestScenario;
    })
    .filter((s): s is TestScenario => s !== null);
}

function mapBugs(rows: BugRow[], locale: DbLocale): BugReport[] {
  return rows
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .map((b) => {
      const t = pickChildTranslation(b.bug_report_translations, locale);
      if (!t) return null;
      return {
        code: b.code,
        severity: b.severity,
        state: b.state,
        environment: b.environment,
        title: t.title,
        summaryMd: t.summary_md,
        stepsMd: t.steps_md,
        expectedMd: t.expected_md,
        actualMd: t.actual_md,
        rootCauseMd: t.root_cause_md,
        resolutionMd: t.resolution_md,
      } satisfies BugReport;
    })
    .filter((b): b is BugReport => b !== null);
}

function mapApiExamples(rows: ApiRow[], locale: DbLocale): ApiExample[] {
  return rows
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .map((a) => {
      const t = pickChildTranslation(a.api_example_translations, locale);
      if (!t) return null;
      return {
        code: a.code,
        method: a.method,
        endpoint: a.endpoint,
        requestBody: a.request_body,
        responseStatus: a.response_status,
        responseBody: a.response_body,
        title: t.title,
        notesMd: t.notes_md,
      } satisfies ApiExample;
    })
    .filter((a): a is ApiExample => a !== null);
}

function mapSqlExamples(rows: SqlRow[], locale: DbLocale): SqlExample[] {
  return rows
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .map((q) => {
      const t = pickChildTranslation(q.sql_example_translations, locale);
      if (!t) return null;
      return {
        code: q.code,
        dialect: q.dialect,
        querySql: q.query_sql,
        sampleResult: q.sample_result,
        title: t.title,
        explanationMd: t.explanation_md,
      } satisfies SqlExample;
    })
    .filter((q): q is SqlExample => q !== null);
}

function hasTerm(list: string[], needle: string): boolean {
  const n = needle.toLowerCase();
  return list.some((t) => t.toLowerCase() === n);
}

function unique(list: string[]): string[] {
  return [...new Set(list.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
