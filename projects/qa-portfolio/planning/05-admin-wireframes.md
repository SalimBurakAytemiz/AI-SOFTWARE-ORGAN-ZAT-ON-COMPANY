---
project: qa-portfolio
output: "05 — Admin Panel Wireframes"
lifecycle_state: PLAN_READY
note: Low-fidelity. Admin UX, editor structure and content workflow — not visual design.
---

# 05 — Admin Panel Wireframes

The admin panel is a single-operator CMS. Priorities: **fast content entry**,
**obvious publication state**, **TR/EN parity visible at all times**, **no way to
accidentally publish a half-translated page**.

---

## 5.0 Admin shell (all admin pages except login)

```
┌──────────────┬────────────────────────────────────────────────────────────┐
│  QA CMS      │  Projects                              ● 2 new messages     │
│              │  ────────────────────────────────────────────────────────  │
│  ▸ Dashboard │                                                            │
│  ▸ Projects  │            ... page content ...                            │
│  ▸ QA Lab    │                                                            │
│  ▸ Experience│                                                            │
│  ▸ Skills    │                                                            │
│  ▸ Services  │                                                            │
│  ▸ Education │                                                            │
│  ▸ Certs     │                                                            │
│  ▸ Media     │                                                            │
│  ▸ Messages  │                                                            │
│  ▸ Settings  │                                                            │
│              │                                                            │
│  ──────────  │                                                            │
│  [avatar]    │                                                            │
│  Owner name  │                                                            │
│  ( Sign out )│  UI lang: [TR|EN]   > View site ↗                          │
└──────────────┴────────────────────────────────────────────────────────────┘
```
- Left rail collapses to icons < 1024px; becomes a top drawer on mobile.
- "View site" opens the public site in a new tab.
- A global **unsaved-changes guard** on every editor.

---

## 5.1 Admin Login  `/admin/login`

```
        ┌─────────────────────────────────┐
        │        QA CMS — Sign in         │
        │                                 │
        │  Email     [__________________] │
        │  Password  [__________________] │
        │  [ ] Remember me                │
        │            ( Sign in )          │
        │                                 │
        │  > Forgot password?             │
        │  ─────────────────────────────  │
        │  ✗ Invalid email or password.   │  ← generic error, no user enumeration
        └─────────────────────────────────┘
```
- After 5 failed attempts in 15 min → soft lock + longer backoff (see [10](10-security-plan.md)).
- Successful login → `?next=` target or `/admin/dashboard`.

---

## 5.2 Dashboard  `/admin/dashboard`

```
┌───────────────────────────────────────────────────────────────────────────┐
│  Dashboard                                                                 │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐                   │
│  │ Published │ │  Drafts   │ │ QA Lab    │ │ New msgs  │                   │
│  │    14     │ │    3      │ │    6      │ │    2  ●   │                   │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘                   │
├───────────────────────────────────────────────────────────────────────────┤
│  ⚠ Translation gaps (3)                            ⚡ Quick actions        │
│  • "Payment regression suite" — EN missing         ( + New project )      │
│  • "Mobile smoke pack" — TR draft                  ( + QA Lab entry )     │
│  • Service "Performance" — TR missing              ( Upload media )       │
├───────────────────────────────────────────────────────────────────────────┤
│  Recent activity (content_audit)                                          │
│  10:24  Owner  published  project "API contract testing"                  │
│  09:501 Owner  updated    experience "QA Engineer @ …"                    │
│  Yesterday   Owner  archived  project "Old landing test"                  │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 5.3 Projects list  `/admin/projects`

```
┌───────────────────────────────────────────────────────────────────────────┐
│  Projects            ( + New project )   Filter:[All][Draft][Published]…  │
│  Search […………]   Classification:[All ▾]   Sort:[Manual order ▾]          │
├──┬───────────────────────────┬────────────┬─────────┬────────┬────────────┤
│⋮⋮│ Title (TR / EN)           │ Class.     │ Status  │ Feat.  │ Updated    │
├──┼───────────────────────────┼────────────┼─────────┼────────┼────────────┤
│⋮⋮│ API sözleşme testi / API… │ Professional│ ●Publ. │  ★     │ 2h ago     │
│⋮⋮│ Ödeme regresyonu / —      │ Professional│ ○Draft │        │ 1d ago  ⚠EN│
│⋮⋮│ — / Mobile smoke pack     │ Personal   │ ○Draft │        │ 3d ago  ⚠TR│
│⋮⋮│ Yük testi / Load testing  │ Supported  │ ▪Arch. │        │ 2w ago     │
└──┴───────────────────────────┴────────────┴─────────┴────────┴────────────┘
   ⋮⋮ = drag handle (manual reorder; persists display_order)
   Row actions (hover / ⋯): Edit · Preview · Publish/Unpublish · Archive · Duplicate · Delete
   Bulk (checkbox): Publish · Unpublish · Archive · Set classification
```
- `⚠EN` / `⚠TR` chips flag missing/draft translations at a glance.
- Status dots: ● published · ○ draft · ◐ published-but-hidden · ▪ archived.

---

## 5.4 Project Editor  `/admin/projects/[id]`  (and `/new`)

Tabbed, single page, **sticky action bar**. Every text field that is localised
shows **TR and EN side by side**.

```
┌───────────────────────────────────────────────────────────────────────────┐
│  ‹ Projects   "API contract testing"          ○Draft   ( Save draft )      │
│                                        ( Preview ↗ )  ( Publish ▸ )        │
│  [ Details ] [ Classification ] [ Taxonomy ] [ TR/EN Content ]             │
│  [ Test scenarios ] [ Bug reports ] [ API testing ] [ SQL ] [ Media ] [ SEO ]│
├───────────────────────────────────────────────────────────────────────────┤
│  TAB: Details                                                              │
│   Slug*        [ api-contract-testing ]   (lock ⚠ after publish)          │
│   Company      [ Acme Corp        ]  [x] Hide company (NDA)                │
│   Role title   TR [ QA Mühendisi ]     EN [ QA Engineer ]                  │
│   Industry     [ Fintech ▾ ]  (taxonomy kind=industry)                     │
│   Period       [ 2023-04 ] – [ 2024-02 ]   [ ] Ongoing                     │
│   Links        GitHub [ https://… ]   External [ https://… ]               │
│   [x] Under NDA — hide sensitive fields on the public page                 │
│   Cover image  [ pick from media ▾ ]  [ preview ]                          │
├───────────────────────────────────────────────────────────────────────────┤
│  TAB: Classification                                                       │
│   Classification ( ) Professional ( ) Supported (•) Personal ( ) QA Lab    │
│   [x] Visible      [ ] Featured (home rail)     Display order [ 12 ]       │
│   Status: ○ Draft  → use the action bar to Publish                        │
├───────────────────────────────────────────────────────────────────────────┤
│  TAB: Taxonomy                                                             │
│   Platforms   ( Web ✕ )( API ✕ )            ( + add )                      │
│   Tools       ( Playwright ✕ )( k6 ✕ )( Postman ✕ )   ( + add )           │
│   Test types  ( Automation ✕ )( Performance ✕ )       ( + add )           │
│   (typeahead against taxonomy_terms; "create new term" inline, owner only)│
├───────────────────────────────────────────────────────────────────────────┤
│  TAB: TR/EN Content                     Completeness: TR ▓▓▓▓░ 80% EN ▓▓░ 40%│
│   ┌─────────────── TR ───────────────┐ ┌─────────────── EN ──────────────┐ │
│   │ Title      [………………]              │ │ Title      [………………]             │ │
│   │ Summary    [………………]              │ │ Summary    [………………]  (copy ◄TR) │ │
│   │ Overview   [ markdown editor ]    │ │ Overview   [ markdown editor ]   │ │
│   │ Testing scope [ md ]             │ │ Testing scope [ md ]            │ │
│   │ Test strategy [ md ]            │ │ Test strategy [ md ]           │ │
│   │ Coverage   [ md / mini-table ]  │ │ Coverage   [ md ]              │ │
│   │ Challenges [ md ]               │ │ Challenges [ md ]              │ │
│   │ Impact     [ md ]              │ │ Impact     [ md ]             │ │
│   │ Lessons    [ md ]             │ │ Lessons    [ md ]           │ │
│   │ Highlights (bullets, sortable) │ │ Highlights (bullets, sortable) │ │
│   └────────────────────────────────┘ └───────────────────────────────┘ │
│   Markdown toolbar: B I · lists · link · code · quote · table            │
│   Live sanitised preview toggle. Image insert → media picker.            │
├───────────────────────────────────────────────────────────────────────────┤
│  TAB: Test scenarios                                    ( + Scenario )     │
│   ⋮⋮ TS-01  P0 ▾  Automation ▾  [x] Automated                             │
│      TR: Title[…] Preconditions[md] Steps[md] Expected[md] Notes[md]      │
│      EN: Title[…] Preconditions[md] Steps[md] Expected[md] Notes[md]      │
│      ( Duplicate ) ( Delete )                                            │
│   ⋮⋮ TS-02  P1 ▾  API ▾ …                                                │
├───────────────────────────────────────────────────────────────────────────┤
│  TAB: Bug reports                                       ( + Bug )          │
│   ⋮⋮ BUG-01  Severity[Critical ▾]  State[Fixed ▾]  Env[ staging ]        │
│      TR/EN: Title · Summary · Steps · Expected · Actual · Root cause · Fix│
├───────────────────────────────────────────────────────────────────────────┤
│  TAB: API testing                                       ( + Example )      │
│   ⋮⋮ API-01  [GET ▾]  Endpoint[ /v1/orders ]   Resp status[ 200 ]        │
│      Request headers [ json ]  Request body [ raw ]  Response body [ raw ]│
│      TR/EN: Title · Notes (what this demonstrates)                       │
├───────────────────────────────────────────────────────────────────────────┤
│  TAB: SQL                                               ( + Example )      │
│   ⋮⋮ SQL-01  Dialect[ postgres ▾ ]                                       │
│      Query [ sql editor ]   Sample result [ text/table ]                 │
│      TR/EN: Title · Explanation                                          │
├───────────────────────────────────────────────────────────────────────────┤
│  TAB: Media (gallery)                                   ( + from library ) │
│   ⋮⋮ [thumb] role[Gallery ▾]  caption TR[…] EN[…]                         │
│   ⋮⋮ [thumb] role[Diagram ▾] …                                           │
├───────────────────────────────────────────────────────────────────────────┤
│  TAB: SEO                                                                  │
│   TR: SEO title[…] SEO description[…]   EN: SEO title[…] SEO description[…]│
│   OG image [ pick ▾ ]   Canonical preview: /en/projects/api-contract-…    │
│   Search preview snippet (TR / EN)                                        │
└───────────────────────────────────────────────────────────────────────────┘
```

### Publish dialog (from `( Publish ▸ )`)

```
┌─────────────────────────────────────────────┐
│  Publish "API contract testing"?            │
│                                             │
│  Checks:                                    │
│   ✓ Slug set and unique                     │
│   ✓ TR content ≥ required fields            │
│   ✗ EN content 40% — 3 required fields empty│
│   ✓ Cover image set                         │
│   ✓ At least one taxonomy term              │
│                                             │
│  ( ) Publish both locales                   │
│  (•) Publish TR only, keep EN as draft      │
│                                             │
│  This will make the page publicly visible   │
│  and trigger revalidation.                  │
│         ( Cancel )   ( Publish )            │
└─────────────────────────────────────────────┘
```
- Required-field rules are defined per section in the `zod` schema and surfaced
  here. The owner can publish one locale while the other stays draft
  (`translation_status`).

---

## 5.5 Project Preview  `/admin/projects/[id]/preview`

```
┌───────────────────────────────────────────────────────────────────────────┐
│  ⓘ PREVIEW — draft content, not public.   Locale:[TR|EN]  ( Back to edit ) │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│        ... exact public case-study template, rendered with draft data ... │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```
- Same React components as the public route; data comes from a draft-aware read.
- `noindex`, `no-store`, only reachable by an admin session.

---

## 5.6 Featured / Supported / Classification management

No separate screens — all three are controlled from:
- **Classification tab** in the editor (`classification`, `featured`,
  `visible`, `display_order`), and
- the **Projects list** (drag to reorder, `★` toggle for featured, bulk "set
  classification").

```
Projects list — inline controls
┌──┬────────────────────┬──────────────┬────────┐
│⋮⋮│ Title              │ Classification│  ★ Feat │   ★ toggles projects.featured
│⋮⋮│ …                  │ [Professional▾]│  [☆]   │   drag ⋮⋮ sets display_order
└──┴────────────────────┴──────────────┴────────┘
```

---

## 5.7 QA Lab management  `/admin/qa-lab`

Same list + editor as Projects, with the editor **preset to
`classification = qa_lab`** and a reduced tab set:
`Details · TR/EN Content · Test scenarios (optional) · Media · SEO`.

---

## 5.8 Experience / Skills / Services / Education / Certifications

Uniform pattern: **left = sortable list, right = form**, TR/EN side by side where
the model has translations.

```
EXPERIENCE  /admin/experience
┌───────────────────────┬───────────────────────────────────────────────────┐
│ ⋮⋮ QA Engineer @ Acme │  Company [ Acme ]  [x] Hide (NDA)                  │
│ ⋮⋮ QA Analyst @ Beta  │  Location [ Remote ]   Type [ Full-time ▾ ]       │
│ ⋮⋮ Intern @ Gamma     │  Period [2023-04]–[ ]  [x] Current                │
│  ( + Add )            │  ── TR ──               ── EN ──                   │
│                       │  Role title [………]      Role title [………]           │
│                       │  Summary [ md ]        Summary [ md ]             │
│                       │  Highlights [ md ]     Highlights [ md ]          │
│                       │  [x] Visible          ( Save )                    │
└───────────────────────┴───────────────────────────────────────────────────┘

SKILLS  /admin/skills
┌── Categories (sortable) ──┬── Skills in "Automation" (sortable) ───────────┐
│ ⋮⋮ Automation             │ ⋮⋮ Playwright   Proficiency[●●●●○] Years[3]    │
│ ⋮⋮ API & Database         │ ⋮⋮ Cypress      Proficiency[●●●○○] [x] Featured│
│ ⋮⋮ Performance            │ ⋮⋮ Selenium     …                             │
│ ⋮⋮ CI/CD                  │  ( + Skill )                                  │
│  Category: label TR[…] EN[…]                                              │
│  ( + Category )                                                          │
└──────────────────────────┴───────────────────────────────────────────────┘
```
- Certifications form: `name`, `issuer`, `issued/expires`, `credential id/url`,
  `badge image` (media picker), `visible`, order.
- Every list has drag-reorder writing `display_order` and a `visible` toggle.

---

## 5.9 Media Library  `/admin/media`

```
┌───────────────────────────────────────────────────────────────────────────┐
│  Media           ( ⬆ Upload )   Filter:[All][Unused]   Search[………]        │
├───────────────────────────────────────────┬───────────────────────────────┤
│  [img][img][img][img][img][img]           │  Selected: cover-api.png      │
│  [img][img][img][img][img][img]           │  [ large preview ]           │
│  [img][img][img][img][img][img]           │  1600×900 · 240 KB · webp    │
│                                           │  Uploaded 2026-08-30         │
│   drag files anywhere to upload           │  Alt TR [………]  Alt EN [………]  │
│                                           │  Caption TR[…] EN[…]         │
│                                           │  Used in: 2 places ▾         │
│                                           │   • project "API contract…" │
│                                           │   • home OG image           │
│                                           │  ( Replace file ) ( Delete ) │
└───────────────────────────────────────────┴───────────────────────────────┘
```
- Upload: MIME + size allowlist (`image/png|jpeg|webp|avif|svg+xml`, ≤ N MB),
  client + server checked; auto-extract dimensions; SVG is sanitised or disabled
  (see [10](10-security-plan.md)).
- **Delete is blocked while referenced** — the panel lists usages; the owner
  must detach first.
- `Alt TR` required before an image can be attached to a published page.

---

## 5.10 Messages (contact inbox)  `/admin/messages`

```
┌──────────────────────────┬────────────────────────────────────────────────┐
│ ● New (2)                 │  From:  Jane Doe <jane@example.com>            │
│  Jane Doe — "Project…"   │  Subject: Regression help for our release      │
│  2026-09-01 14:10        │  Locale: EN · Page: /en/services · 1d ago      │
│ ─ Read                    │  ─────────────────────────────────────────────│
│  Ali Veli — "Soru"       │  Message body (plain text, rendered safe)…     │
│ ─ Archived / Spam         │                                               │
│                          │  ( Mark read ) ( Reply via mail ↗ ) ( Archive )│
│  Filter: [All][New]…     │  ( Mark spam )                                 │
└──────────────────────────┴────────────────────────────────────────────────┘
```
- Body is rendered as **plain text** (never HTML). "Reply" opens a `mailto:`.
- State machine: `new → read → replied → archived`; `spam` from any state.
- No delete in V1 (retention window handled by a scheduled cleanup job + privacy
  notice).

---

## 5.11 Settings  `/admin/settings`

```
Tabs: General · Localization · Profile · Social · SEO defaults · Feature flags

General        Site title TR/EN · tagline TR/EN · primary CTA · contact email
Localization   Default locale [EN ▾]  · fallback behaviour [show fallback + tag ▾]
Profile        Full name · location · years exp · [x] available for work
               Avatar (media) · CV file (media)  ·  Bio TR/EN (md) · summary TR/EN
Social         ⋮⋮ platform · label · URL · visible   ( + link )
SEO defaults   Default meta description TR/EN · default OG image · verification tags
Feature flags  [x] QA Lab enabled   [ ] RSS feed   [ ] Show "available for work" badge
```
- Adding/removing an **admin account** is **not** here — that is a Human Founder
  action via Supabase (mirrors "access-control escalation" as a critical action).

---

## 5.12 Admin content workflow (the required diagram)

```
        ( + New project )
               │
               ▼
   ┌───────────────────────┐
   │  Enter project info    │   Details · Classification · Taxonomy
   │  (metadata + slug)     │
   └───────────┬───────────┘
               ▼
   ┌───────────────────────┐
   │  Enter Turkish content │   TR/EN Content tab — TR column
   └───────────┬───────────┘
               ▼
   ┌───────────────────────┐
   │  Enter English content │   TR/EN Content tab — EN column ( copy ◄TR helper )
   └───────────┬───────────┘
               ▼
   ┌───────────────────────┐
   │  Enter technical QA    │   Test scenarios · Bug reports · API · SQL · Media
   │  content               │
   └───────────┬───────────┘
               ▼
        ( Save draft )  ──────────────►  status = draft   (RLS: not public)
               │
               ▼
        ( Preview ↗ )   ──────────────►  /admin/projects/[id]/preview  (noindex)
               │
               ▼
        ( Publish ▸ )   ── checks ────►  status = published, visible = true,
               │                          published_at = now()
               │                          + content_audit + revalidateTag
               ▼
        ┌──────────────┐
        │ Public site  │   /tr|/en/projects/[slug]
        └──────────────┘

   Also available from the list or editor at any time:
     Unpublish  → status = draft            (+ audit + revalidate)
     Hide       → visible = false            (+ audit + revalidate)
     Archive    → status = archived          (+ audit + revalidate)  [kept in admin]
     Restore    → status = draft             (+ audit)               [then re-publish]
```

---

## 5.13 Admin UX rules (apply to every screen)

| Rule | Reason |
|---|---|
| Autosave draft every N seconds + explicit "Save draft" | never lose content entry |
| Unsaved-changes guard on navigation | same |
| TR/EN always visible together for localised fields | parity is the #1 CMS risk |
| Completeness meters per locale + publish checklist | can't accidentally ship a blank page |
| Every destructive action = typed confirm + audit entry | safety + institutional memory |
| Optimistic reorder, server-confirmed | fast, but correct |
| All lists: search, filter by status, filter by translation gap | scale to 50+ projects |
| Keyboard: ⌘/Ctrl-S save, `/` focus search, `g p` go to projects | operator speed |
| Errors are specific and inline; success is a toast + state change | trust |
