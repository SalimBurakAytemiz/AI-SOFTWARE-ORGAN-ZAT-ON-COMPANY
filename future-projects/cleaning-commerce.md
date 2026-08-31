# Future Project — Cleaning Commerce

**Status:** PLACEHOLDER. Not started. Not designed. Do not build in the current phase.

Cleaning Commerce is the first product the AI Software Company will build, **after**
the Agent Runtime phase is complete and the Human Founder authorizes product work.

## What is recorded now (and only this)

Cleaning Commerce will be:

- **B2C** — consumers booking/buying cleaning products and services
- **B2B** — business customers with accounts, quotes, invoicing, and bulk ordering
- **Web-first** — responsive web is the primary channel
- **Possibly mobile later** — a native or PWA mobile client is a later consideration, not a commitment
- **Developed by the AI Software Company** — using this repository's organization, workflows, and policies
- **Maintained by the AI Software Company** — ongoing bugfix, dependency, and improvement workflows
- **Tested by the AI Software Company** — QA strategy and automated test suites per `policies/qa.yml`
- **Security-reviewed by the AI Software Company** — standing SECURITY gate, threat modeling, DAST once staged
- **Production changes controlled by the Human Founder** — every deploy, migration, payment-config change, refund, and infrastructure change is a critical action requiring explicit Human Founder approval (`policies/human-approval.yml`)

## What is deliberately NOT decided here

- Commerce platform choice (Vendure / Medusa / Saleor / custom) — a separate **Product
  Architecture** decision, owned by the Solution Architect, approved by the Human Founder.
- Technology stack specifics (beyond the company's TypeScript/Node/React/PostgreSQL
  house defaults) — same Product Architecture decision.
- Payment, shipping, ERP, and CRM provider selection — Integration Engineer proposals,
  Human Founder approval; `payment-provider` is `DEFERRED` in `tools/registry.yml`.
- Detailed requirements, data model, pricing rules, or fulfillment flows.
- Hosting and infrastructure.

## How it will start

When authorized, Cleaning Commerce begins at the `IDEA` state of
`workflows/feature-development.yml` (or a dedicated product-inception workflow if one
is added), driven by the Product Manager and Business Analyst, with a Product
Architecture decision preceding the first build.
