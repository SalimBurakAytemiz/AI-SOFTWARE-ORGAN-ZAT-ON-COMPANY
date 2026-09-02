---
project: qa-portfolio
output: "12 — Risks & Open Questions"
lifecycle_state: PLAN_READY
---

# 12 — Risks & Open Questions

## 12.1 Governance / process conflicts (resolve before build)

### OQ-000 — "Continue to implementation" vs the repository constitution

| | |
|---|---|
| **Requirement** | The master spec's "IMPORTANT EXECUTION RULE": *"After planning is complete and technically coherent, continue with the implementation workflow."* |
| **Technical / governance conflict** | `CLAUDE.md` §13 prohibits building any project's application code in this phase. Project Factory (`docs/project-factory.md`) requires `ai-company project authorize-build qa-portfolio` by the **Human Founder** (RISK 5, audited) before Runtime V1.1 may execute a project. No AI agent may perform a critical action without explicit Human Founder approval (`CLAUDE.md` §2). |
| **Recommended resolution** | Treat the planning package as the deliverable of this session. **Stop** at the Human Founder build-authorization gate. Implementation begins only after the Founder runs `authorize-build` and Runtime V1.1 drives the `feature-development` workflow, which itself stops at `HUMAN_APPROVAL_REQUIRED` before any production step. |
| **Impact** | None negative: the plan is complete and coherent; the only thing deferred is the *authorization to start coding*, which is a deliberate, one-command Founder decision. The safest, most maintainable path. |
| **Status** | **RESOLVED** — recorded in `decisions/decision-log.md` (ADR-0001). |

### CONFLICT-01 — "Featured" / "Archived" as both a project *type* and a *status*

| | |
|---|---|
| **Requirement** | The spec lists project types as *Featured, Professional, Supported, Personal, QA Lab, Archived* **and separately** lists statuses *Draft / Published / Archived* plus flags *visible / featured / supported*. |
| **Technical conflict** | "Featured" and "Archived" cannot be both a mutually-exclusive classification *and* an independent flag/status without ambiguous states (e.g. "a Featured project that is Archived"). |
| **Recommended resolution** | `classification ∈ {professional, supported, personal, qa_lab}` (the *kind* of work); `featured` = boolean flag (any professional/supported/personal project may be featured); `archived` = a value of `status ∈ {draft, published, archived}`. `supported` also kept as a mirror boolean for fast queries. |
| **Impact** | Clean, unambiguous data model ([02 §2.13](02-database-schema.md)); the admin UI shows classification as a radio and featured/visible as toggles; no functionality lost. |
| **Status** | **RESOLVED** — ADR-0002. |

### CONFLICT-02 — `/about` vs `/experience` (two routes for overlapping content)

| | |
|---|---|
| **Requirement** | Output 03 lists both `/about` and `/experience`. |
| **Conflict** | Overlapping data (bio, skills, education, certs, timeline) risks duplicate-content SEO issues and maintenance drift. |
| **Recommended resolution** | Keep both as indexable pages with **distinct primary intent**: `/about` = identity + skills + services teaser; `/experience` = career timeline + education + certifications. Shared data, different framing, canonical to self, no cross-duplication of large text blocks. |
| **Impact** | Two focused pages; small extra layout work. Revisit after user testing (OQ-002). |
| **Status** | **RESOLVED (revisit)** — ADR-0003. |

### CONFLICT-03 — Raw table list vs "avoid overengineering"

| | |
|---|---|
| **Requirement** | The spec enumerates ~30 tables **and** says "Do not blindly create every table… avoid overengineering… avoid one giant JSON/HTML structure." |
| **Conflict** | Building all 30 literally overengineers; collapsing to JSON blobs underengineers. |
| **Recommended resolution** | The normalisation decisions in [02 §2.9](02-database-schema.md): merge the three taxonomy tables into one discriminated table + join; fold fixed prose sections into Markdown columns; reuse `projects` for QA Lab; drop `admin_profiles`. Keep structure where the admin UX or filtering needs it (scenarios, bugs, API, SQL). |
| **Impact** | ~25 logical tables, clean editing, no blob. |
| **Status** | **RESOLVED** — ADR-0004. |

## 12.2 Risk register

Scoring: **Likelihood** (L/M/H) × **Impact** (L/M/H). Mitigations map to
[07](07-epics-stories-tasks.md) tasks where applicable.

### Technical risks

| ID | Risk | L | I | Mitigation |
|---|---|---|---|---|
| RISK-001 | **RLS misconfiguration leaks drafts / PII** | M | H | RLS + automated `{role×op×row-state}` matrix as a **release gate** (T-0409, T-1702); child tables gate on parent state; manual review of every policy; preview uses the isolated server module |
| RISK-002 | **Service-role key ends up in a client bundle** | M | H | Isolated `admin-server.ts` module; ESLint `no-restricted-imports`; a CI test that greps the built client bundle for the key (T-1704) |
| RISK-003 | **Stored XSS via Markdown content** | M | H | Strict sanitiser, no raw HTML, safe-link rules, build-time highlighting, CSP with no `unsafe-inline` scripts, XSS corpus test in CI (T-1701, T-1705) |
| RISK-004 | **Supabase free tier pauses the project after 7 days inactivity** → site data-less | M | M | Keep-alive Vercel cron hitting a trivial query; document the paid-tier upgrade; monitor; decide before launch (OQ-007) |
| RISK-005 | **Vercel Hobby tier disallows "commercial use"** — a portfolio marketing a paid service may count | M | M | Confirm terms early; budget for Vercel Pro; the app is portable (standard Next.js) if a move is needed |
| RISK-006 | **ISR / revalidation not firing** → "I published but the site didn't change" | M | M | One `revalidateContent()` helper used everywhere; E2E CF-25 asserts freshness; a manual "revalidate now" admin button as a safety valve |
| RISK-007 | **Schema change needed after Sprint 3** | M | H | Lock schema by end of Sprint 1; migrations in-repo + reviewed; generated types catch breakage; accept that late changes are costly and plan them as their own tasks |
| RISK-008 | **N+1 queries on the case-study page** (7 related tables) | M | M | Batched loaders / single RPC; `EXPLAIN` review (T-1907); ISR means most reads are cached anyway |
| RISK-009 | **Next.js 15 / React 19 / Tailwind v4 churn** (relatively new majors) | M | M | Pin versions; watch release notes; keep abstractions thin; the app is a fairly conventional Next.js site |
| RISK-010 | **Email deliverability** (contact notifications land in spam) | M | M | Pick the provider early; verify sending domain (SPF/DKIM/DMARC); test to Gmail/Outlook; fallback: also surface new messages in the admin dashboard (already planned) |
| RISK-011 | **SVG upload as an XSS vector** | L | H | Default: disallow SVG (T-1203); if enabled, strict sanitise + serve as attachment |
| RISK-012 | **Preview token / draft-preview route exposed** | L | H | Admin session required, `noindex`/`no-store`, robots disallow, isolated read module; E2E CF-07 asserts an anon user is bounced |

### Design / UX risks

| ID | Risk | L | I | Mitigation |
|---|---|---|---|---|
| RISK-020 | **Design reads as "generic freelancer", not "QA engineer"** | M | H | The QA visual language ([06 §6.9](06-design-system.md)); enforce ≥2 QA components per case study (T-0904); Founder sign-off on the hero + case-study comp (T-0211) |
| RISK-021 | **Dark-only theme hurts some readers / print** | L | M | AA contrast validated (T-0201); print stylesheet for the CV/case study; tokens structured for a later light theme (OQ-009) |
| RISK-022 | **The admin project editor is too dense to use comfortably** | M | M | Tabbed structure, autosave, completeness meters, keyboard shortcuts; admin a11y + usability pass (T-1607); Founder does a real content-entry dry run in Sprint 5 |
| RISK-023 | **TR and EN layouts break on differing string lengths** (Turkish translations often run longer than English) | M | M | Test with real-length TR content; fluid type; no fixed-height text containers; visual regression in both locales |

### Database risks

| ID | Risk | L | I | Mitigation |
|---|---|---|---|---|
| RISK-030 | **Translation rows drift** (base updated, translation stale) | M | M | `translation_status` per locale; "last updated" per translation; dashboard translation-gap list (T-0705); publish checklist |
| RISK-031 | **Orphaned media / cascade surprises** | L | M | `*_media_id` FKs are `ON DELETE SET NULL`; delete-guard blocks removing referenced media (T-1205); orphan report job (T-1207) |
| RISK-032 | **`display_order` collisions / gaps after many reorders** | L | L | Reorder writes a full normalised sequence; not user-visible |
| RISK-033 | **Backup/restore never actually tested** | M | H | T-2006 makes a staging restore a Sprint 8 exit criterion |

### Security risks

| ID | Risk | L | I | Mitigation |
|---|---|---|---|---|
| RISK-040 | **Admin credential compromise** (single operator, single password) | M | H | Enable Supabase MFA/TOTP (OQ-004, recommended); login rate limiting; audit log; short sessions |
| RISK-041 | **Contact-form spam / abuse floods the inbox or the email quota** | H | M | Honeypot + timing + app rate limit + DB trigger + optional Turnstile (T-1402/T-1404) |
| RISK-042 | **Dependency vulnerability shipped** | M | M | Trivy/Semgrep/`npm audit` CI gates, Renovate, minimal deps (T-1707) |
| RISK-043 | **CSP too strict → site breaks; too loose → no protection** | M | M | Report-only rollout first, monitor, then enforce (T-1705) |
| RISK-044 | **KVKK/GDPR non-compliance for contact data** | M | H | Privacy notice + explicit consent + retention job + `ip_hash` not raw IP; assign a data-responsibility owner (OQ-005) |

### Content risks

| ID | Risk | L | I | Mitigation |
|---|---|---|---|---|
| RISK-050 | **Missing professional content blocks launch** | H | M | Build with clearly-marked placeholders; [13 — Content Intake Checklist](13-content-intake-checklist.md); site is fully functional with placeholder content; launch gated on the Founder filling it, not on engineering |
| RISK-051 | **NDA breach — a case study reveals a confidential client/detail** | M | H | `nda` / `company_hidden` fields; NDA banner; a **pre-publish NDA self-check** item in the publish dialog; the Founder is the only author and approver of case-study content |
| RISK-052 | **Invented / inaccurate professional claims** | L | H | Hard rule: the team never writes professional facts; all such content comes from the Founder via the checklist; placeholders are visibly fake |
| RISK-053 | **Only one locale of content ready at launch** | M | M | Per-locale publish (`translation_status`); configurable fallback; launch with EN or TR complete and the other following |

### SEO risks

| ID | Risk | L | I | Mitigation |
|---|---|---|---|---|
| RISK-060 | **Draft/preview/admin pages get indexed** | L | H | `noindex` + robots disallow + RLS 404 + `noindex` correctness test (T-1506); sitemap only lists published |
| RISK-061 | **`hreflang` errors** (non-reciprocal, wrong `x-default`) | M | M | Central `hreflang` helper (T-1104); validator in CI + external check |
| RISK-062 | **Thin/duplicate content** (placeholder text at launch, or `/about` ≈ `/experience`) | M | M | Don't submit the sitemap until real content is in; distinct page intents (CONFLICT-02); `noindex` fallback-only pages |
| RISK-063 | **New domain has no authority; slow to rank** | H | L | Expected; out of engineering scope; good technical SEO + real content + backlinks (the Founder's own network) over time |

### Performance risks

| ID | Risk | L | I | Mitigation |
|---|---|---|---|---|
| RISK-070 | **Large case-study pages (many images, code blocks) blow CWV** | M | M | `next/image` + lazy + `sizes`; build-time highlighting; JS budget; Lighthouse gate (T-1507, T-1906) |
| RISK-071 | **Font loading causes CLS** | L | M | `next/font` self-host, subset, `display` strategy (T-1904) |
| RISK-072 | **Too many client components** | M | M | RSC-first; bundle analyser gate (T-1903) |

### Deployment risks

| ID | Risk | L | I | Mitigation |
|---|---|---|---|---|
| RISK-080 | **Prod migration breaks prod** | L | H | Forward-only reviewed migrations; rehearsed on staging; prod apply = Human Founder approval step (T-2003); rollback runbook (T-2004) |
| RISK-081 | **Accidental early production deploy / real data use** | L | H | `CLAUDE.md` §13; prod config *prepared not deployed* (T-2002); pipeline stops at `HUMAN_APPROVAL_REQUIRED`; no real data in any non-prod env |
| RISK-082 | **Secrets misconfigured across the 3 environments** | M | M | `.env.example`, env schema validation at boot (T-0306), per-env secret checklist in T-2009 |
| RISK-083 | **Vendor lock-in (Supabase + Vercel)** | L | M | Both are standard (Postgres + Next.js); migrations + SQL are portable; documented exit path |

### Missing information / credentials (see also [13](13-content-intake-checklist.md))

| ID | Missing item | Needed by | Impact if still missing at that point |
|---|---|---|---|
| MISS-01 | Full CV / résumé (roles, dates, employers, education) | Sprint 5 (Experience) | Experience/About pages ship with placeholders; not launchable |
| MISS-02 | Project list + per-project case-study content (TR + EN) | Sprint 3–4 | Project system works but has no real portfolio; not launchable |
| MISS-03 | Skills list + proficiency + categories | Sprint 5 | Skills matrix placeholder |
| MISS-04 | Certifications (names, issuers, IDs, dates, badges) | Sprint 5 | Certs section placeholder |
| MISS-05 | Services offered + descriptions | Sprint 5 | Services page placeholder |
| MISS-06 | NDA status per project + what may be shown | Sprint 3–4 | Cannot safely publish any professional case study |
| MISS-07 | Contact email / preferred CTA / response-time promise | Sprint 5 | Contact form has no destination |
| MISS-08 | Portrait / brand assets (optional), preferred name spelling | Sprint 2 | Design uses a text identity fallback |
| MISS-09 | Custom domain | Sprint 6 | Canonical URLs / hreflang / email domain unset; blocks hardening |
| MISS-10 | Email provider choice + account | Sprint 5 | Contact notifications don't send |
| MISS-11 | Analytics / Search Console accounts | Sprint 6 | No launch measurement |
| MISS-12 | Default locale preference (TR or EN) | Sprint 2 | Assumed `en`; cheap to change early, costly later |

## 12.3 Open questions

| ID | Question | Owner | Needed by | Default if unanswered |
|---|---|---|---|---|
| OQ-000 | Confirm: planning now, Founder runs `authorize-build` to start implementation | Founder | before Sprint 0 exit | proceed as RESOLVED above |
| OQ-001 | Default locale: **TR or EN**? | Founder | Sprint 2 | `en` (international reach), TR fully available |
| OQ-002 | Merge `/about` + `/experience` into one page? | Founder / UX | after Sprint 3 review | keep separate |
| OQ-003 | Fallback behaviour when a project lacks a translation: **show the other language with a tag**, or **hide it from that locale**? | Founder | Sprint 5 | show + "EN"/"TR" tag |
| OQ-004 | Enable MFA/TOTP for the admin account? (recommended) | Founder | Sprint 1 | enable it |
| OQ-005 | Who owns data-protection responsibility (KVKK/GDPR) for contact submissions? | Founder | before contact form ships | Founder as data controller; documented |
| OQ-006 | Localised slugs (`/tr/projeler/...` vs `/tr/projects/...`) — worth the routing cost? | SEO / Founder | Sprint 5 | keep English, locale-neutral slugs + segment names; revisit |
| OQ-007 | Supabase: stay on free tier (with keep-alive) or budget for Pro? | Founder | before launch | free + keep-alive cron |
| OQ-008 | Contact-message retention period (days)? | Founder | Sprint 5 | 180 days, stated in the privacy notice |
| OQ-009 | Ship a light theme in V1? | Founder / design | Sprint 2 | no; dark-only, tokens ready for later |
| OQ-010 | RSS feed for case studies? | Founder | Sprint 6 | behind a flag, off |
| OQ-011 | Error-monitoring & analytics tools (Sentry? Plausible? Vercel Analytics only?) | Founder / DevOps | Sprint 3 | Vercel Analytics + Speed Insights; Sentry if free tier fits |
| OQ-012 | Second admin/editor account ever needed? | Founder | — | `admin_users.role` reserved; V1 single owner |
| OQ-013 | Blog / writing section later? | Founder | post-V1 | out of scope; the schema (`projects` + Markdown) could extend to it |
| OQ-014 | Testimonials / references on the site? | Founder | post-V1 | out of scope for V1 |

## 12.4 Assumptions made in this plan (flag any that are wrong)

1. Single administrator (the Founder); no visitor accounts.
2. Two locales only (`tr`, `en`); a third is an enum addition, not a redesign.
3. Traffic is low (a portfolio) — ISR + free tiers are sufficient; no CDN-scale
   concerns.
4. No payments, no e-commerce, no external API consumption by the app.
5. The Founder authors and approves all case-study content and confirms NDA
   boundaries before publish.
6. Content will be entered through the admin, not by seeding SQL, in the long run.
7. Hosting = Vercel + Supabase as the spec states; portable if that changes.
8. "Premium technical" design is dark-first; a portrait is optional.
