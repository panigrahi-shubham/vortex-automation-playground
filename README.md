# VORTEX — AUTOMATION PLAYGROUND

**Built to Break. Designed to Test.**

[Visit the live playground](https://vortex-qa.vercel.app) · [Testing guide](https://vortex-qa.vercel.app/pages/testing-guide.html) · [About](https://vortex-qa.vercel.app/pages/about.html) · [Future roadmap](docs/ROADMAP.md)

VORTEX is an existing Express and vanilla-JavaScript e-commerce application for practising browser, API and database automation. It includes catalog, account, cart, checkout and order journeys plus UI laboratories, network controls and intentionally defective legacy exercises.

## About

Vortex Automation Playground gives testers a realistic website on which to learn, experiment and build their own automation frameworks. Its simulated store and UI lab offer practical workflows and browser interactions without requiring real purchases. The website, Vortex Web Recorder, Android application and Android Recorder are separate Vortex projects; this repository contains the website and its supporting API and database.

The supported runtime uses **Supabase/PostgreSQL through Prisma**. A separate in-memory compatibility mode preserves the original reference suite and test controls; it is not the production persistence model.

## Quick start

Requirements: Node.js **24.x**, npm, and a dedicated development PostgreSQL database.

```bash
npm ci
cp .env.example .env              # fill in development-only values
npm run db:generate
npm run db:migrate                 # applies migrations to the configured database
npm run db:seed:catalog            # upserts seeded products; creates no accounts
npx playwright install chromium    # needed for browser tests/smoke
npm start                          # builds TypeScript, then serves port 3000
```

Open `http://localhost:3000/shop` and register an account. The catalog seed does not create users. See [docs/SETUP.md](docs/SETUP.md) for connection-pooler URLs, MFA/test-key handling, every command's side effects, and safe legacy startup.

## Runtime modes

| Mode | Selection | Frontend API | Intended use |
|---|---|---|---|
| PostgreSQL | `DATABASE_URL` set and `SHOPLAB_STORAGE` is not `legacy` | `/api/v2` through `web/js/api-v2.js` | Primary persistent application |
| Legacy memory | `SHOPLAB_STORAGE=legacy`, or no `DATABASE_URL` | `/api` | Reference regression suite and original test controls |

`GET /api/config` reports the selected storage. The SPA reads it before routing. These storage modes do **not** implement the planned Normal / Practice / Defect Lab runtime modes described in the master plan.

The legacy suite is pinned to memory mode by `playwright.config.ts`. Stop another local server on port 3000 before letting Playwright manage its own server; otherwise a local run can reuse a server in the wrong mode. Do not run the reset-driven reference suite against a shared or public instance.

## Current feature areas

- Registration, persistent sessions, authenticator MFA, protected development recovery, profile/settings and avatar storage in PostgreSQL mode.
- Catalog search/filter/sort/pagination, reviews/ratings, variants, wishlist, cart, coupons, shipping, simulated checkout, orders, cancellation and CSV invoices.
- Server-authorized admin functions and a transactional outbox foundation; durable subscribers and all remaining business workflows are not complete.
- Legacy email OTP inbox, global/per-request chaos controls, seeded defects, live order events and simulated 3-D Secure, with mode-specific limitations.
- `/lab` exercises for dialogs, tabs/popups, nested frames, shadow DOM, drag/drop, dynamic content, downloads, keyboard, clipboard, geolocation, clocks, tables and accessibility targets.

The route-by-route implementation and reference-design gaps are tracked in [docs/PAGE_DESIGN_INVENTORY.md](docs/PAGE_DESIGN_INVENTORY.md). A route or reference image is not evidence of visual parity.

## Legacy demo accounts

These accounts exist in **legacy memory mode**, not in the PostgreSQL catalog seed. Their shared demo password is `secret123`.

| User | Behavior |
|---|---|
| `standard_user` | Happy path |
| `locked_user` | HTTP 423 locked response |
| `slow_user` | Delayed login |
| `problem_user` | Seeded defects enabled |
| `mfa_user` | Email OTP through the legacy test inbox |
| `admin_user` | Legacy admin console |

PostgreSQL authenticator MFA is different from legacy email OTP. PostgreSQL recovery codes are available only through the protected development sink when `ORVILO_TEST_KEY` is configured; no production email delivery is implemented.

## Verification commands

```bash
npm run typecheck
npm run test:workflows
npm run test:pricing
npm run test:storefront-adapter
npm test                                      # legacy Playwright projects
npx playwright test --project=chromium --project=mobile
npm run test:api
npm run test:bugs                             # intentional expected-failure exercises
```

Database integration and browser smoke tests require a dedicated development database and have fixture side effects; read [docs/SETUP.md](docs/SETUP.md#6-verification-and-test-commands) before running them. Seeded-defect tests intentionally expect failures and are not evidence that defects were fixed. The visual snapshot remains opt-in.

## Documentation and status

- [Setup and configuration](docs/SETUP.md)
- [Current master plan](docs/VORTEX_AUTOMATION_PLAYGROUND_MASTER_PLAN.md)
- [Page and design-reference inventory](docs/PAGE_DESIGN_INVENTORY.md)
- [Automation compatibility contract](docs/AUTOMATION_COMPATIBILITY.md)
- [Historical baseline validation — 29 October 2026](docs/BASELINE_VALIDATION.md)
- [Chronological migration history](MIGRATION.md)
- [Legacy seeded-defect answer key](BUGS.md)

The live production deployment passed a customer journey and browser/API checks on 30 October 2026; see [deployment status](docs/DEPLOYMENT_STATUS.md). The historical baseline is not a fresh guarantee for every feature. Production password recovery is unavailable, and legacy test controls are disabled. Scoped fixtures and resets, durable event processing, additional commerce workflows and full design verification remain future work; see the [roadmap](docs/ROADMAP.md).
