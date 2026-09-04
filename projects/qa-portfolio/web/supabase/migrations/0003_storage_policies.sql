-- =============================================================================
-- 0003_storage_policies.sql - 'media' Storage bucket RLS politikaları
-- Kaynak: projects/qa-portfolio/planning/10-security-plan.md §10.6
--         projects/qa-portfolio/web/supabase/migrations/0002_functions_rls.sql
--         (STORAGE bölümü - politikalar bilinçli olarak ayrı dosyaya bırakılmıştı)
--
-- İŞ KURALI: 'media' bucket'ı public OKUNUR; dosya YÜKLEME / GÜNCELLEME / SİLME
-- işlemleri YALNIZCA admin tarafından yapılabilir. Yetki kararı tek doğruluk
-- kaynağı olan public.is_admin() üzerinden verilir (ADR-0006) - storage'ın kendi
-- 'owner' sütunu (yükleyen kullanıcının uid'i) KULLANILMAZ; "admin/owner" burada
-- "admin_users allow-list'inde kaydı olan kullanıcı" demektir (role = owner|admin).
--
-- GÜVENLİK: RLS bypass edilmez. storage.objects üzerinde RLS Supabase tarafından
-- zaten AÇIK (varsayılan) - bu dosya onu değiştirmez, yalnızca politika tanımlar.
-- storage şema tablolarının YAPISI değiştirilmez; sadece storage.objects RLS
-- politikaları yönetilir. service_role anahtarı yalnızca sunucu tarafı bakım
-- işleri içindir ve tarayıcı paketine asla girmez (src/lib/supabase/admin.ts).
--
-- NOT: 'media' bucket'ının kendisi (public bayrağı, 5 MB boyut limiti, MIME
-- allowlist) Supabase panelinden oluşturulur - bkz. supabase/README.md.
-- =============================================================================

-- Tekrar çalıştırmaya dayanıklı olması için önce düşür (idempotent).
drop policy if exists "media_public_read"  on storage.objects;
drop policy if exists "media_admin_insert" on storage.objects;
drop policy if exists "media_admin_update" on storage.objects;
drop policy if exists "media_admin_delete" on storage.objects;

-- -----------------------------------------------------------------------------
-- OKUMA: 'media' bucket'ındaki her nesne herkese açık (anon + authenticated).
-- Bucket zaten public olduğundan CDN/public uç noktası RLS'siz servis eder;
-- bu politika list/download API'leri üzerinden de okunur kılar ve niyeti
-- katalogda açıkça görünür yapar (review R10: 'media' TABLOSU kısıtlı kalır,
-- bucket ise §10.6 kararıyla public servis edilir).
-- -----------------------------------------------------------------------------
create policy "media_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'media');

-- -----------------------------------------------------------------------------
-- YÜKLEME (INSERT): yalnızca admin. anon rolü hiçbir zaman admin olamaz
-- (is_admin() auth.uid() -> admin_users allow-list'e bakar, anon'da auth.uid()
-- NULL'dır), dolayısıyla anon yüklemesi otomatik reddedilir. Politika yalnızca
-- authenticated rolüne verildiği için anon'un eşleşen politikası da yoktur.
-- -----------------------------------------------------------------------------
create policy "media_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and public.is_admin());

-- -----------------------------------------------------------------------------
-- GÜNCELLEME (UPDATE): yalnızca admin. Hem mevcut satır (using) hem de yeni
-- hali (with check) admin şartına bağlıdır - admin olmayan bir kullanıcı başka
-- bir bucket'a taşıyarak kaçış yapamaz.
-- -----------------------------------------------------------------------------
create policy "media_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and public.is_admin())
  with check (bucket_id = 'media' and public.is_admin());

-- -----------------------------------------------------------------------------
-- SİLME (DELETE): yalnızca admin.
-- -----------------------------------------------------------------------------
create policy "media_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and public.is_admin());
