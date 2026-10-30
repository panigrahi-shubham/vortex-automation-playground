# Vortex Automation Playground

## Consolidated website specification and development milestones

Version: 2.1
Date: 29 October 2026  
Scope: website, its REST API, database, test laboratories and supporting documentation.

This document merges the submitted master specification with the existing Orvilo
implementation and the agreed testing-focused priorities. It supersedes
VORTEX_WEB_SPEC.md and SPEC_REVIEW.md for future planning. Earlier documents remain
historical references; their greenfield instructions and recorder milestones do
not direct this project.

## 1. Project boundaries

Vortex Automation Playground is a standalone, working website where people can
practice manual testing and browser/API/database automation against realistic,
repeatable workflows.

The following are separate Vortex projects, outside this repository's deliverables:

- Vortex Web Recorder.
- The Vortex Android application.
- Vortex Android Recorder.

This project does not build recorders, generate APKs, implement native mobile
screens, or own recorder benchmarking, recording accuracy or code generation.
External tools may test this website through its documented UI and API. No other
Vortex product is required to run or release the website. Sharing a backend with
another project is a future integration decision, not a requirement here.

Responsive mobile-browser support remains in scope. Native-device automation,
Appium, Maestro, Mobilewright, Kotlin and Android build documentation are excluded.

## 2. Product identity and principles

- Primary name: **VORTEX**.
- Subtitle: **AUTOMATION PLAYGROUND**.
- Tagline: **Built to Break. Designed to Test.**
- Change visible branding, metadata and documentation. Preserve existing database
  schema names, API paths, environment-variable names and encryption keys unless
  an independently justified migration requires otherwise.
- Build one cohesive application with usable navigation, persistence, validations
  and complete business journeys. Functional controls must perform their stated
  action, not merely display a success toast.
- Every feature needs success, loading, empty, validation, permission and failure
  states where applicable.
- Normal business behavior must be reliable. Deliberate defects belong to clearly
  identified, isolated test scenarios and are disabled in normal mode.
- No mandatory AI service, real payment processing, SMS or external email delivery.
- Report actual verification results. Implemented, verified, partial and deferred
  work must remain distinguishable.

## 3. Architecture decisions

Continue the established implementation:

- Frontend: existing modular browser JavaScript, HTML and CSS, bundled fonts and
  reusable view/form/API helpers. Add TypeScript gradually where it helps.
- Backend: Node.js, Express and TypeScript domain modules.
- Database: Supabase PostgreSQL through Prisma, with versioned migrations.
- Hosting target: Vercel-compatible Express function and static assets.
- Verification: TypeScript, focused unit tests, API/database integration tests,
  Playwright browser tests and GitHub Actions.
- Contracts: OpenAPI, validated request/response schemas and consistent errors.

Do not replace PostgreSQL with SQLite or rewrite the entire frontend in React,
Vite, Tailwind, shadcn/ui or TanStack Query solely to meet a technology checklist.
Such a change needs a separate benefit, migration plan and approval of its scope.
Zod or an equivalent validation library may be introduced where it replaces
duplicated validation and supports the API contract.

Maintain the intended organization incrementally:

```text
api/                         Vercel Express entry
src/auth/                    Sessions, MFA, recovery, roles and permissions
src/modules/<domain>/        Routes, services, repositories and domain events
src/workflows/               Checkout, cancellation, deletion and later returns
src/events/                  Outbox, dispatcher and subscribers
src/test-hooks/              Protected fixtures, scoped reset and fault controls
prisma/                      Schema, migrations and seed definitions
web/                         Working website and shared assets
packages/sdk/                Thin generated OpenAPI client when consumed
packages/test-kit/           Factories, fixture lookup, reset and DB checks
tests/                       Unit, API, DB, contract, workflow and browser tests
docs/                        Setup, contracts, labs, test data and verification
```

Transactions provide rollback for database-only steps. Explicit compensation is
required for multi-step workflows that cross transaction or external-system
boundaries. Do not invent undo actions for irreversible operations.

The PostgreSQL-backed application is the target supported experience. Retain the
legacy memory mode while it provides useful compatibility coverage, but document
its differences and isolate its mutable test controls. Do not silently route a
failed database operation into the memory store.

## 4. Existing baseline to preserve

Already implemented in the database-backed application:

- Registration, login/logout, remember-me, session expiration, password hashing,
  locking and account-based login throttling.
- Authenticator MFA, encrypted secrets, replay checks and one-use backup codes.
- Protected development recovery codes and password reset with session revocation.
- Profile editing, protected email changes, password changes, appearance settings
  and validated persistent avatar uploads/removal.
- Catalog, search/categories/filters/sorting/pagination, product details,
  reviews/ratings, variants, wishlist and cart.
- Coupons, shipping choices, demo tax, simulated checkout, stock consistency,
  duplicate-request protection, order history, cancellation and CSV invoices.
- Admin metrics, product CRUD/stock editing, order status transitions and customer
  locking with server-side admin authorization.
- Outbox creation and a dispatcher foundation.

Existing laboratories and supporting work include common form controls, dialogs,
tabs/popups, iframes, shadow DOM, drag/drop, hover/context menus, contenteditable,
dynamic content, infinite scrolling, files, keyboard/clipboard, clocks, geolocation,
tables and accessibility targets. Eight documented defects and chaos controls exist
in legacy mode. They need consolidation, not a fresh implementation of everything.

There are design references for 22 screens/visuals, existing API and browser tests,
database integration coverage and a GitHub Actions workflow. This baseline does
not mean all requirements below are complete or all 22 designs match the running UI.

## 5. Website modules and target requirements

### Authentication, account and permissions

- Preserve all existing authentication, MFA, recovery, profile and avatar behavior.
- Provide standard, admin, seller, locked, slow-response, MFA and read-only demo
  personas through explicit development/test seed configuration.
- Persist only password hashes. Document demo credentials without embedding real
  credentials or production secrets.
- Enforce roles and resource ownership in the backend. A read-only account must
  fail mutation requests even when the UI is bypassed.
- Keep simulated recovery/OTP delivery protected and test-only. A real email
  provider is not required for this playground's release.
- Complete the reference settings controls that have useful behavior and test
  coverage. Never present an unimplemented channel or preference as operational.

### Overview and activity

- Use real database product/order counts and demo revenue metrics.
- Add activity and notification views once event subscribers exist.
- Add search, date filtering or a small chart only where it creates a meaningful
  data-validation or interaction scenario. Do not require arbitrary widgets.

### Marketplace, checkout and orders

- Preserve existing catalog, reviews, variants, wishlist, cart and pricing flows.
- Validate addresses and all server inputs, including negative, boundary and
  malformed values. Never trust client prices, totals or authorization fields.
- Add simulated 3-D Secure success, failure, cancellation and expiry.
- Add a bounded return workflow: eligible order -> request -> approve/reject ->
  complete. Document inventory and simulated refund effects and prevent duplicate
  completion. No real money or payment-provider integration.
- Preserve immutable order/pricing snapshots and enforce valid status transitions.
- Support permission-safe invoices, downloads and repeat purchases.

### Sellers, suppliers and enquiries

This is a website business-workflow extension, not a recorder feature. Complete
one usable vertical journey before adding optional breadth:

1. Seller manages only their own product listings and stock.
2. Buyer views a supplier profile and submits a product enquiry/RFQ.
3. Supplier receives the lead and submits a quote.
4. Buyer reviews and accepts/rejects the quote.
5. Both parties can view the status and audit history.

Include a simple buyer/supplier conversation view and validated attachment support.
Enforce participant access and seller ownership on every endpoint. Add quote
comparison and richer lead dashboards after the vertical journey is verified;
these must not block the core website release.

### Forms lab

- Reuse existing text, numeric, email/password, textarea, radio, checkbox, select,
  date/time, file, preview, slider, switch, address and wizard examples.
- Add missing multiselect, autocomplete, repeatable fields and conditional controls
  after inventorying current coverage.
- Cover required, format, boundary, cross-field and dependent-field validation.
- Give each scenario a description, stable selector, predictable result and reset.
- Persist real submitted form records where persistence is the exercise; explicitly
  identify transient UI demonstrations instead of forcing every widget into the DB.

### Tables lab

- Provide search/filter/sort, stable ordering, server pagination and row details.
- Add column visibility, selection, bulk actions and inline editing with permission
  checks and clear success/failure states.
- Include CSV export, empty results, loading indicators and boundary-page behavior.
- Seed at least 100 deterministic lab records in a dedicated dataset. The business
  catalog does not need artificial growth just to satisfy a table-test requirement.

### Advanced UI lab

Retain existing coverage and fill confirmed gaps across:

- Dynamic DOM, delayed appearance, AJAX, debounced search and enabled-state changes.
- Infinite scrolling and virtualization as distinct exercises.
- Nested frames, open shadow DOM and documented closed-shadow limitations.
- Drag/drop, hover, context menus, modals, toasts and native browser dialogs.
- New tabs/popups, file uploads/downloads and keyboard shortcuts.
- Contenteditable, changing IDs, duplicate text/labels and conditional fields.
- Explicit timeout/retry scenarios and responsive behavior.

Every exercise needs expected behavior, visible results, reset/configuration,
automation hints and deterministic baseline behavior. Unstable IDs or delayed
elements must be named test conditions, not unexplained accidental flakiness.

### Defect and API labs

- Give each defect a stable ID, description, severity, reproduction steps, expected
  behavior, faulty behavior and reset procedure.
- Prefer named fault profiles and explicit delays/status codes over randomness.
  If a random exercise is useful, require a documented seed/configuration.
- Show active defects visibly and expose their state through a protected test API.
- Scope activation and state to a test run/workspace. Keep normal users unaffected.
- Cover incorrect sorting/validation/totals, duplicate submission, stale quantity,
  invalid transitions, unresponsive controls, delays and rendering changes.
- Keep database invariants and secret protection intact; demonstrate unsafe domain
  behavior only inside disposable test data or controlled response/UI exercises.
- Publish OpenAPI for implemented endpoints and examples of 200/201/204,
  400/401/403/404/409/422/429/500/503 responses.
- Support explicit GET/POST/PUT/PATCH/DELETE scenarios and predictable error codes.

### Deterministic test-data engine

- Seed known personas, products, orders and later supplier/enquiry records.
- Provide stable logical fixture names and documented ID lookup. If numeric IDs
  must repeat, implement and verify that guarantee explicitly.
- Use testRunId/workspace ownership for disposable records, defects and resets.
- Provide factories, fixture lookup, database consistency checks and scoped reset.
- Ensure parallel runs cannot delete or mutate each other's fixtures.
- Restrict privileged reset/control APIs to development/test environments with
  explicit authorization; disable them on public production deployments.
- Make cleanup retryable and document which data is preserved.

### Events and notifications

- Commit domain changes and outbox records atomically.
- Implement idempotent subscribers, bounded retries, leases and failure visibility.
- Implement order progression and activity/notification records through a durable
  job mechanism suitable for serverless hosting, not a process-local interval.
- Add live browser updates with a documented reconnect/fallback strategy.
- Use an internal test inbox for simulated messages. No external delivery is needed.

## 6. Visual scope

- Apply the Vortex identity while retaining useful existing design references.
- Use consistent tokens, typography, spacing, focus states and accessible contrast.
- Support desktop, tablet and mobile-browser viewports, keyboard navigation, dark/
  light themes, reduced motion and meaningful error/empty/loading states.
- Map each of the 22 reference visuals to a working page, responsive variant or
  documentation asset. A mobile-shop mockup is a viewport target, not another app.
- Complete seller add/delete, profile/settings and message-center experiences as
  their backend workflows become available. Reuse flow/architecture diagrams in
  documentation where appropriate; an interactive 3D rendering engine is optional.
- A collapsible sidebar can group Overview, Marketplace, Orders, Suppliers,
  Enquiries, Forms, Tables, UI Lab, API Lab, Defect Lab and Settings. Build navigation
  around implemented destinations; never expose placeholder routes as finished.

## 7. Rewritten development milestones

Milestones continue the existing repository. Do not restart the completed baseline.
Run dependent work in order and keep the website usable at each checkpoint.

### Milestone 1 — Consolidate the existing website

Status: in progress. Branding, setup/design inventory and the scenario catalog
were accepted. Release preparation upgraded Prisma/client/adapter to 7.10.1,
resolved the audit findings, verified an isolated clean install/build and added
production boundaries and a browser outage state. Current results: 216 legacy
Playwright tests passed, 1 visual test skipped; 17 workflow/boundary/retry checks,
12 database tests, 2 pricing tests and 1 adapter test passed. PostgreSQL browser
smoke also passed. See [Release Validation](RELEASE_VALIDATION.md) for limitations,
failed checks corrected during the upgrade and remaining host verification.
The Vercel project exists in the user's personal account; publishing the reviewed
uncommitted snapshot is awaiting approval. Broader API-error consistency and
remaining product milestones are not certified complete by these release checks.

Deliver:
- Visible Vortex branding, consistent terminology and a source-based feature map.
- Documented PostgreSQL mode, legacy-mode boundaries, environment configuration
  and safe management of database/MFA/test secrets.
- Dependency advisory remediation, consistent runtime/build configuration and
  API error conventions. Preserve existing shopping/account/admin functionality.
- A page/reference inventory showing implemented, partial and missing behavior.

Exit checks: clean install/build/type checks, baseline unit/API/DB/browser checks,
documented configuration and no unexplained regressions.

### Milestone 2 — Deterministic fixtures and scoped controls

Deliver:
- Known demo personas, stable fixture lookup, 100+ table-lab records and seeded orders.
- testRunId/workspace isolation, scoped resets, factories and consistency checks.
- Read-only permissions and controlled slow-response personas.
- Safe test-control authorization and environment locks.

Exit checks: two parallel runs remain isolated; reset affects only its intended
scope; fixtures can be recreated; production reset attempts are rejected.

### Milestone 3 — Forms, tables and UI laboratory completion

Deliver:
- Inventory and reuse existing exercises; complete the confirmed gaps above.
- Scenario descriptions, observable outcomes, resets, stable selectors and hints.
- Persisted form exercises, table controls and responsive/accessibility behavior.

Exit checks: each scenario has a reproducible manual walkthrough and automated
smoke coverage; reset returns it to its documented starting state.

### Milestone 4 — API contracts and controlled defect laboratory

Deliver:
- OpenAPI, standardized validation/error contracts and documented status examples.
- Per-run defect activation, named deterministic fault profiles and visible state.
- Test-kit integration and a thin generated SDK if consumed by examples/tests.
- Runnable examples for Playwright TypeScript/Python, Selenium, Postman and Python
  requests. These are website examples, not implementations of separate tools.

Exit checks: contract tests pass; each defect is reproducible in its own scope;
normal-mode tests stay green; expected-failure exercises are clearly identified.

### Milestone 5 — Seller and supplier business journeys

Deliver:
- Seller-owned product/stock management and dedicated add/delete pages.
- Supplier profiles, enquiry/RFQ, quoting, accept/reject, simple conversations,
  attachment validation and persisted audit history.
- Relevant admin controls and participant permissions.

Exit checks: buyer-to-supplier journey works manually and through browser/API
tests; cross-user/seller access is rejected; attachment limits are tested.

### Milestone 6 — Remaining commerce and durable events

Deliver:
- Simulated 3DS and the bounded returns workflow.
- Durable order progression, outbox subscribers, activity and notification views.
- Retry/idempotency behavior, failure inspection and live-update fallback.

Exit checks: retries cannot double-apply stock/status/refund effects; simulated
payment failures roll back correctly; jobs survive process restarts.

### Milestone 7 — Design parity and usability verification

Deliver:
- Finish the mapped reference pages and Vortex visual identity.
- Responsive layout, keyboard/accessibility verification, theme/reduced-motion
  checks and polished loading/error/empty states.
- Confirm that all visible actions perform their stated operation.

Exit checks: signed-off page/reference checklist, representative screenshots at
documented viewports and passing critical browser journeys.

### Milestone 8 — CI, documentation and public website release

Deliver:
- Separate CI coverage for unit/API/contracts, isolated PostgreSQL integration
  tests and database-mode browser smoke; retain reports/traces/screenshots.
- Linting and runtime/security checks appropriate to this repository.
- Setup, architecture/module, API, test-data/reset, lab/defect, automation-example
  and validation documentation. Files may be consolidated while content remains.
- Verified Vercel configuration, database migrations, stable MFA key management,
  a clear public-demo policy and a rollback procedure.
- Isolation/disablement of privileged test controls and legacy mutable APIs on
  the public deployment. No paid service or real financial transaction is required.

Exit checks: fresh-environment setup succeeds; public configuration is verified;
critical flows pass against the deployed website; limitations and actual results
are published. Separate Vortex projects are not release dependencies.

## 8. Milestone reporting rules

Companion specifications added after review:

- [Automation Compatibility Contract](AUTOMATION_COMPATIBILITY.md): selector
  guarantees, difficulty levels, scenario identity, fixture/reset contracts and
  observable results. External recorders remain separate projects.
- [Operational Validation](OPERATIONAL_VALIDATION.md): performance evidence and
  the durable background-job proof required before finalizing Milestone 6.
- [Baseline Validation](BASELINE_VALIDATION.md): actual local checks, corrected
  mobile overflow and unresolved Milestone 1 exit criteria.

The website must distinguish Normal, Practice and Defect Lab modes as defined in
the compatibility contract. These are target requirements; the existing memory/
PostgreSQL storage switch does not implement them. Integrate difficulty labels
and scenario manifests in Milestone 3, fixture/reset contracts in Milestone 2,
contract versioning in Milestone 4 and measured performance gates in Milestone 8.
Milestone 1 requires a source inventory and actual baseline results. Passing tests
alone does not complete its branding, consolidation and dependency exit criteria.

At each milestone:

1. State what changed and which existing behavior was preserved.
2. Run appropriate checks and report actual results, including failures/skips.
3. Show evidence for acceptance criteria, not just file existence or screenshots.
4. Record incomplete work and justified deferrals.
5. Do not label an entire module complete when only one API mode or UI path works.
6. Update this plan's status without silently expanding project boundaries.

Features may be implemented incrementally within a milestone, but a milestone is
complete only when its exit checks are met. A percentage based on module counts
is not a reliable progress measure.
