// =============================================================================
// verify-storage-policies.mjs - 'media' Storage bucket güvenlik doğrulaması
//
// AMAÇ: 0003_storage_policies.sql uygulandıktan ve 'media' bucket'ı panelde
// oluşturulduktan sonra, RLS politikalarının gerçekten beklendiği gibi
// davrandığını CANLI olarak (Storage REST API üzerinden) doğrular.
//
// Neden ayrı bir script: bu bir güvenlik kontrolüdür, uygulama kodu değildir;
// harici bağımlılık kullanmaz (yalnızca global fetch). Admin testleri için
// admin e-posta/parola verilirse çalışır, verilmezse atlanır (parola asla
// koda/loga yazılmaz).
//
// KULLANIM (projects/qa-portfolio/web/ içinden):
//   node supabase/scripts/verify-storage-policies.mjs
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... node supabase/scripts/verify-storage-policies.mjs
//
// Kimlik bilgileri gitignored .env.local'den okunur.
// =============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webDir = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const env = fs.readFileSync(path.join(webDir, '.env.local'), 'utf8')
  .split('\n')
  .reduce((acc, line) => {
    const m = line.match(/^([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m) acc[m[1]] = m[2];
    return acc;
  }, {});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const BUCKET = 'media';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('HATA: .env.local içinde NEXT_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY yok.');
  process.exit(1);
}

let pass = 0;
let fail = 0;
const check = (ok, label, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
  if (ok) pass++;
  else fail++;
};

const obj = (token, folder) =>
  `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${folder}/verify-${Date.now()}.txt`;
const headers = (token) => ({
  apikey: ANON_KEY,
  authorization: `Bearer ${token}`,
  'content-type': 'text/plain',
});

// --- Admin oturumu (opsiyonel) ---
async function signInAdmin() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!res.ok) {
    console.log(`UYARI: admin girişi başarısız (HTTP ${res.status}) — admin testleri atlanıyor.`);
    return null;
  }
  return (await res.json()).access_token;
}

// Supabase Storage API hataları dış HTTP 400 ile sarıp gövdede gerçek nedeni
// verir: { statusCode, error, message, code }. RLS reddi -> code "AccessDenied"
// ve message "...row-level security..."; "yok" -> "NoSuchKey" / "NoSuchBucket".
async function body(res) {
  try { return await res.json(); } catch { return {}; }
}
const isRlsDenied = (b) =>
  b.code === 'AccessDenied' || /row-level security/i.test(b.message || '');
const isNotFound = (b) =>
  b.code === 'NoSuchKey' || b.code === 'NoSuchBucket' || /not found/i.test(b.message || '');

async function main() {
  console.log(`Hedef: ${new URL(SUPABASE_URL).host} · bucket "${BUCKET}"\n`);

  // 1) Bucket mevcut mu? Var olmayan bir dosyayı istediğimizde "NoSuchKey"
  //    (bucket var) mı yoksa "NoSuchBucket" mu döndüğüne bakarız.
  const probe = await body(await fetch(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/__probe__.png`));
  check(probe.code === 'NoSuchKey' || probe.code === 'NoSuchBucket' ? probe.code === 'NoSuchKey' : true,
    `Bucket "${BUCKET}" mevcut`, probe.code || 'yanıt alındı');

  // 2) Public read: var olmayan dosya "NoSuchKey" vermeli — RLS reddi (AccessDenied) DEĞİL.
  const rd = await body(await fetch(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/does-not-exist.png`));
  check(isNotFound(rd) && !isRlsDenied(rd),
    'Public read açık (anon SELECT reddedilmiyor)', rd.code || rd.message);

  // 3) Anonim upload reddediliyor mu? -> RLS "AccessDenied" beklenir.
  const anonUp = await body(await fetch(obj(ANON_KEY, 'anon-probe'), {
    method: 'POST', headers: headers(ANON_KEY), body: 'should-fail',
  }));
  check(isRlsDenied(anonUp), 'Anonim upload reddedildi (RLS)', anonUp.message || anonUp.code);

  // 4) Anonim update (PUT) reddediliyor mu? -> RLS "AccessDenied" beklenir.
  //    (DELETE, dosya yokken "NoSuchKey" döndüğü için update ile test edilir.)
  const anonUpd = await body(await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/whatever.txt`, {
    method: 'PUT', headers: headers(ANON_KEY), body: 'should-fail',
  }));
  check(isRlsDenied(anonUpd), 'Anonim update reddedildi (RLS)', anonUpd.message || anonUpd.code);

  // --- Admin testleri (kimlik verilirse) ---
  const adminToken = await signInAdmin();
  if (!adminToken) {
    console.log('\nAdmin testleri atlandı (ADMIN_EMAIL / ADMIN_PASSWORD verilmedi).');
  } else {
    const key = obj(adminToken, 'admin-probe');
    const relPath = key.split(`/object/${BUCKET}/`)[1];

    // 5) Admin upload
    const up = await fetch(key, { method: 'POST', headers: headers(adminToken), body: 'admin-ok' });
    check(up.ok, 'Admin upload yetkili', `HTTP ${up.status} ${up.ok ? '' : JSON.stringify(await body(up))}`);

    // 6) Admin update (upsert bayrağı ile aynı yolu yeniden yazar)
    const upd = await fetch(key, {
      method: 'POST',
      headers: { ...headers(adminToken), 'x-upsert': 'true' },
      body: 'admin-updated',
    });
    check(upd.ok, 'Admin update yetkili', `HTTP ${upd.status} ${upd.ok ? '' : JSON.stringify(await body(upd))}`);

    // 7) Admin delete
    const del = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${relPath}`, {
      method: 'DELETE', headers: { apikey: ANON_KEY, authorization: `Bearer ${adminToken}` },
    });
    check(del.ok, 'Admin delete yetkili', `HTTP ${del.status} ${del.ok ? '' : JSON.stringify(await body(del))}`);
  }

  console.log(`\nSonuç: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
