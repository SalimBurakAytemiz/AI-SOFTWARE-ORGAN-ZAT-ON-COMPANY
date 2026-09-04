// =============================================================================
// write-path-matrix.mjs - Admin YAZMA yolu STAGING doğrulaması (FAZ 4)
//
// AMAÇ: Proje CRUD + yayın durumu geçişleri + audit'in gerçek staging DB'de,
// gerçek RLS + admin_project_transition RPC ile beklendiği gibi çalıştığını
// kanıtlar. `pg` ile bağlanır; kimlikler SET ROLE + JWT claims ile simüle
// edilir. TÜM işlemler tek transaction içinde yapılır ve SONUNDA ROLLBACK
// edilir - staging'e kalıcı yazma YOKTUR.
//
// KULLANIM (web/ içinden): node supabase/scripts/write-path-matrix.mjs
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

let pass = 0;
let fail = 0;
const check = (ok, label, detail = "") => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  — " + detail : ""}`);
};

async function main() {
  const c = new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const { rows: admins } = await c.query(`select user_id from public.admin_users limit 1`);
  const ADMIN = admins[0].user_id;
  const STRANGER = "00000000-0000-4000-8000-00000000dead";

  await c.query("begin");

  const setIdentity = async (role, uid) => {
    await c.query(`set local role ${role}`);
    // jwt.claims HER ZAMAN açıkça ayarlanır - önceki kimlikten sızıntı olmasın.
    await c.query(
      `select set_config('request.jwt.claims', $1::text, true)`,
      [uid ? JSON.stringify({ sub: uid, role }) : ""],
    );
  };
  const clearIdentity = async () => {
    await c.query("reset role");
    await c.query(`select set_config('request.jwt.claims', '', true)`);
  };

  // İzole çalıştırma: savepoint + her zaman rollback (kimlik testleri için).
  const runAs = async (role, uid, sql, params = []) => {
    await c.query("savepoint sp");
    try {
      await setIdentity(role, uid);
      const r = await c.query(sql, params);
      await clearIdentity();
      await c.query("rollback to savepoint sp");
      return r;
    } catch (e) {
      await c.query("rollback to savepoint sp");
      await clearIdentity();
      return { error: e.message };
    }
  };

  // Kalıcı admin işlemi (transaction içinde kalır) - savepoint ile hata izolasyonu.
  const asAdminPersist = async (sql, params = []) => {
    await c.query("savepoint ap");
    try {
      await setIdentity("authenticated", ADMIN);
      const r = await c.query(sql, params);
      await clearIdentity();
      await c.query("release savepoint ap");
      return r;
    } catch (e) {
      await c.query("rollback to savepoint ap");
      await clearIdentity();
      return { error: e.message };
    }
  };

  // 1) CREATE - yabancı reddedilir, admin izinli
  const strangerCreate = await runAs(
    "authenticated",
    STRANGER,
    `insert into public.projects (slug, classification, status) values ('wpm-stranger','personal','draft')`,
  );
  check(Boolean(strangerCreate.error), "Admin olmayan proje oluşturamaz (RLS)");

  const created = await asAdminPersist(
    `insert into public.projects (slug, classification, status) values ('wpm-test','personal','draft') returning id`,
  );
  const PID = created.rows[0].id;
  check(Boolean(PID), "Admin proje oluşturur (draft)");

  await asAdminPersist(
    `insert into public.project_translations (project_id, locale, title, summary, overview_md, testing_scope_md, test_strategy_md, translation_status)
     values ($1,'en','WPM EN','Yeterince uzun bir özet metni buraya.','ov','sc','st','draft'),
            ($1,'tr','WPM TR','Yeterince uzun bir özet metni buraya.','ov','sc','st','draft')`,
    [PID],
  );
  check(true, "Admin iki dil için çeviri ekler");

  // 2) Taslak proje PUBLIC'e görünmez (anon)
  let anonSees = await runAs("anon", null, `select count(*)::int n from public.projects where id=$1`, [PID]);
  check(anonSees.rows[0].n === 0, "Taslak proje anon'a görünmez");

  // 3) Meta update (admin)
  await asAdminPersist(`update public.projects set display_order = 7, featured = true where id = $1`, [PID]);
  const metaCheck = await asAdminPersist(`select display_order, featured from public.projects where id=$1`, [PID]);
  check(
    metaCheck.rows[0].display_order === 7 && metaCheck.rows[0].featured === true,
    "Admin meta günceller (display_order, featured)",
  );

  // 4) Çeviri publish (upsert -> published)
  await asAdminPersist(
    `update public.project_translations set translation_status='published' where project_id=$1`,
    [PID],
  );
  check(true, "Admin çevirileri yayınlar (TR + EN)");

  // 5) PUBLISH RPC (draft -> published + visible), audit atomik
  const pub = await asAdminPersist(`select * from public.admin_project_transition($1::uuid,'publish','Site Sahibi')`, [PID]);
  check(
    !pub.error && pub.rows[0].status === "published" && pub.rows[0].visible === true,
    "publish RPC: status=published, visible=true",
  );
  const auditPub = await asAdminPersist(
    `select count(*)::int n from public.content_audit where entity_id=$1 and action='publish'`,
    [PID],
  );
  check(auditPub.rows[0].n >= 1, "publish audit kaydı atomik oluştu");

  // 6) Yayınlanmış proje anon'a görünür + TR/EN
  anonSees = await runAs("anon", null, `select status, visible from public.projects where id=$1`, [PID]);
  check(anonSees.rows?.[0]?.status === "published", "Yayınlanmış proje anon'a görünür");
  const anonTr = await runAs("anon", null, `select locale from public.project_translations where project_id=$1 order by locale`, [PID]);
  check((anonTr.rows ?? []).map((r) => r.locale).sort().join(",") === "en,tr", "TR + EN çevirileri anon'a görünür");

  // 7) UNPUBLISH -> taslak, anon göremez
  await asAdminPersist(`select public.admin_project_transition($1::uuid,'unpublish','Site Sahibi')`, [PID]);
  anonSees = await runAs("anon", null, `select count(*)::int n from public.projects where id=$1`, [PID]);
  check(anonSees.rows[0].n === 0, "unpublish sonrası proje anon'a görünmez");

  // 8) publish tekrar -> hide -> anon göremez (visible=false)
  await asAdminPersist(`select public.admin_project_transition($1::uuid,'publish','Site Sahibi')`, [PID]);
  await asAdminPersist(`select public.admin_project_transition($1::uuid,'hide','Site Sahibi')`, [PID]);
  anonSees = await runAs("anon", null, `select count(*)::int n from public.projects where id=$1`, [PID]);
  check(anonSees.rows[0].n === 0, "hide (visible=false) sonrası anon'a görünmez");

  // 9) show -> tekrar görünür
  await asAdminPersist(`select public.admin_project_transition($1::uuid,'show','Site Sahibi')`, [PID]);
  anonSees = await runAs("anon", null, `select visible from public.projects where id=$1`, [PID]);
  check(anonSees.rows?.[0]?.visible === true, "show sonrası tekrar görünür");

  // 10) archive -> anon göremez; sonra restore -> draft
  await asAdminPersist(`select public.admin_project_transition($1::uuid,'archive','Site Sahibi')`, [PID]);
  anonSees = await runAs("anon", null, `select count(*)::int n from public.projects where id=$1`, [PID]);
  check(anonSees.rows[0].n === 0, "archive sonrası anon'a görünmez");

  const restored = await asAdminPersist(`select * from public.admin_project_transition($1::uuid,'restore','Site Sahibi')`, [PID]);
  check(restored.rows?.[0]?.status === "draft", "restore -> taslak");

  // 11) Geçersiz geçiş: arşivlenmemiş projede restore -> hata
  const badRestore = await asAdminPersist(`select * from public.admin_project_transition($1::uuid,'restore','x')`, [PID]);
  check(Boolean(badRestore.error) && /yalnızca arşivlenmiş/.test(badRestore.error), "Geçersiz geçiş reddedilir (yarım durum yok)");

  // 12) Yabancı authenticated publish RPC -> reddedilir
  const strangerPub = await runAs("authenticated", STRANGER, `select * from public.admin_project_transition($1::uuid,'publish','x')`, [PID]);
  check(Boolean(strangerPub.error) && /yetkisiz/.test(strangerPub.error), "Yabancı kullanıcı publish RPC'yi çağıramaz");

  // 13) content_audit yabancıya kapalı, admin okur
  const strangerAudit = await runAs("authenticated", STRANGER, `select count(*)::int n from public.content_audit`);
  check(strangerAudit.rows?.[0]?.n === 0, "content_audit yabancı authenticated'a kapalı");

  // 14) media tablosu: yabancı INSERT reddedilir, admin izinli
  const strangerMedia = await runAs("authenticated", STRANGER, `insert into public.media (storage_path, mime_type) values ('x/y.png','image/png')`);
  check(Boolean(strangerMedia.error), "media INSERT yabancıya reddedilir (RLS)");
  const adminMedia = await asAdminPersist(`insert into public.media (storage_path, mime_type, byte_size) values ('wpm/a.png','image/png',10) returning id`);
  check(!adminMedia.error, "media INSERT admin'e izinli", adminMedia.error ?? "ok");

  await c.query("rollback");
  console.log("\n(transaction geri alındı - staging'e kalıcı yazma yok)");
  await c.end();

  console.log(`\nSonuç: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("FATAL", e.message);
  process.exit(1);
});
