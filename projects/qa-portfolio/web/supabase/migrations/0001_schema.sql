-- =============================================================================
-- 0001_schema.sql - QA Portfolio veritabanı şeması
-- Kaynak: projects/qa-portfolio/planning/02-database-schema.md
--
-- Bu migration YALNIZCA yerel/staging Supabase'e uygulanır. Prod uygulaması
-- ayrı, Human Founder onaylı bir adımdır (CLAUDE.md §2, planning/07 T-0413).
-- =============================================================================

-- --- Uzantılar (planning/02 §2.11, review R "Backend Engineer") ---
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists citext;     -- büyük/küçük harf duyarsız slug
create extension if not exists pg_trgm;    -- basit proje araması

-- --- Enum tipleri (planning/02 §2.3) ---
create type locale                as enum ('tr','en');
create type content_status        as enum ('draft','published','archived');
-- İŞ KURALI (ADR-0002): classification = işin TÜRÜ; "featured" ayrı bir bayrak,
-- "archived" ise bir status değeridir. Bu üçü karıştırılmaz.
create type project_classification as enum ('professional','supported','personal','qa_lab');
create type taxonomy_kind          as enum ('platform','tool','test_type','industry');
create type project_media_role     as enum ('cover','gallery','diagram','screenshot');
create type bug_severity           as enum ('blocker','critical','major','minor','trivial');
create type bug_state              as enum ('open','fixed','wont_fix','deferred','by_design');
create type http_method            as enum ('GET','POST','PUT','PATCH','DELETE');
create type test_priority          as enum ('p0','p1','p2','p3');
create type test_kind              as enum ('functional','regression','integration','e2e','api','performance','security','accessibility','exploratory');
create type employment_type        as enum ('full_time','part_time','contract','freelance','internship');
create type contact_state          as enum ('new','read','replied','archived','spam');
create type admin_role             as enum ('owner','editor');

-- updated_at kolonunu otomatik güncelleyen tetikleyici fonksiyon.
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- KİMLİK & ERİŞİM
-- =============================================================================

-- admin_users: yetkilendirme allow-list'i (ADR-0006).
-- Bir kullanıcı ancak burada satırı varsa "admin"dir. Bu tablo UYGULAMADAN
-- düzenlenemez; yalnızca Supabase Studio / migration ile Human Founder tarafından
-- yönetilir (kritik işlem: erişim yükseltme).
create table admin_users (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  role         admin_role not null default 'editor',
  display_name text not null,
  created_at   timestamptz not null default now()
);

-- =============================================================================
-- PROFİL & SİTE AYARLARI (singleton)
-- =============================================================================

create table profile (
  id                 int primary key default 1 check (id = 1),
  full_name          text not null,
  location           text,
  email_public       text,
  phone_public       text,
  years_experience   int,
  available_for_work boolean not null default false,
  avatar_media_id    uuid,
  resume_media_id    uuid,
  updated_at         timestamptz not null default now()
);
create trigger profile_updated before update on profile
  for each row execute function set_updated_at();

create table profile_translations (
  id          uuid primary key default gen_random_uuid(),
  profile_id  int not null references profile(id) on delete cascade,
  locale      locale not null,
  headline    text not null,
  bio_md      text not null default '',
  summary_md  text,
  seo_title   text,
  seo_description text,
  unique (profile_id, locale)
);

create table site_settings (
  id                         int primary key default 1 check (id = 1),
  default_locale             locale not null default 'en',
  contact_notification_email text,
  analytics_id               text,
  feature_flags              jsonb not null default '{}'::jsonb,
  primary_cta                text
);

create table site_settings_translations (
  id                uuid primary key default gen_random_uuid(),
  settings_id       int not null references site_settings(id) on delete cascade,
  locale            locale not null,
  site_title        text not null,
  site_tagline      text not null default '',
  meta_description  text not null default '',
  og_image_media_id uuid,
  unique (settings_id, locale)
);

create table social_links (
  id            uuid primary key default gen_random_uuid(),
  platform      text not null,
  label         text not null,
  url           text not null,
  display_order int not null default 0,
  visible       boolean not null default true
);

-- =============================================================================
-- PROJELER & VAKA ÇALIŞMALARI
-- =============================================================================

create table projects (
  id             uuid primary key default gen_random_uuid(),
  slug           citext not null unique,
  classification project_classification not null,
  status         content_status not null default 'draft',
  visible        boolean not null default true,   -- geçici gizleme
  featured       boolean not null default false,  -- ana sayfa "öne çıkan" rayı
  supported      boolean not null default false,  -- classification='supported' aynası (hız)
  display_order  int not null default 0,
  company        text,                            -- NDA için nullable
  company_hidden boolean not null default false,  -- true -> public'te "Gizli"
  role_title     text,
  start_date     date,
  end_date       date,
  is_ongoing     boolean not null default false,
  nda            boolean not null default false,  -- public şablonun neyi gösterdiğini belirler
  github_url     text,
  external_url   text,
  cover_media_id uuid,
  published_at   timestamptz,                     -- ilk yayında set edilir
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger projects_updated before update on projects
  for each row execute function set_updated_at();

-- Public liste/detay sorgularının indeksleri (planning/02 §2.11).
create index projects_public_idx on projects (status, visible, classification, display_order);
create index projects_featured_idx on projects (featured) where featured;

create table project_translations (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references projects(id) on delete cascade,
  locale             locale not null,
  title              text not null,
  summary            text not null,
  role_title         text,
  overview_md        text,
  testing_scope_md   text,
  test_strategy_md   text,
  test_coverage_md   text,
  challenges_md      text,
  impact_md          text,
  lessons_md         text,
  seo_title          text,
  seo_description    text,
  -- İŞ KURALI (planning/02 §2.7): dil başına yayın hazırlığı. Sahibi EN'i
  -- yayınlarken TR'yi taslak tutabilir.
  translation_status content_status not null default 'draft',
  unique (project_id, locale)
);
create index project_translations_lookup on project_translations (project_id, locale);
create index project_translations_title_trgm on project_translations using gin (title gin_trgm_ops);

-- Kısa sıralı madde listeleri (project_responsibilities/sections yerine - ADR-0004).
create table project_highlights (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  locale        locale not null,
  kind          text not null default 'result',  -- 'responsibility' | 'result' | 'coverage'
  text          text not null,
  display_order int not null default 0
);

create table project_media (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  media_id      uuid not null,
  role          project_media_role not null default 'gallery',
  display_order int not null default 0,
  caption_tr    text,
  caption_en    text
);

-- QA yapıtları (yapısal - JSON blob DEĞİL, ADR-0004).
create table test_scenarios (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  code          text not null,           -- görünen id, ör. "TS-01"
  priority      test_priority not null default 'p2',
  kind          test_kind not null default 'functional',
  automated     boolean not null default false,
  display_order int not null default 0
);
create index test_scenarios_project_idx on test_scenarios (project_id, display_order);

create table test_scenario_translations (
  id             uuid primary key default gen_random_uuid(),
  scenario_id    uuid not null references test_scenarios(id) on delete cascade,
  locale         locale not null,
  title          text not null,
  preconditions_md text,
  steps_md       text not null default '',
  expected_md    text not null default '',
  notes_md       text,
  unique (scenario_id, locale)
);

create table bug_reports (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references projects(id) on delete cascade,
  code             text not null,          -- ör. "BUG-01"
  severity         bug_severity not null default 'major',
  state            bug_state not null default 'fixed',
  environment      text,
  found_in_version text,
  display_order    int not null default 0
);
create index bug_reports_project_idx on bug_reports (project_id, display_order);

create table bug_report_translations (
  id            uuid primary key default gen_random_uuid(),
  bug_id        uuid not null references bug_reports(id) on delete cascade,
  locale        locale not null,
  title         text not null,
  summary_md    text,
  steps_md      text,
  expected_md   text,
  actual_md     text,
  root_cause_md text,
  resolution_md text,
  unique (bug_id, locale)
);

create table api_examples (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references projects(id) on delete cascade,
  code             text not null,          -- ör. "API-01"
  method           http_method not null default 'GET',
  endpoint         text not null,
  request_headers_json jsonb,
  request_body     text,
  response_status  int,
  response_body    text,
  display_order    int not null default 0
);

create table api_example_translations (
  id            uuid primary key default gen_random_uuid(),
  example_id    uuid not null references api_examples(id) on delete cascade,
  locale        locale not null,
  title         text not null,
  notes_md      text,
  unique (example_id, locale)
);

create table sql_examples (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  code          text not null,             -- ör. "SQL-01"
  dialect       text not null default 'postgres',
  query_sql     text not null,
  sample_result text,
  display_order int not null default 0
);

create table sql_example_translations (
  id             uuid primary key default gen_random_uuid(),
  example_id     uuid not null references sql_examples(id) on delete cascade,
  locale         locale not null,
  title          text not null,
  explanation_md text,
  unique (example_id, locale)
);

-- =============================================================================
-- TAKSONOMİ (üç ayrı tablo yerine tek ayrımlı tablo - ADR-0004)
-- =============================================================================

create table taxonomy_terms (
  id            uuid primary key default gen_random_uuid(),
  kind          taxonomy_kind not null,
  slug          citext not null,
  label_tr      text not null,
  label_en      text not null,
  icon          text,
  display_order int not null default 0,
  visible       boolean not null default true,
  unique (kind, slug)
);

create table project_taxonomy (
  project_id    uuid not null references projects(id) on delete cascade,
  term_id       uuid not null references taxonomy_terms(id) on delete restrict,
  display_order int not null default 0,
  primary key (project_id, term_id)
);
create index project_taxonomy_term_idx on project_taxonomy (term_id);

-- =============================================================================
-- ÖZGEÇMİŞ MODÜLLERİ
-- =============================================================================

create table experience (
  id              uuid primary key default gen_random_uuid(),
  company         text not null,
  company_hidden  boolean not null default false,
  location        text,
  start_date      date not null,
  end_date        date,
  is_current      boolean not null default false,
  employment_type employment_type not null default 'full_time',
  display_order   int not null default 0,
  visible         boolean not null default true,
  nda             boolean not null default false
);

create table experience_translations (
  id            uuid primary key default gen_random_uuid(),
  experience_id uuid not null references experience(id) on delete cascade,
  locale        locale not null,
  role_title    text not null,
  summary_md    text not null default '',
  highlights_md text,
  unique (experience_id, locale)
);

create table skill_categories (
  id            uuid primary key default gen_random_uuid(),
  slug          citext not null unique,
  label_tr      text not null,
  label_en      text not null,
  display_order int not null default 0,
  visible       boolean not null default true
);

create table skills (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references skill_categories(id) on delete restrict,
  label         text not null,           -- araç adı, dilden bağımsız
  proficiency   int check (proficiency between 1 and 5),
  years         int,
  display_order int not null default 0,
  visible       boolean not null default true,
  featured      boolean not null default false
);

create table services (
  id            uuid primary key default gen_random_uuid(),
  slug          citext not null unique,
  icon          text,
  display_order int not null default 0,
  visible       boolean not null default true
);

create table service_translations (
  id             uuid primary key default gen_random_uuid(),
  service_id     uuid not null references services(id) on delete cascade,
  locale         locale not null,
  title          text not null,
  description_md text not null default '',
  outcome_md     text,
  unique (service_id, locale)
);

create table education (
  id            uuid primary key default gen_random_uuid(),
  institution   text not null,
  location      text,
  start_date    date,
  end_date      date,
  display_order int not null default 0,
  visible       boolean not null default true
);

create table education_translations (
  id            uuid primary key default gen_random_uuid(),
  education_id  uuid not null references education(id) on delete cascade,
  locale        locale not null,
  degree_title  text not null,
  field         text,
  notes_md      text,
  unique (education_id, locale)
);

create table certifications (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  issuer         text not null,
  issued_on      date,
  expires_on     date,
  credential_id  text,
  credential_url text,
  badge_media_id uuid,
  display_order  int not null default 0,
  visible        boolean not null default true
);

-- =============================================================================
-- MEDYA
-- =============================================================================

create table media (
  id             uuid primary key default gen_random_uuid(),
  bucket         text not null default 'media',
  storage_path   text not null unique,
  mime_type      text not null,
  width          int,
  height         int,
  byte_size      bigint not null default 0,
  checksum       text,
  dominant_color text,
  uploaded_by    uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);

create table media_translations (
  id        uuid primary key default gen_random_uuid(),
  media_id  uuid not null references media(id) on delete cascade,
  locale    locale not null,
  -- İŞ KURALI (erişilebilirlik + SEO): en azından varsayılan dilde alt_text
  -- zorunlu; alt metni olmayan görsel yayınlanmış bir sayfaya eklenemez
  -- (uygulama katmanında kontrol edilir - planning/07 T-1206).
  alt_text  text not null,
  caption   text,
  unique (media_id, locale)
);

-- media_id yabancı anahtarları: görsel silinince proje silinmesin diye SET NULL.
alter table projects            add constraint projects_cover_fk
  foreign key (cover_media_id) references media(id) on delete set null;
alter table profile             add constraint profile_avatar_fk
  foreign key (avatar_media_id) references media(id) on delete set null;
alter table profile             add constraint profile_resume_fk
  foreign key (resume_media_id) references media(id) on delete set null;
alter table site_settings_translations add constraint sst_og_fk
  foreign key (og_image_media_id) references media(id) on delete set null;
alter table certifications      add constraint cert_badge_fk
  foreign key (badge_media_id) references media(id) on delete set null;
alter table project_media       add constraint project_media_media_fk
  foreign key (media_id) references media(id) on delete cascade;

-- =============================================================================
-- İLETİŞİM & DENETİM
-- =============================================================================

-- İŞ KURALI (planning/10 §10.4): public'ten YALNIZCA INSERT yapılabilir;
-- okuma sadece admin'e açıktır. ip_hash ham IP DEĞİL, tuzlanmış SHA-256'dır.
create table contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  subject    text,
  body       text not null,
  locale     locale not null default 'en',
  page_path  text,
  ip_hash    text,
  user_agent text,
  state      contact_state not null default 'new',
  spam_score numeric,
  created_at timestamptz not null default now()
);
create index contact_messages_state_idx on contact_messages (state, created_at desc);

-- İŞ KURALI: append-only denetim defteri. UPDATE/DELETE politikası YOKTUR
-- (planning/10 §10.4). Her admin içerik işlemi buraya bir satır yazar.
create table content_audit (
  id          bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_name  text not null,
  entity_type text not null,
  entity_id   text not null,
  action      text not null,   -- create|update|publish|unpublish|archive|restore|delete|reorder|upload
  summary     text not null default '',
  created_at  timestamptz not null default now()
);
create index content_audit_entity_idx on content_audit (entity_type, entity_id, created_at desc);
