---
project: qa-portfolio
output: "14 — Planning Review (10 perspectives)"
lifecycle_state: PLAN_READY
---

# 14 — Planning Review

The planning package (01–13) reviewed from ten senior perspectives. Each reviewer
gives **strengths**, **concerns / gaps**, **required changes** (must fix before or
during build), and a **verdict**.

Verdict scale: ✅ Approve · ⚠️ Approve with conditions · ⛔ Blocker.

---

## 1. Senior Product Designer

**Strengths**
- Clear product intent: convert recruiter/client visits to contact; the IA in
  [04](04-public-wireframes.md) serves that funnel (proof → work → offer →
  action).
- The "evidence over adjectives" principle and the QA visual language give the
  product a defensible identity vs. a generic portfolio.
- Per-locale publishing is a real product insight, not just a tech detail.

**Concerns / gaps**
- No explicit content-prioritisation guidance for the Founder: with placeholders
  everywhere, which 3 projects and which services matter most is unstated.
- "Featured" vs "Selected case studies" on the home page could confuse (two
  curation mechanisms).
- No measurement of the core goal (contact conversions) is designed in.

**Required changes**
- Add a "curation model" note: Featured = home rail (max 3–4); "Selected case
  studies" = the same set or a manual pick — pick **one** mechanism. → fold into
  ADR / [04 §4.8].
- Define a success metric (contact form submissions / CV downloads) and where
  it's tracked (OQ-011).

**Verdict:** ⚠️ Approve with conditions (curation model + a success metric).

---

## 2. Senior UX/UI Designer

**Strengths**
- Wireframes cover hierarchy, navigation, responsive collapse, and empty states.
- The admin project editor is thought through (tabs, side-by-side TR/EN,
  completeness meters, publish checklist) — the highest-risk screen.
- Accessibility is baked into the design system, not bolted on.

**Concerns / gaps**
- The case-study page is long and dense; scannability for a busy recruiter isn't
  fully solved (anchor rail only appears ≥1280px).
- Mobile case study: sidebar-above-content could push the actual story far down.
- No defined interaction for filtering on the projects list on mobile beyond "bottom sheet".
- Skills "proficiency meter" — self-rated proficiency can read as unserious;
  needs a legend and ideally objective framing (years, or "used in production").

**Required changes**
- Add a mobile "On this page" jump menu for case studies (already noted in
  [04 §4.3] — make it a P1 task, currently implied).
- Case-study template: a short "TL;DR" band (role, stack, outcome, 1 line) above
  the fold, before the long prose. → add to T-0904 scope.
- Skills: show years + "context" alongside any dot rating; document the legend.

**Verdict:** ⚠️ Approve with conditions (case-study scannability).

---

## 3. Senior Software Architect

**Strengths**
- One Next.js deployment for public + admin with clear module boundaries and a
  thin middleware — appropriate for the scale.
- Rendering strategy (SSG/ISR + on-demand revalidation, tag-based) is correct and
  testable.
- The service-role isolation rule (lint + bundle test) is the right instinct.
- Dependency analysis correctly identifies the DB schema and RLS as the
  expensive-to-change core and sequences them first.

**Concerns / gaps**
- Preview relies on the service-role client — a powerful key on a request path.
  Alternative (signed short-lived preview JWT scoping to `is_admin`) is mentioned
  but not decided.
- No explicit decision on **where** rate-limit state lives (edge KV? Upstash?
  in-memory won't work on serverless). This is hand-waved in [10].
- "Two Supabase projects" — schema drift between staging and prod is a classic
  failure; the migration discipline is stated but not tooled (no
  `supabase db diff` gate mentioned).
- The `feature_flags jsonb` on a singleton is fine but needs a typed accessor to
  avoid stringly-typed bugs.

**Required changes**
- Decide the preview mechanism (recommend: keep service-role but **only** in the
  preview route handler, add a test that no other route imports it) — record as
  an ADR.
- Choose the rate-limit store now (recommend **Upstash Redis** free tier or
  Vercel KV) and put it in [01 §1.7] env + [07] T-1703.
- Add a CI step: `supabase db diff` against staging must be empty on merge
  (schema-as-code enforcement). → T-0413 scope.

**Verdict:** ⚠️ Approve with conditions (preview ADR, rate-limit store, schema-drift gate).

---

## 4. Senior Frontend Engineer

**Strengths**
- RSC-first, clear client/server split, `zod` shared client+server, `next-intl`
  with always-prefixed locales — all current best practice.
- JS budget and bundle analyser as CI gates.
- Component gallery + visual regression is a strong quality lever.

**Concerns / gaps**
- Markdown editor choice is deferred ("Markdown stored"); the *editor* UX (not
  the storage) is a real build item — plain textarea vs. a rich MD editor
  (Milkdown/Tiptap-markdown) changes T-0804 a lot.
- Tailwind v4 + `next/font` + CSP nonce for styles: `style-src 'unsafe-inline'`
  is currently allowed "for Tailwind runtime" — that weakens CSP; needs a plan
  (Tailwind v4 emits static CSS, so `unsafe-inline` for styles may be avoidable).
- No mention of form state persistence across the tabbed editor (switching tabs
  must not lose unsaved fields).
- Image handling via the Supabase transform endpoint — confirm it's on the free
  tier and works with `next/image` `loader`.

**Required changes**
- Pick the Markdown editor component in Sprint 2 and size T-0804 accordingly.
- Re-scope CSP: target **no `unsafe-inline` at all**; if Tailwind v4 static
  extraction allows it, tighten `style-src` to `'self'`. → T-1705.
- T-0802: editor holds all tab state in one form context; tab switch is
  client-only, save is atomic.

**Verdict:** ⚠️ Approve with conditions (MD editor decision, CSP tightening).

---

## 5. Senior Backend Engineer

**Strengths**
- Base + `*_translations`, structured QA artifacts, discriminated taxonomy — a
  clean, query-friendly model.
- RLS design is specific (parent-state gating on child tables is the part most
  people get wrong, and it's addressed).
- Append-only `content_audit` and the DB-level contact-rate trigger are good
  defensive touches.

**Concerns / gaps**
- Publishing writes to many tables (`projects` + N translations + N artifacts) —
  needs to be **transactional**; a partial publish is a bad state. Not stated.
- `translation_status` on `project_translations` plus `projects.status` plus
  `visible` = three state axes; the "what is actually public right now" query is
  non-trivial and must be **one** well-tested SQL view or RPC, not reconstructed
  in the app per page.
- Slug immutability "warn on change" — if changed after publish, old URLs 404
  with no redirect. Need a `project_slug_history` table + redirect, or hard-lock.
- `citext` and `pg_trgm` are extensions — confirm they're enabled on Supabase
  (they are, but list it in the first migration).
- No soft-delete / recovery window for a hard `DELETE` of a project.

**Required changes**
- Wrap publish/unpublish/archive/restore in a transaction (RPC function) — one
  audit row, all-or-nothing. → T-0808 scope.
- Create a `public_projects` **view** (or RPC) that encodes the publication
  predicate once; all public queries use it; the RLS matrix tests it. → T-0403/T-0409.
- Add `project_slug_history (old_slug, project_id)` + a redirect in the
  case-study route, OR hard-lock the slug after first publish. Recommend the
  history+redirect. → new task in EPIC 08.
- First migration explicitly `create extension` for `citext`, `pg_trgm`,
  `pgcrypto`.
- Define a 30-day "trash" for deleted projects, or require export-before-delete.

**Verdict:** ⚠️ Approve with conditions (transactional publish, publication view, slug history).

---

## 6. Database Architect

**Strengths**
- Normalisation decisions are explicit and justified — the reviewer's job is half
  done by [02 §2.9].
- Enums for every controlled vocabulary; UUID PKs; consistent timestamps and
  cascade rules.
- Indexes are proposed with the query patterns in mind.

**Concerns / gaps**
- `project_highlights` has a fuzzy uniqueness ("UNIQUE-ish") and a free-text
  `kind` — either constrain `kind` to an enum or accept it's just an ordered
  list and drop `kind`.
- `media` public `SELECT using (true)` is a pragmatic call but means the full
  media inventory (filenames, timestamps, uploader) is readable by anon via
  PostgREST even if the *UI* hides it. Filenames could leak draft project slugs.
  → tighten: anon may read a `media` row only if it's referenced by published
  content (a policy with an `EXISTS` across the union of referencing tables), or
  expose media only through a view.
- No `ON DELETE` policy stated for `taxonomy_terms` when a term is in use
  (`project_taxonomy` FK) — should be `RESTRICT` with an admin "merge term" tool.
- Singleton pattern (`CHECK id = 1`) is fine but seed order matters — document
  it.
- Time zone: "UTC" stated; ensure `timestamptz` everywhere (not `timestamp`) and
  that date-only fields (`start_date`) are genuinely `date`.

**Required changes**
- Constrain `project_highlights.kind` to a small enum or remove it.
- Tighten `media` RLS: no blanket anon `SELECT`; expose published-referenced
  media via a view or an `EXISTS` policy. → [02 §2.10] + T-0409.
- `taxonomy_terms` delete = `RESTRICT`; add a "term in use" guard in the admin.
- Add a `db/seed-order.md` note.

**Verdict:** ⚠️ Approve with conditions (media RLS tightening is the important one).

---

## 7. Security Engineer

**Strengths**
- Defence in depth for admin (middleware + layout + action + RLS) is correctly
  layered and explicitly "hidden ≠ secure".
- RLS test matrix as a **release gate** is exactly right.
- XSS handling (no stored HTML, sanitiser + CSP + build-time highlight, plain-text
  inbox) is thorough.
- Secret hygiene, CSP, headers, scanning tools all mirror the repo policy.

**Concerns / gaps**
- `style-src 'unsafe-inline'` (see Frontend review) — a real gap; inline styles
  are a (smaller) XSS/exfil vector.
- The `?next=` open-redirect mitigation is stated but not specified (must be
  same-origin path starting `/admin/`, not a full URL, not `//host`).
- Preview + service-role: if an attacker gets an admin session (phishing), the
  blast radius is total (RLS bypass via service role is not reachable by them,
  but full content control is). MFA is only "recommended" — for a
  single-credential admin it should be **required**.
- No mention of Supabase **RLS on `auth` schema / `storage` schema defaults**,
  or of disabling the Supabase auto-generated GraphQL/`pg_graphql` and the
  `anon` role's access to `pg_catalog`-adjacent RPCs.
- Rate-limit state on serverless — must be shared (see Architect); in-memory is a
  silent no-op.
- No CAPTCHA on login (only rate limit) — acceptable but note it.
- Dependency on `[PLACEHOLDER: email provider]` — the notification email contains
  user-supplied name/subject; confirm the template escapes them and the provider
  isn't an SSRF/injection path.

**Required changes (some are blockers for launch, not for build start)**
- **MFA/TOTP required** for the admin account, not optional. → [10 §10.2], OQ-004 default flips to "required".
- Specify `?next=` validation precisely. → T-1708.
- Eliminate `style-src 'unsafe-inline'` or document a concrete compensating
  control. → T-1705.
- Harden Supabase project settings: disable unused auto-APIs, restrict the
  `anon`/`authenticated` roles to only what's needed, review default `storage`
  policies. → new subtask in EPIC 17.
- Shared rate-limit store (Redis/KV). → T-1703.
- Pre-launch: external ZAP baseline + the internal review (T-1710) are both
  required; 0 criticals is a hard gate.

**Verdict:** ⚠️ Approve with conditions for build; ⛔ **Blocker** items (MFA,
shared rate-limit store, Supabase project hardening, CSP) must be closed before
production.

---

## 8. DevOps Engineer

**Strengths**
- Preview-per-PR → staging Supabase, prod gated behind Human Founder approval —
  matches the repo's critical-action model.
- Rollback and backup/restore are explicit Sprint 8 exit criteria (restore is
  actually *tested*, not assumed).
- SHA-pinned actions, dependency scanning, env schema validation at boot.

**Concerns / gaps**
- Schema migration tooling isn't specified beyond "SQL in the repo" — need
  `supabase` CLI in CI, a migrations lint, and the `db diff` gate (see Architect).
- Secret management across 3 environments is a listed risk but not a runbook.
- No IaC for the Supabase project config (RLS aside — buckets, auth settings,
  extensions). "ClickOps" drift risk. Supabase supports config in
  `supabase/config.toml` + migrations — use it.
- Free-tier operational realities: Supabase project pause on inactivity, Vercel
  Hobby commercial-use terms — flagged as risks but need an owner + a decision
  date, not just a risk row.
- No cost monitoring / budget alert.
- Cron for keep-alive + for `contact_messages` retention — Vercel Cron is
  mentioned; confirm it's on the plan and idempotent.

**Required changes**
- Adopt the Supabase CLI end to end: `config.toml`, migrations, `db diff` gate,
  seed. → T-0401/T-0413.
- Write the per-environment secret checklist + rotation runbook. → T-2008.
- Get explicit Founder decisions on Supabase Pro vs free+keepalive and Vercel
  Pro vs Hobby **before Sprint 6** (hardening assumes the final domain + plan).
- Add a cost/usage alert. → T-2005.

**Verdict:** ⚠️ Approve with conditions (migration tooling + plan decisions).

---

## 9. QA Lead

**Strengths**
- Test strategy is layered correctly (pyramid), shifts left, and treats the suite
  as a portfolio artifact — fitting for this client.
- 25 explicit critical-flow specs with Given/When/Then, mapped to tasks.
- RLS matrix, a11y, Lighthouse, visual regression, XSS corpus all as CI gates.
- Deterministic fixtures shared across suites; flake policy defined.
- Traceability matrix (requirement → AC → test) with a CI check.

**Concerns / gaps**
- Integration tests need a real Postgres in CI — the plan says "local Supabase in
  CI" but Supabase-in-CI can be slow/flaky; consider a plain `postgres` service +
  applying migrations, reserving full Supabase for a nightly job.
- No performance *regression* budget history — "≥ 95" is a point check; trends
  matter.
- E2E against a preview deploy that points at shared staging → tests can collide
  (two PRs mutating the same data). Need per-run data isolation (schema per run,
  or a data namespace, or reset-before-suite).
- No contract test for the `revalidateTag` map — easy to forget a tag and get
  stale pages; CF-25 covers one case, not the matrix.
- Accessibility: automated axe catches ~30–40% of issues; the manual checklist is
  there but no named cadence/owner.
- Load testing is "light / pre-launch only" — fine, but the contact endpoint
  abuse case deserves an automated test at the integration layer too (it's in
  CF-22, good).

**Required changes**
- CI DB: plain Postgres + migrations for integration; Supabase container only
  nightly. → T-1802.
- E2E data isolation strategy (recommend: each E2E run seeds its own namespaced
  fixtures and cleans up, or uses an ephemeral schema). → T-1804/T-1807.
- Add a "every content mutation revalidates the right tags" test that iterates
  the tag map. → T-0703.
- Name an a11y audit owner + do it every sprint from Sprint 3, not just at
  release.

**Verdict:** ⚠️ Approve with conditions (E2E data isolation is the important one).

---

## 10. Technical SEO Specialist

**Strengths**
- Always-prefixed locales, reciprocal `hreflang` + `x-default`, per-route
  localised metadata, JSON-LD, dynamic OG, sitemap regenerated on publish — a
  complete technical-SEO checklist.
- `noindex` correctness is an automated test (drafts/preview/admin/fallback).
- Performance-as-SEO with CWV budgets in CI.
- Sitemap lists only published URLs.

**Concerns / gaps**
- Locale-neutral English slugs at `/tr/projects/{slug}` — acceptable, but the
  **path segment** `projects` / `qa-lab` / `about` staying English on the TR site
  is a mild SEO + UX miss for Turkish users and searches. Decision is recorded
  (OQ-006) but leans on "revisit".
- No canonical strategy stated for filtered list URLs (`/projects?tool=k6`) —
  these can create near-duplicate crawl paths; need `canonical` → `/projects` (or
  selective indexing of a few valuable facets).
- Placeholder content + an accidentally-submitted sitemap = thin-content
  penalty risk (flagged RISK-062, but make it a hard checklist item).
- No 404 → soft-404 handling guidance for unpublished slugs (returning a proper
  404 status is stated — good — just confirm the status code, not just the page).
- International targeting: `hreflang` handles language, but is there a
  country-targeting need (Türkiye vs global)? Probably not for a personal
  portfolio — confirm.
- Structured data for the person: ensure `Person` `sameAs` links to the real
  social profiles (from Section B of the checklist).

**Required changes**
- Filtered list pages: `canonical` to the unfiltered list; `noindex` the
  parameterised variants (or index a curated few). → T-1501/T-1506.
- Localise the route segments for TR (`/tr/projeler`, `/tr/hakkinda`, …) via
  `next-intl` pathnames — reconsider OQ-006 with a lean toward doing it; it's
  cheaper in Next 15 than the plan implies.
- Pre-launch checklist: "sitemap NOT submitted to Search Console until real
  content is published and reviewed" as an explicit gate. → T-2009.
- Confirm unpublished/preview URLs return HTTP 404/401, not 200. → CF-06/CF-07
  assert status codes.

**Verdict:** ⚠️ Approve with conditions (list-page canonicalisation; reconsider localised path segments).

---

## Consolidated required changes (fold into the backlog before/early in build)

| # | Change | From | Target task |
|---|---|---|---|
| R1 | Pick **one** home-page curation mechanism (Featured rail) + a success metric | Product, UX | ADR + T-0602 |
| R2 | Case-study "TL;DR" band above the fold + mobile "on this page" menu | UX | T-0904, T-0604e |
| R3 | Skills: show years/context, document the meter legend | Product, UX | T-1302, T-0606 |
| R4 | Preview mechanism ADR (service-role confined to the preview route + test) | Architect, Security | ADR + T-0811 |
| R5 | Choose a **shared** rate-limit store (Upstash/Vercel KV) | Architect, Security, DevOps | T-1703, [01 §1.7] |
| R6 | `supabase db diff` schema-drift gate in CI + Supabase CLI config-as-code | Architect, DevOps | T-0413, T-0401 |
| R7 | **Transactional** publish/unpublish/archive/restore (RPC) | Backend | T-0808 |
| R8 | Single `public_projects` view/RPC encoding the publication predicate | Backend, QA | T-0403, T-0703 |
| R9 | `project_slug_history` + redirect (or hard-lock slug post-publish) | Backend | new task, EPIC 08 |
| R10 | Tighten `media` RLS — no blanket anon `SELECT`; published-referenced only | DB Architect, Security | T-0409 |
| R11 | Constrain `project_highlights.kind`; `taxonomy_terms` delete = `RESTRICT` | DB Architect | T-0403, T-0405 |
| R12 | **MFA/TOTP required** for admin (flip OQ-004 default) | Security | T-0502, [10 §10.2] |
| R13 | Eliminate `style-src 'unsafe-inline'` or document a compensating control | Frontend, Security | T-1705 |
| R14 | Precise `?next=` open-redirect validation (same-origin `/admin/` path only) | Security | T-1708 |
| R15 | Supabase project hardening (disable unused auto-APIs, review default roles/storage policies) | Security | new subtask, EPIC 17 |
| R16 | Pick the Markdown **editor** component; re-size T-0804 | Frontend | Sprint 2, T-0804 |
| R17 | CI integration DB = plain Postgres + migrations; Supabase container nightly | QA | T-1802 |
| R18 | E2E data isolation (namespaced fixtures / ephemeral schema per run) | QA | T-1804, T-1807 |
| R19 | "Revalidate the right tags for every mutation" iterating test | QA | T-0703 |
| R20 | Filtered list pages `canonical` → unfiltered; `noindex` param variants | SEO | T-1501, T-1506 |
| R21 | Reconsider localised route segments for TR (`/tr/projeler` …) | SEO | OQ-006, T-1101 |
| R22 | Pre-launch gate: sitemap not submitted until real content reviewed | SEO | T-2009 |
| R23 | Named a11y audit owner + per-sprint cadence from Sprint 3 | QA, UX | [08], [11] |
| R24 | Founder decisions on Supabase/Vercel plans + domain before Sprint 6 | DevOps | OQ-007, MISS-09 |

## Overall verdict

**⚠️ Approve the plan to proceed to `authorize-build`, with the 24 required
changes above tracked in the backlog.**

None of the findings invalidate the architecture, the data model, or the
sequencing. The blockers identified (MFA, shared rate-limit store, Supabase
hardening, CSP, transactional publish, media RLS) are **implementation-level**
and are gated before *production*, not before *build start*. The plan is
technically coherent.

Recommended next step: the Human Founder reviews this package (especially
[12](12-risks-open-questions.md) and [13](13-content-intake-checklist.md)), then
runs `ai-company project authorize-build qa-portfolio`.
