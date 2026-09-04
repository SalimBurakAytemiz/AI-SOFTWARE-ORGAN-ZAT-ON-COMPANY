# Supabase — QA Portfolio

Bu klasör veritabanı şemasını (migrations) ve Supabase yapılandırmasını içerir.

## Durum

Şema ve RLS politikaları **yazıldı** ve **DEVELOPMENT / STAGING** Supabase
projesine **uygulandı** (2026-09-03, `supabase db push --db-url`, migration
geçmişi `supabase_migrations.schema_migrations` içinde: `0001`, `0002`).
33 tablo, 33'ünde RLS etkin, 66 policy, 4 uygulama fonksiyonu.

**`0003_storage_policies.sql`** (2026-09-04) — `media` Storage bucket'ı için
`storage.objects` RLS politikaları da STAGING'e uygulandı (tek transaction,
migration geçmişine `0003` olarak yazıldı): `media_public_read` (anon+auth
SELECT), `media_admin_insert` / `media_admin_update` / `media_admin_delete`
(yalnızca `public.is_admin()`). storage şema tablolarının yapısı
değiştirilmedi; yalnızca politika eklendi.

Uygulama **hâlâ** placeholder içerikle (`src/content/fixtures.ts`) çalışır:
`NEXT_PUBLIC_CONTENT_SOURCE` `fixtures` olduğu sürece Supabase'e sorgu atılmaz.

**Faz 4 (devam ediyor):** gerçek OKUMA katmanı yazıldı
(`SupabaseContentRepository`, tipli PostgREST sorguları, çerezsiz anon istemci
`src/lib/supabase/public.ts`). Admin girişi gerçek Supabase Auth'a bağlandı
(e-posta + parola, MFA yok, genel hata mesajı, IP hız sınırı, allow-list yetki).
Bayrak **yine de `fixtures`**: yazma yolu (CMS CRUD, publish RPC, çeviri
editörleri, medya yükleme, audit) bitip uçtan uca doğrulanana kadar `supabase`
yapılmayacak.

### Staging'e DEMO içerik yükleme ve doğrulama scriptleri

`web/` klasöründen (`pg` devDependency + `.env.local` gerekir):

```
node supabase/seed/demo-seed.mjs            # DEMO/SANITIZED içeriği yükler (idempotent)
node supabase/scripts/rls-test-matrix.mjs   # RLS görünürlük matrisi (22 kontrol)
node supabase/scripts/content-parity-check.mjs  # okuma yolu / select doğrulama (14 kontrol)
node supabase/scripts/verify-storage-policies.mjs  # media bucket RLS (anon; admin için ADMIN_EMAIL/PASSWORD)
```

Bu proje **production değildir**. Prod için ayrı bir Supabase projesi açılacak;
prod'a migration uygulamak **ayrı, Human Founder onaylı** bir adımdır
(`CLAUDE.md` §2).

## Human Founder işlemleri — durum

Bunlar bilinçli olarak otomatikleştirilmedi (erişim yükseltme / güvenlik).

**Tamamlandı (2026-09-03):**

- ✅ **DEVELOPMENT / STAGING Supabase projesi açıldı** ve migration'lar uygulandı.
- ✅ **Public sign-up KAPATILDI** (Authentication → Providers → Email → "Enable
  Sign Up" off). Panelden manuel yapıldı. (`config.toml`'daki
  `enable_signup = false` yalnızca yerel CLI içindir; asıl kontrol paneldedir.)
- ✅ **Admin Auth kullanıcısı oluşturuldu** (Founder tarafından, e-posta + parola,
  e-posta doğrulanmış) ve **`admin_users` allow-list kaydı yapıldı**:
  `role = owner`, `display_name = 'Site Sahibi'`. `is_admin()` bu kullanıcı için
  `true` döndüğü doğrulandı.

**Bekleyen manuel adımlar:**

1. **Storage bucket adı düzeltmesi.** Panelde bucket **`Media`** (büyük M) olarak
   oluşturulmuş; proje her yerde küçük harf **`media`** bekliyor (`media` tablosu
   `bucket` varsayılanı, `planning/10` §10.6, `0003_storage_policies.sql`). Bucket
   boş olduğu için kayıpsız düzeltilir:
   Storage → `Media` → **Delete bucket** → **New bucket**, ad tam `media`,
   **Public bucket** açık, **File size limit** `5 MB`, **Allowed MIME types**
   `image/png, image/jpeg, image/webp, image/avif`.
   RLS politikaları (`0003`) zaten `bucket_id = 'media'` için uygulandı; bucket
   `media` olur olmaz devreye girer.
2. Keep-alive: 7 günlük hareketsizlik duraklatmasına karşı bir cron planlanacak
   (`planning/12` RISK-004, OQ-007).

**MFA/TOTP:** Founder kararıyla **kullanılmıyor** — zorunlu değil, launch blocker
değil (decision-log ADR-0021, OQ-004 = "hayır"). İleride opsiyonel güvenlik
geliştirmesi olarak eklenebilir. Admin erişimi şu an: e-posta + güçlü parola +
`admin_users` allow-list + RLS + `is_admin()` yetki modeli + login hız sınırı +
append-only audit + kısa oturum.

## TypeScript tiplerini yeniden üretmek

Şema değişince (`db push` sonrası):

```
npx supabase gen types typescript --db-url "$SUPABASE_DB_URL" > src/lib/db/database.generated.ts
```

`--linked` yerine `--db-url` kullanılır (`--linked` bir access token ister).
Uygulama kodu tipleri `src/lib/db/database.types.ts`'ten alır (üretilen dosyayı
sarar + kısa takma adları ekler); üretilen `database.generated.ts` elle
düzenlenmez.

## Migration dosyaları

| Dosya | İçerik |
|---|---|
| `migrations/0001_schema.sql` | Uzantılar, enum'lar, tüm tablolar, indeksler, yabancı anahtarlar |
| `migrations/0002_functions_rls.sql` | `is_admin()`, `project_is_public()`, iletişim hız sınırı tetikleyicisi, her tabloda RLS + okuma/yazma politikaları |
| `migrations/0003_storage_policies.sql` | `media` Storage bucket'ı için `storage.objects` RLS politikaları (public read + admin-only write/update/delete) |

## Prod uygulaması

Prod veritabanına migration uygulamak **ayrı, Human Founder onaylı** bir adımdır
(`CLAUDE.md` §2). Bu klasördeki hiçbir şey prod'a otomatik uygulanmaz.
