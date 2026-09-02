---
generated_by: project-factory@0.1
project: qa-portfolio
title: "QA Engineer Portfolio Platform - Requirements"
lifecycle_state: DISCOVERY
note: >
  Deterministic scaffold generated from project.yml. Runtime V1.1 agents
  refine this during an authorised build. Not the final specification.
---
# QA Engineer Portfolio Platform - Requirements

## Functional requirements

### FR-001. Public bilingual TR and EN marketing website with locale-aware routing

- **Priority:** must
- **Rationale:** supports the business goal ("Give the QA Engineer a self-owned credible bilingual professional
presence that converts recruiter and client visits into contact and interview
requests and lets the owner keep it current entirely through the admin dashboard.").
- **Verification:** an automated test proves this feature behaves as specified.

### FR-002. Home / About-Experience / Projects / Project case-study / QA Lab / QA Lab detail / Services / Contact pages

- **Priority:** must
- **Rationale:** supports the business goal ("Give the QA Engineer a self-owned credible bilingual professional
presence that converts recruiter and client visits into contact and interview
requests and lets the owner keep it current entirely through the admin dashboard.").
- **Verification:** an automated test proves this feature behaves as specified.

### FR-003. Project catalogue with classification filtering and a featured section

- **Priority:** must
- **Rationale:** supports the business goal ("Give the QA Engineer a self-owned credible bilingual professional
presence that converts recruiter and client visits into contact and interview
requests and lets the owner keep it current entirely through the admin dashboard.").
- **Verification:** an automated test proves this feature behaves as specified.

### FR-004. Structured QA case-study pages with scope strategy scenarios API tests SQL validation bug reports challenges impact and lessons

- **Priority:** should
- **Rationale:** supports the business goal ("Give the QA Engineer a self-owned credible bilingual professional
presence that converts recruiter and client visits into contact and interview
requests and lets the owner keep it current entirely through the admin dashboard.").
- **Verification:** an automated test proves this feature behaves as specified.

### FR-005. Admin dashboard protected by Supabase Authentication and an admin allow-list

- **Priority:** should
- **Rationale:** supports the business goal ("Give the QA Engineer a self-owned credible bilingual professional
presence that converts recruiter and client visits into contact and interview
requests and lets the owner keep it current entirely through the admin dashboard.").
- **Verification:** an automated test proves this feature behaves as specified.

### FR-006. Admin project editor for metadata classification status visibility featured supported display-order taxonomy TR content EN content and every QA content block

- **Priority:** should
- **Rationale:** supports the business goal ("Give the QA Engineer a self-owned credible bilingual professional
presence that converts recruiter and client visits into contact and interview
requests and lets the owner keep it current entirely through the admin dashboard.").
- **Verification:** an automated test proves this feature behaves as specified.

### FR-007. Content workflow of Draft then Preview then Publish then Unpublish / Hide / Archive / Restore

- **Priority:** should
- **Rationale:** supports the business goal ("Give the QA Engineer a self-owned credible bilingual professional
presence that converts recruiter and client visits into contact and interview
requests and lets the owner keep it current entirely through the admin dashboard.").
- **Verification:** an automated test proves this feature behaves as specified.

### FR-008. Admin modules for experience skills services education certifications media and site settings

- **Priority:** should
- **Rationale:** supports the business goal ("Give the QA Engineer a self-owned credible bilingual professional
presence that converts recruiter and client visits into contact and interview
requests and lets the owner keep it current entirely through the admin dashboard.").
- **Verification:** an automated test proves this feature behaves as specified.

### FR-009. Media library with image upload to Supabase Storage

- **Priority:** should
- **Rationale:** supports the business goal ("Give the QA Engineer a self-owned credible bilingual professional
presence that converts recruiter and client visits into contact and interview
requests and lets the owner keep it current entirely through the admin dashboard.").
- **Verification:** an automated test proves this feature behaves as specified.

### FR-010. Public contact form with validation spam protection and rate limiting

- **Priority:** should
- **Rationale:** supports the business goal ("Give the QA Engineer a self-owned credible bilingual professional
presence that converts recruiter and client visits into contact and interview
requests and lets the owner keep it current entirely through the admin dashboard.").
- **Verification:** an automated test proves this feature behaves as specified.

### FR-011. SEO architecture with per-locale metadata Open Graph sitemap robots hreflang and structured data

- **Priority:** should
- **Rationale:** supports the business goal ("Give the QA Engineer a self-owned credible bilingual professional
presence that converts recruiter and client visits into contact and interview
requests and lets the owner keep it current entirely through the admin dashboard.").
- **Verification:** an automated test proves this feature behaves as specified.

### FR-012. Incremental Static Regeneration with on-demand revalidation when content is published or unpublished

- **Priority:** should
- **Rationale:** supports the business goal ("Give the QA Engineer a self-owned credible bilingual professional
presence that converts recruiter and client visits into contact and interview
requests and lets the owner keep it current entirely through the admin dashboard.").
- **Verification:** an automated test proves this feature behaves as specified.

## Non-functional requirements

- NFR-001. The system runs on: web.
- NFR-002. Security level is "elevated"; no secret is committed or logged.
- NFR-003. All changes go through the feature-development workflow with an independent review and a QA gate.
- NFR-004. No production deployment, migration, or financial action occurs without explicit Human Founder approval.

## Open questions for Discovery
- Confirm the priority order of the core features with the Human Founder
- Confirm the target market and any locale / regulatory constraints
- Confirm concrete providers for: Supabase for PostgreSQL Authentication Row Level Security and Storage, Vercel for hosting the edge network and on-demand revalidation, A transactional email provider for contact-form notifications (to be selected)
