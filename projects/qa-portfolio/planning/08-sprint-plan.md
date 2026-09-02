---
project: qa-portfolio
output: "08 — Sprint / Development Phase Plan"
lifecycle_state: PLAN_READY
---

# 08 — Sprint / Development Phase Plan

## 8.1 How this plan is built

Sprints are ordered by **technical dependency**, not by feature glamour. The hard
constraint chain is:

```
build authorization → app skeleton + CI → DB schema + is_admin() + RLS
  → Supabase clients + auth → locale routing + design tokens
  → public read pages   ┐
  → admin shell + CMS   ┘ (parallelisable once the base is in)
  → structured QA content + media + i18n parity
  → SEO + a11y + security + performance hardening
  → full E2E + fix pass
  → deployment prep → Human Founder production approval
```

No calendar durations are assigned (team size and the Founder's content-entry
pace are unknown — RISK-013). Each sprint has **entry** and **exit** criteria;
a sprint is done when its exit criteria are demonstrably met (tests + evidence),
not when time runs out.

"Sprint" here = a coherent phase. If the team runs 1–2 week iterations, several
phases will span multiple iterations (Sprint 3 and 6 especially).

## 8.2 Sprint map

| Sprint | Theme | Primary epics | Runs in parallel? |
|---|---|---|---|
| **0** | Planning, design foundation, project skeleton | 01, 02 (start), 03 | design + scaffold in parallel |
| **1** | Supabase, schema, RLS, auth | 04, 05, 18 (harness) | — (foundational, mostly serial) |
| **2** | Design system complete, locale + app shell | 02 (finish), 11 (routing), 03 (finish) | design vs routing in parallel |
| **3** | Public read site + Admin shell + Project CMS core | 06, 07, 08 | **public team ‖ admin team** |
| **4** | Structured QA content, QA Lab, Media | 08 (artifacts), 09, 10, 12 | CMS artifacts ‖ media |
| **5** | TR/EN parity, résumé modules, Contact | 11, 13, 14 | modules ‖ contact |
| **6** | SEO, Accessibility, Security, Performance | 15, 16, 17, 19 | four hardening tracks in parallel |
| **7** | Full automated testing + bug-fix + production hardening | 18, plus fixes across all | test authoring ‖ fixing |
| **8** | Deployment prep, docs, release approval | 20 | — |

## 8.3 Sprint detail

### Sprint 0 — Planning & Foundation
**Entry:** this planning package exists.
**Work:** T-0101→T-0104 (planning + review + decision log + **build
authorization**); T-0301→T-0303, T-0306 (Next.js skeleton, tooling, env schema);
T-0201, T-0202, T-0211 (palette, fonts, first comps); T-1801 (unit harness).
**Exit:**
- Human Founder has run `ai-company project authorize-build qa-portfolio`.
- `next build` + `tsc` + `lint` clean in CI (T-0304 at least skeletal).
- `tokens.css` v0 + hero direction chosen.
- Repo conventions documented.

### Sprint 1 — Data & Identity
**Entry:** Sprint 0 exit; Supabase projects provisioned (T-0401).
**Work:** T-0402→T-0413 (all migrations, `is_admin()`, indexes, generated types,
seed, migration runbook); **T-0409 + T-1702** (RLS policies + automated policy
matrix — do them together); T-0501→T-0507 (Supabase clients, auth routes,
middleware guard, admin layout gate, login rate limiting, provisioning runbook);
T-1802 (DB/RLS integration tests); T-2001 (preview deploys → staging).
**Exit:**
- Every table has RLS; the anon×admin × CRUD × published/draft **test matrix is
  green in CI**.
- An admin can log in on staging; a non-admin cannot reach `/admin`.
- Service-role client provably not importable from client code (lint + test).
- Migrations apply cleanly to staging from a clean slate.

### Sprint 2 — Design System & App Shell
**Entry:** Sprint 1 exit.
**Work:** T-0203→T-0210 (components, layout primitives, nav, feedback, motion,
gallery route); T-0704, T-1101, T-1102 (start), T-1107 (locale routing + catalogs
+ path-preserving switch); T-0305, T-0308 (error/not-found segments, security
headers); T-1704, T-1705 (secret hygiene, CSP report-only).
**Exit:**
- Component gallery renders every component in every state; visual snapshots
  baselined (T-0209).
- `/` redirects to default locale; `/tr` and `/en` shells render with real
  chrome; unknown locale 404s.
- No hard-coded user-facing strings (lint rule active).
- securityheaders.com grade A on staging.

### Sprint 3 — Public Site + Admin CMS Core  *(two tracks)*
**Entry:** Sprint 2 exit.

**Track A — Public read site:** T-0601, T-0602 (home), T-0603 (projects list +
filters), T-0604a–e (case study — the XL, now 5 tasks), T-0606, T-0607 (about,
experience), T-0608 (services), T-0609, T-0610, T-0611 (contact shell, legal,
404). T-1907 (query performance).

**Track B — Admin + Project CMS:** T-0701 (shell), T-0702, T-0703 (mutation infra
+ revalidate), T-0705 (dashboard), T-0706 (DataTable), T-0707 (unsaved guard),
T-0801, T-0802 (zod schemas + editor shell), T-0803 (details/classification/
taxonomy tabs), T-0804 (TR/EN content tab), T-0808, T-0809 (publish + lifecycle
actions), T-0811 (preview route), T-1701 (Markdown sanitisation — needed by both).

**Exit:**
- A project can be created, saved as draft, previewed, and published from the
  admin; the published project appears on the public list + detail after
  revalidation; a draft is **never** publicly reachable (E2E T-1804b passes).
- All public pages render from the DB with placeholder seed content, AA-clean,
  LCP < 2.5s on staging.
- Unpublish / hide / archive / restore all work and write audit entries.

### Sprint 4 — Structured QA Content + Media + QA Lab
**Entry:** Sprint 3 exit.
**Work:** T-0805a–d (scenario / bug / API / SQL editors), T-0806 (media tab),
T-0807 (SEO tab), T-0810 (duplicate), T-0604c re-check (public rendering of
artifacts), T-0901→T-0904 (case-study contract, coverage meter, partial states,
evidence rule); T-1201→T-1206 (media library, upload pipeline, SVG policy,
`next/image`, delete guard, alt gate); T-1001→T-1004 (QA Lab admin + public +
flag); T-0206 finalised (QA components).
**Exit:**
- A full case study with all four artifact types renders correctly public-side,
  including empty/partial blocks.
- Media upload → attach → public image with localised alt text works end to end
  (E2E T-1804e); disallowed file types rejected server-side.
- QA Lab section works and can be toggled off by flag.

### Sprint 5 — Localisation Parity + Résumé Modules + Contact
**Entry:** Sprint 4 exit.
**Work:** T-1102 (finish all catalogs), T-1103 (fallback policy), T-1104 (hreflang
+ localised metadata), T-1105, T-1106 (formatting, Turkish casing); T-1301→T-1307
(experience, skills, services, education, certifications admin + settings/profile
+ public wiring); T-1401→T-1406 (contact form, `/api/contact`, mailer, inbox,
retention, optional CAPTCHA flag).
**Exit:**
- Every public route has complete TR + EN content paths and correct reciprocal
  `hreflang`/canonical (validator passes).
- All résumé modules are fully editable in the admin and rendered on About /
  Experience.
- Contact form: happy path emails the owner; spam/honeypot/rate-limit paths
  blocked; messages land in the inbox (E2E T-1804f).

### Sprint 6 — Hardening: SEO · A11y · Security · Performance  *(four tracks)*
**Entry:** Sprint 5 exit (feature-complete).
**Work:**
- **SEO:** T-1501→T-1507 (metadata, sitemap, robots, JSON-LD, OG images,
  noindex audit, CWV budget in CI).
- **A11y:** T-1601→T-1607 (landmarks, keyboard, forms, contrast/non-colour,
  reduced motion, CI axe, admin pass).
- **Security:** T-1702 (re-run), T-1703, T-1705 (CSP enforce), T-1706 (uploads),
  T-1707 (dep/container scan), T-1708 (auth hardening), T-1710 (pre-launch
  security review + fix).
- **Performance:** T-1901→T-1907 (render strategy, images, JS budget, fonts,
  caching, Lighthouse ≥95, query perf).
**Exit:**
- axe: 0 serious/critical on all public routes; documented keyboard path.
- Lighthouse ≥ 95 perf/BP/SEO, a11y ≥ 100 on home, projects, a case study,
  contact.
- CSP enforced with no `unsafe-inline` scripts; dep scan gate green.
- Security review sign-off: 0 criticals.

### Sprint 7 — Full Automated Testing + Fix Pass
**Entry:** Sprint 6 exit.
**Work:** T-1803, T-1804a–f (E2E for every critical flow), T-1805 (visual
regression), T-1806 (axe + Lighthouse CI), T-1807 (fixtures), T-1808 (flake
policy); regression fixes surfaced by the suites; T-1907 final query audit.
**Exit:**
- Every critical business flow in [11](11-test-strategy.md) has a passing E2E
  spec running against a preview deploy.
- Coverage gates met (`lib/` ≥ 80%; critical flows 100% covered).
- Zero P0/P1 known defects; P2/P3 triaged.

### Sprint 8 — Deployment, Documentation, Release
**Entry:** Sprint 7 exit.
**Work:** T-2002 (prod config — prepared), T-2003 (migration runbook rehearsed),
T-2004 (rollback rehearsed), T-2005 (monitoring), T-2006 (backup + restore test),
T-2007 (owner docs), T-2008 (dev docs), T-2009 (pre-launch checklist),
**T-2010 (Human Founder production-deploy approval package)**.
**Exit:**
- Pre-launch checklist 100% with linked evidence.
- Restore-from-backup verified on staging.
- Approval package assembled; **the pipeline STOPS at
  `HUMAN_APPROVAL_REQUIRED`** — production deployment happens only on explicit
  Human Founder approval (`CLAUDE.md` §2). Nothing here authorizes the deploy
  itself.

## 8.4 Parallelisation & team shape

| If team is… | Then |
|---|---|
| 1 engineer | Sprints run mostly serial; Sprint 3 track A then B; Sprint 6 tracks sequenced SEO→A11y→Security→Perf; expect the long pole to be Sprint 3–4 |
| 2 engineers | Split Sprint 3 (public ‖ admin) and Sprint 6 (2+2 tracks); design supports both |
| + designer | Design runs one sprint ahead from Sprint 0; hands comps before each UI sprint |
| + QA/test engineer (the Founder's own domain) | Owns EPIC 18 from Sprint 1, writes E2E specs alongside features rather than only in Sprint 7 |

## 8.5 Definition of Done (every task)

1. Code + tests written; unit/integration/E2E as applicable **pass in CI**.
2. Localised (TR + EN) if user-facing; no hard-coded strings.
3. AA accessible if UI; keyboard + SR checked for interactive components.
4. RLS respected; no new secret exposure; no service-role in client.
5. Independent review (never the implementer) approved — mirrors the runtime's
   `feature-development` workflow.
6. Docs/decision-log updated if behaviour or architecture changed.
7. Evidence attached (test output, screenshot, Lighthouse run) — "files created"
   is not "done" (`CLAUDE.md` §14).

## 8.6 Milestones (dependency-defined, not dated)

| Milestone | Met when |
|---|---|
| **M1 — Secure data layer** | Sprint 1 exit (RLS matrix green, auth works) |
| **M2 — Walking skeleton** | Sprint 2 exit (localised shell + design system) |
| **M3 — Publish loop closed** | Sprint 3 exit (create→publish→public, draft never leaks) |
| **M4 — Content-complete CMS** | Sprint 4–5 exit (all content types + i18n parity + contact) |
| **M5 — Quality bar met** | Sprint 6–7 exit (SEO/a11y/security/perf gates + full E2E) |
| **M6 — Release-ready** | Sprint 8 exit (approval package; awaiting Human Founder) |
