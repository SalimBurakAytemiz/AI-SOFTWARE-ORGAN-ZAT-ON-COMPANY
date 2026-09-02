---
project: qa-portfolio
output: "06 — Design System Proposal"
lifecycle_state: PLAN_READY
note: >
  This is the design-team proposal the spec asked the team to create. No finished
  Figma / UI files were provided and none are expected. Values below are a
  starting system to be refined during Sprint 0–2, not a locked brand.
---

# 06 — Design System Proposal

## 6.1 Design direction

The site must read as **premium, technical, precise, reliable, and
software-engineering-oriented** — the portfolio of a QA *engineer*, not a
freelancer marketplace profile.

Principles:
1. **Evidence over adjectives.** Show coverage meters, scenario tables, real
   payloads, bug cards — structured proof, not "I'm detail-oriented".
2. **Dark, calm, high-contrast.** A focused instrument panel, not a neon
   dashboard. One decisive accent, used sparingly.
3. **Monospace as a signal.** Code, endpoints, IDs, statuses and metrics render
   in mono — it's the visual accent of the QA domain.
4. **Restraint in motion.** Motion confirms actions and reveals structure; it
   never decorates. Full `prefers-reduced-motion` support.
5. **Accessibility is design, not a checkbox.** WCAG 2.1 AA minimum for contrast,
   focus, targets, and semantics.

Reference portfolios are **inspiration for rigour only** — no cloning of layout,
copy, or visual identity.

## 6.2 Typography

| Role | Family (proposal) | Fallback stack | Notes |
|---|---|---|---|
| Display / headings | **Geist** or **Inter Tight** | `Inter, "Segoe UI", system-ui, sans-serif` | tight tracking, -1% to -2.5% |
| Body / UI | **Inter** | `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` | 16px base, 1.6 line-height |
| Monospace | **Geist Mono** or **JetBrains Mono** | `"SFMono-Regular", Menlo, Consolas, monospace` | code, endpoints, IDs, metrics, badges |

- Self-host via `next/font` (no layout shift, no third-party request; helps CSP
  and Core Web Vitals). Latin + Latin-Extended (Turkish: ç ğ ı İ ö ş ü).
- **Turkish rendering:** test dotted/dotless İ/ı and ğ/ş at every weight; verify
  `lang="tr"` is set so hyphenation/locale rules apply.

### Type scale (1.25 "major third", rem)

| Token | px @16 | Use |
|---|---|---|
| `text-2xs` | 11 | overline labels, table meta |
| `text-xs` | 12 | captions, chips, code annotations |
| `text-sm` | 14 | secondary text, form help |
| `text-base` | 16 | body |
| `text-lg` | 18 | lead paragraph, card titles |
| `text-xl` | 20 | H4 |
| `text-2xl` | 25 | H3 |
| `text-3xl` | 31 | H2 |
| `text-4xl` | 39 | H1 (interior pages) |
| `text-5xl` | 49 | Hero H1 (desktop) |
| `text-6xl` | 61 | Hero display (optional, ≥1280px) |

Headings: weight 600–680, tracking `-0.02em`. Body max width **68ch**. Fluid
clamp for hero sizes between the `sm` and `xl` breakpoints.

## 6.3 Colour palette (dark-first)

Defined as CSS custom properties / Tailwind tokens. **All pairings below meet
WCAG AA** on their intended background (verify in build with an automated
contrast test — see [11](11-test-strategy.md)).

### Neutrals (backgrounds & text)

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#0A0B0D` | page background |
| `--bg-subtle` | `#0F1114` | large section alternation |
| `--surface` | `#14171B` | cards, inputs |
| `--surface-raised` | `#1B1F24` | popovers, modals, hover |
| `--border` | `#262B31` | hairlines, dividers |
| `--border-strong` | `#333A42` | input borders, focus ring base |
| `--text` | `#E8EBEF` | primary text (~14.5:1 on `--bg`) |
| `--text-muted` | `#A2ABB5` | secondary text (~7:1) |
| `--text-faint` | `#6B747E` | disabled, timestamps (~4.6:1 — large/again only) |

### Accent

| Token | Hex | Use |
|---|---|---|
| `--accent` | `#3DDC97` | primary accent — a "test passed" green; links, key CTAs, active states |
| `--accent-hover` | `#34C588` | hover |
| `--accent-contrast` | `#04140D` | text on an accent-filled button |
| `--accent-muted` | `#12271E` | accent-tinted surfaces / chips |
| `--focus` | `#6FE9B6` | focus ring (3:1 against adjacent colours) |

> Alternative accent under review: electric indigo `#6E8BFF` if the green reads
> too "success-only". Decision in Sprint 1 after the hero comp. A **single**
> accent ships.

### Semantic (status = core QA vocabulary)

| Token | Hex | Meaning |
|---|---|---|
| `--pass` | `#3DDC97` | passed, published, healthy (== accent) |
| `--fail` | `#FF6B6B` | failed, blocker, error |
| `--warn` | `#F5C451` | flaky, deferred, needs attention |
| `--info` | `#5AA7FF` | informational, "automated", links in prose |
| `--neutral-status` | `#8A929B` | skipped, N/A, draft |

Each semantic token has a `-bg` (~10–14% tint) and `-border` variant for badges.

### Light theme

Dark is the product. A light theme is **not** in V1 scope but tokens are
structured so a `[data-theme="light"]` override is a later additive change, not a
rewrite. (Flagged OQ-009.)

## 6.4 Spacing, radius, elevation

- **Base unit 4px.** Scale: `0 1 2 3 4 6 8 12 16 20 24 32 40 48 64 80 96 128`
  (× 4px). Section vertical rhythm: `64 / 96 / 128` (mobile / tablet / desktop).
- **Radius:** `--radius-sm 6px` (chips, inputs), `--radius-md 10px` (cards,
  buttons), `--radius-lg 16px` (modals, media), `--radius-full` (avatars, dots).
- **Elevation** (dark = border + subtle glow, not heavy shadow):
  - `e0` flat on `--surface`
  - `e1` `--surface-raised` + `1px --border`
  - `e2` popover: `--surface-raised` + `0 8px 24px rgba(0,0,0,.4)` + `1px --border`
  - `e3` modal: `+ 0 24px 64px rgba(0,0,0,.5)` + backdrop blur 4px

## 6.5 Layout & grid

| Token | Value |
|---|---|
| Container `--max-content` | 1200px (marketing), 1320px (project list) |
| Prose `--max-prose` | 68ch |
| Case-study main / sidebar | `minmax(0,1fr) 320px` at ≥1024px; stacked below |
| Gutters | 16 / 24 / 32 (mobile / tablet / desktop) |
| Grid | 12-col at ≥1024px; 6-col 768–1023; 4-col < 768 |

### Breakpoints

| Name | Min width | Target |
|---|---|---|
| `xs` | 360 | small phones (baseline) |
| `sm` | 640 | large phones |
| `md` | 768 | tablets / small laptops |
| `lg` | 1024 | laptops (sidebar appears) |
| `xl` | 1280 | desktop (anchor rail appears) |
| `2xl` | 1536 | large desktop (max container only) |

Design and test **mobile-first**. No horizontal page scroll at any width;
wide artifacts (tables, code, diagrams) scroll inside their own container.

## 6.6 Components

### Buttons
| Variant | Look | Use |
|---|---|---|
| Primary | `--accent` fill, `--accent-contrast` text | one per view (Hire me, Send, Publish) |
| Secondary | `--surface` fill, `--border-strong`, `--text` | View case study, Cancel |
| Ghost | transparent, `--text-muted`, hover `--surface` | tertiary, toolbars |
| Danger | `--fail` border/text, fill on hover | Delete, Archive |
Sizes `sm 32` / `md 40` / `lg 48` px height. Focus ring `2px --focus` + `2px`
offset. Disabled = 40% opacity + `not-allowed`. Min target 44×44 on touch.

### Inputs / forms
- `--surface` fill, `1px --border-strong`, `--radius-sm`, 40px height, 12–14px
  padding. Focus: border `--focus` + `0 0 0 3px var(--focus)/30%`.
- Label above (always visible — no placeholder-only labels). Help text `text-sm
  --text-muted`. Error text `--fail` + `aria-describedby` + icon.
- Markdown editor: toolbar + textarea + live sanitised preview toggle; mono font
  in edit mode.

### Cards
- `--surface`, `1px --border`, `--radius-md`, hover → `--surface-raised` +
  border `--border-strong` + 120ms lift (translateY -2px). Entire card is one
  link where appropriate (`<a>` wrapping, with nested actionable elements handled
  via `::after` overlay pattern).
- **Project card:** cover (16:9, `next/image`), classification badge (top-left
  over image), title, role/company line (or "Confidential"), ≤3 taxonomy chips,
  1–2 line summary, NDA badge, `> Case study`.

### Badges & chips
- **Classification badge:** Professional (info), Supported (accent-muted),
  Personal (neutral), QA Lab (warn-tinted). Uppercase `text-2xs`, mono, 1px
  border.
- **Status dot + label:** ● pass/published, ○ draft, ◐ hidden, ▪ archived,
  ✕ fail.
- **Taxonomy chip:** `--surface-raised`, `text-xs`, optional 12px icon, not
  interactive on public pages (interactive as filters on the list page).

### Status indicators (QA visual language)
- **Coverage meter:** horizontal bar, `--pass` fill on `--border` track, %
  label in mono, `role="meter"` + `aria-valuenow`.
- **Result pill:** `PASS` / `FAIL` / `FLAKY` / `SKIPPED` in mono on a tinted
  `-bg`.
- **Scenario row:** collapsible; header shows `TS-01 · P0 · Automation` in mono +
  title; body shows Preconditions / Steps / Expected as labelled blocks.
- **Bug card:** left border in `--fail`/`--warn` by severity; header `BUG-03 ·
  Critical · Fixed`; fields Steps / Expected / Actual / Root cause / Resolution.
- **Code block:** `--bg-subtle`, `1px --border`, mono 13px, language tag
  top-right, copy button, horizontal scroll. Syntax highlighting via a
  build-time highlighter (Shiki) — no client JS needed.
- **Terminal/console block:** `$` prompt affordance, dimmed output lines.

### Navigation
- Header: 64px, `--bg`/90% + backdrop blur on scroll, bottom `1px --border`.
  Active link = `--accent` text + 2px underline.
- Footer: `--bg-subtle`, three columns → stacked on mobile.
- Locale switch: segmented `TR | EN`, active segment `--surface-raised`.
- Anchor rail (case study, ≥1280px): sticky right, current section `--accent`.

### Feedback
- Toast: bottom-right, `--surface-raised`, `e2`, auto-dismiss 4s, `role="status"`.
- Modal/dialog: `e3`, focus-trapped, `Esc` closes, backdrop click closes
  non-destructive dialogs only.
- Empty state: centered icon + one line + one action.
- Skeletons: `--surface` shimmer for list/detail loads.

## 6.7 Iconography

- **One set:** Lucide (consistent 1.5px stroke, geometric, technical). 16 / 20 /
  24px. `currentColor`. Decorative icons `aria-hidden`; standalone icon buttons
  get `aria-label`.
- Brand/social icons (GitHub, LinkedIn) as inline SVG, monochrome.
- QA glyphs (bug, flask, gauge, check-shield) reused consistently for the same
  concepts.

## 6.8 Motion

| Token | Value | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(.2,.7,.2,1)` | enters, most UI |
| `--ease-in-out` | `cubic-bezier(.5,0,.2,1)` | moves/resizes |
| `--dur-1` | 120ms | hover, toggles |
| `--dur-2` | 180ms | dropdowns, toasts |
| `--dur-3` | 260ms | page section reveal, modal |

- Scroll-reveal: fade + 8px rise, **once**, `IntersectionObserver`, disabled
  under `prefers-reduced-motion` (content is always present in the DOM).
- No parallax, no autoplaying video, no infinite loops. Page transitions: cheap
  cross-fade only.

## 6.9 QA visual language — summary

The recurring vocabulary that makes the site legibly "a QA engineer's":

```
 mono type   ·   PASS/FAIL pills   ·   coverage meters   ·   scenario tables
 bug cards with severity rails   ·   request/response code blocks   ·   SQL blocks
 status dots   ·   "evidence" chips   ·   terminal snippets   ·   diff highlights
```

Every case study should surface **at least two** of these so the depth is
visible before the visitor reads a word.

## 6.10 Tokens → implementation

- Ship as `:root` CSS custom properties + a Tailwind v4 `@theme` mapping.
- One `tokens.css` is the single source of truth; the design doc references it.
- A visual **Storybook / component gallery route** (`/admin/_styleguide`, admin
  only, or a static `styleguide` page excluded from sitemap) renders every
  component in every state for review and visual regression tests.

## 6.11 Deliverables the design team owns (not the Founder)

Per the spec: the team produces the visual identity. Expected artifacts by end of
Sprint 2:
- `tokens.css` (final palette, type scale, spacing)
- Component gallery (buttons, inputs, cards, badges, meters, tables, code blocks,
  nav, footer, forms) in light-of-dark
- Hero comp (2 directions → 1)
- Case-study page comp (the hardest layout)
- Admin editor comp (the densest layout)
- Responsive behaviour notes per component
- Favicon / OG template / logo lockup (`[PLACEHOLDER: name]`)

The Founder supplies **content and a portrait/asset if desired**, not design.
