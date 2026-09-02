---
project: qa-portfolio
output: "10 — Security Plan"
lifecycle_state: PLAN_READY
---

# 10 — Security Plan

Guiding rule: **"`/admin` is hidden" ≠ "`/admin` is secure."** Every protection
is enforced at the layer that owns the data, not by obscurity. Inherits the
repo's security posture (`policies/security.yml`, `policies/secrets.yml`,
`docs/security.md`).

## 10.1 Threat model (summary)

| Asset | Threats | Primary control |
|---|---|---|
| Draft / unpublished content | disclosure via wrong query, direct URL, API | RLS `status='published' AND visible` on every read; `notFound()` for misses |
| Contact submissions (PII) | disclosure, exfiltration, spam flooding | RLS insert-only for anon, admin-only read; rate limit + DB trigger; retention |
| Admin session | theft, fixation, CSRF | `HttpOnly/Secure/SameSite=Lax` cookies, PKCE, origin check on mutations |
| Admin authorization | privilege escalation, non-admin write | `is_admin()` in RLS `WITH CHECK` + server re-check; allow-list not app-editable |
| Storage | malicious upload, path abuse, hotlink cost | MIME/size allowlist, SVG policy, admin-only write policy |
| Secrets | leak via client bundle, logs, repo | env schema, `NEXT_PUBLIC_` audit, gitleaks, isolated service-role module |
| Rendered content | stored XSS via Markdown | sanitising pipeline, no raw HTML, safe-link rules, CSP |
| Availability | DoS, scraping, quota exhaustion | edge rate limiting, ISR (cheap reads), Supabase/Vercel limits monitored |

## 10.2 Supabase Auth

- Email + password only; **sign-up disabled** in the Supabase dashboard.
- Accounts provisioned by the Human Founder (add `auth.users` + `admin_users`
  row) per a runbook (T-0507). Adding an admin is treated like the runtime's
  "access-control escalation" critical action — Founder-only, audited.
- Password policy: Supabase minimum + a length check; encourage a password
  manager. Optional: enable Supabase MFA/TOTP for the owner (recommended,
  flagged OQ-004).
- Email confirmation required; password-reset via time-boxed token.
- Session: short access token + refresh token in `HttpOnly` cookies via
  `@supabase/ssr`; refresh on the server; `POST /auth/signout` revokes.
- **Login abuse:** ≤ 5 attempts / 15 min / IP-hash → exponential backoff + a
  short soft-lock; generic "invalid email or password" (no user enumeration);
  log attempts to `content_audit` (action `auth_failed`, no password).

## 10.3 Admin authorization

Defence in depth — four independent checks:

1. **Middleware** (`middleware.ts`): no Supabase session cookie on `/admin/**`
   → redirect to `/admin/login`. (Coarse; not the security boundary.)
2. **Server layout** (`app/admin/layout.tsx`): `await isAdmin()` server-side;
   authenticated-but-not-allow-listed → `403` page, not the panel.
3. **Every mutation** (server action / route handler): re-checks `isAdmin()`
   before touching data; validates input with the shared `zod` schema; verifies
   request origin (CSRF).
4. **Database RLS** (`WITH CHECK (is_admin())`): even a compromised app path
   cannot write as a non-admin.

`is_admin()` is `SECURITY DEFINER` with a pinned `search_path` and reads only
`admin_users`. The `admin_users` table has **no** `INSERT/UPDATE/DELETE` policy
for any app role.

Roles: `owner` vs `editor` on `admin_users`. V1 ships one `owner`. `owner`-only
actions: localisation settings, feature flags, creating taxonomy terms,
(future) managing other editors.

## 10.4 Row Level Security

Full policy design is in [02 §2.10](02-database-schema.md). Key points:

- **RLS enabled on every table in `public`.** Default deny. No table relies on
  "the app won't query it".
- Public read = `status='published' AND visible=true` on base tables; child /
  translation tables gate on the **parent's** publication state.
- All writes = `USING (is_admin()) WITH CHECK (is_admin())`.
- `contact_messages`: anon `INSERT` only (`WITH CHECK (true)`), admin `SELECT`
  and `UPDATE`; **no** anon `SELECT`/`UPDATE`/`DELETE` → denied. A `BEFORE
  INSERT` trigger caps inserts per `ip_hash` per hour as a DB-level backstop.
- `content_audit`: admin `INSERT` + `SELECT` only; **no** `UPDATE`/`DELETE`
  policy → append-only.
- **Test matrix (T-1702) is mandatory and runs in CI:** for every table,
  `{anon, admin} × {select, insert, update, delete} × {published row, draft row}`
  → asserted expected allow/deny. A new table without a matrix entry fails CI.
- `service_role` (bypasses RLS) is used only in `lib/supabase/admin-server.ts`
  for: draft-preview reads, Storage maintenance, seed. An ESLint
  `no-restricted-imports` rule + a build test forbid importing it from anything
  under `app/**/(client)` or any `"use client"` module.

## 10.5 Environment variables & server secrets

| Rule | Enforcement |
|---|---|
| Secrets never in a `NEXT_PUBLIC_*` name | env schema (T-0306) + a test that greps the client bundle for the service-role key |
| Secrets only in Vercel encrypted env + local `.env.local` (git-ignored) | `.gitignore`, `.env.example` with placeholders only |
| No secret in logs / error messages / audit | structured logging with a redaction allowlist; error boundary strips details in prod |
| gitleaks in CI on every PR | mirrors repo policy |
| Rotate on suspicion; document rotation for each key | runbook (T-2007/T-2008) |
| CI uses scoped **staging** secrets only | separate Vercel/Supabase envs |

Secret inventory: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` (if preview
tokens used), `MAIL_PROVIDER_API_KEY`, `REVALIDATE_WEBHOOK_SECRET`,
`TURNSTILE_SECRET_KEY` (optional), `SENTRY_AUTH_TOKEN` (optional).

## 10.6 File-upload security

| Control | Detail |
|---|---|
| MIME allowlist | `image/png`, `image/jpeg`, `image/webp`, `image/avif` (+ `image/svg+xml` only if sanitised — see below). Checked **client and server**; server is authoritative. |
| Magic-byte sniffing | Verify the actual file signature server-side, not just the declared `Content-Type`. |
| Size limit | ≤ `N` MB (config; propose 5 MB) enforced server-side and by a Storage policy. |
| Dimensions | Extract server-side; reject absurd dimensions (decompression-bomb guard). |
| **SVG** | **Default: disallow SVG uploads.** If enabled later, run through a strict sanitiser (strip `<script>`, `on*`, `<foreignObject>`, external refs) and serve with `Content-Disposition: attachment` / a separate origin. Decision recorded (T-1203). |
| Filenames / paths | Server generates the storage path (`{uuid}/{slug}.{ext}`); the client filename is never used in the path. |
| Storage policy | `INSERT/UPDATE/DELETE` on bucket `media` require `is_admin()`. |
| Serving | Public bucket + CDN; `next/image` with fixed `sizes`; immutable cache by content hash. |
| Cost / hotlinking | Low risk at this scale; monitor egress; can add a referer check later. |

## 10.7 Rich-text / Markdown sanitisation

- Content prose is **Markdown text**, never stored HTML.
- Render pipeline: `remark-parse → remark-gfm → remark-rehype (allowDangerousHtml:
  false) → rehype-sanitize (strict allowlist) → rehype-stringify`.
- Allowlist: headings, paragraphs, lists, `strong/em/del`, `code/pre`,
  `blockquote`, tables, `a`, `img`. **No** `script`, `style`, `iframe`,
  `object`, `on*` attributes, `javascript:` URLs.
- Links: `http(s)`/`mailto` only; external links get `rel="nofollow ugc
  noopener noreferrer"` `target="_blank"`.
- Images in Markdown must reference the media library (or an allowed host);
  arbitrary remote images are blocked (privacy + CSP).
- Code blocks: highlighted at **build time** (Shiki) — no client-side highlighter
  executing content.
- An **XSS payload corpus** test renders known attack strings and asserts inert
  output (T-1701), run in CI.
- The contact inbox renders message bodies as **plain text only** — never
  Markdown, never HTML.

## 10.8 Form validation & contact-form protection

| Layer | Control |
|---|---|
| Client | `zod` schema: required fields, email format, length caps (name ≤ 120, subject ≤ 200, body 10–5000), consent checkbox required |
| Transport | HTTPS only; `POST` only; same-origin |
| Server (`/api/contact`) | Re-validate with the **same** `zod` schema; reject on mismatch with a generic 400 |
| Honeypot | A hidden field that must stay empty; a min-time-to-submit check (< 2s = bot) |
| Rate limit | ≤ 5 submissions / hour / `ip_hash` at the app layer (edge KV or in-memory+DB), plus the DB `BEFORE INSERT` trigger as a hard backstop |
| CAPTCHA | Cloudflare Turnstile behind a feature flag (off by default); verified server-side when on |
| Storage | `ip_hash` = salted SHA-256 (not the raw IP); `user_agent` truncated; `spam_score` recorded |
| Response | Always a generic success after a valid submit (no "email already contacted" oracle); errors never leak stack/infra |
| Email | Templated; user input inserted as **text**, never as HTML; `Reply-To` set to the submitter, `To` fixed |
| Privacy | `/legal/privacy` explains storage, purpose, retention (KVKK + GDPR); consent is explicit; retention job purges after `N` days |

## 10.9 Admin route protection (recap)

- `robots.txt` `Disallow: /admin`, `/api`, preview paths.
- All `/admin/**` and `/auth/**` responses: `X-Robots-Tag: noindex, nofollow`.
- `/admin` never cached (`dynamic = 'force-dynamic'`, `no-store`).
- Preview (`/admin/projects/[id]/preview`): admin session required, `noindex`,
  `no-store`; the draft-aware read uses the isolated server module.
- No admin bundle, route name, or API shape is treated as a secret — the
  security is the auth + RLS, so enumerating routes gains nothing.

## 10.10 Database access

- App connects only via Supabase (PostgREST + Auth), not a raw connection
  string in the app.
- **No dynamic SQL from user input.** All queries via the typed Supabase client
  / RPC functions with parameters; `rpc()` functions are `SECURITY INVOKER`
  unless they specifically need `DEFINER` (only `is_admin()` does).
- Migrations are reviewed SQL in the repo; prod apply is a Human-Founder-approved
  step (mirrors `database-migration` workflow).
- Backups: Supabase PITR / scheduled backups; a restore is rehearsed on staging
  (T-2006).
- Least privilege: the anon role can do nothing RLS doesn't allow; the
  authenticated role is still fully RLS-bound.

## 10.11 Public content access

- Read-only, anonymous, RLS-scoped. No mutations from any public route.
- The anon key is publishable by design (it's in the client) — its power is
  bounded entirely by RLS, which is why the RLS matrix test is a release gate.
- ISR means most public reads never hit the DB — smaller attack surface and
  cheaper under scraping.

## 10.12 Rate limiting (all surfaces)

| Surface | Limit (proposal, tunable via env) | Mechanism |
|---|---|---|
| `POST /api/contact` | 5 / hour / ip_hash; 20 / day / ip_hash | edge KV counter + DB trigger backstop |
| `/admin/login` | 5 / 15 min / ip_hash then backoff | app counter + soft-lock |
| Other `/api/*` | 60 / min / ip_hash generic guard | edge middleware |
| Static/ISR pages | CDN absorbs; origin protected by ISR | Vercel edge |
| Sitemap/robots | cached long | — |

## 10.13 XSS, injection & other web risks

| Risk | Control |
|---|---|
| Stored XSS (Markdown) | §10.7 sanitiser + CSP + no raw HTML |
| Reflected XSS | React auto-escaping; no `dangerouslySetInnerHTML` except the sanitised Markdown output; URL params validated by `zod` before use |
| DOM XSS | no `eval`, no `innerHTML`, no untrusted `href`/`src`; ESLint rules |
| SQL injection | parameterised Supabase client / RPC only; no string-built SQL |
| SSRF | server never fetches a user-supplied URL; OG images render from DB fields only |
| CSRF | server actions verify `Origin`/`Sec-Fetch-Site`; `SameSite=Lax` cookies; no state-changing `GET` |
| Clickjacking | `frame-ancestors 'none'` (CSP) + `X-Frame-Options: DENY` |
| Open redirect | `?next=` sanitised to same-origin `/admin/*` paths only |
| MIME sniffing | `X-Content-Type-Options: nosniff` |
| Info leak | prod error boundary hides details; no source maps public; server headers minimal (`X-Powered-By` removed) |
| Dependency vulns | Trivy/Semgrep + `npm audit` in CI, block on high/critical; Dependabot/Renovate; SHA-pinned GitHub Actions |
| Supply chain | lockfile committed; `npm ci`; minimal deps; review new deps in PR |

## 10.14 Security response headers (CSP focus)

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-<per-request>';        # no unsafe-inline for scripts
  style-src 'self' 'unsafe-inline';               # Tailwind runtime; tighten to nonce if feasible
  img-src 'self' data: https://<supabase-project>.supabase.co https://<cdn>;
  font-src 'self';
  connect-src 'self' https://<supabase-project>.supabase.co;
  form-action 'self';
  frame-ancestors 'none';
  base-uri 'self';
  object-src 'none';
  upgrade-insecure-requests;
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()
```

Roll out CSP **report-only first** (Sprint 2), monitor violations, then enforce
(Sprint 6).

## 10.15 Layered scanning (mirrors repo policy)

| Tool | Stage | Gate |
|---|---|---|
| gitleaks | pre-commit + CI | block on any finding |
| Semgrep (JS/TS + React rules) | CI | block on high |
| `npm audit` / Trivy (deps + lockfile) | CI | block on high/critical |
| ESLint security rules | CI | block |
| Playwright + axe | CI | block on serious/critical a11y |
| Lighthouse CI (best-practices incl. HTTPS, CSP) | CI | budget gate |
| RLS test matrix | CI (against staging) | block on any mismatch |
| XSS corpus render test | CI | block |
| Manual pre-launch security review (T-1710) | Sprint 6/7 | sign-off, 0 criticals |
| ZAP baseline scan (optional, against staging) | pre-launch | triage findings |

## 10.16 Incident readiness

- Kill switch: the site is static/ISR; in an incident, roll back the Vercel
  deployment and/or disable the affected route; revoke Supabase keys and rotate.
- `content_audit` + Supabase logs + Vercel logs give a timeline.
- Contact-form abuse: raise the rate limit / enable Turnstile / temporarily
  disable the endpoint via a flag.
- A one-page incident runbook ships with T-2008.

## 10.17 What is explicitly out of scope (and why it's acceptable)

| Not doing | Why acceptable for V1 |
|---|---|
| WAF beyond Vercel's baseline | low-value target, static reads, RLS-bound |
| SIEM / SOC | single-operator site; audit log + platform logs suffice |
| Pen-test by a third party | recommended pre-launch but not blocking; internal review (T-1710) is required |
| Bug bounty | premature |
| DDoS protection beyond CDN | CDN + ISR absorb; escalate to Vercel Pro if needed |
