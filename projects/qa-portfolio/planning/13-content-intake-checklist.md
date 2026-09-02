---
project: qa-portfolio
output: "13 — Content Intake Checklist"
lifecycle_state: PLAN_READY
note: >
  Fill this in with your REAL professional information. The team will NOT invent
  any of it. Everything left blank ships as a visible [PLACEHOLDER] until you
  provide it. Field names match the database schema in 02-database-schema.md so
  content can be entered directly.
---

# 13 — Content Intake Checklist

**How to use this:** copy this file, replace every `▢` / `[PLACEHOLDER]` with
real content, and hand it back. Provide **both TR and EN** for every field marked
*(TR + EN)*. If a language is not ready, mark it `LATER` — the platform supports
per-locale publishing.

**Legend:** `▢` = to provide · *(TR + EN)* = both languages · *(opt)* = optional ·
`⚠ NDA` = confirm what may be shown publicly.

---

## A. Identity & profile  → `profile`, `profile_translations`, `site_settings`

| Field | DB column | Value |
|---|---|---|
| ▢ Full name (exact spelling, casing) | `profile.full_name` | `[PLACEHOLDER]` |
| ▢ Preferred professional title *(TR + EN)* | `profile_translations.headline` | TR: `…` / EN: `…` |
| ▢ Short bio / summary, 1–2 sentences *(TR + EN)* | `profile_translations.summary_md` | TR: `…` / EN: `…` |
| ▢ Full bio, 2–4 paragraphs *(TR + EN)* | `profile_translations.bio_md` | TR: `…` / EN: `…` |
| ▢ Location (City, Country) | `profile.location` | `[PLACEHOLDER: City, Türkiye]` |
| ▢ Years of experience (number) | `profile.years_experience` | `▢` |
| ▢ Public email (shown on the site?) *(opt)* | `profile.email_public` | `▢` / none |
| ▢ Public phone *(opt)* | `profile.phone_public` | `▢` / none |
| ▢ "Available for work" — show the badge? (yes/no) | `profile.available_for_work` | `▢` |
| ▢ Portrait / headshot *(opt)* — file | `profile.avatar_media_id` | attach file |
| ▢ CV / résumé PDF — one file, or one per language? | `profile.resume_media_id` | attach file(s) |
| ▢ Default site language: **TR or EN**? | `site_settings.default_locale` | `▢` (OQ-001) |
| ▢ Site title *(TR + EN)* | `site_settings_translations.site_title` | TR: `…` / EN: `…` |
| ▢ Site tagline *(TR + EN)* | `site_settings_translations.site_tagline` | TR: `…` / EN: `…` |
| ▢ Default meta description *(TR + EN)* | `site_settings_translations.meta_description` | TR: `…` / EN: `…` |
| ▢ Primary call-to-action (e.g. `mailto:`, Calendly link) | `site_settings.primary_cta` | `▢` |
| ▢ Contact-notification email (where new messages go) | `site_settings.contact_notification_email` | `▢` |

## B. Social & external links  → `social_links`

For each link: platform, label, URL, show/hide.

| Platform | URL | Show? |
|---|---|---|
| ▢ GitHub | `▢` | ▢ |
| ▢ LinkedIn | `▢` | ▢ |
| ▢ X / Twitter *(opt)* | `▢` | ▢ |
| ▢ Personal website / blog *(opt)* | `▢` | ▢ |
| ▢ Other *(opt)* | `▢` | ▢ |

## C. Skills  → `skill_categories`, `skills`

First define **categories** (label *(TR + EN)*, order). Suggested starting set —
edit freely:

| Category *(TR + EN)* | Order |
|---|---|
| ▢ Test Automation | 1 |
| ▢ API & Database Testing | 2 |
| ▢ Performance Testing | 3 |
| ▢ CI/CD & Tooling | 4 |
| ▢ Test Management / Process | 5 |
| ▢ Programming / Scripting | 6 |

Then for **each skill**:

| Skill (name) | Category | Proficiency 1–5 *(opt)* | Years *(opt)* | Featured? | Show? |
|---|---|---|---|---|---|
| ▢ `[e.g. Playwright]` | `▢` | `▢` | `▢` | `▢` | `▢` |
| ▢ … | | | | | |

> Provide as many rows as you want. Tool names are **not** translated.

## D. Experience  → `experience`, `experience_translations`

For **each role** (most recent first):

| Field | DB column | Value |
|---|---|---|
| ▢ Company / client name | `experience.company` | `[PLACEHOLDER]` |
| ▢ ⚠ NDA — hide the company name? (show "Confidential") | `experience.company_hidden` | `▢` |
| ▢ Location *(opt)* | `experience.location` | `▢` |
| ▢ Employment type (full_time / part_time / contract / freelance / internship) | `experience.employment_type` | `▢` |
| ▢ Start date (YYYY-MM) | `experience.start_date` | `▢` |
| ▢ End date (YYYY-MM) or "current" | `experience.end_date` / `is_current` | `▢` |
| ▢ Role title *(TR + EN)* | `experience_translations.role_title` | TR: `…` / EN: `…` |
| ▢ Summary of the role, 2–4 sentences *(TR + EN)* | `experience_translations.summary_md` | TR: `…` / EN: `…` |
| ▢ Key achievements / responsibilities, bullet list *(TR + EN)* | `experience_translations.highlights_md` | TR: `…` / EN: `…` |
| ▢ Show on the site? | `experience.visible` | `▢` |

*(Repeat the block for every role.)*

## E. Education  → `education`, `education_translations`

For **each entry**:

| Field | Value |
|---|---|
| ▢ Institution name | `[PLACEHOLDER]` |
| ▢ Degree title *(TR + EN)* | TR: `…` / EN: `…` |
| ▢ Field of study *(opt)* | `▢` |
| ▢ Start / end year | `▢` – `▢` |
| ▢ Notes *(TR + EN, opt)* | TR: `…` / EN: `…` |
| ▢ Show? | `▢` |

## F. Certifications  → `certifications`

For **each certification**:

| Field | Value |
|---|---|
| ▢ Name (e.g. "ISTQB Certified Tester — Foundation Level") | `[PLACEHOLDER]` |
| ▢ Issuing organisation | `▢` |
| ▢ Issue date | `▢` |
| ▢ Expiry date *(opt)* | `▢` |
| ▢ Credential ID *(opt)* | `▢` |
| ▢ Verification URL *(opt)* | `▢` |
| ▢ Badge image *(opt)* — file | attach |
| ▢ Show? | `▢` |

## G. Services  → `services`, `service_translations`

For **each service you offer**:

| Field | Value |
|---|---|
| ▢ Slug (short id, e.g. `test-strategy`) | `▢` |
| ▢ Icon *(opt)* — name or file | `▢` |
| ▢ Title *(TR + EN)* | TR: `…` / EN: `…` |
| ▢ Description, 2–4 sentences *(TR + EN)* | TR: `…` / EN: `…` |
| ▢ Outcome / deliverable, 1 sentence *(TR + EN, opt)* | TR: `…` / EN: `…` |
| ▢ Show? / order | `▢` |

*(opt)* Engagement-model steps (e.g. Discovery → Test plan → Implementation →
Handover) *(TR + EN)*: `▢`

## H. Taxonomy terms  → `taxonomy_terms`

The controlled vocabulary used to tag projects. Provide label *(TR + EN)* per
term. Suggested starters — add/remove freely:

| Kind | Terms (label TR / EN) |
|---|---|
| ▢ platform | Web, Mobile (iOS/Android), API, Desktop, … |
| ▢ tool | Playwright, Cypress, Selenium, Postman, REST Assured, k6, JMeter, GitHub Actions, Jira, TestRail, Charles, … |
| ▢ test_type | Functional, Regression, Automation, API, Performance, Security, Accessibility, Exploratory, Integration, E2E, … |
| ▢ industry | Fintech, E-commerce, SaaS, Healthtech, Gaming, Public sector, … |

## I. Projects & case studies  → `projects` + all `project_*` tables

**This is the core of the portfolio.** For **each project**, fill a block. Start
with your 3–6 strongest; add the rest over time.

### I.1 Project metadata  → `projects`

| Field | DB column | Value |
|---|---|---|
| ▢ Project title *(TR + EN)* | `project_translations.title` | TR: `…` / EN: `…` |
| ▢ Slug (URL id, English, kebab-case) | `projects.slug` | `▢` |
| ▢ One-line summary *(TR + EN)* | `project_translations.summary` | TR: `…` / EN: `…` |
| ▢ Classification: professional / supported / personal / qa_lab | `projects.classification` | `▢` |
| ▢ Featured on the home page? | `projects.featured` | `▢` |
| ▢ Visible? (usually yes) | `projects.visible` | `▢` |
| ▢ Display order (number, lower = earlier) *(opt)* | `projects.display_order` | `▢` |
| ▢ Company / client | `projects.company` | `[PLACEHOLDER]` |
| ▢ ⚠ NDA — hide company (show "Confidential")? | `projects.company_hidden` | `▢` |
| ▢ ⚠ Under NDA overall? (restricts what the template shows) | `projects.nda` | `▢` |
| ▢ Your role title *(TR + EN)* | `project_translations.role_title` | TR: `…` / EN: `…` |
| ▢ Industry (taxonomy) | `project_taxonomy` (kind=industry) | `▢` |
| ▢ Period (start / end, YYYY-MM) or "ongoing" | `projects.start_date` / `end_date` / `is_ongoing` | `▢` |
| ▢ GitHub URL *(opt)* | `projects.github_url` | `▢` |
| ▢ Live / external URL *(opt)* | `projects.external_url` | `▢` |
| ▢ Cover image — file | `projects.cover_media_id` | attach |
| ▢ Platforms (taxonomy) | `project_taxonomy` (kind=platform) | `▢` |
| ▢ Tools (taxonomy) | `project_taxonomy` (kind=tool) | `▢` |
| ▢ Test types (taxonomy) | `project_taxonomy` (kind=test_type) | `▢` |

### I.2 Case-study prose  → `project_translations` (Markdown, *(TR + EN)* each)

| Section | DB column | Provide *(TR + EN)* |
|---|---|---|
| ▢ Overview — what the product/project was | `overview_md` | `…` |
| ▢ Testing scope — what was in / out of scope | `testing_scope_md` | `…` |
| ▢ Test strategy — approach, levels, types, tooling, environments | `test_strategy_md` | `…` |
| ▢ Test coverage — areas covered + rough % or maturity *(opt)* | `test_coverage_md` | `…` |
| ▢ Challenges — hardest problems and how you handled them | `challenges_md` | `…` |
| ▢ Impact — measurable results (defects found, time saved, releases stabilised) | `impact_md` | `…` |
| ▢ Lessons learned | `lessons_md` | `…` |
| ▢ Highlights / responsibilities — short bullets *(TR + EN)* | `project_highlights` | `…` |
| ▢ SEO title + description *(TR + EN, opt — defaults to summary)* | `project_translations.seo_*` | `…` |

### I.3 Test scenarios  → `test_scenarios` (+ translations). *Per scenario:*

| Field | Value |
|---|---|
| ▢ Code (e.g. TS-01) | `▢` |
| ▢ Priority (p0–p3) | `▢` |
| ▢ Kind (functional / regression / automation / api / performance / security / accessibility / exploratory / integration / e2e) | `▢` |
| ▢ Automated? | `▢` |
| ▢ Title *(TR + EN)* | `…` |
| ▢ Preconditions *(TR + EN, opt)* | `…` |
| ▢ Steps *(TR + EN)* | `…` |
| ▢ Expected result *(TR + EN)* | `…` |
| ▢ Notes *(TR + EN, opt)* | `…` |

### I.4 Bug examples  → `bug_reports` (+ translations). *Per bug:*

| Field | Value |
|---|---|
| ▢ Code (e.g. BUG-01) | `▢` |
| ▢ Severity (blocker / critical / major / minor / trivial) | `▢` |
| ▢ State (open / fixed / wont_fix / deferred / by_design) | `▢` |
| ▢ Environment *(opt)* | `▢` |
| ▢ Found in version *(opt)* | `▢` |
| ▢ Title *(TR + EN)* | `…` |
| ▢ Summary *(TR + EN)* | `…` |
| ▢ Steps to reproduce *(TR + EN)* | `…` |
| ▢ Expected *(TR + EN)* | `…` |
| ▢ Actual *(TR + EN)* | `…` |
| ▢ Root cause *(TR + EN, opt)* | `…` |
| ▢ Resolution *(TR + EN, opt)* | `…` |
| ▢ ⚠ Confirm this bug may be described publicly (no confidential data / screenshots) | `▢` |

### I.5 API testing examples  → `api_examples` (+ translations). *Per example:*

| Field | Value |
|---|---|
| ▢ Code (e.g. API-01) | `▢` |
| ▢ Method (GET/POST/PUT/PATCH/DELETE) | `▢` |
| ▢ Endpoint (sanitised — no real secrets/hosts if confidential) | `▢` |
| ▢ Request headers *(opt, JSON)* | `▢` |
| ▢ Request body *(opt)* | `▢` |
| ▢ Response status | `▢` |
| ▢ Response body *(opt, redact sensitive values)* | `▢` |
| ▢ Title *(TR + EN)* | `…` |
| ▢ Notes — what this call demonstrates *(TR + EN)* | `…` |

### I.6 SQL / database validation  → `sql_examples` (+ translations). *Per example:*

| Field | Value |
|---|---|
| ▢ Code (e.g. SQL-01) | `▢` |
| ▢ Dialect (postgres / mysql / mssql / …) | `▢` |
| ▢ Query (sanitised) | `▢` |
| ▢ Sample result *(opt, redacted)* | `▢` |
| ▢ Title *(TR + EN)* | `…` |
| ▢ Explanation *(TR + EN)* | `…` |

### I.7 Project media / gallery  → `project_media` + `media`

| Field | Value |
|---|---|
| ▢ Images (screenshots, dashboards, diagrams) — files | attach |
| ▢ For each: role (cover / gallery / diagram / screenshot) | `▢` |
| ▢ For each: alt text *(TR + EN — required for the default locale)* | `…` |
| ▢ For each: caption *(TR + EN, opt)* | `…` |
| ▢ ⚠ Confirm no image contains confidential data, real customer PII, or unredacted internal URLs | `▢` |

## J. Media library (site-wide, non-project)  → `media`, `media_translations`

| Item | Value |
|---|---|
| ▢ Logo / wordmark *(opt)* | attach |
| ▢ Favicon source (512×512 PNG) *(opt — design can generate)* | attach |
| ▢ Default social share image (OG) *(opt — design can generate)* | attach |
| ▢ Any diagrams for About/Services *(opt)* | attach |

## K. Legal / compliance  → `/legal/*`, privacy notice

| Item | Value |
|---|---|
| ▢ Full legal name for the imprint | `[PLACEHOLDER]` |
| ▢ Contact address / method for legal notices (can be an email) | `▢` |
| ▢ Data controller name (KVKK/GDPR) — likely you | `▢` |
| ▢ Contact-message retention period (days) | `▢` (default 180) |
| ▢ Any existing privacy-policy text you want used *(TR + EN, opt — otherwise the team drafts a standard notice for your review)* | `…` |
| ▢ Cookie/analytics disclosure needs (which analytics, if any) | `▢` |

## L. Infrastructure & accounts (for DevOps)

| Item | Value |
|---|---|
| ▢ Custom domain (registered? registrar?) | `▢` |
| ▢ Who controls DNS | `▢` |
| ▢ Supabase account owner + plan (free / Pro) | `▢` |
| ▢ Vercel account owner + plan (Hobby / Pro) | `▢` |
| ▢ Transactional email provider choice (Resend / other) + who owns the account | `▢` |
| ▢ Error monitoring preference (Sentry / none) | `▢` |
| ▢ Analytics preference (Vercel Analytics / Plausible / GA4 / none) | `▢` |
| ▢ Google Search Console access | `▢` |

## M. Brand / voice preferences  → design & copy

| Item | Value |
|---|---|
| ▢ Any portfolios/sites you like (for *rigour* reference, not cloning) | `▢` |
| ▢ Accent colour preference: technical green (default) / electric indigo / other | `▢` |
| ▢ Tone: formal / direct / conversational | `▢` |
| ▢ Any words/claims to avoid | `▢` |
| ▢ Name pronunciation / preferred short form *(opt)* | `▢` |

---

## Minimum set to launch (everything else can follow)

To take the site live you need, **at minimum**:
1. Section A (identity, default locale, contact email).
2. Section B (at least GitHub + LinkedIn).
3. Section C (skills — even a partial list).
4. Section D (experience — at least current + previous role).
5. Section I — **at least 3 published projects** with I.1 + I.2 filled in one
   language, NDA confirmed (I.7/I.4 confirmations).
6. Section K (legal name, retention period, analytics disclosure).
7. Section L (domain + email provider).

Certifications, education, services, QA Lab, additional projects, and the second
language can all be added incrementally through the admin after launch.
