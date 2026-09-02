---
project: qa-portfolio
output: "11 — Test Strategy"
lifecycle_state: PLAN_READY
note: This site belongs to a Software QA Engineer. Quality is a first-class deliverable and part of the portfolio's credibility.
---

# 11 — Test Strategy

## 11.1 Objectives & principles

1. **The test suite is itself a portfolio artifact.** It should be exemplary —
   clean, readable, deterministic, well-layered.
2. **Shift left.** Tests are written with features, not in a "Sprint 7" bucket
   (Sprint 7 is for the *full* E2E sweep and the fix pass, not first coverage).
3. **Test at the cheapest layer that gives confidence.** Pyramid, not ice-cream
   cone: many unit, fewer integration, a focused set of E2E for business flows.
4. **Every bug fix ships with a regression test** that fails before the fix.
5. **Gates block merges.** A red required check = no merge (mirrors the runtime's
   QA gate + independent-review model).

## 11.2 Test types & tooling

| Layer | Tool (proposal) | Scope | Runs |
|---|---|---|---|
| Static | `tsc --noEmit`, ESLint, Prettier, `knip` (dead code) | types, lint, unused | pre-commit + CI |
| Unit | **Vitest** | `lib/` (query builders, formatters, `zod` schemas, sanitiser, i18n helpers, rate limiter, slug logic) | CI, watch locally |
| Component | **Vitest + Testing Library** | QA components, forms, cards, meters, nav | CI |
| Integration | **Vitest + local Supabase** (`supabase start`) | query layer against real Postgres + **RLS policies** | CI (service in CI) |
| Contract / schema | Vitest | `zod` ↔ DB types alignment; generated types up to date | CI |
| E2E | **Playwright** (Chromium, Firefox, WebKit) | critical business flows against a **preview deploy** | CI on PR + nightly |
| Visual regression | **Playwright screenshots** | component gallery + key pages, TR & EN, mobile & desktop | CI (diff gate) |
| Accessibility | **@axe-core/playwright** + manual (NVDA/VoiceOver) | all public routes + admin editor | CI (automated) + manual checklist per release |
| Performance | **Lighthouse CI** + bundle-size check | CWV budgets, JS budget per route | CI (budget gate) |
| SEO validation | custom Playwright assertions + external (Rich Results, hreflang validator) | metadata, canonical, sitemap, robots, JSON-LD, `noindex` correctness | CI + pre-launch manual |
| Security | gitleaks, Semgrep, Trivy, XSS corpus, RLS matrix, ZAP baseline | see [10 §10.15](10-security-plan.md) | CI + pre-launch |
| Load (light) | **k6** smoke (the Founder's own tool — fitting) | contact endpoint + ISR pages under modest concurrency | pre-launch, staging only |
| Manual exploratory | session-based, charter-driven | each release; documented as it would be for a client | per release |

## 11.3 Environments

| Env | Purpose | Data | Who |
|---|---|---|---|
| Local | dev + unit/integration | `supabase start` + seed fixtures (placeholder) | engineers |
| CI ephemeral | unit/integration/component | fresh local Supabase per run + fixtures | pipeline |
| Preview (Vercel per PR) | E2E, a11y, Lighthouse, visual | **staging** Supabase, seeded, **no real data** | pipeline + reviewers |
| Staging (persistent) | pre-launch full regression, k6, ZAP, restore test | staging Supabase, realistic placeholder content | team + Founder UAT |
| Production | live | real content | **only after Human Founder approval** |

Test data is **deterministic fixtures** (T-1807): one canonical set of
placeholder projects (each classification, draft + published, NDA + non-NDA,
TR-only + full bilingual, with/without each artifact type), media, résumé rows,
and contact messages. Every suite uses the same fixtures.

## 11.4 Coverage targets

| Area | Target |
|---|---|
| `lib/**` unit lines/branches | ≥ 80% / ≥ 70% |
| `zod` schemas, sanitiser, RLS-critical query helpers | 100% of branches |
| Critical business flows (§11.6) | 100% have a passing E2E spec |
| Public routes | 100% have an a11y (axe) + metadata assertion |
| RLS policy matrix | 100% of `{role × op × row-state}` cells asserted |
| Components in the gallery | 100% have at least a render + interaction test |

Coverage is a floor, not a goal — a green 80% with untested critical paths is a
fail.

## 11.5 Test matrices

### Browser / device matrix (E2E + manual)

| | Chromium | Firefox | WebKit/Safari | Notes |
|---|---|---|---|---|
| Desktop 1440 | ✅ E2E | ✅ E2E | ✅ E2E | full suite |
| Laptop 1280 | ✅ | — | — | sidebar/anchor-rail breakpoint |
| Tablet 768 | ✅ | — | ✅ | nav collapse, grid reflow |
| Mobile 390 (iPhone) | ✅ | — | ✅ | primary mobile target |
| Mobile 360 (Android) | ✅ | — | — | smallest supported |
| Reduced motion | ✅ smoke | — | — | animations disabled |
| Dark (only theme) | ✅ | ✅ | ✅ | — |

### Localisation matrix

| Case | Assert |
|---|---|
| `/tr` and `/en` for every public route | renders, correct language, correct `lang` attr |
| Locale switch on a deep URL with params | path + params preserved, content swaps |
| Project published in EN only, viewed at `/tr` | fallback behaviour per site setting (show+tag OR hide) |
| Project published in both | independent content, reciprocal `hreflang` |
| Turkish casing (`toLocaleUpperCase('tr')`) | no `i`→`I` bug in headings/nav |
| Dates/numbers | TR and EN formats |
| Missing UI catalog key | CI fails (no silent fallback to the key) |

### Publication-state matrix (public visibility)

| `status` | `visible` | `translation_status` (req. locale) | Public list | Public detail | Sitemap |
|---|---|---|---|---|---|
| draft | true | — | ❌ | 404 | ❌ |
| published | true | published | ✅ | ✅ | ✅ |
| published | true | draft/missing | per fallback setting | per fallback | only if shown |
| published | false | published | ❌ | 404 | ❌ |
| archived | any | any | ❌ | 404 | ❌ |

## 11.6 Critical business-flow tests (explicit, per the spec)

Each is one Playwright spec (`e2e/flows/*.spec.ts`), against a preview deploy,
with fixtures. `CF-##` IDs are referenced from [07](07-epics-stories-tasks.md)
T-1804.

| ID | Flow | Given → When → Then |
|---|---|---|
| **CF-01** | Admin login (happy) | Given a valid admin account · When they submit correct credentials · Then they land on `/admin/dashboard` with a session cookie |
| **CF-02** | Admin login (bad) | Given wrong credentials · When submitted 6× · Then generic error each time, backoff after 5, no user enumeration, attempts audited |
| **CF-03** | Unauthorized admin access | Given no session · When GET `/admin/projects` · Then redirect to `/admin/login?next=/admin/projects`; **and** given a logged-in non-allow-listed user · Then 403, not the panel |
| **CF-04** | Create project | Given an admin on `/admin/projects/new` · When they fill details + classification and save · Then a `draft` row exists, audit entry written, editor shows the new id |
| **CF-05** | Save draft | Given an open editor with edits · When "Save draft" · Then data persists, status stays `draft`, autosave also fires |
| **CF-06** | Draft not public | Given a `draft` project with a known slug · When an anon user visits `/en/projects/{slug}` and `/tr/...` · Then 404 (RLS), and it is absent from `/projects` and the sitemap |
| **CF-07** | Preview project | Given an admin · When they open `/admin/projects/{id}/preview` · Then the public case-study template renders with draft data, `noindex` + `no-store`; **and** an anon user hitting that URL is redirected to login |
| **CF-08** | Publish project | Given a draft passing the publish checklist · When "Publish" (both locales) · Then `status=published`, `published_at` set, audit written, revalidation triggered |
| **CF-09** | Published project public | Given CF-08 · When an anon user reloads `/projects` and the detail URL after revalidation · Then the project appears in the list and the detail renders in both locales with correct `hreflang` |
| **CF-10** | Hide project | Given a published project · When admin sets `visible=false` · Then it disappears from public list + detail (404) but stays in `/admin/projects` as "published/hidden" |
| **CF-11** | Unpublish project | Given a published project · When "Unpublish" · Then `status=draft`, gone from public, still editable |
| **CF-12** | Archive project | Given any project · When "Archive" · Then `status=archived`, gone from every public surface, visible in admin under the Archived filter, audit written |
| **CF-13** | Restore project | Given an archived project · When "Restore" · Then `status=draft`; admin can then re-publish; content intact (translations + artifacts) |
| **CF-14** | Featured project | Given a published project · When admin toggles `featured=true` · Then it appears in the Home featured rail and at the top of `/projects` (no filter); untoggle removes it |
| **CF-15** | Supported project | Given a project with `classification=supported` · Then it shows the Supported badge, is filterable by "Supported", and is **not** treated as Featured unless also flagged |
| **CF-16** | Change classification | Given a `personal` project · When admin changes it to `professional` · Then badges/filters/prev-next grouping update after revalidation |
| **CF-17** | Project reordering | Given 3 published projects · When admin drags to reorder · Then `display_order` persists and the public list order matches |
| **CF-18** | TR / EN content | Given a project with distinct TR and EN bodies · Then each locale shows its own content; the switch preserves the slug; EN-only publish shows fallback/hidden per setting at `/tr` |
| **CF-19** | Media upload | Given an admin on `/admin/media` · When they upload a valid PNG · Then a `media` row + storage object exist with dimensions + checksum; an invalid `.exe`/oversized/SVG(if disallowed) is rejected server-side with a clear error |
| **CF-20** | Project image | Given an uploaded image with TR+EN alt text · When attached as a project cover and the project is published · Then the public page renders it via `next/image` with the locale-correct `alt`; **and** attaching an image with no default-locale alt blocks publish |
| **CF-21** | Contact form (happy) | Given the contact page · When a valid message + consent is submitted · Then a `contact_messages` row (`state=new`) is created, a notification email is sent, the form shows success without reload |
| **CF-22** | Contact form (abuse) | Given the contact endpoint · When the honeypot is filled OR submitted < 2s OR the 6th time in an hour · Then it is rejected/ignored, no email, no oracle in the response; the DB trigger also caps it |
| **CF-23** | Contact inbox | Given messages exist · When an admin opens `/admin/messages` · Then bodies render as plain text (an HTML/script payload is inert), and `new→read→replied→archived`/`spam` transitions persist + audit |
| **CF-24** | Sitemap / robots correctness | Then `sitemap.xml` lists only published URLs with reciprocal `hreflang`; `robots.txt` disallows `/admin`, `/api`, preview; `/admin/*` responses carry `X-Robots-Tag: noindex` |
| **CF-25** | Revalidation freshness | Given a published project · When its EN summary is edited and saved · Then the public EN detail reflects the change within one revalidation cycle without a manual redeploy |

## 11.7 Non-functional test plan

| Attribute | Method | Pass bar |
|---|---|---|
| Performance | Lighthouse CI on home / projects / a case study / contact, mobile profile | Perf ≥ 95, LCP < 2.5s, CLS < 0.1, INP < 200ms, TBT < 200ms |
| Bundle size | `@next/bundle-analyzer` gate | public route first-load JS ≤ budget `[set in Sprint 2]` |
| Accessibility | axe (CI) + manual SR pass (checklist below) | 0 serious/critical automated; manual checklist 100% |
| SEO | assertions + external validators | unique localised metadata per route; valid JSON-LD; 0 `noindex` on indexable routes |
| Resilience | kill Supabase in staging → load a cached ISR page | cached pages still serve; a clear error only where live data is required |
| Load (light) | k6: 50 VUs on ISR pages, 5 rps on `/api/contact` for 2 min | ISR p95 < 400ms; contact endpoint rate-limits correctly, no 5xx |
| Data integrity | restore staging from backup, run smoke E2E | site fully functional post-restore |

### Manual accessibility checklist (per release)
- [ ] Keyboard-only: every interactive element reachable + operable; visible focus everywhere
- [ ] Skip link works; landmark regions present; one `h1` per page; logical heading order
- [ ] Screen reader (NVDA + VoiceOver): nav, project card, case-study sections, forms, dialogs, lightbox, admin editor announce correctly
- [ ] Forms: labels, required indication, error text linked + announced (`aria-live`)
- [ ] Status never by colour alone (icon/text present)
- [ ] 200% zoom + 320px width: no loss of content or function, no h-scroll
- [ ] `prefers-reduced-motion`: animations off, content still present
- [ ] Contrast spot-check with a tool on the final palette

## 11.8 Regression strategy

- **Automated regression suite** = all unit + integration + component + the 25
  CF specs + visual snapshots + axe + Lighthouse budgets. Runs on every PR and
  nightly against staging.
- **Regression tests are mandatory for bug fixes** (fail-first).
- **Visual regression** baselines are reviewed and committed deliberately; a diff
  is a blocking review item, not an auto-accept.
- **Flake policy** (T-1808): a flaky spec is quarantined (tagged, still run,
  reported) within 24h and fixed or deleted within a week — never left to
  silently retry.

## 11.9 Test data & privacy in tests

- No real personal data in any non-production environment, ever.
- Fixture emails use `@example.com`; fixture names are obviously fake
  (`[PLACEHOLDER]`-style or `QA Fixture 01`).
- Contact-message fixtures include an XSS/HTML payload case (must render inert).
- Staging DB is periodically reset to the fixture set.

## 11.10 Entry / exit criteria for the QA phase (Sprint 7)

**Entry:** feature-complete (Sprints 3–5 done), hardening tracks (Sprint 6) done.
**Exit (all required):**
- All 25 CF specs green on 3 browsers.
- Unit/integration/component coverage floors met.
- RLS matrix green.
- axe: 0 serious/critical; manual a11y checklist 100%.
- Lighthouse budgets green on the four key routes.
- Security: gitleaks/Semgrep/Trivy green; XSS corpus green; pre-launch review
  sign-off with 0 criticals.
- Restore-from-backup verified on staging.
- 0 open P0/P1 defects; P2/P3 triaged with owners.
- Exploratory session notes recorded.

Meeting these produces the **T-2010 approval package** for the Human Founder —
who alone authorizes the production deployment.

## 11.11 Traceability

A simple matrix (kept in the repo, `docs/traceability.md`) maps:
`requirement (FR/NFR from product/requirements.md) → acceptance criterion →
test id(s) (unit / CF / a11y / perf)`. CI fails if a `must` requirement has no
linked passing test.
