# Vortex web/API specification review

Reviewed 29 October 2026 against the source in this checkout. This is a source
assessment, not a new test execution or a claim that every requirement passes.
The submitted attachment is unchanged. VORTEX_WEB_SPEC.md is its mobile-free copy.

## Recommendation

Continue the existing application. Brand the visible product as Vortex Automation
Playground, keep its working Express/Prisma/Supabase foundation, and prioritize
repeatable automation scenarios over a framework rewrite or additional businesses.
The source attachment's FIRST TASK describes a greenfield project; it should not
restart this repository or replace its database.

## Already implemented

- Persistent customer registration, login/logout, remember-me sessions, expiration,
  salted password hashing, account locking and database-backed login throttling.
- Authenticator MFA with encrypted secrets, replay protection and backup codes.
  Development recovery uses expiring, limited-attempt, single-use codes behind a
  protected test inbox. Real email/SMS is neither configured nor needed by this spec.
- Profile, password changes, theme/reduced-motion preferences and validated avatar
  uploads, replacement and removal. Broader reference Settings controls remain open.
- Marketplace catalog/search/categories/price and stock filters, sorting and paging,
  product details, reviews/ratings, variants, wishlist, persistent cart, coupons,
  shipping, demo tax, simulated checkout, orders, cancellation and CSV invoices.
- Transactional stock checks, duplicate-checkout protection, saved order/pricing
  snapshots and cancellation that restores stock once. Returns are not implemented.
- Database-backed admin dashboard counts/revenue, product create/edit/soft delete,
  stock updates, staged order status changes, customer locking and role enforcement.
  Seller ownership, self-service seller tools and a read-only role are missing.
- An existing UI lab: dialogs, popups/new tabs, nested frames, open/closed shadow
  roots, drag/drop, hover/context menus, input types, contenteditable, dynamic waits,
  infinite scrolling, uploads/downloads, keyboard/clipboard, geolocation, clock,
  changing IDs, tables and accessibility/visual targets. Do not rebuild these first.
- Stable test IDs in many views; loading/empty/error states; responsive CSS; light
  and dark themes. These do not establish full 22-screen visual parity or all device
  and accessibility requirements.
- Playwright TypeScript API/UI suites, real database tests and browser smoke scripts,
  TypeScript checks, migrations, and a GitHub Actions Playwright workflow.
- No required AI service, real payment processing, SMS or email delivery.

## Partially implemented or not equivalent to the specification

- The frontend is modular vanilla JavaScript, not React/TypeScript/Vite/Tailwind/
  shadcn/React Router/TanStack Query. Backend TypeScript modules coexist with legacy
  JavaScript. A React error-boundary requirement does not apply to the current SPA;
  equivalent route/API error recovery does.
- PostgreSQL in Supabase with Prisma is established; SQLite is not the current DB.
- The legacy memory store has deterministic product IDs and demo users (standard,
  locked, slow, problem, MFA and admin). PostgreSQL seeds catalog products by SKU,
  not the full requested set of known users/orders. Read-only is absent. Legacy
  test-only credentials use plaintext; persistent accounts use password hashes.
- Catalog seed has 40 products, not 100+. Stable SKUs are not the same as guaranteed
  repeatable PostgreSQL numeric IDs. Browser fixtures use unique disposable accounts.
- Tables have sorting/search/paging and some exports, but full server-side admin
  pagination, column visibility, selection, bulk actions and inline editing are open.
- Forms and checkout cover many requested controls and validations; not every lab
  form has refresh persistence, a scoped reset or a published deterministic contract.
- Eight documented seeded defects and chaos controls exist in legacy mode. They
  are not a per-defect, per-run engine for PostgreSQL. Global toggles, problem_user
  activation and random delays/failure probabilities need explicit isolation and
  deterministic profiles to satisfy the new specification.
- The UI/API labs and documentation page exist, but there is no generated OpenAPI
  contract, generated SDK or packages/test-kit. Errors are not fully standardized.
- Outbox records and a dispatcher exist; subscribers, durable notification delivery,
  activity feed and automatic/live order progression are not wired.
- GitHub Actions exists, but the complete PostgreSQL suite and database-mode browser
  smoke are not integrated as isolated CI jobs. A separate runner/fixture strategy
  and secret handling are needed. No ESLint configuration was found.
- Existing automation code focuses on Playwright TypeScript. Python, Selenium,
  Postman and requests examples/compatibility validation remain to be supplied.
- The 3-D Secure exercise exists in legacy mode but is unsupported in v2.
- Design references are preserved; the running pages do not fully reproduce all
  references. Dedicated supplier/enquiry/message/quote and visual flow pages are
  not implemented as working business modules.

## Feasible and worth prioritizing

1. Publish a single supported database-backed API contract and error schema.
2. Build seeded users, products, orders and scoped reset by testRunId; provide
   stable logical fixture identities and isolated parallel execution.
3. Add deterministic defect IDs, reproducible fault profiles, visible activation
   indicators, expected/faulty results, reproduction steps and per-run reset.
4. Inventory each existing lab exercise; add missing scenarios such as virtualization,
   repeatable fields, multiselect and duplicate-label ambiguity where absent. Give
   each exercise a local reset, observable result and versioned behavior contract.
5. Add a focused forms/table suite: boundaries, dependent controls, cross-field
   validation, persisted submissions, server pagination and permission scenarios.
6. Validate recorder output: record -> generate test -> replay -> compare expected
   result. Version the scenarios and selector strategies. Distinguish robust waits
   from speed and repeat tests under controlled latency to measure reliability.
7. Add one runnable example per supported external automation tool, with the same
   fixture/scenario contract. The playground itself must not depend on these tools.
8. Integrate DB integration and browser smoke suites into CI, retain traces/reports,
   document setup, limitations, known bugs, reset safety and benchmark results.

## Optional or unnecessarily expensive now

- React/Vite/Tailwind/shadcn/TanStack migration: feasible, but substantial UI rework
  with little new testing coverage by itself. Do it only for a concrete recorder
  compatibility requirement. A small React lab fixture can test rerender behavior
  without rewriting the whole app.
- SQLite replacement: unnecessary after building Supabase persistence, concurrency
  tests and migrations. PostgreSQL better preserves the existing concurrency work.
  Offline local setup can be a separate packaging decision, not a DB rewrite.
- Full B2B marketplace: feasible but adds suppliers, leads, RFQs, attachments, quotes,
  conversations, permissions and audit history. Add one buyer-to-supplier quotation
  journey later if multi-role recorder coverage needs it; do not build every feature
  before the deterministic test engine.
- Dashboard charts, notifications, date analytics and a premium sidebar redesign:
  useful for selected test scenarios, not prerequisites for a QA portfolio. Existing
  counts already use real data. Avoid cosmetic widgets that do not add coverage.
- Full returns/refund management: defer unless order-state testing needs it. A small
  simulated return request and status transition is sufficient initially.
- Real payments, email/SMS providers, AI services and production business operations:
  unnecessary for the submitted brief. Keep the simulation and protected inbox.
- A generated SDK is optional for recorder benchmarking. An accurate OpenAPI file,
  fixtures and simple clients matter first. Keep the SDK if repository architecture
  or downstream clients genuinely use it.
- Nine separate documentation files are optional packaging. Their content matters;
  consolidate initially into setup, API, test data, labs/defects and validation docs.
- Internal renaming of DB schema, environment variables, API paths and encryption
  keys adds no testing value. Visible Vortex branding can change independently.

## Revised milestones for this existing repository

1. Consolidate: visible branding, supported API/mode documentation, stable configuration,
   dependency cleanup and a baseline inventory. Preserve existing working features.
2. Reproducibility: database fixtures, read-only/demo roles, test-run isolation, scoped
   reset, OpenAPI and deterministic defect profiles.
3. Recorder lab: complete/reset existing exercises, targeted forms/table gaps, replay
   benchmarks and cross-tool examples.
4. Coverage extensions: selected returns, simulated 3DS and one seller/supplier
   quotation journey when justified by test coverage.
5. Verification/release: database/browser CI, responsive/accessibility checks, evidence
   reports and a deliberately configured public demo deployment.

No percentage-complete estimate is assigned: the specification mixes small lab
exercises with large new business domains, so module counts would be misleading.
