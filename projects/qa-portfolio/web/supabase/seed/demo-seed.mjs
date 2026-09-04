// =============================================================================
// demo-seed.mjs - DEVELOPMENT / STAGING veritabanına DEMO/SANITIZED içerik yükler
//
// AMAÇ (FAZ 4): gerçek Supabase sorgu katmanını (SupabaseContentRepository) ve
// RLS görünürlük kurallarını gerçek veriyle doğrulayabilmek. Bu script:
//   - YALNIZCA staging'e uygulanır (SUPABASE_DB_URL, .env.local).
//   - İdempotenttir: aşağıdaki slug kümesini silip yeniden ekler.
//   - Yalnızca DEMO/SANITIZED içerik ekler (ADR-0008) - gerçek profesyonel
//     veri ASLA uydurulmaz. Gerçek portföy içeriği admin CMS'ten girilecek.
//   - `pg` ile doğrudan bağlanır (postgres rolü, RLS'i bypass eder - seed için).
//
// KULLANIM (projects/qa-portfolio/web/ içinden):
//   node supabase/seed/demo-seed.mjs           # yükle
//   node supabase/seed/demo-seed.mjs --clean   # yalnızca temizle
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const webDir = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
const env = fs
  .readFileSync(path.join(webDir, ".env.local"), "utf8")
  .split("\n")
  .reduce((acc, line) => {
    const m = line.match(/^([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m) acc[m[1]] = m[2];
    return acc;
  }, {});

if (!env.SUPABASE_DB_URL) {
  console.error("HATA: .env.local içinde SUPABASE_DB_URL yok (bir insan işlemi).");
  process.exit(1);
}

// Bu script'in yönettiği slug kümesi (idempotent temizlik bunları hedefler).
export const SEED_SLUGS = [
  "demo-checkout-regression-suite",
  "demo-public-api-contract-testing",
  "demo-qa-lab-flaky-test-triage",
  "demo-en-only-tr-draft",
  "seed-draft-project",
  "seed-hidden-project",
];

const TAXONOMY = [
  { kind: "platform", slug: "web", label_tr: "Web", label_en: "Web" },
  { kind: "platform", slug: "api", label_tr: "API", label_en: "API" },
  { kind: "tool", slug: "playwright", label_tr: "Playwright", label_en: "Playwright" },
  { kind: "tool", slug: "postman", label_tr: "Postman", label_en: "Postman" },
  { kind: "tool", slug: "k6", label_tr: "k6", label_en: "k6" },
  { kind: "tool", slug: "github-actions", label_tr: "GitHub Actions", label_en: "GitHub Actions" },
  { kind: "test_type", slug: "automation", label_tr: "Otomasyon", label_en: "Automation" },
  { kind: "test_type", slug: "regression", label_tr: "Regresyon", label_en: "Regression" },
  { kind: "test_type", slug: "api-testing", label_tr: "API", label_en: "API" },
  { kind: "test_type", slug: "performance", label_tr: "Performans", label_en: "Performance" },
  { kind: "industry", slug: "e-commerce", label_tr: "E-ticaret (DEMO)", label_en: "E-commerce (DEMO)" },
  { kind: "industry", slug: "fintech", label_tr: "Fintech (DEMO)", label_en: "Fintech (DEMO)" },
];

/**
 * Proje tanımları. `translations` dizisi dil başına yayın durumunu taşır
 * (planning/02 §2.7 - EN yayınlanıp TR taslak kalabilir).
 */
const PROJECTS = [
  {
    slug: "demo-checkout-regression-suite",
    classification: "professional",
    status: "published",
    visible: true,
    featured: true,
    supported: false,
    nda: false,
    company: "DEMO Company Inc.",
    company_hidden: false,
    display_order: 1,
    start_date: "2024-02-01",
    end_date: "2024-09-01",
    is_ongoing: false,
    taxonomy: ["web", "api", "playwright", "postman", "github-actions", "automation", "regression", "api-testing", "e-commerce"],
    highlights: [
      { locale: "tr", kind: "coverage", text: "Sepet ve fiyatlandırma::88", display_order: 0 },
      { locale: "tr", kind: "coverage", text: "Ödeme yöntemleri::82", display_order: 1 },
      { locale: "en", kind: "coverage", text: "Cart and pricing::88", display_order: 0 },
      { locale: "en", kind: "coverage", text: "Payment methods::82", display_order: 1 },
    ],
    translations: [
      {
        locale: "tr",
        translation_status: "published",
        title: "DEMO — Ödeme (checkout) regresyon paketi",
        summary:
          "SANITIZED örnek: bir e-ticaret ödeme akışı için uçtan uca otomasyon paketi.",
        role_title: "Kıdemli QA Mühendisi (DEMO)",
        overview_md: "> **DEMO / SANITIZED** — kurgusal içerik.\n\nKurgusal bir e-ticaret ödeme akışı otomasyonu.",
        test_strategy_md: "- API sözleşme testleri + tarayıcı E2E.\n- İzole staging ortamı.",
        impact_md: "- Regresyon süresi kurgusal olarak 2 gün → ~3 saat.",
        seo_title: "DEMO — Ödeme regresyon paketi | Vaka çalışması",
        seo_description: "SANITIZED örnek vaka çalışması.",
      },
      {
        locale: "en",
        translation_status: "published",
        title: "DEMO — Checkout regression suite",
        summary: "SANITIZED example: end-to-end automation suite for an e-commerce checkout flow.",
        role_title: "Senior QA Engineer (DEMO)",
        overview_md: "> **DEMO / SANITIZED** — fictional content.\n\nAutomation for a fictional e-commerce checkout flow.",
        test_strategy_md: "- API contract tests + browser E2E.\n- Isolated staging environment.",
        impact_md: "- Regression time went from a fictional 2 days → ~3 hours.",
        seo_title: "DEMO — Checkout regression suite | Case study",
        seo_description: "SANITIZED example case study.",
      },
    ],
    scenarios: [
      {
        code: "TS-01", priority: "p0", kind: "e2e", automated: true, display_order: 0,
        tr: { title: "Misafir kullanıcı kredi kartıyla siparişi tamamlar", steps_md: "1. Ürünü sepete ekle\n2. Öde", expected_md: "Sipariş oluşur.", preconditions_md: "Stokta ürün var.", notes_md: "DEMO test kartı." },
        en: { title: "Guest user completes an order with a credit card", steps_md: "1. Add product\n2. Pay", expected_md: "Order is created.", preconditions_md: "Product in stock.", notes_md: "DEMO test card." },
      },
    ],
    bugs: [
      {
        code: "BUG-01", severity: "blocker", state: "fixed", environment: "staging", display_order: 0,
        tr: { title: "Çift tıklamada sipariş iki kez oluşuyor", summary_md: "Buton iki kez basılınca iki sipariş.", steps_md: "Hızlı iki tık.", expected_md: "Tek sipariş.", actual_md: "İki sipariş.", root_cause_md: "Idempotency anahtarı yoktu.", resolution_md: "Idempotency-Key eklendi." },
        en: { title: "Double click creates the order twice", summary_md: "Two clicks create two orders.", steps_md: "Two fast clicks.", expected_md: "One order.", actual_md: "Two orders.", root_cause_md: "No idempotency key.", resolution_md: "Added Idempotency-Key." },
      },
    ],
    apiExamples: [
      {
        code: "API-01", method: "POST", endpoint: "/v1/orders", request_body: '{ "cart_id": "DEMO-1" }', response_status: 201, response_body: '{ "order_id": "DEMO-ord-1" }', display_order: 0,
        tr: { title: "Sipariş oluşturma", notes_md: "Idempotency anahtarıyla." },
        en: { title: "Create order", notes_md: "With an idempotency key." },
      },
    ],
    sqlExamples: [
      {
        code: "SQL-01", dialect: "postgres", query_sql: "select 1;", sample_result: "(0 satır)", display_order: 0,
        tr: { title: "Sipariş toplamı tutarlılığı", explanation_md: "0 satır beklenir." },
        en: { title: "Order total consistency", explanation_md: "0 rows expected." },
      },
    ],
  },
  {
    slug: "demo-public-api-contract-testing",
    classification: "supported",
    status: "published",
    visible: true,
    featured: true,
    supported: true,
    nda: true,
    company: "DEMO Fintech Ltd.",
    company_hidden: true,
    display_order: 2,
    start_date: "2023-05-01",
    end_date: "2023-11-01",
    is_ongoing: false,
    taxonomy: ["api", "postman", "k6", "api-testing", "performance", "fintech"],
    highlights: [],
    translations: [
      {
        locale: "tr", translation_status: "published",
        title: "DEMO — Public API sözleşme ve yük testi",
        summary: "SANITIZED örnek: NDA'lı kurgusal bir fintech için API sözleşme testleri.",
        role_title: "QA Danışmanı (DEMO)",
        overview_md: "> **DEMO / SANITIZED · NDA** — kurgusal içerik.",
        seo_title: "DEMO — API sözleşme testi | Vaka çalışması",
        seo_description: "SANITIZED örnek.",
      },
      {
        locale: "en", translation_status: "published",
        title: "DEMO — Public API contract and load testing",
        summary: "SANITIZED example: API contract tests for a fictional fintech under NDA.",
        role_title: "QA Consultant (DEMO)",
        overview_md: "> **DEMO / SANITIZED · NDA** — fictional content.",
        seo_title: "DEMO — API contract testing | Case study",
        seo_description: "SANITIZED example.",
      },
    ],
    scenarios: [], bugs: [], apiExamples: [], sqlExamples: [],
  },
  {
    slug: "demo-qa-lab-flaky-test-triage",
    classification: "qa_lab",
    status: "published",
    visible: true,
    featured: false,
    supported: false,
    nda: false,
    company: null,
    company_hidden: false,
    display_order: 1,
    start_date: null,
    end_date: null,
    is_ongoing: false,
    taxonomy: ["automation", "playwright"],
    highlights: [],
    translations: [
      { locale: "tr", translation_status: "published", title: "DEMO — Kararsız (flaky) test ayıklama notları", summary: "SANITIZED QA Lab girişi.", role_title: null, seo_title: null, seo_description: null },
      { locale: "en", translation_status: "published", title: "DEMO — Flaky test triage notes", summary: "SANITIZED QA Lab entry.", role_title: null, seo_title: null, seo_description: null },
    ],
    scenarios: [], bugs: [], apiExamples: [], sqlExamples: [],
  },
  {
    // EN yayınlanmış, TR taslak -> locale='tr' istendiğinde EN fallback görünmeli.
    slug: "demo-en-only-tr-draft",
    classification: "personal",
    status: "published",
    visible: true,
    featured: false,
    supported: false,
    nda: false,
    company: null,
    company_hidden: false,
    display_order: 5,
    start_date: null,
    end_date: null,
    is_ongoing: false,
    taxonomy: ["web"],
    highlights: [],
    translations: [
      { locale: "en", translation_status: "published", title: "DEMO — Personal project (EN only)", summary: "SANITIZED example whose TR translation is still a draft.", role_title: null, seo_title: null, seo_description: null },
      { locale: "tr", translation_status: "draft", title: "DEMO — Kişisel proje (TR taslak)", summary: "Bu çeviri taslak; public'te görünmemeli.", role_title: null, seo_title: null, seo_description: null },
    ],
    scenarios: [], bugs: [], apiExamples: [], sqlExamples: [],
  },
  {
    // RLS negatif senaryo: taslak proje anon'a ASLA görünmez.
    slug: "seed-draft-project",
    classification: "personal",
    status: "draft",
    visible: true,
    featured: false,
    supported: false,
    nda: false,
    company: null,
    company_hidden: false,
    display_order: 90,
    start_date: null,
    end_date: null,
    is_ongoing: false,
    taxonomy: [],
    highlights: [],
    translations: [
      { locale: "en", translation_status: "draft", title: "SEED — Draft project (must be hidden)", summary: "If anon can read this, RLS is broken.", role_title: null, seo_title: null, seo_description: null },
    ],
    scenarios: [], bugs: [], apiExamples: [], sqlExamples: [],
  },
  {
    // RLS negatif senaryo: yayınlanmış ama visible=false -> anon'a görünmez.
    slug: "seed-hidden-project",
    classification: "personal",
    status: "published",
    visible: false,
    featured: false,
    supported: false,
    nda: false,
    company: null,
    company_hidden: false,
    display_order: 91,
    start_date: null,
    end_date: null,
    is_ongoing: false,
    taxonomy: [],
    highlights: [],
    translations: [
      { locale: "en", translation_status: "published", title: "SEED — Hidden project (visible=false)", summary: "If anon can read this, RLS is broken.", role_title: null, seo_title: null, seo_description: null },
    ],
    scenarios: [], bugs: [], apiExamples: [], sqlExamples: [],
  },
];

async function clean(client) {
  // ON DELETE CASCADE çocukları da siler; taksonomi terimleri paylaşımlı olduğu
  // için yalnızca bizim slug önekimizle eklenenleri bırakırız (idempotent).
  await client.query(`delete from public.projects where slug = any($1::citext[])`, [SEED_SLUGS]);
  await client.query(
    `delete from public.taxonomy_terms where slug = any($1::citext[])`,
    [TAXONOMY.map((t) => t.slug)],
  );
}

async function seed(client) {
  await clean(client);

  // Taksonomi
  const termIds = {};
  for (const t of TAXONOMY) {
    const { rows } = await client.query(
      `insert into public.taxonomy_terms (kind, slug, label_tr, label_en)
       values ($1,$2,$3,$4) returning id`,
      [t.kind, t.slug, t.label_tr, t.label_en],
    );
    termIds[t.slug] = rows[0].id;
  }

  for (const p of PROJECTS) {
    const { rows } = await client.query(
      `insert into public.projects
        (slug, classification, status, visible, featured, supported, nda, company,
         company_hidden, display_order, start_date, end_date, is_ongoing, published_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       returning id`,
      [
        p.slug, p.classification, p.status, p.visible, p.featured, p.supported, p.nda,
        p.company, p.company_hidden, p.display_order, p.start_date, p.end_date, p.is_ongoing,
        p.status === "published" ? new Date().toISOString() : null,
      ],
    );
    const pid = rows[0].id;

    for (const [i, slug] of p.taxonomy.entries()) {
      await client.query(
        `insert into public.project_taxonomy (project_id, term_id, display_order) values ($1,$2,$3)`,
        [pid, termIds[slug], i],
      );
    }

    for (const h of p.highlights) {
      await client.query(
        `insert into public.project_highlights (project_id, locale, kind, text, display_order)
         values ($1,$2,$3,$4,$5)`,
        [pid, h.locale, h.kind, h.text, h.display_order],
      );
    }

    for (const tr of p.translations) {
      await client.query(
        `insert into public.project_translations
          (project_id, locale, title, summary, role_title, overview_md, test_strategy_md,
           impact_md, seo_title, seo_description, translation_status)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          pid, tr.locale, tr.title, tr.summary, tr.role_title ?? null,
          tr.overview_md ?? null, tr.test_strategy_md ?? null, tr.impact_md ?? null,
          tr.seo_title ?? null, tr.seo_description ?? null, tr.translation_status,
        ],
      );
    }

    for (const s of p.scenarios) {
      const { rows: sr } = await client.query(
        `insert into public.test_scenarios (project_id, code, priority, kind, automated, display_order)
         values ($1,$2,$3,$4,$5,$6) returning id`,
        [pid, s.code, s.priority, s.kind, s.automated, s.display_order],
      );
      for (const loc of ["tr", "en"]) {
        const c = s[loc];
        await client.query(
          `insert into public.test_scenario_translations
            (scenario_id, locale, title, preconditions_md, steps_md, expected_md, notes_md)
           values ($1,$2,$3,$4,$5,$6,$7)`,
          [sr[0].id, loc, c.title, c.preconditions_md ?? null, c.steps_md, c.expected_md, c.notes_md ?? null],
        );
      }
    }

    for (const b of p.bugs) {
      const { rows: br } = await client.query(
        `insert into public.bug_reports (project_id, code, severity, state, environment, display_order)
         values ($1,$2,$3,$4,$5,$6) returning id`,
        [pid, b.code, b.severity, b.state, b.environment, b.display_order],
      );
      for (const loc of ["tr", "en"]) {
        const c = b[loc];
        await client.query(
          `insert into public.bug_report_translations
            (bug_id, locale, title, summary_md, steps_md, expected_md, actual_md, root_cause_md, resolution_md)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [br[0].id, loc, c.title, c.summary_md, c.steps_md, c.expected_md, c.actual_md, c.root_cause_md, c.resolution_md],
        );
      }
    }

    for (const a of p.apiExamples) {
      const { rows: ar } = await client.query(
        `insert into public.api_examples (project_id, code, method, endpoint, request_body, response_status, response_body, display_order)
         values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
        [pid, a.code, a.method, a.endpoint, a.request_body, a.response_status, a.response_body, a.display_order],
      );
      for (const loc of ["tr", "en"]) {
        const c = a[loc];
        await client.query(
          `insert into public.api_example_translations (example_id, locale, title, notes_md) values ($1,$2,$3,$4)`,
          [ar[0].id, loc, c.title, c.notes_md ?? null],
        );
      }
    }

    for (const q of p.sqlExamples) {
      const { rows: qr } = await client.query(
        `insert into public.sql_examples (project_id, code, dialect, query_sql, sample_result, display_order)
         values ($1,$2,$3,$4,$5,$6) returning id`,
        [pid, q.code, q.dialect, q.query_sql, q.sample_result, q.display_order],
      );
      for (const loc of ["tr", "en"]) {
        const c = q[loc];
        await client.query(
          `insert into public.sql_example_translations (example_id, locale, title, explanation_md) values ($1,$2,$3,$4)`,
          [qr[0].id, loc, c.title, c.explanation_md ?? null],
        );
      }
    }
  }
}

async function main() {
  const cleanOnly = process.argv.includes("--clean");
  const client = new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query("begin");
    if (cleanOnly) {
      await clean(client);
      console.log("Seed içeriği temizlendi.");
    } else {
      await seed(client);
      const { rows } = await client.query(
        `select count(*)::int n from public.projects where slug = any($1::citext[])`,
        [SEED_SLUGS],
      );
      console.log(`Seed tamam: ${rows[0].n} proje + çocuk kayıtlar + ${TAXONOMY.length} taksonomi terimi.`);
    }
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    console.error("SEED HATASI (rollback yapıldı):", e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

// Doğrudan çalıştırıldığında seed et; import edildiğinde yalnızca sabitleri ver.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
