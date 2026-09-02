---
project: qa-portfolio
output: "01 — System Architecture"
lifecycle_state: PLAN_READY
---

# 01 — System Architecture

## 1.1 Stack decision (summary)

| Concern | Choice | Why |
|---|---|---|
| App framework | **Next.js 15, App Router, React 19, TypeScript (strict)** | SSR + RSC for SEO and fast content pages; one codebase for public site + admin; Vercel-native ISR / on-demand revalidation. Named in the spec constraints. |
| Styling | **Tailwind CSS v4 + CSS variables (design tokens)** + headless primitives (Radix) | Fast, consistent, dark-first, tiny runtime; tokens map 1:1 to [Design System](06-design-system.md). |
| Backend platform | **Supabase** — Postgres 15, Auth, Storage, Row Level Security | Named in the spec. One managed platform for DB + auth + files; free tier viable. |
| Data access | **`@supabase/ssr`** (cookie-based sessions) + generated TypeScript types | First-class Next App Router support; RLS enforced at the database. |
| Localization | **`next-intl`** with an **always-prefixed** locale segment (`/tr`, `/en`) | Explicit URLs for `hreflang`; message catalogs for UI chrome, DB translation tables for content. |
| Rich text | **Markdown stored as text**, rendered through a **strict sanitising pipeline** (`remark`/`rehype` + allowlist). Structured QA artifacts are **typed rows**, not HTML. | Avoids "one giant HTML column"; keeps XSS surface minimal; diff-friendly. |
| Forms / validation | **`react-hook-form` + `zod`** (shared schemas client + server) | One validation definition, used by the form and the server action / route handler. |
| Email | **Transactional provider (candidate: Resend)** — `[PLACEHOLDER: provider to confirm]` | Contact-form notifications only. Abstracted behind a `Mailer` interface. |
| Hosting | **Vercel** (Edge network, ISR, on-demand revalidation, cron) | Named in the spec; integrates with Next.js and GitHub. |
| Error / uptime | **`[PLACEHOLDER: Sentry or equivalent — confirm]`**, Vercel Analytics / Speed Insights | Core Web Vitals is a first-class requirement. |

> Everything above is a **proposal**. It is not built. Runtime V1.1 executes it
> only after a Human Founder build authorization.

## 1.2 Architecture diagram

```
                              ┌──────────────────────────────┐
                              │            USERS             │
                              │  Recruiters · Clients · Peers │
                              │  (+ Owner as Administrator)   │
                              └───────────────┬──────────────┘
                                              │ HTTPS
                                              ▼
                        ┌─────────────────────────────────────────┐
                        │        VERCEL EDGE  (CDN + WAF)          │
                        │  TLS · caching · ISR assets · headers    │
                        └───────────────────┬─────────────────────┘
                                            │
                                            ▼
        ┌───────────────────────────────────────────────────────────────────┐
        │                       NEXT.JS APP (one deployment)                 │
        │                                                                   │
        │   middleware.ts:  locale resolution  +  /admin auth guard         │
        │                                                                   │
        │   ┌───────────────────────────┐     ┌───────────────────────────┐  │
        │   │      PUBLIC SYSTEM        │     │       ADMIN SYSTEM        │  │
        │   │  /[locale]/(site)/*       │     │  /admin/*  (noindex)     │  │
        │   │                          │     │                          │  │
        │   │  RSC pages (SSG/ISR)      │     │  RSC lists + client      │  │
        │   │  read-only queries       │     │  editors (RHF + zod)     │  │
        │   │  next-intl UI messages   │     │  Server Actions / Route  │  │
        │   │  sitemap · robots · OG   │     │  Handlers for mutations  │  │
        │   └────────────┬─────────────┘     └────────────┬─────────────┘  │
        │                │                                │                │
        │        anon Supabase client            authed Supabase client   │
        │        (RLS: published only)           (RLS: is_admin() = true) │
        │                │                                │                │
        │                │        ┌───────────────────────┘                │
        │                │        │   revalidateTag() / revalidatePath()   │
        │                ▼        ▼   on publish / unpublish / reorder      │
        └───────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
        ┌───────────────────────────────────────────────────────────────────┐
        │                              SUPABASE                              │
        │                                                                   │
        │   ┌───────────────┐   ┌───────────────┐   ┌───────────────────┐   │
        │   │   PostgreSQL   │   │     Auth      │   │      Storage      │   │
        │   │  content +     │   │  email+pass   │   │  bucket "media"   │   │
        │   │  translations  │   │  sessions     │   │  (public read,   │   │
        │   │  + RLS + RPC   │   │  JWT / cookie │   │   admin write)   │   │
        │   │  is_admin()    │   │               │   │                  │   │
        │   └───────┬───────┘   └───────┬───────┘   └────────┬─────────┘   │
        │           │                   │                    │             │
        │           ▼                   ▼                    ▼             │
        │   status = 'published'   auth.uid() ∈           media objects    │
        │   AND visible = true     admin_users            + <img> via      │
        │   → PUBLIC CONTENT       → ADMIN ACCESS         next/image       │
        └───────────────────────────────────────────────────────────────────┘
                    │
                    ▼
             ┌──────────────┐        ┌───────────────────────────────┐
             │   Email      │        │  Vercel Cron (optional)       │
             │  provider    │◄───────┤  scheduled revalidate / warm  │
             │  (contact)   │        └───────────────────────────────┘
             └──────────────┘
```

## 1.3 Component responsibilities

### Vercel Edge / CDN
Terminates TLS, serves cached static and ISR output close to the user, applies
security response headers (CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`,
`Permissions-Policy`), and provides basic network-layer protection. No business
logic.

### Next.js app — `middleware.ts`
Two jobs only, kept deliberately thin:
1. **Locale resolution** — redirect `/` → `/{defaultLocale}`, validate the
   `[locale]` segment, set the `next-intl` locale.
2. **Admin guard** — for `/admin/**`, read the Supabase session cookie; if there
   is no session, redirect to `/admin/login`. (Fine-grained `is_admin()`
   enforcement still happens in the layout **and** in the database via RLS — the
   middleware is a first gate, not the only one.)

### Public System (`app/[locale]/(site)/**`)
- Server Components that **read** published content through an **anonymous**
  Supabase client. RLS guarantees only `published + visible` rows are returned
  even if a query is wrong.
- Rendered as **static + ISR**: `generateStaticParams` for known slugs,
  `revalidate` windows as a safety net, and **on-demand revalidation** as the
  primary freshness mechanism.
- Owns SEO surface: `generateMetadata`, `sitemap.ts`, `robots.ts`, dynamic
  `opengraph-image`, JSON-LD.
- No secrets. No service-role key. No write paths.

### Admin System (`app/admin/**`)
- `noindex`, `Disallow` in robots, behind the middleware guard **and** a
  server-side `is_admin()` check in `app/admin/layout.tsx`.
- Lists are RSC; editors are client components (`react-hook-form` + `zod`).
- **All mutations go through Server Actions or Route Handlers** that:
  re-check `is_admin()` server-side → validate with the shared `zod` schema →
  write via the authenticated Supabase client (RLS still applies) → write a
  `content_audit` row → call `revalidateTag(...)` for affected content.
- The `SUPABASE_SERVICE_ROLE_KEY` is used **only** where RLS genuinely cannot
  express the rule (e.g. reading drafts for preview, some Storage admin ops), and
  only in server code that is never bundled to the client.

### PostgreSQL
- Holds content in **base tables + `*_translations` child tables** (see
  [02](02-database-schema.md)).
- `status` (`draft` / `published` / `archived`) + `visible` + `published_at`
  drive publication. Public read policies filter on these columns, so
  **publication state is enforced by the database**, not just the UI.
- `is_admin()` — a `SECURITY DEFINER` SQL function — is the single source of
  truth for "is this user an administrator", used by every write policy.
- On-demand revalidation is triggered by the app after a successful write; an
  optional DB `NOTIFY` / webhook path is documented as a fallback but not
  required for V1.

### Auth (Supabase Auth)
- Email + password for the owner (magic-link optional). Small fixed set of
  accounts.
- Being *authenticated* is not the same as being *authorized*: a session only
  becomes an admin session if `auth.uid()` has a row in `admin_users`. That check
  lives in `is_admin()` and is applied by RLS and by the admin layout.
- Sessions are cookie-based (`@supabase/ssr`), `HttpOnly`, `Secure`,
  `SameSite=Lax`.

### Authorization
- **Coarse**: middleware blocks unauthenticated `/admin/**`.
- **Fine**: `is_admin()` in RLS policies (DB) and in server actions (app).
- **Role field** on `admin_users` (`owner` / `editor`) reserved for a future
  second user; V1 ships a single `owner`.

### Storage / Media
- One bucket `media`, **public read**, writes restricted to `is_admin()` via a
  `storage.objects` policy.
- Upload flow: admin selects file → client requests a constrained upload (size +
  MIME allowlist checked client-side *and* server-side) → object stored →
  `media` row created with dimensions, byte size, checksum, `uploaded_by`.
- Display: `next/image` with the Supabase public URL (optionally the Supabase
  image transformation endpoint) as the loader. `alt` text comes from
  `media_translations` for the active locale — accessibility + SEO.

### Contact form
- Public page → client validates with `zod` → `POST /api/contact`.
- Server: revalidate with the same `zod` schema → honeypot + timing check →
  rate-limit by IP hash (see [10](10-security-plan.md)) → insert into
  `contact_messages` (RLS lets `anon` INSERT only) → send notification email via
  the `Mailer` → return a generic success.
- Admin reads the inbox at `/admin/messages` (RLS: `is_admin()` SELECT).

### Email provider
Abstracted behind a `Mailer` interface so the concrete provider
(`[PLACEHOLDER: Resend / other]`) can be swapped. Only used for outbound contact
notifications in V1. API key server-side only.

## 1.4 Content lifecycle — control flow

```
ADMIN                          DATABASE                         PUBLIC
─────                          ────────                         ──────
Create project ───────────────► INSERT projects (status=draft)
Enter TR + EN content ────────► INSERT/UPDATE *_translations
Add structured QA artifacts ──► INSERT test_scenarios / bug_reports / api_examples / sql_examples
Upload media ────────────────► Storage object + INSERT media (+ media_translations)
Save draft ──────────────────► rows persisted, status stays 'draft'
                                (RLS: invisible to anon)
Preview ─────────────────────► admin-only draft-aware read ───► /tr|/en/projects/[slug]?preview=… (noindex, no-store)
Publish ─────────────────────► UPDATE status='published',
                                       visible=true,
                                       published_at=now()
                                + INSERT content_audit
        app: revalidateTag('projects'), revalidateTag('project:'+slug),
             revalidatePath('/[locale]/projects') ────────────► next request rebuilds → visitor sees it
Unpublish / Hide ────────────► status='draft' OR visible=false + audit + revalidate ─► removed from public
Archive ─────────────────────► status='archived' + audit + revalidate ─► removed from public, kept in admin
Restore ─────────────────────► status back to 'draft' (owner then re-publishes) + audit
```

## 1.5 Caching & revalidation strategy

| Surface | Strategy |
|---|---|
| Public list pages (`/projects`, `/qa-lab`, home) | Static + `revalidate: 3600` fallback; **tag** `projects` / `qa-lab`; on-demand revalidation on publish/unpublish/reorder |
| Public detail pages (`/projects/[slug]`) | `generateStaticParams` for published slugs; tag `project:{slug}`; on-demand revalidation on that project's change |
| `/about`, `/experience`, `/services` | Tag per module (`profile`, `experience`, `services`, `skills`, …); revalidated when that module is edited |
| `sitemap.xml`, `robots.txt` | Regenerated on any publish (tag `sitemap`) |
| Contact page | Dynamic form island on an otherwise static page; `POST` is never cached |
| Admin | `dynamic = 'force-dynamic'`, `no-store`; never cached, never indexed |
| Images | Immutable CDN cache by content hash; `next/image` responsive sizes |

Revalidation is a **server action helper** `revalidateContent(entity, id?)` called
after every successful admin write, so freshness is consistent and testable.

## 1.6 Deployment

```
GitHub repo ──► PR ──► CI (lint, typecheck, unit, integration, e2e, a11y, lighthouse budget)
                         │
                         ├─ Preview deployment (Vercel) per PR  — points at a
                         │   Supabase "staging" project, seeded, no real data
                         │
                         └─ merge to main ──► Production deployment (Vercel)
                                              points at Supabase "prod" project
```

- **Two Supabase projects**: `staging` and `prod`. Schema changes are SQL
  migrations in the repo (`supabase/migrations/**`), applied to staging in CI and
  to prod **only** as a Human-Founder-approved step (mirrors the runtime's
  database-migration workflow).
- No production deployment, no prod migration, and no real data until the Human
  Founder authorizes it (`CLAUDE.md` §2, §13).
- Rollback: Vercel instant rollback for the app; migrations are written
  forward-only with a documented down path.

## 1.7 Environment variables

| Variable | Scope | Secret? | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | client + server | no | Canonical origin for metadata, sitemap, OG |
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | no | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | no (RLS-scoped) | Anonymous, RLS-restricted DB access |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | **YES** | Draft preview reads, Storage admin ops. Never in a client bundle. |
| `SUPABASE_JWT_SECRET` | server only | YES | Verify/GENERATE preview tokens (if used) |
| `MAIL_PROVIDER_API_KEY` | server only | YES | Contact-form notification email |
| `MAIL_TO_ADDRESS` | server only | no | Where contact notifications go |
| `REVALIDATE_WEBHOOK_SECRET` | server only | YES | Auth for any external revalidation trigger |
| `CONTACT_RATE_LIMIT_*` | server only | no | Tunable rate-limit window / max |
| `SENTRY_DSN` / `SENTRY_AUTH_TOKEN` | server (+ client DSN) | partial | Error monitoring `[PLACEHOLDER: confirm tool]` |
| `TURNSTILE_SECRET_KEY` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | server / client | secret / no | Optional CAPTCHA for contact `[PLACEHOLDER: confirm]` |

Rules: secrets are set in Vercel Project Settings (encrypted) and in local
`.env.local` (git-ignored). No secret is ever read into a `NEXT_PUBLIC_*` name.
CI has its own scoped staging secrets. Inherited from `policies/secrets.yml`.

## 1.8 Security boundaries (detail in [10](10-security-plan.md))

| Boundary | Trust transition | Control |
|---|---|---|
| Internet → Edge | untrusted → untrusted | TLS, headers, basic WAF, rate limiting |
| Edge → Public RSC | untrusted → semi-trusted | input validation, no mutations, anon DB client |
| Browser → Admin | untrusted → **must authenticate** | middleware guard + `is_admin()` in layout |
| Admin action → DB | authenticated → **must authorize** | `is_admin()` re-check + RLS `WITH CHECK` |
| App → DB | app identity | RLS on every table; service-role only in isolated server modules |
| App → Storage | app identity | bucket policy: public read, `is_admin()` write; MIME/size allowlist |
| App → Email | server | key server-side only; templated, no user HTML passthrough |
| Public form → DB | anonymous write | RLS INSERT-only, honeypot, rate limit, validation, no read-back |

## 1.9 What is explicitly **out** of the architecture for V1

Payments, e-commerce, multi-tenant, user-generated accounts for visitors,
comments, newsletter, search service (Postgres `ILIKE` / trigram is enough at
this scale), a separate mobile app, a separate design tool, and any production
deployment or real data prior to Human Founder authorization.
