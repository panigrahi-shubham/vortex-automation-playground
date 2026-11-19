# Vortex Business

Open the business portal at `/business` or choose **Business** in the main navigation.
Use the existing account sign-in, then
create a business profile. No additional seller password is required. Every
account owns a private demo workspace; it does not grant storefront admin access.

## Workflows

| Page | Functional journey |
| --- | --- |
| `/business` | Create/edit a company profile; view balance, wholesale revenue, bookings, certificates and recent activity. |
| `/business/seller` | Create/edit a private wholesale listing, search inventory, filter status, create sample buyer enquiries, quote an RFQ, simulate acceptance, reserve stock, cancel an unshipped order or ship with tracking and receive a demo payment. |
| `/business/travel` | Search five supported cities with a future departure and 1–6 travellers, confirm a demo flight, download an itinerary and cancel for a full demo refund. |
| `/business/finance` | Add a fictional `DEMO-` beneficiary, review/confirm a payment, search/filter/page through the ledger and export a CSV statement. |
| `/business/learning` | Enrol in three business courses, read and complete lessons, pass a gated assessment and download a text completion certificate. |

Seller inventory, sample buyer requests and orders are private practice data,
separate from the buyer storefront catalog. Sample buyer acceptance is explicitly
simulated; there is no shared marketplace, real airline, bank or payment gateway.
All amounts use USD and integer cents. Certificates are not accredited.

## Storage and setup

In PostgreSQL mode, apply `npm run db:migrate` and regenerate/build with
`npm run build` before startup. The `BusinessWorkspace` aggregate belongs to the
authenticated user with cascade deletion. In legacy mode it is attached to the
in-memory user and lasts until reset/restart. Nothing is stored in browser localStorage
apart from the existing account session.

The server validates all mutations. Workspace versions reject stale writes with
409; refresh before retrying. The latest 200 request IDs and command fingerprints
are retained to recognize network retries without repeating a mutation. Reusing
an ID for different details is rejected. The browser retains an uncertain command
in session storage and reuses its original ID when retrying or recovering after
a reload. Do not start a different action until the previous one is confirmed.
Already accepted quotes, shipped
orders and cancelled trips cannot repeat their financial or inventory effects.
Prices and trip fares are calculated/validated on the server. No user ID supplied
by the client selects the workspace. Demo limits: 100 products, 50 beneficiaries,
100 buyer enquiries, 100 reservations, fewer than 1,000 ledger entries and 30 recent activity events.

## Automation

Run `node --test tests/workflows/business.test.js` for business invariants.
Run `npm run test:api -- business.api.spec.ts` for authenticated account isolation,
idempotency and concurrent writes. Run
`npx playwright test --project=chromium tests/e2e/business.spec.ts` for complete
seller, travel, finance and learning journeys, mobile layout, and navigation
between the UI Lab and the business portal. This also checks interrupted payment recovery, keyboard focus,
CSV contents, accessibility and narrow-screen layouts.
The standard Playwright configuration starts a legacy server;
never point its reset-driven global setup at a shared or production instance.

For PostgreSQL, use a dedicated development database, apply migrations, then run
`npm run test:db` and `npm run test:business:db`. The latter starts its own server on
port 3100 without the legacy global reset. It exercises all four portal sections
through real database sessions, checks a fresh mobile browser session and removes
its own account fixtures. Both checks are included in the database CI job.

Open `/lab` for the standalone browser exercises, including native dialogs,
uploads, frames, shadow DOM, canvas, and geolocation.

## Release order

Apply migration `202611170001_business_workspace` with `npm run db:migrate`
against the intended deployment database before routing users to the portal, then
build and deploy the application. Use the existing secure database bindings;
never copy credentials into source. A Git push does not run production migrations.
The migration adds a private table with an owner foreign key and revokes public,
anonymous and authenticated data-API access. Existing storefront tables are not
changed by this migration. Production deployment is separate from local/CI checks.

Tests should use roles and labels, scoped to a dialog, business row, RFQ or course.
Stable entry points include `business-portal`, `business-nav-*`,
`business-product-row`, `business-rfq`, `business-booking`, `business-balance`,
`business-transaction`, `business-course` and `business-form-error`.

## Validation — 17 November 2026

- Build and full TypeScript check passed.
- Workflow and boundary tests: 26 passed; pricing: 2 passed; storefront adapter: 2 passed.
- PostgreSQL integration tests: 13 passed, including business ownership, real concurrent writes and durable payment deduplication.
- Full legacy Playwright suite: 209 passed, including its intentional expected-failure defect exercises.
- PostgreSQL business browser journey: passed across all four sections and a fresh mobile browser session.
- Business accessibility scans and 360-pixel layouts passed; uncertain-payment retry/reload recovery and CSV contents were exercised.

These results describe the local development and CI-compatible commands, not a
production deployment or a completed GitHub Actions run.
