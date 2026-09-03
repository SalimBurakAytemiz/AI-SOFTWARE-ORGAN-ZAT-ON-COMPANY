---
generated_by: project-factory@0.1
project: qa-portfolio
title: "QA Engineer Portfolio Platform - Decision Log"
lifecycle_state: DRAFT
note: >
  Deterministic scaffold generated from project.yml. Runtime V1.1 agents
  refine this during an authorised build. Not the final specification.
---
# QA Engineer Portfolio Platform - Decision Log

## D-001 (2026-09-02T22:01:27.574Z) - Project created via Project Factory V0.1

- Project type inferred/confirmed as "web_app"
- Business model "other", target market "Türkiye and the international English-speaking technology market"
- Risk level 3, security level "elevated"
- Requested workflow "feature-development"

Further decisions (architecture, platform choice, provider selection) are made by
Runtime V1.1 agents during an authorised build and appended here.

---

## Planning-phase decisions (ADRs)

Recorded during the mandatory pre-development planning gate. Full context in
`../planning/`. These are proposals accepted by the planning team and its
10-perspective review; they become binding when the Human Founder authorizes the
build.

### ADR-0001 — Planning now, implementation only after `authorize-build`

- **Context:** The master spec's "IMPORTANT EXECUTION RULE" says to continue into
  implementation after planning. `CLAUDE.md` §13 prohibits building any project's
  application code in this phase, and Project Factory requires
  `ai-company project authorize-build qa-portfolio` (Human Founder, RISK 5,
  audited) before Runtime V1.1 may execute a project.
- **Decision:** Complete the 13-part planning package and **stop** at the build-
  authorization gate. The repository constitution overrides the inline spec rule.
- **Consequences:** No code is written yet. Implementation starts on the Founder's
  one-command authorization. See `planning/12-risks-open-questions.md` OQ-000.

### ADR-0002 — Project classification vs status vs flags

- **Context:** The spec lists "Featured" and "Archived" as both project *types*
  and *statuses/flags*, which produces ambiguous states.
- **Decision:** `classification ∈ {professional, supported, personal, qa_lab}`
  (kind of work); `featured` = boolean flag; `archived` = a value of
  `status ∈ {draft, published, archived}`. `supported` kept as a mirror boolean.
- **Consequences:** Unambiguous data model; radio for classification, toggles for
  featured/visible in the admin. See `planning/02-database-schema.md` §2.13.

### ADR-0003 — Keep `/about` and `/experience` as separate routes

- **Decision:** Two indexable pages with distinct intent (identity+skills vs
  career timeline), shared data, no duplicated large text blocks. Revisit after
  user testing (OQ-002).

### ADR-0004 — Normalise the schema; no JSON/HTML blob, no table-per-section

- **Decision:** Merge `project_platforms`/`project_tools`/`project_test_types`
  into `taxonomy_terms` + `project_taxonomy`; fold fixed prose sections into
  Markdown columns on `project_translations`; reuse `projects` (with
  `classification='qa_lab'`) for QA Lab; drop `admin_profiles` (use
  `admin_users`). Keep structured tables for repeatable QA artifacts (scenarios,
  bugs, API, SQL). See `planning/02-database-schema.md` §2.9.

### ADR-0005 — Stack: Next.js 15 (App Router) + Supabase + Vercel + `next-intl`

- **Decision:** As mandated by the spec constraints. Tailwind v4 + Radix
  primitives; Markdown stored as text and sanitised on render; `@supabase/ssr`
  with cookie sessions; always-prefixed locales (`/tr`, `/en`).
- **Consequences:** One deployment for public + admin; RLS is the security
  boundary; ISR + on-demand revalidation for freshness.

### ADR-0006 — Authorization = `is_admin()` allow-list, enforced in RLS and app

- **Decision:** Authentication (Supabase Auth) is separate from authorization: a
  session is an admin session only if `auth.uid()` is in `admin_users`. The
  `is_admin()` SQL function is used by every write RLS policy and re-checked in
  every server action. The allow-list is not app-editable (Founder-only, like a
  critical action). An automated RLS test matrix is a release gate.

### ADR-0007 — Dark-first design system with an explicit "QA visual language"

- **Decision:** The team owns the visual identity (no design files provided).
  Dark-first, one technical accent, monospace as a domain signal, WCAG 2.1 AA
  minimum. Case studies must surface ≥2 QA components (coverage meter, scenario
  table, bug card, code/SQL blocks). See `planning/06-design-system.md`.

### ADR-0008 — Missing professional content: placeholders + intake checklist, never invented

- **Decision:** Build proceeds with clearly-marked `[PLACEHOLDER]` content. The
  team never invents professional facts. `planning/13-content-intake-checklist.md`
  is the single structured form the Founder fills with real content, entered
  later through the admin. Launch is gated on content, not engineering.

### ADR-0009 — İçerik veri katmanı: repository soyutlaması (faz 2)

- **Bağlam:** Supabase henüz bağlı değil ama public sayfalar geliştirilecek.
- **Karar:** `ContentRepository` arayüzü + `FixtureContentRepository` (faz 2) +
  `SupabaseContentRepository` iskeleti (faz 3). Sayfalar `getContentRepository()`
  fabrikasını çağırır ve somut kaynağı bilmez. "Published + visible" kuralı
  `lib/content/publication.ts` + SQL `project_is_public()` ile TEK yerde.
- **Sonuç:** Supabase bağlandığında yalnızca fabrika + `SupabaseContentRepository`
  değişir; sayfa kodu değişmez (planning/14 review R8).

### ADR-0010 — Markdown: sakla + render'da sanitize et (`react-markdown` + `rehype-sanitize`)

- **Karar:** İçerik metinleri Markdown olarak saklanır, HTML olarak değil.
  Render `react-markdown` + `remark-gfm` + `rehype-sanitize` (kesin izin
  listesi) ile yapılır; çıktı React elemanıdır (`dangerouslySetInnerHTML` yok).
  12 saldırı yükünden oluşan XSS test korpusu CI'da çalışır.
- **Sonuç:** Saklanan XSS engellenir (planning/10 §10.7).

### ADR-0011 — DEMO/SANITIZED içerik gerçek veriden ayrıştırılır

- **Karar:** Şablonu ve bileşenleri gerçekçi hacimde test etmek için kurgusal
  vaka çalışmaları (`demo-projects.ts`) eklendi; hepsi `demo: true` ile işaretli
  ve sitede görünür bir "DEMO / SANITIZED" bandıyla sunulur. Gerçek profesyonel
  bilgi UYDURULMAZ (ADR-0008 pekiştirilir).

### ADR-0012 — Admin mutasyon sırası: Auth → Authz → Validation → Write → Audit → Revalidate

- **Karar:** Tüm admin yazma işlemleri `withAdminAction()` sarmalayıcısından
  geçer. Herhangi bir adım başarısız olursa yazma yapılmaz. Audit append-only.
  Faz 2'de yazma tarafı in-memory mock (yayın davranışları mock seviyesinde
  test edilir); faz 3'te Supabase + transactional RPC (planning/07 T-0702,
  planning/14 review R7).

### ADR-0013 — Vaka çalışması rotası faz 2'de `dynamicParams = false`

- **Karar:** Fixture verisiyle çalışıldığı sürece bilinmeyen slug doğrudan
  gerçek HTTP 404 döner (soft-404 önlenir, RISK-060). Faz 3'te ISR için
  `dynamicParams = true` + yayında `generateStaticParams` yeniden üretimi.

### Open items from the 10-perspective review

24 required changes (R1–R24) are listed in `planning/14-planning-review.md` and
are to be folded into the backlog before/early in the build. Notable pre-
production blockers: mandatory admin MFA, a shared rate-limit store,
transactional publish, tightened `media` RLS, Supabase project hardening, and
CSP without `unsafe-inline`.
