// =============================================================================
// rls-test-matrix.mjs - QA Portfolio RLS doğrulama matrisi (STAGING)
//
// AMAÇ (FAZ 4, planning/11 §11.2, planning/10): gerçek Supabase staging
// veritabanında Row Level Security kurallarının beklendiği gibi davrandığını
// kanıtlar. İki katman:
//   A) CANLI PostgREST (anon publishable anahtar) - uygulamanın gördüğü yol.
//   B) DB rol simülasyonu (pg, SET ROLE) - anon / admin / yabancı authenticated.
//
// ÖN KOŞUL: `node supabase/seed/demo-seed.mjs` çalıştırılmış olmalı.
// KULLANIM (projects/qa-portfolio/web/ içinden):
//   node supabase/scripts/rls-test-matrix.mjs
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

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!URL_ || !ANON || !env.SUPABASE_DB_URL) {
  console.error("HATA: .env.local eksik (URL / PUBLISHABLE_KEY / SUPABASE_DB_URL).");
  process.exit(1);
}

let pass = 0;
let fail = 0;
const check = (ok, label, detail = "") => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  — " + detail : ""}`);
};

// --- A) CANLI PostgREST (anon) ---------------------------------------------
async function rest(pathAndQuery) {
  const res = await fetch(`${URL_}/rest/v1/${pathAndQuery}`, {
    headers: { apikey: ANON, authorization: `Bearer ${ANON}` },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function liveLayer() {
  console.log("\n=== A) Canlı PostgREST (anon publishable anahtar) ===");

  const all = await rest("projects?select=slug,status,visible,classification,featured,supported");
  const slugs = Array.isArray(all.body) ? all.body.map((r) => r.slug) : [];

  check(slugs.includes("demo-checkout-regression-suite"), "Yayınlanmış proje anon'a görünür");
  check(
    !slugs.includes("seed-draft-project"),
    "Taslak proje anon'a GÖRÜNMEZ",
    slugs.includes("seed-draft-project") ? "SIZDI!" : "gizli",
  );
  check(
    !slugs.includes("seed-hidden-project"),
    "Gizli (visible=false) proje anon'a GÖRÜNMEZ",
    slugs.includes("seed-hidden-project") ? "SIZDI!" : "gizli",
  );
  check(
    Array.isArray(all.body) && all.body.every((r) => r.status === "published" && r.visible === true),
    "Anon'a dönen HER satır published + visible",
  );

  const featured = await rest("projects?select=slug&featured=eq.true");
  check(
    Array.isArray(featured.body) && featured.body.some((r) => r.slug === "demo-checkout-regression-suite"),
    "Öne çıkan (featured) proje filtrelenebilir ve görünür",
  );

  const supported = await rest("projects?select=slug&supported=eq.true");
  check(
    Array.isArray(supported.body) && supported.body.some((r) => r.slug === "demo-public-api-contract-testing"),
    "Destek verilen (supported) proje görünür",
  );

  const bySlug = await rest(
    "projects?select=slug,project_translations(locale,title,translation_status)&slug=eq.demo-checkout-regression-suite",
  );
  check(
    Array.isArray(bySlug.body) && bySlug.body.length === 1,
    "Slug ile proje detayı (anon) döner",
  );
  const trLocales = bySlug.body?.[0]?.project_translations?.map((t) => t.locale).sort() ?? [];
  check(
    trLocales.join(",") === "en,tr",
    "TR + EN çeviri satırları anon'a döner (uygulama translation_status'ü kendi filtreler)",
    `dönen diller: ${trLocales.join(",") || "yok"}`,
  );

  const draftBySlug = await rest("projects?select=slug&slug=eq.seed-draft-project");
  check(
    Array.isArray(draftBySlug.body) && draftBySlug.body.length === 0,
    "Taslak projeye slug ile doğrudan erişim de reddedilir",
  );

  const adminUsers = await rest("admin_users?select=user_id");
  check(
    Array.isArray(adminUsers.body) && adminUsers.body.length === 0,
    "admin_users allow-list'i anon'a KAPALI",
    `dönen satır: ${Array.isArray(adminUsers.body) ? adminUsers.body.length : adminUsers.status}`,
  );

  const auditInsert = await fetch(`${URL_}/rest/v1/content_audit`, {
    method: "POST",
    headers: { apikey: ANON, authorization: `Bearer ${ANON}`, "content-type": "application/json" },
    body: JSON.stringify({ actor_name: "anon", entity_type: "project", entity_id: "x", action: "create" }),
  });
  check(auditInsert.status === 401 || auditInsert.status === 403, "content_audit'e anon INSERT reddedilir", `HTTP ${auditInsert.status}`);

  const contactInsert = await fetch(`${URL_}/rest/v1/contact_messages`, {
    method: "POST",
    headers: { apikey: ANON, authorization: `Bearer ${ANON}`, "content-type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ name: "RLS Test", email: "rls@example.com", body: "matris testi", locale: "en" }),
  });
  check(contactInsert.status === 201 || contactInsert.status === 200, "İletişim formu anon INSERT'e açık (yalnızca INSERT)", `HTTP ${contactInsert.status}`);

  const contactRead = await rest("contact_messages?select=id");
  check(
    Array.isArray(contactRead.body) && contactRead.body.length === 0,
    "İletişim mesajları anon OKUMAYA kapalı",
  );
}

// --- B) DB rol simülasyonu -------------------------------------------------
async function simLayer() {
  console.log("\n=== B) DB rol simülasyonu (pg, SET ROLE) ===");
  const client = new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const { rows: admins } = await client.query(`select user_id from public.admin_users limit 1`);
  const ADMIN_UID = admins[0]?.user_id;
  const STRANGER_UID = "00000000-0000-4000-8000-0000000000ff";

  const asRole = async (label, role, uid, sql) => {
    await client.query("begin");
    try {
      await client.query(`set local role ${role}`);
      if (uid) {
        await client.query(
          `select set_config('request.jwt.claims', json_build_object('sub',$1::text,'role',$2::text)::text, true)`,
          [uid, role],
        );
      }
      const r = await client.query(sql);
      await client.query("rollback");
      return r;
    } catch (e) {
      await client.query("rollback");
      return { error: e.message };
    }
  };

  const countVisible = `select count(*)::int n from public.projects`;
  const anonCount = (await asRole("anon", "anon", null, countVisible)).rows[0].n;
  const strangerCount = (await asRole("stranger", "authenticated", STRANGER_UID, countVisible)).rows[0].n;
  const adminCount = ADMIN_UID
    ? (await asRole("admin", "authenticated", ADMIN_UID, countVisible)).rows[0].n
    : null;
  const { rows: totalRows } = await client.query(countVisible);
  const total = totalRows[0].n;

  check(anonCount < total, "anon yalnızca yayınlanmış+görünür projeleri sayar", `anon=${anonCount} / toplam=${total}`);
  check(strangerCount === anonCount, "yabancı authenticated kullanıcı = anon (oturum açmak yetki vermez)", `stranger=${strangerCount}`);
  if (ADMIN_UID) {
    check(adminCount === total, "admin TÜM projeleri görür (taslak + gizli dahil)", `admin=${adminCount} / toplam=${total}`);
  } else {
    check(false, "admin_users satırı bulunamadı - admin simülasyonu atlandı");
  }

  // Yazma: anon / yabancı projects INSERT reddedilir, admin izinli.
  const insSql = `insert into public.projects (slug, classification, status) values ('rls-sim-x','personal','draft')`;
  check(Boolean((await asRole("anon", "anon", null, insSql)).error), "anon projects INSERT reddedilir");
  check(
    Boolean((await asRole("stranger", "authenticated", STRANGER_UID, insSql)).error),
    "yabancı authenticated projects INSERT reddedilir",
  );
  if (ADMIN_UID) {
    const adminIns = await asRole("admin", "authenticated", ADMIN_UID, insSql);
    check(!adminIns.error, "admin projects INSERT izinli (rollback)", adminIns.error ?? "ok");
  }

  // content_audit: admin INSERT + SELECT var; UPDATE/DELETE politikası yok (append-only).
  if (ADMIN_UID) {
    const auditIns = await asRole(
      "admin",
      "authenticated",
      ADMIN_UID,
      `insert into public.content_audit (actor_name, entity_type, entity_id, action) values ('owner','project','x','create')`,
    );
    check(!auditIns.error, "admin content_audit INSERT izinli", auditIns.error ?? "ok");
    const auditDel = await asRole(
      "admin",
      "authenticated",
      ADMIN_UID,
      `delete from public.content_audit where entity_id = 'x'`,
    );
    check(Boolean(auditDel.error) || auditDel.rowCount === 0, "content_audit DELETE reddedilir/etkisiz (append-only)");
  }

  // RLS her tabloda açık mı? (regresyon)
  const { rows: noRls } = await client.query(
    `select count(*)::int n from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
     where ns.nspname='public' and c.relkind='r' and c.relrowsecurity=false`,
  );
  check(noRls[0].n === 0, "public şemasındaki HER tabloda RLS açık", `RLS kapalı tablo: ${noRls[0].n}`);

  await client.end();
}

async function cleanup() {
  // Canlı katman contact_messages'a bir test satırı ekler (RLS INSERT testi);
  // hız sınırı tetikleyicisini yormamak için postgres bağlantısıyla siliyoruz.
  const client = new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query(`delete from public.contact_messages where email = 'rls@example.com'`);
  await client.end();
}

async function main() {
  await liveLayer();
  await simLayer();
  await cleanup();
  console.log(`\nSonuç: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("FATAL", e.message);
  process.exit(1);
});
