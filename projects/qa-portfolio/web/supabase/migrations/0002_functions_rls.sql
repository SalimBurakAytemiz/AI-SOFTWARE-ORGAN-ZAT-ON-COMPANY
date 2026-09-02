-- =============================================================================
-- 0002_functions_rls.sql - is_admin(), yayın görünümü, tetikleyiciler ve RLS
-- Kaynak: projects/qa-portfolio/planning/02-database-schema.md §2.10
--         projects/qa-portfolio/planning/10-security-plan.md §10.4
--
-- İLKE: RLS her tabloda AÇIK, varsayılan RED. Hiçbir tablo "uygulama zaten
-- sorgulamaz" varsayımına güvenmez ("/admin gizli" ≠ "/admin güvenli").
-- =============================================================================

-- -----------------------------------------------------------------------------
-- is_admin(): tek yetki doğruluk kaynağı (ADR-0006).
-- SECURITY DEFINER + sabit search_path: politika içinden güvenle çağrılır.
-- -----------------------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

-- -----------------------------------------------------------------------------
-- Bir projenin şu an public'te görünür olup olmadığı - TEK KURAL (review R8).
-- Uygulama tarafındaki karşılığı: src/lib/content/publication.ts
-- -----------------------------------------------------------------------------
create or replace function public.project_is_public(p_id uuid) returns boolean
language sql stable as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_id and p.status = 'published' and p.visible = true
  );
$$;

-- -----------------------------------------------------------------------------
-- İletişim formu: DB seviyesinde hız sınırı yedeği (planning/10 §10.4, §10.12).
-- Uygulama katmanı bypass edilse bile saatte ip_hash başına en fazla 5 kayıt.
-- -----------------------------------------------------------------------------
create or replace function public.contact_rate_guard() returns trigger
language plpgsql as $$
declare recent int;
begin
  if new.ip_hash is not null then
    select count(*) into recent
    from public.contact_messages
    where ip_hash = new.ip_hash and created_at > now() - interval '1 hour';
    if recent >= 5 then
      raise exception 'contact rate limit exceeded';
    end if;
  end if;
  return new;
end;
$$;
create trigger contact_rate_guard_trg before insert on public.contact_messages
  for each row execute function public.contact_rate_guard();

-- =============================================================================
-- RLS'İ HER TABLODA AÇ
-- =============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'admin_users','profile','profile_translations','site_settings','site_settings_translations',
    'social_links','projects','project_translations','project_highlights','project_media',
    'test_scenarios','test_scenario_translations','bug_reports','bug_report_translations',
    'api_examples','api_example_translations','sql_examples','sql_example_translations',
    'taxonomy_terms','project_taxonomy','experience','experience_translations','skill_categories',
    'skills','services','service_translations','education','education_translations','certifications',
    'media','media_translations','contact_messages','content_audit'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end $$;

-- =============================================================================
-- OKUMA POLİTİKALARI (public içerik)
-- =============================================================================

-- Yayın durumu KENDİ ÜZERİNDE olan taban tablolar:
create policy projects_read on projects for select to anon, authenticated
  using (status = 'published' and visible = true or public.is_admin());

-- Yayın durumu OLMAYAN ama her zaman public olan referans tablolar
-- (admin dışı yazma yok; okuma serbest):
create policy social_links_read on social_links for select to anon, authenticated
  using (visible = true or public.is_admin());
create policy taxonomy_read on taxonomy_terms for select to anon, authenticated
  using (visible = true or public.is_admin());
create policy skill_categories_read on skill_categories for select to anon, authenticated
  using (visible = true or public.is_admin());
create policy skills_read on skills for select to anon, authenticated
  using (visible = true or public.is_admin());
create policy services_read on services for select to anon, authenticated
  using (visible = true or public.is_admin());
create policy service_tr_read on service_translations for select to anon, authenticated
  using (exists (select 1 from services s where s.id = service_id and s.visible) or public.is_admin());
create policy experience_read on experience for select to anon, authenticated
  using (visible = true or public.is_admin());
create policy experience_tr_read on experience_translations for select to anon, authenticated
  using (exists (select 1 from experience e where e.id = experience_id and e.visible) or public.is_admin());
create policy education_read on education for select to anon, authenticated
  using (visible = true or public.is_admin());
create policy education_tr_read on education_translations for select to anon, authenticated
  using (exists (select 1 from education e where e.id = education_id and e.visible) or public.is_admin());
create policy certifications_read on certifications for select to anon, authenticated
  using (visible = true or public.is_admin());

-- Singleton'lar: her zaman okunabilir.
create policy profile_read on profile for select to anon, authenticated using (true);
create policy profile_tr_read on profile_translations for select to anon, authenticated using (true);
create policy site_settings_read on site_settings for select to anon, authenticated using (true);
create policy site_settings_tr_read on site_settings_translations for select to anon, authenticated using (true);

-- Proje ÇOCUK tabloları: ebeveyn yayınlıysa veya çağıran admin ise okunur.
create policy project_tr_read on project_translations for select to anon, authenticated
  using (public.project_is_public(project_id) or public.is_admin());
create policy project_highlights_read on project_highlights for select to anon, authenticated
  using (public.project_is_public(project_id) or public.is_admin());
create policy project_media_read on project_media for select to anon, authenticated
  using (public.project_is_public(project_id) or public.is_admin());
create policy project_taxonomy_read on project_taxonomy for select to anon, authenticated
  using (public.project_is_public(project_id) or public.is_admin());
create policy test_scenarios_read on test_scenarios for select to anon, authenticated
  using (public.project_is_public(project_id) or public.is_admin());
create policy bug_reports_read on bug_reports for select to anon, authenticated
  using (public.project_is_public(project_id) or public.is_admin());
create policy api_examples_read on api_examples for select to anon, authenticated
  using (public.project_is_public(project_id) or public.is_admin());
create policy sql_examples_read on sql_examples for select to anon, authenticated
  using (public.project_is_public(project_id) or public.is_admin());

-- QA yapıtı çevirileri: ilgili yapıtın projesi yayınlıysa okunur.
create policy test_scenario_tr_read on test_scenario_translations for select to anon, authenticated
  using (exists (select 1 from test_scenarios s where s.id = scenario_id and public.project_is_public(s.project_id)) or public.is_admin());
create policy bug_report_tr_read on bug_report_translations for select to anon, authenticated
  using (exists (select 1 from bug_reports b where b.id = bug_id and public.project_is_public(b.project_id)) or public.is_admin());
create policy api_example_tr_read on api_example_translations for select to anon, authenticated
  using (exists (select 1 from api_examples a where a.id = example_id and public.project_is_public(a.project_id)) or public.is_admin());
create policy sql_example_tr_read on sql_example_translations for select to anon, authenticated
  using (exists (select 1 from sql_examples q where q.id = example_id and public.project_is_public(q.project_id)) or public.is_admin());

-- Medya: yalnızca YAYINLANMIŞ içeriğe bağlı satırlar anon'a görünür (review R10 -
-- "media" için sınırsız anon SELECT verilmez; dosya adları taslak slug sızdırabilir).
create policy media_read on media for select to anon, authenticated
  using (
    public.is_admin()
    or id in (select cover_media_id from projects where status='published' and visible)
    or id in (
      select pm.media_id from project_media pm
      where public.project_is_public(pm.project_id)
    )
    or id in (select badge_media_id from certifications where visible)
    or id in (select avatar_media_id from profile)
  );
create policy media_tr_read on media_translations for select to anon, authenticated
  using (exists (select 1 from media m where m.id = media_id) and (public.is_admin() or true));

-- =============================================================================
-- YAZMA POLİTİKALARI (tüm içerik tabloları: yalnızca admin)
-- =============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'profile','profile_translations','site_settings','site_settings_translations','social_links',
    'projects','project_translations','project_highlights','project_media','test_scenarios',
    'test_scenario_translations','bug_reports','bug_report_translations','api_examples',
    'api_example_translations','sql_examples','sql_example_translations','taxonomy_terms',
    'project_taxonomy','experience','experience_translations','skill_categories','skills',
    'services','service_translations','education','education_translations','certifications',
    'media','media_translations'
  ]
  loop
    execute format(
      'create policy %I_admin_write on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin());',
      t, t
    );
  end loop;
end $$;

-- =============================================================================
-- ÖZEL POLİTİKALAR
-- =============================================================================

-- admin_users: yalnızca admin OKUYABİLİR. INSERT/UPDATE/DELETE politikası YOK
-- -> hiçbir uygulama rolü allow-list'i değiştiremez (erişim yükseltme = kritik işlem).
create policy admin_users_read on admin_users for select to authenticated
  using (public.is_admin());

-- contact_messages: anon YALNIZCA INSERT; okuma/güncelleme yalnızca admin.
create policy contact_insert on contact_messages for insert to anon, authenticated
  with check (true);
create policy contact_admin_read on contact_messages for select to authenticated
  using (public.is_admin());
create policy contact_admin_update on contact_messages for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- DELETE politikası yok -> silme reddedilir (saklama süresi işi ayrı bir job).

-- content_audit: admin INSERT + SELECT. UPDATE/DELETE politikası YOK -> append-only.
create policy audit_insert on content_audit for insert to authenticated
  with check (public.is_admin());
create policy audit_read on content_audit for select to authenticated
  using (public.is_admin());

-- =============================================================================
-- STORAGE (bucket: media) - planning/10 §10.6
-- Not: 'media' bucket'ı ayrıca Supabase Studio'dan veya config.toml ile
-- oluşturulur. Politikalar:
--   - okuma: herkese açık
--   - yazma/güncelleme/silme: yalnızca admin
-- =============================================================================
-- (storage.objects politikaları Supabase projesinde uygulanır - supabase/README.md)
