---
project: qa-portfolio
output: "07 — Epic / Story / Task Breakdown"
lifecycle_state: PLAN_READY
---

# 07 — Epic / Story / Task Breakdown

Estimation model: see [`README.md` §Estimation model](README.md). Complexity is
**S / M / L / XL** (XL = must be split before a sprint). Priority is **P0**
(blocks release), **P1** (core), **P2** (important, deferrable), **P3** (nice to
have). "Order" is the suggested implementation sequence *within the whole
backlog*.

Task IDs: `T-<epic><nn>`. Dependencies reference task or epic IDs.

---

## EPIC 01 — Planning & Architecture

**Goal:** a coherent, reviewed plan (this package) and a decision log.

**Stories**
- As the Founder, I want a complete pre-development planning package so
  implementation starts from a shared design.
- As an architect, I want ADRs recorded so future changes have context.

| ID | Title | Cx | Pri | Deps | Acceptance criteria | Order |
|---|---|---|---|---|---|---|
| T-0101 | Produce planning outputs 01–13 | L | P0 | — | All 13 docs exist, internally consistent, in `planning/` | 1 |
| T-0102 | 10-perspective planning review | M | P0 | T-0101 | [`14-planning-review.md`](14-planning-review.md) with findings + verdicts | 2 |
| T-0103 | Decision log seeded (stack, RLS model, taxonomy merge, QA-Lab reuse, classification reconciliation) | S | P0 | T-0101 | `decisions/decision-log.md` has ≥6 ADR entries | 3 |
| T-0104 | Human Founder build authorization | S | P0 | T-0102, T-0103 | `ai-company project authorize-build qa-portfolio` recorded (RISK 5, audited) | 4 |

---

## EPIC 02 — Design System & UX

**Goal:** tokens + component gallery + key comps, dark-first, AA.

**Stories**
- As a visitor, I want a premium technical look so I trust the engineer.
- As a developer, I want tokens and a gallery so UI is consistent and testable.

| ID | Title | Cx | Pri | Deps | Acceptance criteria | Order |
|---|---|---|---|---|---|---|
| T-0201 | Finalise palette + contrast validation | M | P0 | T-0101 | `tokens.css`; automated contrast test passes AA for every documented pairing | 8 |
| T-0202 | Type scale + self-hosted fonts (`next/font`), Turkish glyph check | M | P0 | T-0201 | No CLS from fonts; İ/ı/ğ/ş render at all weights | 9 |
| T-0203 | Core components: Button, Input, Textarea, Select, Checkbox, Label, Field | M | P0 | T-0201 | All states + focus + `aria`; in gallery | 12 |
| T-0204 | Layout primitives: Container, Section, Grid, Prose | S | P0 | T-0201 | Responsive at all breakpoints; no h-scroll | 13 |
| T-0205 | Card, Badge, Chip, StatusDot | M | P0 | T-0203 | Project card matches [04](04-public-wireframes.md) | 14 |
| T-0206 | QA components: CoverageMeter, ResultPill, ScenarioRow, BugCard, CodeBlock (Shiki), SqlBlock | L | P1 | T-0203 | Render from sample data; keyboard-operable; in gallery | 24 |
| T-0207 | Nav: Header (scroll state), Footer, LocaleSwitch, AnchorRail | M | P0 | T-0203 | Active states; mobile menu; locale-preserving switch | 15 |
| T-0208 | Feedback: Toast, Dialog (focus trap), EmptyState, Skeleton | M | P1 | T-0203 | `role` semantics; `Esc`/backdrop rules | 20 |
| T-0209 | Component gallery route + visual-regression snapshots | M | P1 | T-0203..T-0208 | Gallery excluded from sitemap; Playwright screenshots baselined | 26 |
| T-0210 | Motion tokens + reduced-motion audit | S | P2 | T-0204 | All animation respects `prefers-reduced-motion` | 27 |
| T-0211 | Hero + case-study + admin-editor comps reviewed | L | P1 | T-0201, T-0205 | Founder sign-off on direction | 16 |

---

## EPIC 03 — Application Foundation

**Goal:** Next.js app skeleton, tooling, CI, conventions.

**Stories**
- As a developer, I want a strict, linted, typed baseline with CI so quality is
  enforced from commit one.

| ID | Title | Cx | Pri | Deps | Acceptance criteria | Order |
|---|---|---|---|---|---|---|
| T-0301 | Next.js 15 + TS strict + App Router scaffold | S | P0 | T-0104 | `next build` clean; `tsc --noEmit` clean | 5 |
| T-0302 | Tailwind v4, ESLint (incl. `no-restricted-imports` for service role), Prettier, `lint-staged` | S | P0 | T-0301 | `npm run lint` clean; pre-commit hook | 6 |
| T-0303 | Directory conventions: `app/`, `lib/`, `components/`, `content/`, `supabase/` + README | S | P0 | T-0301 | Documented in repo `CONTRIBUTING.md` | 7 |
| T-0304 | CI pipeline: lint, typecheck, unit, integration, e2e, a11y, Lighthouse budget | M | P0 | T-0301 | GitHub Actions green on PR; SHA-pinned actions | 10 |
| T-0305 | Error boundary, `not-found`, `error.tsx`, `loading.tsx` per segment | S | P1 | T-0301 | Localised; no stack traces to users in prod | 22 |
| T-0306 | Env schema validation (`@t3-oss/env` or `zod`) at boot | S | P0 | T-0301 | Missing/invalid env fails fast with a clear message | 11 |
| T-0307 | Error monitoring wiring `[PLACEHOLDER: Sentry]` + Vercel Speed Insights | S | P2 | T-0301 | Errors captured in staging | 40 |
| T-0308 | Security response headers (CSP, HSTS, etc.) via `next.config` / middleware | M | P0 | T-0301 | securityheaders.com A; CSP has no `unsafe-inline` for scripts | 33 |

---

## EPIC 04 — Supabase & Database

**Goal:** schema, migrations, seed, generated types, local dev.

**Stories**
- As a developer, I want migrations in the repo so schema changes are reviewed
  and reproducible.
- As the Founder, I want RLS so a query bug can't leak drafts.

| ID | Title | Cx | Pri | Deps | Acceptance criteria | Order |
|---|---|---|---|---|---|---|
| T-0401 | Supabase local + `staging` + `prod` projects; `supabase/` in repo | M | P0 | T-0104 | `supabase start` works; two remote projects exist (prod empty) | 17 |
| T-0402 | Migration: enums + `profile`/`site_settings` singletons + `admin_users` + `is_admin()` | M | P0 | T-0401 | Applies clean to staging; `is_admin()` unit-tested | 18 |
| T-0403 | Migration: `projects` + `project_translations` + `project_highlights` + `project_media` | M | P0 | T-0402 | FKs/uniques per [02](02-database-schema.md); applies clean | 19 |
| T-0404 | Migration: QA artifacts (`test_scenarios`, `bug_reports`, `api_examples`, `sql_examples` + translations) | M | P0 | T-0403 | Cascades verified | 21 |
| T-0405 | Migration: taxonomy (`taxonomy_terms`, `project_taxonomy`) | S | P0 | T-0403 | `kind` discriminator; composite PK | 23 |
| T-0406 | Migration: résumé modules (`experience`, `skills`, `services`, `education`, `certifications` + translations) | M | P0 | T-0402 | Applies clean | 25 |
| T-0407 | Migration: `media` + `media_translations` + Storage bucket `media` | S | P0 | T-0402 | Bucket exists; dimensions column present | 26 |
| T-0408 | Migration: `contact_messages` + insert-rate trigger; `content_audit` (append-only) | M | P0 | T-0402 | Trigger caps inserts/ip_hash/hour; audit has no update/delete policy | 28 |
| T-0409 | RLS policies for **all** tables + Storage | L | P0 | T-0403..T-0408 | Policy test matrix (anon/admin × select/insert/update/delete) all correct | 30 |
| T-0410 | Indexes (list + trigram search) | S | P1 | T-0403 | `EXPLAIN` shows index use on list/detail queries | 31 |
| T-0411 | Generated TS types + typed query helpers (`lib/db/*`) | M | P0 | T-0403 | `supabase gen types`; no `any` in query layer | 32 |
| T-0412 | Seed script (taxonomy terms, skill categories, singletons, `[PLACEHOLDER]` content) | M | P1 | T-0409 | `npm run seed` populates staging with obviously-placeholder data | 34 |
| T-0413 | Migration workflow doc + prod-apply gate (Human Founder) | S | P0 | T-0401 | `docs` note; prod migration = approval-required step | 35 |

---

## EPIC 05 — Authentication & Authorization

**Goal:** admin sign-in, session handling, `is_admin()` end to end.

**Stories**
- As the owner, I want to sign in securely and stay signed in.
- As the Founder, I want non-admins locked out of `/admin` at every layer.

| ID | Title | Cx | Pri | Deps | Acceptance criteria | Order |
|---|---|---|---|---|---|---|
| T-0501 | `@supabase/ssr` clients: `browser`, `server`, `admin-server` (service role, isolated) | M | P0 | T-0411 | Service-role client cannot be imported by client components (lint + test) | 36 |
| T-0502 | Auth routes: `/admin/login`, `/auth/callback`, `/auth/confirm`, reset flow | M | P0 | T-0501 | PKCE flow works on staging; sign-up disabled | 37 |
| T-0503 | `middleware.ts`: locale + `/admin` session guard (+ `?next=`) | M | P0 | T-0501 | Unauthed `/admin/x` → `/admin/login?next=/admin/x` | 38 |
| T-0504 | `app/admin/layout.tsx` server-side `is_admin()` gate | S | P0 | T-0503 | Authed-but-not-admin user gets 403, not the panel | 39 |
| T-0505 | Login rate limiting + generic errors + soft lock | M | P0 | T-0502 | 5 fails/15min → backoff; no user enumeration | 41 |
| T-0506 | Session refresh, sign-out, "remember me" behaviour | S | P1 | T-0502 | Cookie flags `HttpOnly/Secure/SameSite=Lax`; refresh works | 42 |
| T-0507 | Admin account provisioning runbook (Human Founder) | S | P0 | T-0402 | `docs`: how to add `auth.users` + `admin_users` row safely | 43 |

---

## EPIC 06 — Public Website

**Goal:** all public pages, statically rendered, SEO-ready, AA.

**Stories**
- As a recruiter, I want fast, clear pages that show the engineer's work.
- As the engineer, I want the site to rank for my name + "QA engineer".

| ID | Title | Cx | Pri | Deps | Acceptance criteria | Order |
|---|---|---|---|---|---|---|
| T-0601 | `app/[locale]/(site)/layout.tsx` — chrome, `next-intl` provider, fonts, theme | M | P0 | T-0207, T-0704 | Header/footer/locale switch on every page | 44 |
| T-0602 | Home page + Featured rail + Selected case studies + CTAs | L | P0 | T-0601, T-0413 | Renders from DB; featured = `featured=true`; AA; LCP < 2.5s on staging | 46 |
| T-0603 | Projects list + URL-param filters (classification/platform/tool/test type) + pagination | L | P0 | T-0601, T-0405 | Filter state in URL; SSR; empty state; only published+visible | 47 |
| T-0604 | Project case-study page — fixed section order, meta sidebar, NDA handling | XL → split | P0 | T-0603, T-0206 | See sub-tasks T-0604a..e | 49 |
| T-0604a | · Case-study data loader + `generateStaticParams` + ISR tags | M | P0 | T-0411 | Tag `project:{slug}`; unpublished → `notFound()` | 49 |
| T-0604b | · Prose sections (overview/scope/strategy/coverage/challenges/impact/lessons) + sanitised Markdown | M | P0 | T-0604a, T-1702 | Empty sections omitted; XSS test passes | 50 |
| T-0604c | · Scenario table + Bug list + API blocks + SQL blocks | L | P0 | T-0604a, T-0206 | Structured artifacts render, collapsible, mono | 51 |
| T-0604d | · Meta sidebar + taxonomy chips + links + NDA banner | M | P0 | T-0604a | `nda=true` hides company + reveals-links; "Confidential" shown | 52 |
| T-0604e | · Gallery (lightbox) + Prev/Next nav + anchor rail | M | P1 | T-0604a | Keyboard-navigable lightbox; prev/next within classification | 53 |
| T-0605 | QA Lab list + detail (lighter template) | L | P1 | T-0603 | `classification='qa_lab'`; separate route; lighter card | 55 |
| T-0606 | About page (bio, skills matrix, certs, education) | M | P0 | T-0601, T-0406 | Proficiency meter has a legend; AA | 45 |
| T-0607 | Experience page (timeline + education + certs) | M | P1 | T-0601, T-0406 | Timeline responsive; NDA-hidden employers show "Confidential" | 48 |
| T-0608 | Services page + engagement stepper | S | P1 | T-0601, T-0406 | Renders from `services(+t)` | 54 |
| T-0609 | Contact page shell (form island in EPIC 14) | S | P0 | T-0601 | Layout + "other ways" + consent copy | 56 |
| T-0610 | Legal pages (`/legal/privacy`, `/legal/imprint`) | S | P0 | T-0601 | KVKK + GDPR notice; linked from footer + contact | 57 |
| T-0611 | Global `not-found` + localised 404 | S | P1 | T-0601 | `noindex`; helpful links | 58 |
| T-0612 | Responsive + cross-browser pass (Chrome/Firefox/Safari/Edge, iOS/Android) | M | P0 | T-0602..T-0610 | No h-scroll; tables/code scroll internally; matrix in [11](11-test-strategy.md) | 70 |

---

## EPIC 07 — Admin Panel

**Goal:** the CMS shell, dashboard, lists, mutations plumbing.

| ID | Title | Cx | Pri | Deps | Acceptance criteria | Order |
|---|---|---|---|---|---|---|
| T-0701 | Admin shell (`app/admin/layout.tsx`): rail nav, user menu, `force-dynamic`, `noindex` | M | P0 | T-0504 | Robots `Disallow: /admin`; never cached | 59 |
| T-0702 | Mutation infra: server-action wrapper (auth re-check → `zod` → write → audit → revalidate) | L | P0 | T-0501, T-0411 | One helper used by all mutations; unit-tested | 60 |
| T-0703 | `revalidateContent(entity,id?)` helper + tag map | S | P0 | T-0702 | Publishing a project revalidates list + detail + sitemap tags | 61 |
| T-0704 | `next-intl` setup: catalogs, `[locale]` config, `hreflang` helper, locale-preserving nav | M | P0 | T-0301 | Missing key fails CI; switch keeps path | 43 |
| T-0705 | Dashboard: stat cards, recent activity, translation-gap list, quick actions | M | P1 | T-0701 | Counts correct; gap list detects missing/draft translations | 66 |
| T-0706 | Reusable admin `DataTable` (sort, filter, search, bulk, drag-reorder) | L | P0 | T-0701, T-0203 | Used by projects/experience/services/etc.; reorder persists `display_order` | 62 |
| T-0707 | Unsaved-changes guard + autosave-draft hook | M | P1 | T-0701 | Navigation blocked with unsaved edits; autosave every N s | 63 |
| T-0708 | Admin keyboard shortcuts + toasts | S | P2 | T-0208 | ⌘S save, `/` search | 90 |
| T-0709 | `/admin/audit` view | S | P2 | T-0706, T-0408 | Filter by entity/action/date | 91 |

---

## EPIC 08 — Project CMS

**Goal:** the full project editor + publication workflow.

**Stories**
- As the owner, I want to create/edit a project entirely in the admin so I never
  touch code.
- As the owner, I want a publish checklist so I don't ship a blank page.

| ID | Title | Cx | Pri | Deps | Acceptance criteria | Order |
|---|---|---|---|---|---|---|
| T-0801 | `zod` schemas per section (shared client+server) + required-field rules | M | P0 | T-0411 | One schema module; drives form + server + publish checks | 64 |
| T-0802 | Project editor shell: tabs, sticky action bar, status display | M | P0 | T-0706, T-0801 | Matches [05 §5.4](05-admin-wireframes.md) | 65 |
| T-0803 | Details + Classification + Taxonomy tabs (incl. taxonomy typeahead + inline term create) | L | P0 | T-0802, T-0405 | Slug uniqueness check; NDA toggles; featured/visible/order | 67 |
| T-0804 | TR/EN Content tab: side-by-side Markdown editors, completeness meters, "copy TR→EN" | L | P0 | T-0802, T-1701 | Completeness % per locale; sanitised preview | 68 |
| T-0805 | Structured artifact editors: scenarios, bugs, API, SQL (repeatable, sortable, TR/EN) | XL → split | P0 | T-0802 | Sub-tasks T-0805a..d | 69 |
| T-0805a | · Test scenario editor | M | P0 | T-0805 | Add/reorder/delete; code auto-suggest `TS-nn` | 69 |
| T-0805b | · Bug report editor | M | P0 | T-0805 | Severity/state enums; all fields | 71 |
| T-0805c | · API example editor (method, endpoint, payloads) | M | P0 | T-0805 | Raw payload fields; JSON lint hint | 72 |
| T-0805d | · SQL example editor (dialect, query, sample result) | M | P0 | T-0805 | SQL editor with mono + basic highlight | 73 |
| T-0806 | Media tab: attach from library, set role, captions TR/EN, reorder, set cover | M | P0 | T-1201 | Cover + gallery persisted to `project_media` | 74 |
| T-0807 | SEO tab: per-locale title/description, OG image, search-snippet preview | S | P1 | T-0802 | Char counters; canonical preview | 75 |
| T-0808 | Publish dialog + checks + per-locale publish (`translation_status`) | L | P0 | T-0803, T-0804, T-0801 | Can't publish a locale missing required fields; audit + revalidate | 76 |
| T-0809 | Unpublish / Hide / Archive / Restore actions + list controls | M | P0 | T-0808 | Each writes audit + revalidates; archived stays in admin only | 77 |
| T-0810 | Duplicate-project action | S | P2 | T-0803 | Deep-copies translations + artifacts as a new draft | 92 |
| T-0811 | Draft preview route wiring (`/admin/projects/[id]/preview`) | M | P0 | T-0604, T-0501 | Renders public template w/ draft data; `noindex`,`no-store`; admin-only | 78 |

---

## EPIC 09 — QA Case Study System

**Goal:** the public rendering + data contracts for structured QA content
(overlaps EPIC 06/08 but tracked for QA depth).

| ID | Title | Cx | Pri | Deps | Acceptance criteria | Order |
|---|---|---|---|---|---|---|
| T-0901 | Case-study content contract doc (section order, required vs optional, NDA rules) | S | P0 | T-0101 | Referenced by T-0604 and T-0808 | 48 |
| T-0902 | Coverage meter data shape + render (`role=meter`, a11y) | S | P1 | T-0206 | Values from `test_coverage_md` table or `project_highlights` | 51 |
| T-0903 | Scenario/bug/API/SQL empty + partial states | S | P1 | T-0604c | Missing block omitted; partial block shows only filled fields | 52 |
| T-0904 | "Evidence at a glance" rule: enforce ≥2 QA components per published case study (soft warning) | S | P2 | T-0808 | Publish dialog warns (not blocks) if fewer than 2 | 79 |

---

## EPIC 10 — QA Lab

**Goal:** the lighter experiment/demo showcase.

| ID | Title | Cx | Pri | Deps | Acceptance criteria | Order |
|---|---|---|---|---|---|---|
| T-1001 | QA Lab admin list + editor preset (`classification='qa_lab'`, reduced tabs) | M | P1 | T-0802 | Separate `/admin/qa-lab`; fewer tabs | 80 |
| T-1002 | QA Lab public list + filters | M | P1 | T-0605 | Visual-forward cards | 81 |
| T-1003 | QA Lab detail template (lighter) | M | P1 | T-0605 | Optional scenario table; repo/demo links | 82 |
| T-1004 | Feature flag `qa_lab` (hide entire section if off) | S | P2 | T-0705 | Nav + routes hidden when flag off | 83 |

---

## EPIC 11 — TR / EN Localization

**Goal:** full bilingual parity, routing, fallback, SEO alternates.

| ID | Title | Cx | Pri | Deps | Acceptance criteria | Order |
|---|---|---|---|---|---|---|
| T-1101 | Locale routing (`/tr`, `/en`, always-prefixed) + root redirect | M | P0 | T-0704 | `/` → default; unknown locale → 404 | 43 |
| T-1102 | UI message catalogs (all chrome, forms, errors, admin) TR + EN | L | P0 | T-0704 | No hard-coded user-facing strings (lint rule) | 84 |
| T-1103 | Content fallback policy (missing translation → default locale + tag, or hide) — configurable | M | P1 | T-0411 | Site setting honoured on all list + detail pages | 85 |
| T-1104 | `hreflang` + canonical + localised metadata on every public route | M | P0 | T-1101, T-1501 | Validator: reciprocal `hreflang`, correct `x-default` | 86 |
| T-1105 | Localised formatting (dates, numbers) via `next-intl`/`Intl` | S | P1 | T-1101 | TR/EN date formats correct | 87 |
| T-1106 | Turkish typography/casing QA (İ/ı, `toLocaleUpperCase('tr')`) | S | P1 | T-0202 | No `i`/`I` casing bugs in TR | 88 |
| T-1107 | Locale switch preserves deep path + params | S | P0 | T-1101 | `/en/projects?tool=k6` ↔ `/tr/projects?tool=k6` | 44 |

---

## EPIC 12 — Media Management

**Goal:** upload, store, optimise, alt-text, safe delete.

| ID | Title | Cx | Pri | Deps | Acceptance criteria | Order |
|---|---|---|---|---|---|---|
| T-1201 | Media library UI: grid, upload dropzone, detail panel (alt TR/EN, captions, usages) | L | P0 | T-0407, T-0706 | Matches [05 §5.9](05-admin-wireframes.md) | 74 |
| T-1202 | Upload pipeline: MIME+size allowlist (client+server), checksum, dimension extraction | M | P0 | T-0407 | Reject disallowed types with a clear error; server is authoritative | 74 |
| T-1203 | SVG policy: sanitise on upload OR disallow SVG | S | P0 | T-1202 | No script/`foreignObject` survives; decision recorded | 75 |
| T-1204 | `next/image` integration + Supabase loader/transform + responsive `sizes` | M | P0 | T-0407 | AVIF/WebP served; no CLS; LCP image priority | 76 |
| T-1205 | Usage reverse-lookup + delete guard | M | P1 | T-1201 | Delete blocked while referenced; lists exact usages | 77 |
| T-1206 | Alt-text gate: image can't attach to a published page without default-locale alt | S | P1 | T-0808 | Publish check fails with the offending image named | 78 |
| T-1207 | Orphan-media cleanup job (staging only until authorized) | S | P3 | T-1205 | Dry-run report of unreferenced objects | 120 |

---

## EPIC 13 — Services / Experience / Skills / Education

**Goal:** the résumé modules, admin + public.

| ID | Title | Cx | Pri | Deps | Acceptance criteria | Order |
|---|---|---|---|---|---|---|
| T-1301 | Experience admin CRUD (TR/EN, NDA, order, current) | M | P1 | T-0706, T-0406 | List + form per [05 §5.8](05-admin-wireframes.md) | 66 |
| T-1302 | Skills & categories admin (nested sortable, proficiency, featured) | M | P1 | T-0706, T-0406 | Category reorder + skill reorder persist | 67 |
| T-1303 | Services admin CRUD (TR/EN) | S | P1 | T-0706, T-0406 | — | 68 |
| T-1304 | Education admin CRUD (TR/EN degree/notes) | S | P2 | T-0706, T-0406 | — | 69 |
| T-1305 | Certifications admin CRUD (badge image, credential URL, expiry) | S | P2 | T-0706, T-1201 | Expired certs flagged in admin | 70 |
| T-1306 | Public rendering for all four modules (About + Experience pages) | M | P1 | T-0606, T-0607 | Covered by T-0606/T-0607; data wired | 71 |
| T-1307 | Settings: profile (bio/avatar/CV), social links, SEO defaults, feature flags | M | P1 | T-0706 | Per [05 §5.11](05-admin-wireframes.md); `owner`-only fields enforced | 72 |

---

## EPIC 14 — Contact System

**Goal:** a safe, spam-resistant contact form + inbox.

**Stories**
- As a visitor, I want to send a message and get confirmation.
- As the owner, I want spam kept out and messages in one place.

| ID | Title | Cx | Pri | Deps | Acceptance criteria | Order |
|---|---|---|---|---|---|---|
| T-1401 | Contact form (client) — `react-hook-form` + `zod`, consent checkbox, honeypot, a11y | M | P0 | T-0609, T-0203 | Inline errors; success replaces form; consent required | 95 |
| T-1402 | `POST /api/contact` — revalidate, honeypot + timing check, rate limit (IP-hash), insert, mailer | L | P0 | T-0408, T-1403 | 5xx never leaks; generic success; DB trigger backstop | 96 |
| T-1403 | `Mailer` interface + provider adapter `[PLACEHOLDER: Resend]` + templated notification | M | P0 | T-0306 | Key server-side only; no user HTML in email | 96 |
| T-1404 | Optional CAPTCHA (Turnstile) behind a flag | S | P2 | T-1402 | Flag off by default; verified server-side when on | 110 |
| T-1405 | Admin inbox: list, detail (plain-text render), state machine, `mailto:` reply | M | P1 | T-0706 | States per [05 §5.10](05-admin-wireframes.md); body never HTML | 97 |
| T-1406 | Retention: scheduled purge of `contact_messages` older than N days (staging only until authorized) | S | P2 | T-0408 | Documented in privacy notice; dry-run first | 111 |

---

## EPIC 15 — SEO

**Goal:** technical SEO complete and validated.

| ID | Title | Cx | Pri | Deps | Acceptance criteria | Order |
|---|---|---|---|---|---|---|
| T-1501 | Per-route `generateMetadata` (title, description, canonical, OG, Twitter) TR/EN | M | P0 | T-0601 | Every public route has unique localised metadata | 86 |
| T-1502 | `sitemap.ts` — all published routes + `hreflang` alternates; revalidated on publish | M | P0 | T-0703 | Valid XML; only published URLs; updates within one revalidation | 87 |
| T-1503 | `robots.ts` — allow public, disallow `/admin` `/api` preview; sitemap ref | S | P0 | T-0301 | Verified with a crawler | 88 |
| T-1504 | JSON-LD: `Person`, `WebSite`, `BreadcrumbList`, `CreativeWork`/`Article` for case studies | M | P1 | T-1501 | Passes Rich Results test | 89 |
| T-1505 | Dynamic OG images (`ImageResponse`) for home + case studies | M | P2 | T-0206 | Renders name/title/logo; cached | 100 |
| T-1506 | Canonical + `noindex` correctness audit (preview, 404, fallback-only pages) | S | P0 | T-1104 | Automated test asserts `noindex` where required | 90 |
| T-1507 | Performance-as-SEO: Core Web Vitals budget in CI (LCP/CLS/INP/TBT) | M | P0 | T-0304 | PR fails if budget regressed | 101 |

---

## EPIC 16 — Accessibility

**Goal:** WCAG 2.1 AA across public + admin.

| ID | Title | Cx | Pri | Deps | Acceptance criteria | Order |
|---|---|---|---|---|---|---|
| T-1601 | Semantic landmarks, heading order, skip link, focus-visible on every route | M | P0 | T-0601 | axe: 0 serious/critical on all public routes | 102 |
| T-1602 | Keyboard operability: menus, dialogs, lightbox, accordions, data tables, editors | L | P0 | T-0208, T-0206 | Full keyboard path documented + tested | 103 |
| T-1603 | Forms: labels, `aria-describedby`, error announcement, `aria-live` | M | P0 | T-1401 | Screen-reader pass (NVDA/VoiceOver) | 104 |
| T-1604 | Contrast + non-colour status cues (icons/text with every colour) | M | P0 | T-0201 | No status conveyed by colour alone | 105 |
| T-1605 | `prefers-reduced-motion` + `prefers-contrast` respected | S | P1 | T-0210 | Verified | 106 |
| T-1606 | CI a11y checks (axe on key routes) + manual audit checklist | M | P0 | T-0304 | axe in Playwright; checklist in [11](11-test-strategy.md) | 107 |
| T-1607 | Admin a11y pass (the dense editor especially) | M | P1 | T-0802 | Editor usable by keyboard + SR | 108 |

---

## EPIC 17 — Security

**Goal:** implement [10](10-security-plan.md).

| ID | Title | Cx | Pri | Deps | Acceptance criteria | Order |
|---|---|---|---|---|---|---|
| T-1701 | Markdown sanitisation pipeline (`rehype-sanitize` allowlist, no raw HTML, safe links) | M | P0 | T-0301 | XSS payload corpus renders inert; test in CI | 68 |
| T-1702 | RLS test matrix (anon vs admin × CRUD × published/draft) automated | L | P0 | T-0409 | Every cell asserted; runs in CI against staging | 30 |
| T-1703 | Rate limiting: contact + login (+ generic API guard) | M | P0 | T-0408 | Configurable; DB trigger backstop; tested | 41 |
| T-1704 | Secret hygiene: `env` validation, no `NEXT_PUBLIC_` secret, gitleaks in CI | S | P0 | T-0306 | gitleaks clean; test asserts no service-role in client bundle | 33 |
| T-1705 | CSP + headers hardening (nonce-based scripts, no `unsafe-inline`) | M | P0 | T-0308 | CSP report-only → enforce; violations monitored | 34 |
| T-1706 | Upload security (MIME sniffing, size, SVG, path) | M | P0 | T-1202 | Malicious file corpus rejected | 74 |
| T-1707 | Dependency + container scanning (Trivy/Semgrep) in CI, SHA-pinned actions | S | P0 | T-0304 | CI blocks on high/critical | 35 |
| T-1708 | Auth hardening: session fixation, CSRF on mutations (server actions origin check), sign-out everywhere | M | P0 | T-0501 | Pen-test checklist items pass | 42 |
| T-1709 | promptfoo/redteam N/A note + manual abuse-case review | S | P2 | — | Documented: no LLM surface in the app | 130 |
| T-1710 | Pre-launch security review (`/security-review` equivalent) + fix pass | M | P0 | all EPIC 17 | Sign-off recorded; criticals = 0 | 135 |

---

## EPIC 18 — Automated Testing

**Goal:** implement [11](11-test-strategy.md).

| ID | Title | Cx | Pri | Deps | Acceptance criteria | Order |
|---|---|---|---|---|---|---|
| T-1801 | Unit test harness (Vitest) + coverage gate for `lib/` | M | P0 | T-0301 | `lib/` ≥ 80% lines; CI gate | 12 |
| T-1802 | Integration tests: DB query layer + RLS (against local Supabase) | L | P0 | T-0411 | Query helpers + policies covered | 32 |
| T-1803 | Component tests (Testing Library) for QA components + forms | M | P1 | T-0206 | Key components covered | 26 |
| T-1804 | E2E (Playwright): critical business flows (see [11 §Critical flows](11-test-strategy.md)) | XL → split | P0 | T-0808, T-0602 | Each flow = one spec; runs on preview deploy | 79 |
| T-1804a | · Auth flows (login, unauthorized `/admin`, sign-out) | M | P0 | T-0505 | — | 79 |
| T-1804b | · Project lifecycle (create → draft → preview → publish → public → hide/unpublish/archive/restore) | L | P0 | T-0809 | Draft never public; published appears after revalidation | 80 |
| T-1804c | · Featured/Supported/classification/reorder | M | P0 | T-0803 | Home rail + list order reflect admin | 81 |
| T-1804d | · TR/EN content + locale switch + fallback | M | P0 | T-1103 | — | 82 |
| T-1804e | · Media upload + attach + public image + alt text | M | P0 | T-1206 | — | 83 |
| T-1804f | · Contact form happy + spam + rate limit | M | P0 | T-1402 | — | 84 |
| T-1805 | Visual regression (Playwright screenshots) for gallery + key pages | M | P1 | T-0209 | Baselines committed; diff gate | 26 |
| T-1806 | a11y automated (axe) + Lighthouse CI budgets | M | P0 | T-0304 | Gates wired | 107 |
| T-1807 | Seed/fixtures for tests (deterministic, placeholder content) | M | P0 | T-0412 | One fixture set for all suites | 34 |
| T-1808 | Flake policy + quarantine + CI retry rules | S | P2 | T-1804 | Documented; flaky specs tagged | 125 |

---

## EPIC 19 — Performance

**Goal:** fast on mid-range mobile; green Core Web Vitals.

| ID | Title | Cx | Pri | Deps | Acceptance criteria | Order |
|---|---|---|---|---|---|---|
| T-1901 | Rendering strategy per route (SSG/ISR/dynamic) documented + implemented | M | P0 | T-0602 | Matches [01 §1.5](01-system-architecture.md) | 46 |
| T-1902 | Image optimisation pass (sizes, priority, formats, lazy) | M | P0 | T-1204 | LCP image `priority`; others lazy | 100 |
| T-1903 | JS budget: minimise client components; ship < N KB on public pages | M | P1 | T-0602 | Bundle analyser in CI; public route JS budget | 101 |
| T-1904 | Font strategy (subset, `display:swap`/`optional`, preload) | S | P1 | T-0202 | No CLS; FOIT minimal | 102 |
| T-1905 | Caching headers + ISR tag verification | S | P1 | T-0703 | Stale content clears within one revalidation cycle | 103 |
| T-1906 | Lighthouse ≥ 95 (perf/best-practices/SEO), ≥ 100 a11y on key routes | M | P0 | all | CI budget enforces | 130 |
| T-1907 | DB query performance (N+1 audit, batched loaders) | M | P1 | T-0411 | Case-study page ≤ 3 queries | 55 |

---

## EPIC 20 — Deployment & Documentation

**Goal:** reproducible deploys, runbooks, handover — **no prod deploy without
Human Founder authorization**.

| ID | Title | Cx | Pri | Deps | Acceptance criteria | Order |
|---|---|---|---|---|---|---|
| T-2001 | Vercel project + preview deploys per PR → staging Supabase | M | P0 | T-0304 | Every PR gets a working preview | 10 |
| T-2002 | Production environment config (Vercel prod → prod Supabase) — **prepared, not deployed** | M | P0 | T-0401 | Config exists; deploy gated on approval | 135 |
| T-2003 | Migration apply runbook (staging auto, prod = approval step) | S | P0 | T-0413 | Documented + rehearsed on staging | 35 |
| T-2004 | Rollback runbook (app + DB) | S | P0 | T-2002 | Rehearsed on staging | 136 |
| T-2005 | Monitoring + alerts (uptime, error rate, CWV) `[PLACEHOLDER: tools]` | M | P1 | T-0307 | Alerts fire on staging test | 137 |
| T-2006 | Backups: Supabase PITR/backup schedule + restore test | S | P0 | T-0401 | Restore verified on staging | 138 |
| T-2007 | Owner documentation: "How to publish a project", "How to add media", "How to add an admin" | M | P0 | T-0808 | Screenshots + steps; reviewed by Founder | 139 |
| T-2008 | Developer docs: architecture, local setup, env, migrations, testing, deploy | M | P1 | all | New dev productive in < 1 day | 140 |
| T-2009 | Pre-launch checklist (SEO, a11y, security, perf, content, legal, backups) | M | P0 | all | Every item checked + evidence linked | 141 |
| T-2010 | Human Founder production-deploy approval package | M | P0 | T-2009 | Evidence bundle prepared; deploy STOPS for approval | 142 |

---

## Backlog summary

| Epic | P0 tasks | Total tasks | Heaviest items |
|---|---|---|---|
| 01 Planning | 4 | 4 | — |
| 02 Design system | 6 | 11 | QA components (L), comps (L) |
| 03 Foundation | 6 | 8 | CI (M), headers (M) |
| 04 Supabase & DB | 11 | 13 | RLS policies (L) |
| 05 Auth | 6 | 7 | rate limiting (M) |
| 06 Public site | 9 | 17 | case study (XL→5) |
| 07 Admin panel | 5 | 9 | DataTable (L), mutation infra (L) |
| 08 Project CMS | 8 | 15 | artifact editors (XL→4), publish (L) |
| 09 Case study system | 2 | 4 | — |
| 10 QA Lab | 0 | 4 | — |
| 11 Localization | 5 | 7 | UI catalogs (L) |
| 12 Media | 6 | 7 | media library (L) |
| 13 Résumé modules | 0 | 7 | — |
| 14 Contact | 4 | 6 | `/api/contact` (L) |
| 15 SEO | 6 | 7 | — |
| 16 Accessibility | 5 | 7 | keyboard (L) |
| 17 Security | 9 | 10 | RLS matrix (L) |
| 18 Testing | 7 | 13 | E2E (XL→6) |
| 19 Performance | 4 | 7 | — |
| 20 Deployment | 8 | 10 | — |

**XL tasks that must be split before entering a sprint:** T-0604 (case study),
T-0805 (artifact editors), T-1804 (E2E) — sub-tasks already listed.

**Cross-cutting P0 that gate everything:** T-0104 (build authorization),
T-0401/T-0402 (DB + `is_admin()`), T-0409/T-1702 (RLS + its test matrix),
T-0501 (Supabase clients), T-0704/T-1101 (locale routing).
