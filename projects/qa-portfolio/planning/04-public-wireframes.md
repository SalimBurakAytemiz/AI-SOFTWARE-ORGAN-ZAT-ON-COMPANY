---
project: qa-portfolio
output: "04 — Public Website Wireframes"
lifecycle_state: PLAN_READY
note: Low-fidelity. Information architecture, hierarchy and content flow only — not visual design (see 06).
---

# 04 — Public Website Wireframes

Conventions: `[ ]` = image/media, `====` = primary heading, `----` = section
divider, `( button )`, `>` = link. Layout shown at desktop width; the
**Responsive** note under each wireframe describes the mobile collapse.

---

## 4.0 Global chrome (all public pages)

```
┌───────────────────────────────────────────────────────────────────────────┐
│  [logo] NAME · QA Engineer      Projects  QA Lab  Experience  Services     │
│                                 About  Contact        [TR|EN]  ( Hire me ) │
└───────────────────────────────────────────────────────────────────────────┘
                              ... page content ...
┌───────────────────────────────────────────────────────────────────────────┐
│  NAME — Software QA Engineer                          > GitHub  > LinkedIn │
│  > Projects  > QA Lab  > Services  > Contact                               │
│  © 2026 · Türkiye   ·   > Privacy (KVKK/GDPR)  ·  > Imprint   [TR|EN]      │
└───────────────────────────────────────────────────────────────────────────┘
```
- Sticky, condensed-on-scroll header. Locale switch preserves the current path
  (`/tr/projects/x` ↔ `/en/projects/x`).
- **Responsive:** nav collapses to a hamburger → full-screen menu; locale +
  "Hire me" stay visible in the bar.

---

## 4.1 HOME  `/[locale]`

```
┌───────────────────────────────────────────────────────────────────────────┐
│  ============  HERO  ============                                          │
│  [PLACEHOLDER: headline — e.g. "I break software so your users don't."]    │
│  One-line positioning: Senior Software QA Engineer · API · Automation · …  │
│  ( View case studies )   ( Download CV )        [ portrait / abstract ]    │
│  ── trust strip: 8y exp · N projects · TR/EN ──                            │
├───────────────────────────────────────────────────────────────────────────┤
│  ----  FEATURED PROJECTS  (projects.featured = true)  ----   > All projects│
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                         │
│  │ [ cover ]   │  │ [ cover ]   │  │ [ cover ]   │   (horizontal scroll    │
│  │ Title       │  │ Title       │  │ Title       │    / 3-up grid)         │
│  │ Role @ Co.  │  │ Confidential│  │ Personal    │                         │
│  │ ·chips·     │  │ NDA         │  │ ·chips·     │                         │
│  │ > Case study│  │ > Case study│  │ > Case study│                         │
│  └─────────────┘  └─────────────┘  └─────────────┘                         │
├───────────────────────────────────────────────────────────────────────────┤
│  ----  WHAT I TEST  (skills strip, grouped by category)  ----              │
│  Automation:  Playwright · Cypress · Selenium        API: Postman · REST…  │
│  Perf: k6 · JMeter        CI: GitHub Actions · …     DB: SQL · …           │
├───────────────────────────────────────────────────────────────────────────┤
│  ----  SELECTED CASE STUDIES  (2–3 deep links w/ 1-line outcomes)  ----    │
│  01 · Title — "cut regression time 60%"                     > Read         │
│  02 · Title — "found 3 release-blocking payment bugs"       > Read         │
├───────────────────────────────────────────────────────────────────────────┤
│  ----  SERVICES TEASER  ----                                               │
│  [icon] Test Strategy   [icon] Automation   [icon] API/DB   > All services │
├───────────────────────────────────────────────────────────────────────────┤
│  ============  CONTACT CTA  ============                                   │
│  "Have a release you don't trust yet?"   ( Get in touch )                  │
└───────────────────────────────────────────────────────────────────────────┘
```
**Hierarchy:** Hero (who + proof) → Featured work → Capability → Depth → Offer →
Action. **Responsive:** featured cards become a 1-up swipe carousel; skills strip
wraps to stacked category rows.

---

## 4.2 PROJECTS  `/[locale]/projects`

```
┌───────────────────────────────────────────────────────────────────────────┐
│  ====  Projects  ====   "Case studies of QA work across N products."       │
├───────────────────────────────────────────────────────────────────────────┤
│  Filters:  [All ▸ Professional ▸ Supported ▸ Personal]                     │
│            Platform:( Web )( Mobile )( API )   Tool:( Playwright )( k6 )…   │
│            Test type:( Automation )( Performance )( Security )   ( Clear )  │
│            Sort: [ Newest ▾ ]                        (12 results)          │
├───────────────────────────────────────────────────────────────────────────┤
│  ── FEATURED (only when no filter active) ──                               │
│  ┌───────────────────────────────┐                                        │
│  │ [ wide cover ]  Title         │  Role @ Company · 2023–2024            │
│  │  outcome one-liner            │  ·Playwright· ·API· ·CI·   > Case study│
│  └───────────────────────────────┘                                        │
├───────────────────────────────────────────────────────────────────────────┤
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                             │
│  │ [ cover ]  │ │ [ cover ]  │ │ [ cover ]  │   responsive grid           │
│  │ Title      │ │ Title      │ │ Title      │   3 / 2 / 1 columns         │
│  │ Prof · Web │ │ Support·API│ │ Personal   │                             │
│  │ ·chips·    │ │ ·chips·    │ │ ·chips·    │                             │
│  │ short sum. │ │ short sum. │ │ short sum. │                             │
│  │ > Case stdy│ │ > Case stdy│ │ > Case stdy│                             │
│  └────────────┘ └────────────┘ └────────────┘                             │
│                     ( Load more / 1 2 3 › )                                │
└───────────────────────────────────────────────────────────────────────────┘
```
- Filters are URL params (`?type=professional&platform=web`) → shareable,
  server-rendered, indexable base page.
- Card shows: cover, title, classification badge, primary platform, up to 3
  taxonomy chips, 1–2 line summary, NDA badge if applicable.
- **Responsive:** filter row collapses into a `( Filters )` button → bottom
  sheet; grid → single column.

---

## 4.3 PROJECT CASE STUDY  `/[locale]/projects/[slug]`

```
┌───────────────────────────────────────────────────────────────────────────┐
│  > Projects / Title                                          [TR|EN]       │
│  ====  PROJECT TITLE  ====                                                 │
│  Summary sentence (1–2 lines).                                             │
│  [ hero cover image ]                                                      │
├──────────────────────────────────────────┬────────────────────────────────┤
│  MAIN COLUMN (prose + structured blocks)  │  META SIDEBAR (sticky)         │
│                                           │  Company: Acme  (or Confid.)   │
│  ## Overview                              │  Role: QA Engineer             │
│  markdown …                               │  Industry: Fintech             │
│                                           │  Period: 2023 – 2024           │
│  ## Testing scope                         │  Platforms: Web, API           │
│  markdown …                               │  Tools: Playwright, k6, …      │
│                                           │  Test types: Automation, Perf  │
│  ## Test strategy                         │  ── links ──                   │
│  markdown …                               │  > GitHub   > Live site        │
│                                           │  ⚠ Some details withheld (NDA) │
│  ## Coverage            [ coverage meter ]│                                │
│  - area … 85%                             │                                │
│                                           │                                │
│  ## Test scenarios                        │                                │
│  ┌───────────────────────────────────────┐│                                │
│  │ TS-01  P0  Automation                 ││                                │
│  │ Title …                               ││                                │
│  │  ▸ Preconditions / Steps / Expected   ││  (accordion rows)              │
│  ├───────────────────────────────────────┤│                                │
│  │ TS-02  P1  API …                      ││                                │
│  └───────────────────────────────────────┘│                                │
│                                           │                                │
│  ## Bug examples                          │                                │
│  ┌ BUG-01 · Critical · Fixed ───────────┐ │                                │
│  │ Title · summary · steps · exp/act ·  │ │                                │
│  │ root cause · resolution              │ │                                │
│  └──────────────────────────────────────┘ │                                │
│                                           │                                │
│  ## API testing                           │                                │
│  ┌ API-01  GET /v1/orders  → 200 ───────┐ │  (request/response code, mono) │
│  │ request { … }  response { … }  notes │ │                                │
│  └──────────────────────────────────────┘ │                                │
│                                           │                                │
│  ## Database validation                   │                                │
│  ┌ SQL-01  postgres ────────────────────┐ │                                │
│  │ SELECT … ; -- explanation            │ │                                │
│  └──────────────────────────────────────┘ │                                │
│                                           │                                │
│  ## Challenges   ## Impact   ## Lessons   │                                │
│  markdown …                               │                                │
│                                           │                                │
│  ## Gallery   [ ][ ][ ]  (lightbox)       │                                │
├──────────────────────────────────────────┴────────────────────────────────┤
│  ‹ Prev: Other project            Next: Another project ›                  │
│  ============  "Want this on your product?"  ( Contact )  ============     │
└───────────────────────────────────────────────────────────────────────────┘
```
- **Section order is fixed** (matches `project_translations` columns +
  artifact tables). Empty sections are omitted, not shown blank.
- **NDA behaviour:** when `nda=true`, the sidebar shows "Confidential" for
  company, hides links that would reveal it, and a banner explains that scenario
  details are illustrative.
- In-page anchor nav (right rail on ≥1280px) for long case studies.
- **Responsive:** sidebar moves **above** the main column as a compact meta
  card; scenario/bug/API blocks stay full-width accordions; anchor nav becomes a
  `( On this page ▾ )` dropdown.

---

## 4.4 QA LAB  `/[locale]/qa-lab`  and  `/[locale]/qa-lab/[slug]`

```
LIST                                          DETAIL (lighter than a case study)
┌────────────────────────────────────┐        ┌──────────────────────────────┐
│ ====  QA Lab  ====                  │        │ > QA Lab / Title             │
│ "Experiments, demos and teardowns." │        │ ====  Title  ====            │
│ Filters: ( Automation )( API )( … ) │        │ Summary. [ repo ] [ demo ]   │
├────────────────────────────────────┤        │ [ hero image / gif ]         │
│ ┌────────┐ ┌────────┐ ┌────────┐    │        │                              │
│ │[thumb] │ │[thumb] │ │[thumb] │    │        │ ## What & why (markdown)     │
│ │Title   │ │Title   │ │Title   │    │        │ ## How it works             │
│ │·tags·  │ │·tags·  │ │·tags·  │    │        │ ## Findings / notes         │
│ │1-liner │ │1-liner │ │1-liner │    │        │ [ gallery ]                  │
│ │>Open   │ │>Open   │ │>Open   │    │        │ (optional) scenario table   │
│ └────────┘ └────────┘ └────────┘    │        │ ‹ Prev   Next ›              │
│        ( Load more )                │        └──────────────────────────────┘
└────────────────────────────────────┘
```
- QA Lab cards emphasise **visual QA content** (screenshots, GIFs, dashboards).
- **Responsive:** 3 / 2 / 1 column grid; detail is single-column throughout.

---

## 4.5 ABOUT  `/[locale]/about`   +   EXPERIENCE  `/[locale]/experience`

```
ABOUT                                        EXPERIENCE
┌───────────────────────────────────┐        ┌────────────────────────────────┐
│ [ portrait ]   ====  About  ====   │        │ ====  Experience  ====          │
│ Bio (markdown, 2–4 paragraphs).    │        │                                │
│ ( Download CV )  > Contact         │        │  2023 ─┬─ QA Engineer @ Company │
├───────────────────────────────────┤        │        │  • highlight            │
│ ----  Skills matrix  ----          │        │        │  • highlight            │
│  Automation  ▸ Playwright ●●●●○     │        │  2021 ─┼─ QA Analyst @ Company  │
│              ▸ Cypress    ●●●○○     │        │        │  • highlight            │
│  API/DB      ▸ Postman/REST ●●●●●   │        │  2019 ─┴─ Intern @ Company      │
│  Perf        ▸ k6         ●●●○○     │        │                                │
│  CI/CD       ▸ GH Actions ●●●●○     │        │ ----  Education  ----           │
├───────────────────────────────────┤        │  BSc … , University, 2015–2019  │
│ ----  Certifications  ----         │        │                                │
│  [badge] ISTQB …    [badge] …      │        │ ----  Certifications  ----      │
├───────────────────────────────────┤        │  [badge][badge][badge]         │
│ ----  Education  ----              │        │                                │
│  BSc …                             │        │ ( Download CV )   > Contact     │
└───────────────────────────────────┘        └────────────────────────────────┘
```
- Skills use a **proficiency meter** (part of the QA visual language, [06](06-design-system.md)),
  never vague star ratings without a legend.
- The two pages share `skills`, `education`, `certifications` data; `/about`
  leads with identity, `/experience` leads with the timeline.
- **Responsive:** skills matrix → stacked category accordions; timeline → single
  vertical rail with the year as a sticky label.

---

## 4.6 SERVICES  `/[locale]/services`

```
┌───────────────────────────────────────────────────────────────────────────┐
│  ====  Services  ====   "How I can help your team ship with confidence."   │
├───────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐                     │
│  │ [icon]        │ │ [icon]        │ │ [icon]        │                     │
│  │ Test Strategy │ │ Test Automation│ │ API & DB QA  │                     │
│  │ description   │ │ description   │ │ description   │                     │
│  │ outcome       │ │ outcome       │ │ outcome       │                     │
│  └───────────────┘ └───────────────┘ └───────────────┘                     │
│  ┌───────────────┐ ┌───────────────┐                                       │
│  │ Performance   │ │ QA Coaching   │                                       │
│  └───────────────┘ └───────────────┘                                       │
├───────────────────────────────────────────────────────────────────────────┤
│  ----  Engagement model  ----                                              │
│  Discovery → Test plan → Implementation → Handover  (simple stepper)       │
├───────────────────────────────────────────────────────────────────────────┤
│  ============  ( Start a conversation )  ============                      │
└───────────────────────────────────────────────────────────────────────────┘
```
**Responsive:** 3 / 2 / 1 columns; stepper becomes vertical.

---

## 4.7 CONTACT  `/[locale]/contact`

```
┌──────────────────────────────────────────┬────────────────────────────────┐
│  ====  Contact  ====                      │  ----  Other ways  ----        │
│  "Tell me about your product and where    │  > email@…   (if public)       │
│   quality hurts."                         │  > LinkedIn   > GitHub         │
│                                           │  Location: [PLACEHOLDER]       │
│  Name        [__________________]         │  Response time: ~2 business d. │
│  Email       [__________________]         │                                │
│  Subject     [__________________]         │  ── KVKK/GDPR ──               │
│  Message     [                  ]         │  "Your message is stored to    │
│              [                  ]         │   reply to you. > Privacy"     │
│              [                  ]         │                                │
│  [x] I agree to the privacy notice        │                                │
│  (honeypot field — visually hidden)       │                                │
│              ( Send message )             │                                │
│                                           │                                │
│  ✓ success / ✗ error inline state         │                                │
└──────────────────────────────────────────┴────────────────────────────────┘
```
- Client-side `zod` validation; server re-validates; on success the form is
  replaced by a confirmation panel (no page reload).
- Consent checkbox is **required**; links to `/legal/privacy`.
- **Responsive:** "Other ways" panel moves below the form.

---

## 4.8 Cross-page IA notes

| Concern | Decision |
|---|---|
| Primary nav | Projects · QA Lab · Experience · Services · About · Contact (6 items; About/Experience could merge under a dropdown if user testing shows crowding) |
| Breadcrumbs | On detail pages only (`Projects / Title`) |
| Featured vs Supported | "Featured" = curated rail on Home + top of Projects; "Supported" = a classification badge + filter, not a separate page |
| QA visual content | Concentrated on case-study + QA Lab detail: scenario tables, coverage meters, bug cards, code blocks, galleries |
| Case-study navigation | Prev/Next by `display_order` within the same classification; "All projects" always one click away |
| Empty states | Every list has a designed empty state (e.g. "No projects match these filters — ( Clear )") |
| Localisation gaps | If a project has no translation for the active locale, either hide it from that locale or show the fallback with a small "EN" tag (site setting) |
