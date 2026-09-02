---
project: qa-portfolio
output: "03 — Complete Page & Route Map"
lifecycle_state: PLAN_READY
---

# 03 — Complete Page & Route Map

Legend for every table:
- **Auth** — `none` (public), `session` (must be logged in), `admin` (must pass `is_admin()`).
- **Authz** — extra rule beyond Auth.
- **SEO** — `index` / `noindex` / `n/a` (non-HTML).
- **Data** — primary source(s).

Route base: Next.js App Router. Public site is locale-prefixed
(`/[locale]/...`, `locale ∈ {tr,en}`). Admin is **not** locale-prefixed
(`/admin/...`) — it is a single-operator tool; its UI language follows a cookie
preference, defaulting to `site_settings.default_locale`.

---

## 3.1 Public routes

| Route | Purpose | Main components | Data source | Auth | Authz | SEO |
|---|---|---|---|---|---|---|
| `/` | Root redirect | — (middleware) | `site_settings.default_locale` | none | — | n/a (307 → `/{locale}`) |
| `/[locale]` | Home / landing | `Hero`, `FeaturedProjects`, `SkillsStrip`, `ServicesTeaser`, `SelectedCaseStudies`, `ContactCTA` | `profile(+t)`, `projects where featured`, `skills`, `services`, `site_settings(+t)` | none | — | **index** |
| `/[locale]/about` | Who the engineer is | `ProfileBio`, `SkillsMatrix`, `Certifications`, `EducationList`, `DownloadCV` | `profile_translations`, `skills`+`skill_categories`, `certifications`, `education(+t)` | none | — | **index** |
| `/[locale]/experience` | Career timeline | `ExperienceTimeline`, `EducationList`, `CertificationsGrid` | `experience(+t)`, `education(+t)`, `certifications` | none | — | **index** |
| `/[locale]/projects` | Project catalogue | `ProjectFilters` (classification, platform, tool, test type), `ProjectGrid`, `FeaturedRail`, `Pagination` | `projects where status=published & visible`, `project_translations`, `taxonomy_terms`, `project_taxonomy`, `project_media` (cover) | none | — | **index** |
| `/[locale]/projects/[slug]` | Case study | `CaseStudyHeader`, `MetaSidebar` (company/role/dates/links/NDA), `TaxonomyChips`, `OverviewSection`, `ScopeSection`, `StrategySection`, `CoverageSection`, `ScenarioTable`, `BugReportList`, `ApiExampleBlocks`, `SqlExampleBlocks`, `ChallengesSection`, `ImpactSection`, `LessonsSection`, `Gallery`, `PrevNextNav` | `projects`, `project_translations`, `project_highlights`, `project_media`+`media(+t)`, `test_scenarios(+t)`, `bug_reports(+t)`, `api_examples(+t)`, `sql_examples(+t)`, `project_taxonomy` | none | published + visible (RLS) | **index** (per published locale; `noindex` if only fallback content shown — configurable) |
| `/[locale]/qa-lab` | QA Lab index | `QaLabIntro`, `QaLabGrid` (lighter cards), `Filters` | `projects where classification='qa_lab' & published` | none | — | **index** |
| `/[locale]/qa-lab/[slug]` | QA Lab entry detail | `QaLabHeader`, `SummarySection`, `Gallery`, `ScenarioTable` (optional), `RepoLinks` | same tables as case study, lighter template | none | published (RLS) | **index** |
| `/[locale]/services` | What the engineer offers | `ServiceList`, `EngagementModel`, `ContactCTA` | `services(+t)` | none | — | **index** |
| `/[locale]/contact` | Contact form + details | `ContactForm` (client island), `ContactDetails`, `SocialLinks`, `MapOrLocation?` | `POST /api/contact`, `profile`, `social_links` | none | — | **index** (form action noindex/n/a) |
| `/[locale]/legal/privacy` | Privacy / KVKK + GDPR notice | `LegalDocument` | static MDX (repo) or `site_settings` | none | — | **index** |
| `/[locale]/legal/imprint` | Imprint / contact identity | `LegalDocument` | static MDX | none | — | **index** |
| `/[locale]/404` (not-found) | Localised not found | `NotFound` | — | none | — | noindex |

### Public non-HTML / system routes

| Route | Purpose | Data | Auth | SEO |
|---|---|---|---|---|
| `/sitemap.xml` | Multi-locale sitemap with `hreflang` alternates | all published routes | none | n/a |
| `/robots.txt` | Allow public, disallow `/admin`, `/api`, preview | static + env | none | n/a |
| `/[locale]/rss.xml` *(optional)* | Case-study feed | `projects` | none | n/a |
| `/opengraph-image` + `/[locale]/projects/[slug]/opengraph-image` | Dynamic OG images (`ImageResponse`) | `project_translations`, `profile` | none | n/a |
| `/manifest.webmanifest` | PWA-lite metadata | `site_settings` | none | n/a |
| `POST /api/contact` | Contact submission | body → `contact_messages` + mailer | none | n/a |
| `POST /api/revalidate` | External revalidation hook (optional) | `REVALIDATE_WEBHOOK_SECRET` | secret | n/a |
| `GET /api/health` | Uptime probe | — | none | n/a |

---

## 3.2 Admin routes (`/admin`, all `noindex`, all behind middleware + `is_admin()`)

| Route | Purpose | Main components | Data source | Auth | Authz | SEO |
|---|---|---|---|---|---|---|
| `/admin` | Entry | redirect → `/admin/dashboard` (or `/admin/login` if no session) | — | none→session | — | noindex |
| `/admin/login` | Sign in | `LoginForm` (email+password), `ForgotPassword` | Supabase Auth | none | — | noindex |
| `/admin/dashboard` | Overview | `StatCards` (published/draft counts, new messages), `RecentActivity` (from `content_audit`), `QuickActions`, `TranslationGaps` | aggregate queries, `content_audit` | admin | `is_admin()` | noindex |
| `/admin/projects` | Projects list | `DataTable` (title, classification, status, featured, order, updated), `BulkActions`, `Filters`, `ReorderHandle` | `projects` + `project_translations` (title) | admin | `is_admin()` | noindex |
| `/admin/projects/new` | Create project | `ProjectEditor` (empty) | — | admin | `is_admin()` | noindex |
| `/admin/projects/[id]` | Edit project | `ProjectEditor` (tabbed — see [05](05-admin-wireframes.md)) | all project tables for `id` | admin | `is_admin()` | noindex |
| `/admin/projects/[id]/preview` | Draft preview | renders the **public** case-study template with draft-aware data, `PreviewBanner` | draft-aware read (service role) | admin | `is_admin()` | noindex, `no-store` |
| `/admin/qa-lab` | QA Lab list | `DataTable` filtered to `classification='qa_lab'` | `projects` | admin | `is_admin()` | noindex |
| `/admin/qa-lab/new` | Create QA Lab entry | `ProjectEditor` preset `classification=qa_lab` (fewer tabs) | — | admin | `is_admin()` | noindex |
| `/admin/qa-lab/[id]` | Edit QA Lab entry | `ProjectEditor` (lite) | project tables | admin | `is_admin()` | noindex |
| `/admin/messages` | Contact inbox | `MessageList`, `MessageDetail`, state controls (`new`→`read`→`replied`→`archived`/`spam`) | `contact_messages` | admin | `is_admin()` | noindex |
| `/admin/experience` | Experience CRUD | `DataTable` + `ExperienceForm` (TR/EN) | `experience(+t)` | admin | `is_admin()` | noindex |
| `/admin/skills` | Skills & categories | `CategoryList`, `SkillList` (drag-order), `SkillForm` | `skill_categories`, `skills` | admin | `is_admin()` | noindex |
| `/admin/services` | Services CRUD | `DataTable` + `ServiceForm` (TR/EN) | `services(+t)` | admin | `is_admin()` | noindex |
| `/admin/education` | Education CRUD | `DataTable` + `EducationForm` (TR/EN) | `education(+t)` | admin | `is_admin()` | noindex |
| `/admin/certifications` | Certifications CRUD | `DataTable` + `CertificationForm` | `certifications`, `media` | admin | `is_admin()` | noindex |
| `/admin/media` | Media library | `MediaGrid`, `UploadDropzone`, `MediaDetail` (alt text TR/EN, usages), `DeleteGuard` | `media(+t)`, Storage, reverse-lookup of usages | admin | `is_admin()` | noindex |
| `/admin/settings` | Site settings | tabs: `General`, `Localization`, `Profile` (bio TR/EN, avatar, CV), `SocialLinks`, `SEO defaults`, `Feature flags` | `site_settings(+t)`, `profile(+t)`, `social_links` | admin | `is_admin()` (`owner` for some fields) | noindex |
| `/admin/audit` *(optional)* | Full activity log | `AuditTable` + filters | `content_audit` | admin | `is_admin()` | noindex |

### Admin mutation endpoints (not pages)

Implemented as **Server Actions** co-located with the editors; a few as Route
Handlers where a non-form client (dropzone, reorder) needs JSON:

| Action | Effect | Guards |
|---|---|---|
| `saveProjectDraft(id, data)` | upsert `projects` + `project_translations` + artifacts | `is_admin()`, `zod`, audit |
| `publishProject(id)` | `status='published'`, `published_at`, revalidate tags | `is_admin()`, translation-completeness check, audit |
| `unpublishProject(id)` / `hideProject` / `archiveProject` / `restoreProject` | status/visible transitions + revalidate | `is_admin()`, audit |
| `reorderProjects(orderedIds[])` | bulk `display_order` | `is_admin()`, audit |
| `uploadMedia(file)` | Storage put + `media` row | `is_admin()`, MIME/size allowlist, checksum |
| `deleteMedia(id)` | block if referenced; else Storage + row delete | `is_admin()`, usage check, audit |
| `saveExperience/Service/Education/...` | upsert module + translations + revalidate | `is_admin()`, `zod`, audit |
| `updateMessageState(id, state)` | `contact_messages.state` | `is_admin()`, audit |
| `saveSettings(data)` | `site_settings(+t)`, `profile(+t)`, `social_links` + revalidate | `is_admin()` (`owner` for localization/allow-list-adjacent), audit |

---

## 3.3 Authentication routes

| Route | Purpose | Auth | SEO |
|---|---|---|---|
| `/admin/login` | Email + password sign-in (Supabase) | none | noindex |
| `/auth/callback` | OAuth/magic-link/PKCE code exchange → sets session cookie | none | noindex |
| `/auth/confirm` | Email confirmation / password-reset token handler | none | noindex |
| `/admin/forgot-password` | Request reset email | none | noindex |
| `/admin/reset-password` | Set a new password (from email link) | token | noindex |
| `POST /auth/signout` | Clear session, redirect to `/admin/login` | session | n/a |

Notes:
- Sign-up is **disabled** in Supabase Auth. Accounts are provisioned by the
  Human Founder (adding a `auth.users` row + an `admin_users` row).
- Rate-limit login attempts (see [10](10-security-plan.md)).

---

## 3.4 Dynamic routes & params

| Segment | Values | Generation | 404 behaviour |
|---|---|---|---|
| `[locale]` | `tr`, `en` | static (`generateStaticParams`) | unknown locale → `notFound()` |
| `projects/[slug]` | published project slugs | `generateStaticParams` from `projects where status='published'`; `dynamicParams=true` for freshly published (ISR) | unknown/unpublished slug → localised `not-found` (`noindex`) |
| `qa-lab/[slug]` | published `qa_lab` slugs | same | same |
| `admin/projects/[id]` | uuid | dynamic, `force-dynamic` | not found / not admin → 404 or `/admin/login` |
| `legal/[doc]` | `privacy`, `imprint` | static | unknown → `not-found` |

---

## 3.5 Middleware matrix

```
matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|xml|txt|webmanifest)).*)']

request path            action
────────────────────────────────────────────────────────────────────
/                    →  307 redirect to /{default_locale}
/tr, /en, ...         →  set locale, continue
/{unknown-locale}/... →  rewrite to /{default_locale}/... OR notFound
/admin (no session)   →  307 redirect to /admin/login  (?next= preserved)
/admin (session)      →  continue; layout re-checks is_admin() server-side
/admin/login (session)→  307 redirect to /admin/dashboard
/api/*                →  continue (handlers do their own auth)
```

---

## 3.6 Route → sitemap / indexing summary

| Bucket | Indexed | In sitemap |
|---|---|---|
| Home, about, experience, projects list, project detail (published), qa-lab (list + detail), services, contact, legal | ✅ | ✅ (with `hreflang` alternates for `tr`/`en`) |
| `not-found`, preview, any `?preview=` URL | ❌ `noindex` | ❌ |
| All `/admin/**`, `/auth/**` | ❌ `noindex` + `robots Disallow` | ❌ |
| API / sitemap / robots / OG / manifest | n/a | ❌ |
| Draft / archived / hidden projects | not reachable (RLS 404) | ❌ |

---

## 3.7 Deviations from the spec's suggested route list (with justification)

| Spec route | Plan | Why |
|---|---|---|
| `/about` **and** `/experience` | **Both kept** | Two distinct indexable pages; `/about` = identity + skills + services teaser, `/experience` = timeline + education + certs. Data is shared. |
| `/admin/experience`, `/skills`, `/services`, `/education`, `/certifications`, `/media`, `/settings` | **Kept as-is** | Matches the module list. |
| `/admin/projects/[id]` | **Kept**, plus `/admin/projects/[id]/preview` | Preview is a first-class step in the content workflow (spec Output 05). |
| *(new)* `/admin/messages` | **Added** | The contact form needs an inbox; not in the spec's admin list but implied by "Contact System". |
| *(new)* `/admin/audit` | **Added (optional)** | Institutional-memory / security requirement; cheap given `content_audit` already exists. |
| *(new)* `/[locale]/legal/*` | **Added** | The contact form collects personal data → KVKK/GDPR notice is required. |
| `/admin/login` under `/admin` | **Kept** but auth token handling split into `/auth/*` | Supabase PKCE/magic-link callbacks need dedicated non-guarded routes. |
