# Supabase — QA Portfolio

Bu klasör veritabanı şemasını (migrations) ve Supabase yapılandırmasını içerir.

## Durum (Faz 1)

Şema ve RLS politikaları **yazıldı** ama henüz **hiçbir Supabase projesine
uygulanmadı**. Uygulama şu an placeholder içerikle (`src/content/fixtures.ts`)
çalışır ve Supabase'e bağlanmaz.

## İnsan işlemi gerekli — sonraki adım

Faz 2'nin başlaması için **Human Founder'ın** yapması gerekenler:

1. **Bir Supabase projesi oluştur** (staging). Ücretsiz katman yeterli; 7 günlük
   hareketsizlik duraklatmasına karşı bir keep-alive cron planlanacak
   (`planning/12` RISK-004, OQ-007).
2. Proje panosundan şu değerleri al ve `web/.env.local` dosyasına gir
   (`.env.example`'ı kopyala):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (GİZLİ — yalnızca sunucu)
3. **Sign-up'ı kapat** (Authentication → Providers → Email → "Enable Sign Up" off).
4. Migration'ları uygula (Supabase CLI ile):
   ```
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
5. **`media` adında bir Storage bucket** oluştur (public read). `storage.objects`
   politikaları: okuma herkese açık; INSERT/UPDATE/DELETE yalnızca `is_admin()`.
6. **Admin hesabını sağla** (yalnızca Human Founder):
   - Authentication → Users → yeni kullanıcı ekle (e-posta + parola).
   - SQL Editor'de:
     ```sql
     insert into admin_users (user_id, role, display_name)
     values ('<yeni kullanıcının auth uid'si>', 'owner', 'Site Sahibi');
     ```
7. (Önerilir) Admin hesabı için MFA/TOTP'yi etkinleştir (`planning/14` review R12).

## Migration dosyaları

| Dosya | İçerik |
|---|---|
| `migrations/0001_schema.sql` | Uzantılar, enum'lar, tüm tablolar, indeksler, yabancı anahtarlar |
| `migrations/0002_functions_rls.sql` | `is_admin()`, `project_is_public()`, iletişim hız sınırı tetikleyicisi, her tabloda RLS + okuma/yazma politikaları |

## Prod uygulaması

Prod veritabanına migration uygulamak **ayrı, Human Founder onaylı** bir adımdır
(`CLAUDE.md` §2). Bu klasördeki hiçbir şey prod'a otomatik uygulanmaz.
