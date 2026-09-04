// =============================================================================
// content-parity-check.mjs - gerçek Supabase okuma yolu STAGING doğrulaması
//
// AMAÇ (FAZ 4, item 14 kapısı): SupabaseContentRepository'nin kullandığı
// PostgREST select string'lerinin gerçek şemaya karşı GEÇERLİ olduğunu ve
// seed içeriğinin beklenen davranışı (fixture ile aynı) verdiğini kanıtlar.
// `NEXT_PUBLIC_CONTENT_SOURCE="supabase"` geçişi bu script yeşil olmadan
// YAPILMAZ.
//
// ÖN KOŞUL: node supabase/seed/demo-seed.mjs
// KULLANIM (web/ içinden): node supabase/scripts/content-parity-check.mjs
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webDir = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
const env = fs
  .readFileSync(path.join(webDir, ".env.local"), "utf8")
  .split("\n")
  .reduce((acc, line) => {
    const m = line.match(/^([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m) acc[m[1]] = m[2];
    return acc;
  }, {});

const BASE = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;
const KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// SupabaseContentRepository'deki select string'lerinin aynısı (tek satır).
const LIST_SELECT =
  "slug,classification,featured,supported,nda,company,company_hidden,display_order,role_title," +
  "project_translations(locale,title,summary,role_title,translation_status,overview_md,testing_scope_md," +
  "test_strategy_md,test_coverage_md,challenges_md,impact_md,lessons_md,seo_title,seo_description)," +
  "project_taxonomy(display_order,taxonomy_terms(kind,slug,label_tr,label_en))";
const DETAIL_SELECT =
  LIST_SELECT +
  ",github_url,external_url,start_date,end_date,is_ongoing," +
  "project_highlights(locale,kind,text,display_order)," +
  "test_scenarios(code,priority,kind,automated,display_order,test_scenario_translations(locale,title,preconditions_md,steps_md,expected_md,notes_md))," +
  "bug_reports(code,severity,state,environment,display_order,bug_report_translations(locale,title,summary_md,steps_md,expected_md,actual_md,root_cause_md,resolution_md))," +
  "api_examples(code,method,endpoint,request_body,response_status,response_body,display_order,api_example_translations(locale,title,notes_md))," +
  "sql_examples(code,dialect,query_sql,sample_result,display_order,sql_example_translations(locale,title,explanation_md))";

let pass = 0;
let fail = 0;
const check = (ok, label, detail = "") => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  — " + detail : ""}`);
};

async function get(q) {
  const res = await fetch(`${BASE}/${q}`, { headers: { apikey: KEY, authorization: `Bearer ${KEY}` } });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

// pickTranslation ile aynı: istenen dilde published, yoksa EN published.
function pickTr(rows, loc) {
  const pub = (l) => rows.find((r) => r.locale === l && r.translation_status === "published");
  return pub(loc) ?? pub("en") ?? null;
}

async function main() {
  // 1) LIST select geçerli + yalnızca yayınlanmış projeler
  const list = await get(
    `projects?select=${encodeURIComponent(LIST_SELECT)}&status=eq.published&visible=eq.true&classification=neq.qa_lab&order=display_order.asc`,
  );
  check(list.status === 200 && Array.isArray(list.body), "LIST select string şemaya karşı geçerli", `HTTP ${list.status}`);
  const listSlugs = (list.body ?? []).map((r) => r.slug);
  check(listSlugs.includes("demo-checkout-regression-suite"), "Yayınlanmış professional proje listede");
  check(!listSlugs.includes("demo-qa-lab-flaky-test-triage"), "qa_lab projesi ana listeden hariç");
  check(!listSlugs.includes("seed-draft-project") && !listSlugs.includes("seed-hidden-project"), "Taslak/gizli listede yok");

  // 2) TR fallback: demo-en-only-tr-draft -> TR istenince EN başlık
  const enOnly = (list.body ?? []).find((r) => r.slug === "demo-en-only-tr-draft");
  check(Boolean(enOnly), "EN-only proje (TR taslak) yine de listede (EN fallback ile)");
  if (enOnly) {
    const trPick = pickTr(enOnly.project_translations, "tr");
    check(trPick?.title === "DEMO — Personal project (EN only)", "locale=tr istendiğinde EN çeviriye düşülür", trPick?.title);
  }

  // 3) DETAIL select geçerli + tüm çocuk diziler geliyor
  const detail = await get(
    `projects?select=${encodeURIComponent(DETAIL_SELECT)}&slug=eq.demo-checkout-regression-suite&status=eq.published&visible=eq.true`,
  );
  check(detail.status === 200 && detail.body?.length === 1, "DETAIL select string şemaya karşı geçerli", `HTTP ${detail.status}`);
  const d = detail.body?.[0];
  if (d) {
    check(Array.isArray(d.test_scenarios) && d.test_scenarios.length >= 1, "Senaryolar + çevirileri geldi");
    check(Array.isArray(d.bug_reports) && d.bug_reports.length >= 1, "Bug kayıtları + çevirileri geldi");
    check(Array.isArray(d.api_examples) && d.api_examples.length >= 1, "API örnekleri geldi");
    check(Array.isArray(d.sql_examples) && d.sql_examples.length >= 1, "SQL örnekleri geldi");
    check(
      d.project_highlights.some((h) => h.kind === "coverage" && /::\d+$/.test(h.text)),
      "Kapsam (coverage) highlight'ları 'alan::değer' biçiminde",
    );
    check(
      d.test_scenarios[0].test_scenario_translations.some((t) => t.locale === "en"),
      "Senaryo çevirisi EN mevcut",
    );
  }

  // 4) Slug ile taslak proje detayı reddedilir (RLS)
  const draft = await get(`projects?select=slug&slug=eq.seed-draft-project`);
  check(Array.isArray(draft.body) && draft.body.length === 0, "Taslak projeye slug ile erişim RLS ile engellenir");

  console.log(`\nSonuç: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("FATAL", e.message);
  process.exit(1);
});
