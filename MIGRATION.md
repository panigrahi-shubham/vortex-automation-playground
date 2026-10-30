# Orvilo migration status

This checkout is a partial migration, not the completed target architecture.

## Implemented
- `web/` replaces `public/`, retaining the existing working SPA and test IDs.
- `src/app.js` exports Express separately from the local `server.js` listener.
- `api/index.js` and `vercel.json` provide the function entry and routing.
- All 22 source designs, screenshots, and bundled fonts are preserved in `design/`.
- Orvilo branding and shared visual tokens are applied to existing screens.
- Session and role middleware live in `src/auth/sessions.js`.
- Production rejects test controls and disables seeded bug/header injection.
- Product deletion has compensating steps and removes active cart/wishlist references.

## Still required
- Full TypeScript domain modules, repositories, and services.
- Prisma persistence and migrations; current state remains process-local memory.
- Transactional outbox, retrying dispatcher, and subscribers.
- Checkout and cancellation workflows with durable compensation.
- Scoped test resets and generated OpenAPI SDK/test kit.
- Full implementation and visual verification of all 22 designs.
- Database, contract, workflow, and deployment verification.

Do not use the Vercel configuration as evidence of production readiness. In-memory
state and interval-driven order progression are unsuitable for durable serverless
execution. No deployment has been performed.

## Local commands
- `npm ci`
- `npm start`
- `npm run typecheck`
- `npm run test:api`
- `node --test tests/workflows/*.test.js`
- `npx playwright test --project=chromium`

## Database foundation added
- Prisma 6 schema and initial PostgreSQL migration, including positive quantity
  and nonnegative stock/money constraints.
- Generated typed client, serializable transaction retry helper, atomic stock
  reservation repository, soft product deletion and idempotent cancellation.
- Transactional event enqueue and a lease-based outbox dispatcher. Subscribers
  must deduplicate by event ID; delivery is at least once.
- These TypeScript components are not yet connected to the running legacy API.
- Prisma validate, generate and TypeScript checks pass. Migration execution and
  concurrency/integration verification require a PostgreSQL database.
- Prisma CLI currently has a transitive deepmerge-ts development-tool advisory;
  resolving it requires a reviewed upgrade or compatible dependency fix.

### Database setup
Use a dedicated development database, never a production database for tests.
With Docker installed: `docker compose up -d postgres`.
Copy `.env.example` to `.env`, or set DATABASE_URL through the environment.
Then run `npm run db:generate` and `npm run db:migrate`.
The API still uses memory; these commands prepare the new persistence layer only.

## Supabase development project
Project: orvilo-dev (`rtchpqmyutyaoddoledo`), Mumbai (ap-south-1).
Dashboard: https://supabase.com/dashboard/project/rtchpqmyutyaoddoledo
Initial schema applied through Supabase migration `orvilo_initial`.
Eight application tables live in private schema `orvilo`, with RLS enabled and
schema/table access revoked from anon and authenticated roles.
The running API is still memory-backed. Direct Prisma connection credentials
have not been configured. Before using Prisma migrate deploy on this existing
project, baseline the initial migration with:
`npx prisma migrate resolve --applied 202610280001_initial`
Do not reapply the initial CREATE TABLE statements to this project.

## Connection verified — 29 October 2026
Supabase session-pooler connection now succeeds through the ignored local .env.
`npm run db:check` verified access to all eight tables and transaction rollback.
Prisma initial migration 202610280001_initial has been baselined as applied.
The HTTP API still uses the legacy memory store; database connectivity alone
has not migrated application behavior.

## Database catalog API — 29 October 2026
- `/api/v2/products` and `/api/v2/products/:id` now read Supabase via Prisma.
- List supports search, category, sort, pagination and a consistent snapshot for
  the count and page. Deleted products are excluded and prices are JSON numbers.
- `npm run db:seed:catalog` seeds by SKU without overwriting stock or user edits.
- `npm run test:db` exercises the real database and HTTP routes using temporary
  uniquely named products, then deletes only its own fixtures.
- `npm start` and `npm run dev` compile TypeScript before starting the server.
- The v2 API is staged: it does not yet support rating/price-range filters,
  reviews, cart, authentication or checkout. Existing `/api` routes and the
  storefront remain memory-backed until those modules are migrated together.

## Persistent v2 authentication — 29 October 2026
- Added POST /api/v2/register, POST /api/v2/login, GET /api/v2/me and
  POST /api/v2/logout, backed by Prisma User and Session records.
- Salted scrypt password hashes and SHA-256 session-token hashes are stored;
  plaintext passwords and bearer tokens are not stored in database records.
- Registration cannot assign roles. Session checks reject locked accounts,
  expired sessions and revoked tokens. Login accepts username or email.
- Real database integration tests verify registration validation, duplicate
  rejection, secret hashing, role assignment, login, logout, expiry and locking.
- This remains a development API: persistent MFA, password recovery, shared
  login throttling and remaining profile fields are not yet implemented.
  The storefront still uses the legacy auth routes until feature parity.

## Persistent v2 cart — 29 October 2026
- GET/POST/DELETE /api/v2/cart and PATCH/DELETE /api/v2/cart/:lineId
  now operate on Supabase Cart and CartLine tables.
- All operations require a persistent session and scope access to its user.
- Serializable transactions and per-user row locking protect concurrent adds;
  product prices and stock come from the database, never the client.
- Quantities are integers 1-99; stock is checked on add/update but not reserved.
  Read responses flag lines unavailable after stock changes or soft deletion.
- Decimal arithmetic produces subtotal and line totals without float drift.
- Real database tests verify concurrent increments, exact totals, ownership,
  stock conflicts, persistence, deletion and authentication requirements.
- V2 does not yet implement product variants, coupons, shipping/tax totals or
  checkout. Nonempty variants are explicitly rejected. The legacy storefront
  remains on its existing cart until parity is achieved.

## Persistent checkout and orders — 29 October 2026
- POST /api/v2/checkout requires an Idempotency-Key (8-100 alphanumeric,
  underscore or hyphen characters), address fields name/line1/city/postalCode/
  country, acceptTerms=true and testPayment=approved|declined.
- This is a payment simulator. No funds are charged and paymentLast4=TEST is a
  marker, not a card number. Totals are product subtotals only for this stage.
- Atomic serializable transactions reserve stock, snapshot order lines, clear
  the cart and append order.placed to the outbox. Failures roll everything back.
- Reusing the same key returns the original order; use a new key for a new order.
- GET /api/v2/orders (25 per page), GET /api/v2/orders/:id and
  POST /api/v2/orders/:id/cancel enforce persistent session ownership.
- Cancellation of Placed/Processing orders restores inventory and appends one
  outbox event. Repeat cancellation returns the already cancelled order.
- Real database tests cover decline, partial-stock rollback, simultaneous
  duplicate checkouts, ownership and simultaneous cancellation.
- Full address/payment validation, coupons, tax/shipping pricing, 3DS, event
  subscribers, notifications and storefront cutover remain outstanding.

## Coupons, shipping and tax — 29 October 2026
- Added POST/DELETE /api/v2/cart/coupon and PUT /api/v2/cart/shipping.
- One decimal-based pricing module drives both cart quotes and checkout using
  the existing demo rules: SAVE10, FLAT50 ($200 minimum), FREESHIP, expired
  EXPIRED20, standard/express/nextday shipping and 8% demo tax.
- Free standard shipping uses the discounted subtotal; invalidated minimum-spend
  coupons show a cart error and block checkout until removed or made eligible.
- Order.pricing stores the purchase-time breakdown. Earlier subtotal-only orders
  retain null pricing; their historical totals are not rewritten.
- Migration 202610290001_order_pricing applied to the Supabase development DB.
- Checkout clears the coupon and restores standard shipping after ordering.
- Pricing boundary tests and the real database coupon/express checkout pass.
- These rules are for the test store, not a jurisdiction-specific tax engine.
  Variants, reviews, wishlist, full address validation, 3DS, event subscribers,
  auth parity, all design screens and storefront cutover remain outstanding.

## Storefront cutover to v2 — 29 October 2026
The existing SPA in `web/` now runs against the database-backed v2 API when a
database is configured. There is no second storefront and no duplicated views:
the views call the same `api()` helper they always did.

### Runtime switch
- `DATABASE_URL` set and `SHOPLAB_STORAGE` unset (or not `legacy`) → postgres
  mode. `/api/v2` routes mount and the SPA talks to them through
  `web/js/api-v2.js`.
- `SHOPLAB_STORAGE=legacy` forces memory mode even when `DATABASE_URL` exists.
  With `DATABASE_URL` unset the server is memory mode regardless.
- `GET /api/config` reports `{ storage: 'postgres' | 'memory' }`. The SPA fetches
  it once at boot (`loadRuntime()` in `web/js/core.js`) before the first route
  renders; `isDatabaseMode()` gates every capability difference.
- The legacy `/api` router is always mounted, so untranslated endpoints still
  answer in memory mode exactly as before.

### How the cutover works
- `api()` in `web/js/core.js` forwards to `requestV2()` in
  `web/js/api-v2.js` when storage is postgres, otherwise to the original
  `/api` fetch. `V2HttpError` is mapped to `ApiError`, so views keep their
  existing error handling (401 → sign-in redirect, `fields` → inline errors).
- `requestV2()` maps paths and normalizes responses (cart, order, user, product
  shapes) so views needed no data-shape changes. Checkout sends a generated
  `Idempotency-Key`, maps `fullName`/`zip` to `name`/`postalCode`, and always
  sends `testPayment: 'approved'` after the client-side test-card checks.
- Store metadata (`/meta`: countries, shipping options, categories) is served
  by the shared memory module in both modes because it is demo configuration.

### Supported in postgres mode
Register, sign in/out, session restore, shop list/search, category and price
filters, in-stock filter, sorting, pagination, deal-of-the-day, product detail,
cart add/update/remove/clear, coupons, shipping method, checkout wizard
(address → delivery → payment → review), order confirmation, order list with
status filter, order detail, cancel, buy again and CSV invoice download.

### Deliberately unavailable in postgres mode
These are hidden or replaced with an explanatory notice rather than failing:
reviews and ratings (schema absent), wishlist and "save for later", variants,
3-D Secure (hidden test card row; adapter returns 402 if used), forgot/reset
password, MFA verify, profile/password/avatar editing, admin console, test
inbox, chaos panel, SSE live order updates and seeded bug mode. Order
progression is server-managed; the SPA no longer listens for live status events.

### Backend additions made for the cutover
- `GET /api/config` storage probe.
- `GET /api/v2/categories` (with counts), `GET /api/v2/deal`,
  `minPrice`/`maxPrice`/`inStock` product filters.
- Optional `line2`/`state`/`phone` checkout address fields.
- `GET /api/v2/orders/:id/invoice` returning a CSV attachment.

### Running and verifying
- Postgres mode: keep `DATABASE_URL` in `.env`, run `npm start`, then register a
  user in the UI (the catalog seed creates products only, no accounts). Seed
  products with `npm run db:seed:catalog`.
- Memory mode: `SHOPLAB_STORAGE=legacy npm start` (or remove `DATABASE_URL`).
- The reference Playwright suite is pinned to memory mode by the
  `SHOPLAB_STORAGE=legacy` env on `webServer` in `playwright.config.ts`, so the
  214-test suite keeps testing the documented legacy contracts. Stop any
  postgres-mode server first: outside CI Playwright reuses an existing server on
  port 3000 (and that server would be in the wrong storage mode). Pointing the
  suite at postgres mode is a separate future task.
- Database-mode smoke coverage: `npm run smoke:storefront:db` drives register →
  shop → product → cart → coupon → shipping → checkout → order detail → invoice
  → cancel against a running postgres-mode server, then deletes its disposable
  account and order.

## Reviewed storefront cutover and wishlist — 29 October 2026
The newly supplied storefront adapter and storage-mode routing have been reviewed.
Database connectivity, build, typecheck and the full browser smoke journey pass.
Corrected checkout retries to retain the same idempotency key after a lost response;
the UI now passes actual terms consent. Smoke cleanup cancels orders before deleting
fixtures and removes their outbox events, preventing stock leaks on failed runs.
The smoke test now waits for real product cards instead of the empty loading grid.

Persistent wishlist is now supported in database mode: GET/POST /api/v2/wishlist
and DELETE /api/v2/wishlist/:productId. WishlistEntry migration applied with RLS,
private schema access and a foreign-key index. Repeated adds are idempotent; reads
exclude soft-deleted products; deletion is scoped to the signed-in account.
Wishlist hearts, header/menu links, save-for-later and the wishlist page are enabled
in database mode. The browser test verifies persistence across reloads and removal;
database tests check duplicate adds, validation, authentication and user isolation.

This supersedes earlier entries describing the storefront as fully memory-backed
or the database wishlist as unavailable. The default storefront now uses PostgreSQL
when configured, with SHOPLAB_STORAGE=legacy retained for legacy regression tests.
Remaining unsupported capabilities include reviews/ratings, variants, MFA/recovery,
profile editing, admin/seller features, 3DS and durable event processing. All 22
reference designs still need full implementation and visual verification.

## Persistent reviews and ratings — 29 October 2026
- Added Review with per-user/product uniqueness, foreign keys, database rating
  and text-length constraints, RLS and revoked public access.
- GET /api/v2/products/:id/reviews supports pages of 50; authenticated POST
  validates and persists reviews. Only username is returned, not internal user ID.
- Database triggers recompute product average/count on insert/update/delete,
  including account cascades and maintenance moves between products.
- Product, catalog, deal and wishlist APIs expose numeric rating/reviewCount;
  catalog supports minimum rating and stable rating sorting.
- Product review tab/form, stars, rating filter/sort and load-more reviews are
  enabled in database mode. HTML content remains escaped by the existing views.
- Transaction retries now recognize raw-query SQLSTATE serialization/deadlock
  failures. Bounded connection/transaction waits accommodate remote DB latency.
- Browser smoke covers review posting and reload persistence; database tests
  cover concurrent duplicates, validation, average/count, account deletion and
  removed-product access. Security advisors show informational no-policy notices
  for private, backend-only tables; no public policies have been granted.
- Remaining: product variants, MFA/recovery/throttling, profile settings, seller/
  admin capabilities, 3DS, outbox subscribers, SDK/test kit, full design parity
  and deployment.

## Product variants — 29 October 2026
- Product.variants stores allowed size/color values; migration 202610290005
  applied. The seed fills missing options on known seeded fashion SKUs without
  resetting inventory, pricing or existing option edits.
- Cart add requires valid options for configurable products and rejects options
  for simple products. Canonical selection keys merge identical choices and
  keep different choices in separate lines.
- Product-level stock is shared across variants, matching the original app.
  Combined cart quantities are checked on add/update/read. Checkout revalidates
  options and atomically decrements stock across all selected lines.
- Selected options remain in immutable order-line snapshots and are decoded by
  the storefront for cart, confirmation, order detail and buy-again requests.
- CSV invoices display size/color and escape quotes/formula-prefixed names.
- Database tests verify canonical merges, option validation, shared stock limits,
  removed-option rollback, checkout snapshots, invoice escaping and cancellation.
- Full storefront smoke passes size/color selection through checkout and invoice.
  Six database tests, 71 legacy API tests, adapter test and TypeScript checks pass.
- Remaining: auth MFA/recovery/throttling, profile/settings, admin/seller screens,
  3DS, durable event subscribers/progression, SDK/test kit, full design parity,
  dependency advisory cleanup and deployment.

## Persistent profile, password and settings — 29 October 2026
- Added phone and settings columns on User (migration 202610290006 applied).
- PUT /api/v2/me validates name/email/phone and updates only allowed profile
  fields. Email changes require the current password; duplicate emails return
  409. Username, role and account-lock state cannot be changed through this API.
- PUT /api/v2/me/password verifies the current password in a transaction, stores
  a new salted hash and revokes all other sessions. The current session remains.
- Login rechecks the password hash while issuing the session under a user row
  lock, preventing a stale password verification from issuing a post-change
  session. Session creation and password changes use the same transaction rules.
- GET/PUT /api/v2/me/settings persist order/marketing email preferences, theme
  and reduced motion. Delivery is not yet enabled, as stated in the UI.
- Profile/security tabs now work in PostgreSQL mode. /settings and the Settings
  account tab save preferences; appearance applies immediately and after reload.
- Browser smoke passes profile editing, persisted appearance and password change.
  Seven database tests and TypeScript checks pass. Avatar upload, MFA/recovery,
  shared login throttling, broader settings/design parity and notifications remain.

## Shared login throttling and development recovery — 29 October 2026
- RateLimit, RecoveryChallenge and TestMail migration 202610290007 applied.
  Tables remain private with RLS and no anonymous/authenticated grants.
- Login allows eight attempts per ten-minute account window, combining username
  and email aliases for existing users. Counters are shared in PostgreSQL and
  return 429/Retry-After. Successful login clears that account's counter.
- Development recovery requires ORVILO_TEST_KEY. POST /api/v2/password/forgot
  returns the same response for existing/missing accounts and limits requests.
- Six-digit codes expire after ten minutes, are hashed in RecoveryChallenge,
  allow five failed guesses and can only be consumed once. A new request replaces
  old codes. Successful reset changes the salted password hash and revokes all
  sessions. Profile email/password changes invalidate outstanding challenges.
- Plaintext codes exist only in the protected development TestMail sink. GET
  /api/v2/test/mailbox requires X-Orvilo-Test-Key plus a recipient. No inbox or
  recovery delivery is available in production; a real delivery provider remains
  required. Do not use this development sink as a production mail system.
- Local key generated into ignored .env, never returned in API config or bundled
  into frontend assets. Read codes with npm run test:inbox -- user@example.test.
- /api/config reports recovery availability. The storefront enables the reset
  form when configured and clears stale authentication after a successful reset.
- New database coverage verifies rate limits, unknown-recipient response parity,
  code expiration/attempt caps, concurrent single-use resets, session revocation
  and production protection. MFA and real delivery remain outstanding.
- Full browser recovery/shopping/account smoke passes without browser errors.
  All eight database tests, 71 legacy API tests and TypeScript checks pass.
- Supabase advisors report only informational missing-policy notices on the
  private backend tables; public grants remain revoked.

## Authenticator MFA — 29 October 2026
- Added MfaCredential, MfaLogin and MfaBackupCode (migration 202610290008).
- Authenticator TOTP uses pinned otplib 13.4.0. Enrollment exposes a manual setup
  key/otpauth URI once and requires password plus a valid code before activation.
- Secrets are encrypted with AES-256-GCM and user-bound AAD. ORVILO_MFA_KEY is a
  stable 32-byte base64 key in ignored .env; preserve it securely for deployment.
  It must never be bundled into frontend assets or casually regenerated.
- Activation issues eight random one-use backup codes; only their hashes persist.
- Password login returns a hashed, five-minute challenge for enrolled users and
  does not create a session. /api/v2/login/mfa validates a TOTP or backup code,
  enforces persisted attempt/rate limits and atomically consumes the challenge.
- A consumed TOTP time step cannot be reused, even with another login challenge.
  Password changes/resets invalidate pending challenges while retaining MFA.
- Enabling/disabling MFA revokes other sessions. Disabling requires current
  password plus authenticator or backup code; it deletes credentials/backups.
- Account security and verification pages support enrollment, code verification,
  one-time backup display, backup sign-in and disabling. No email provider is
  needed for authenticator MFA. QR rendering is not included; use manual setup.
- All nine database tests, 71 legacy API tests, adapter test, TypeScript checks
  and the full shopping/account/recovery/MFA browser smoke pass.
- Remaining: avatar storage, admin/seller features, 3DS, durable event subscribers,
  real recovery delivery, SDK/test kit, full design parity, dependency cleanup
  and deployment configuration.

## Persistent avatars — 29 October 2026
- User.avatar and private Avatar byte storage added in migration 202610290009.
  The normalized thumbnail is stored in PostgreSQL; original uploads are discarded.
- POST /api/v2/me/avatar requires a persistent session and accepts raw PNG/JPEG/
  GIF/WebP bytes up to 1 MiB. It checks actual decoded format, caps inputs at
  16 megapixels, strips metadata and generates a WebP thumbnail up to 256x256.
  Animated uploads use the first frame. SVG and malformed/type-mismatched files
  are rejected. Uploads are throttled per account.
- Replacement atomically rotates the opaque public photo URL and deletes old
  bytes; DELETE clears both data and profile URL. GET serves only WebP with
  nosniff/no-store headers, so removed or replaced URLs return 404.
- Profile-photo tab, file selection, drag/drop, reload persistence, header and
  account photo updates and removal are enabled in database mode.
- Native image processing uses pinned sharp 0.35.5; runtime requirement is now
  Node >=20.9. Existing Prisma development-tool dependency advisories remain.
- Database tests verify authentication, ownership isolation, spoofed/oversized/
  excessive-dimension uploads, normalized format, metadata removal, replacement
  and deletion. Browser smoke verifies photo persistence and removal.
- Remaining: admin/seller capabilities, 3DS, durable event subscribers/progression,
  real recovery email delivery, SDK/test kit, full design parity, dependency
  advisory cleanup and deployment.
- Verification complete: all ten database tests, 71 API tests, adapter test,
  TypeScript checks and full shopping/account/recovery/MFA/avatar browser smoke
  pass. One initial API run hit test-server startup timeout; starting the server
  separately and rerunning the suite passed. Supabase security advisors show
  informational no-policy notices for private tables only.

## Database-backed admin console — 29 October 2026
- Added /api/v2/admin/stats, products CRUD, orders list/status updates and
  users list/locking. Every endpoint requires a live admin session; mutations
  recheck admin role, lock status and session validity inside their transaction.
- Product fields are validated and allowlisted; stock and two-decimal prices
  are checked. Delete is soft and transactionally removes cart/wishlist entries
  while retaining immutable historical order lines and appending an event.
- Orders advance Placed -> Processing -> Shipped -> Delivered one stage at a
  time. Terminal orders cannot reopen. Cancellation uses the shared workflow,
  restores stock once and emits one cancellation event. UI reverts rejected
  status changes instead of displaying an uncommitted status.
- Locking a customer revokes sessions and MFA login challenges. Admin accounts
  cannot be locked/edited through this endpoint. Role assignment is deliberately
  absent from public registration/profile/user-lock APIs.
- Local operator bootstrap: npm run admin:grant -- existing_username. This
  development-only helper requires database credentials, grants the admin role,
  revokes sessions and appends a role-change event. No real account was promoted
  automatically; browser tests promote and delete only their temporary fixture.
- Enabled admin navigation, dashboard, product editor, orders and user tables
  in the database-mode storefront. Existing memory-mode admin remains supported.
- All twelve database tests and browser shopping/account/MFA/avatar/admin-product
  smoke pass. Remaining: seller ownership/permissions and dedicated seller pages,
  richer product option editing, pagination for large admin lists, 3DS, event
  subscribers/progression, email delivery, SDK/test kit, design parity and deploy.
