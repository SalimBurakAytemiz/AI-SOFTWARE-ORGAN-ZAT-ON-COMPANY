---
generated_by: project-factory@0.1
project: qa-portfolio
title: "QA Engineer Portfolio Platform - Product Brief"
lifecycle_state: INTAKE
note: >
  Deterministic scaffold generated from project.yml. Runtime V1.1 agents
  refine this during an authorised build. Not the final specification.
---
# QA Engineer Portfolio Platform - Product Brief

**Slug:** qa-portfolio  |  **Type:** web_app  |  **Business model:** other
**Target market:** Türkiye and the international English-speaking technology market  |  **Risk level:** 3  |  **Security level:** elevated

## Description
A premium technical bilingual (Turkish and English) portfolio and
case-study web application for a professional Software QA Engineer. It has a
public marketing website that presents the engineer's experience skills services
and QA case studies. It also has a private admin dashboard (a headless CMS behind
an admin login) where the owner creates translates previews and publishes
projects and content without touching source code. The public site renders only
published content. Every project has a classification (Featured Professional
Supported Personal QA Lab or Archived) and a lifecycle status of Draft Published
or Archived plus visibility featured supported and display-order flags. Case
studies hold structured QA content such as testing scope test strategy test
scenarios API testing examples SQL and database validation bug report examples
challenges impact and lessons learned. Media such as screenshots and diagrams is
uploaded through the admin dashboard and served from object storage. A public
contact form lets visitors send messages and its submissions are personal data.
Admin accounts authenticate with email and password against an allow-list. The
design must feel premium technical and software-engineering oriented with a dark
theme and must clearly communicate Software QA Engineering rather than a generic
freelancer portfolio.

## Business goal
Give the QA Engineer a self-owned credible bilingual professional
presence that converts recruiter and client visits into contact and interview
requests and lets the owner keep it current entirely through the admin dashboard.

## Target users
- recruiters and hiring managers
- engineering managers and technical leads
- potential freelance and consulting clients
- fellow QA and software engineers
- the portfolio owner acting as the site administrator

## Platforms
- web

## Core features (initial)
- Public bilingual TR and EN marketing website with locale-aware routing
- Home / About-Experience / Projects / Project case-study / QA Lab / QA Lab detail / Services / Contact pages
- Project catalogue with classification filtering and a featured section
- Structured QA case-study pages with scope strategy scenarios API tests SQL validation bug reports challenges impact and lessons
- Admin dashboard protected by Supabase Authentication and an admin allow-list
- Admin project editor for metadata classification status visibility featured supported display-order taxonomy TR content EN content and every QA content block
- Content workflow of Draft then Preview then Publish then Unpublish / Hide / Archive / Restore
- Admin modules for experience skills services education certifications media and site settings
- Media library with image upload to Supabase Storage
- Public contact form with validation spam protection and rate limiting
- SEO architecture with per-locale metadata Open Graph sitemap robots hreflang and structured data
- Incremental Static Regeneration with on-demand revalidation when content is published or unpublished

## Constraints
- Next.js App Router and React for the frontend and server rendering
- Supabase provides PostgreSQL Authentication Row Level Security and Storage
- Turkish and English content parity using a translation-table strategy
- Dark-theme-first premium technical design system created by the team because no design files are provided
- Must run within free or low-cost hosting tiers (Vercel plus Supabase free tier)
- Accessibility to WCAG 2.1 AA and good Core Web Vitals are first-class requirements
- No real customer data and no payments and no production deployment until the Human Founder authorizes it

## Integrations (candidate)
- Supabase for PostgreSQL Authentication Row Level Security and Storage
- Vercel for hosting the edge network and on-demand revalidation
- A transactional email provider for contact-form notifications (to be selected)

## Non-goals for the first version
- Anything not listed under core features above
- Production deployment, payment execution, or destructive data operations (Human Founder controlled)
