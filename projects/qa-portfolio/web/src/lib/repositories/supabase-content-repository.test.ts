import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

// Sunucu-yalnızca korumaları test ortamında etkisiz kıl (bkz. action.test.ts).
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/public", () => ({
  createPublicClient: () => {
    throw new Error("testte gerçek istemci kullanılmamalı - fakeClient enjekte edin");
  },
}));

import { SupabaseContentRepository } from "./supabase-content-repository";

/** İlk elemanı döndürür; boşsa testi anlaşılır bir hatayla düşürür. */
function first<T>(arr: T[]): T {
  if (arr.length === 0) throw new Error("beklenen en az bir sonuç, dizi boş");
  return arr[0]!;
}

/**
 * SupabaseContentRepository birim testleri.
 *
 * Ağ / gerçek Supabase YOK: sorgu oluşturucu zinciri sahte bir istemciyle
 * taklit edilir. Amaç map fonksiyonlarını, dil çözümünü (pickTranslation) ve
 * filtre davranışını doğrulamak. Gerçek RLS + PostgREST davranışı ayrı script
 * ile staging'de doğrulanır (supabase/scripts/rls-test-matrix.mjs).
 */

type Row = Record<string, unknown>;

/** Zincirlenebilir, "thenable" sahte sorgu. Tüm .eq/.neq/.order çağrıları
 *  yok sayılır (RLS + filtre mantığı testte önceden hazırlanmış satırlarla
 *  değil, repository'nin JS tarafı filtreleriyle sınanır). */
function fakeQuery(rows: Row[]) {
  const q: Record<string, unknown> = {};
  const chain = () => q;
  for (const m of ["select", "eq", "neq", "order", "limit"]) q[m] = chain;
  q.maybeSingle = () => Promise.resolve({ data: rows[0] ?? null, error: null });
  q.then = (resolve: (v: { data: Row[]; error: null }) => unknown) =>
    resolve({ data: rows, error: null });
  return q;
}

function fakeClient(tableRows: Record<string, Row[]>): SupabaseClient<Database> {
  return {
    from: (table: string) => fakeQuery(tableRows[table] ?? []),
  } as unknown as SupabaseClient<Database>;
}

const checkoutRow: Row = {
  slug: "demo-checkout-regression-suite",
  classification: "professional",
  featured: true,
  supported: false,
  nda: false,
  company: "DEMO Company Inc.",
  company_hidden: false,
  display_order: 1,
  role_title: null,
  project_translations: [
    { locale: "en", title: "Checkout suite", summary: "EN summary", role_title: "Senior QA", translation_status: "published", overview_md: "EN overview", testing_scope_md: null, test_strategy_md: null, test_coverage_md: null, challenges_md: null, impact_md: null, lessons_md: null, seo_title: "SEO EN", seo_description: "desc en" },
    { locale: "tr", title: "Ödeme paketi", summary: "TR özet", role_title: "Kıdemli QA", translation_status: "published", overview_md: "TR genel bakış", testing_scope_md: null, test_strategy_md: null, test_coverage_md: null, challenges_md: null, impact_md: null, lessons_md: null, seo_title: "SEO TR", seo_description: "desc tr" },
  ],
  project_taxonomy: [
    { display_order: 0, taxonomy_terms: { kind: "platform", slug: "web", label_tr: "Web", label_en: "Web" } },
    { display_order: 1, taxonomy_terms: { kind: "tool", slug: "playwright", label_tr: "Playwright", label_en: "Playwright" } },
    { display_order: 2, taxonomy_terms: { kind: "test_type", slug: "automation", label_tr: "Otomasyon", label_en: "Automation" } },
  ],
};

// EN yayınlanmış, TR taslak -> locale=tr istendiğinde EN'e düşmeli.
const enOnlyRow: Row = {
  slug: "demo-en-only-tr-draft",
  classification: "personal",
  featured: false,
  supported: false,
  nda: false,
  company: null,
  company_hidden: false,
  display_order: 5,
  role_title: null,
  project_translations: [
    { locale: "en", title: "EN only", summary: "EN", role_title: null, translation_status: "published", overview_md: null, testing_scope_md: null, test_strategy_md: null, test_coverage_md: null, challenges_md: null, impact_md: null, lessons_md: null, seo_title: null, seo_description: null },
    { locale: "tr", title: "TR taslak", summary: "TR", role_title: null, translation_status: "draft", overview_md: null, testing_scope_md: null, test_strategy_md: null, test_coverage_md: null, challenges_md: null, impact_md: null, lessons_md: null, seo_title: null, seo_description: null },
  ],
  project_taxonomy: [],
};

describe("SupabaseContentRepository.listProjects", () => {
  it("DB satırını ProjectSummary'ye çevirir ve istenen dili seçer", async () => {
    const repo = new SupabaseContentRepository(fakeClient({ projects: [checkoutRow] }));
    const p = first(await repo.listProjects("tr"));
    expect(p.slug).toBe("demo-checkout-regression-suite");
    expect(p.title).toBe("Ödeme paketi");
    expect(p.summary).toBe("TR özet");
    expect(p.roleTitle).toBe("Kıdemli QA");
    expect(p.taxonomy).toEqual(["Web", "Playwright", "Otomasyon"]);
    expect(p.demo).toBe(true); // slug 'demo-' önekiyle başlıyor
    expect(p.featured).toBe(true);
  });

  it("istenen dilde yayınlanmış çeviri yoksa varsayılan dile (EN) düşer", async () => {
    const repo = new SupabaseContentRepository(fakeClient({ projects: [enOnlyRow] }));
    const p = first(await repo.listProjects("tr"));
    expect(p.title).toBe("EN only"); // TR taslak -> EN fallback
  });

  it("hiçbir dilde yayınlanmış çeviri yoksa projeyi listeden çıkarır", async () => {
    const noPub: Row = {
      ...enOnlyRow,
      project_translations: [
        { ...(enOnlyRow.project_translations as Row[])[0], translation_status: "draft" },
      ],
    };
    const repo = new SupabaseContentRepository(fakeClient({ projects: [noPub] }));
    expect(await repo.listProjects("en")).toHaveLength(0);
  });

  it("taksonomi filtresi (tool) uygulamada eşleştirir (büyük/küçük harf duyarsız)", async () => {
    const repo = new SupabaseContentRepository(fakeClient({ projects: [checkoutRow] }));
    expect(await repo.listProjects("en", { tool: "playwright" })).toHaveLength(1);
    expect(await repo.listProjects("en", { tool: "cypress" })).toHaveLength(0);
  });

  it("company_hidden true ise şirket adı null'lanır", async () => {
    const hiddenCo: Row = { ...checkoutRow, company: "Gizli A.Ş.", company_hidden: true };
    const repo = new SupabaseContentRepository(fakeClient({ projects: [hiddenCo] }));
    const p = first(await repo.listProjects("en"));
    expect(p.company).toBeNull();
    expect(p.companyHidden).toBe(true);
  });
});

describe("SupabaseContentRepository.getProjectBySlug", () => {
  it("tüm çocuk tablolarını domain vaka çalışmasına map'ler", async () => {
    const detailRow: Row = {
      ...checkoutRow,
      github_url: "https://example.com/repo",
      external_url: null,
      start_date: "2024-02-01",
      end_date: "2024-09-01",
      is_ongoing: false,
      project_highlights: [
        { locale: "en", kind: "coverage", text: "Cart::88", display_order: 0 },
        { locale: "en", kind: "coverage", text: "Payments::82", display_order: 1 },
        { locale: "en", kind: "result", text: "not coverage", display_order: 2 },
      ],
      test_scenarios: [
        {
          code: "TS-01", priority: "p0", kind: "e2e", automated: true, display_order: 0,
          test_scenario_translations: [
            { locale: "en", title: "Guest checkout", preconditions_md: null, steps_md: "1. do", expected_md: "ok", notes_md: null },
          ],
        },
      ],
      bug_reports: [
        {
          code: "BUG-01", severity: "blocker", state: "fixed", environment: "staging", display_order: 0,
          bug_report_translations: [
            { locale: "en", title: "Dup order", summary_md: "s", steps_md: null, expected_md: null, actual_md: null, root_cause_md: null, resolution_md: null },
          ],
        },
      ],
      api_examples: [
        {
          code: "API-01", method: "POST", endpoint: "/v1/orders", request_body: null, response_status: 201, response_body: null, display_order: 0,
          api_example_translations: [{ locale: "en", title: "Create order", notes_md: null }],
        },
      ],
      sql_examples: [
        {
          code: "SQL-01", dialect: "postgres", query_sql: "select 1", sample_result: null, display_order: 0,
          sql_example_translations: [{ locale: "en", title: "Check", explanation_md: null }],
        },
      ],
    };
    const repo = new SupabaseContentRepository(fakeClient({ projects: [detailRow] }));
    const cs = await repo.getProjectBySlug("en", "demo-checkout-regression-suite");
    expect(cs).not.toBeNull();
    expect(cs!.links.github).toBe("https://example.com/repo");
    expect(cs!.period).toEqual({ start: "2024-02", end: "2024-09", ongoing: false });
    expect(cs!.platforms).toEqual(["Web"]);
    expect(cs!.tools).toEqual(["Playwright"]);
    expect(cs!.coverage).toEqual([
      { area: "Cart", value: 88 },
      { area: "Payments", value: 82 },
    ]);
    expect(cs!.scenarios[0]!.title).toBe("Guest checkout");
    expect(cs!.bugs[0]!.code).toBe("BUG-01");
    expect(cs!.apiExamples[0]!.endpoint).toBe("/v1/orders");
    expect(cs!.sqlExamples[0]!.querySql).toBe("select 1");
    expect(cs!.seo.title).toBe("SEO EN");
  });

  it("satır yoksa null döner", async () => {
    const repo = new SupabaseContentRepository(fakeClient({ projects: [] }));
    expect(await repo.getProjectBySlug("en", "yok")).toBeNull();
  });
});

describe("SupabaseContentRepository.listFilterFacets", () => {
  it("yayınlanmış projelerden benzersiz facet değerleri toplar", async () => {
    const repo = new SupabaseContentRepository(fakeClient({ projects: [checkoutRow] }));
    const facets = await repo.listFilterFacets("en");
    expect(facets.platforms).toEqual(["Web"]);
    expect(facets.tools).toEqual(["Playwright"]);
    expect(facets.testTypes).toEqual(["Automation"]);
    expect(facets.classifications).toEqual(["professional"]);
  });
});
