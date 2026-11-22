# VORTEX setup and configuration

This guide describes the current checkout, not the early memory-only migration notes. The primary application is Express + Prisma/PostgreSQL with the existing modular vanilla-JavaScript SPA. The legacy in-memory API remains for compatibility testing.

See the [master plan](VORTEX_AUTOMATION_PLAYGROUND_MASTER_PLAN.md), [page/design inventory](PAGE_DESIGN_INVENTORY.md) and [dated baseline report](BASELINE_VALIDATION.md) for scope and verification status.

## 1. Requirements

- Node.js **24.x** and npm, as declared in `package.json`.
- A dedicated development PostgreSQL database. The checked-in Prisma configuration targets the private `orvilo` schema and the `.env.example` placeholders follow Supabase pooler conventions.
- Chromium for Playwright or the database browser smoke test:

```bash
npm ci
npx playwright install chromium
```

`npm ci` installs the locked dependency tree and replaces `node_modules`; it does not migrate or seed a database. Do not run browser/database tests against production or a shared public demo.

## 2. Configure a development environment

Copy the template, then edit the new ignored file locally:

```bash
cp .env.example .env
```

Never commit `.env` or paste real connection strings into documentation, screenshots, issue reports or frontend source.

### `DATABASE_URL` — runtime

The Prisma 7 PostgreSQL adapter uses `DATABASE_URL` for the running application.
For the Supabase arrangement in `.env.example`, this is the **transaction pooler**
connection, normally port `6543`, with `sslmode=require` and `schema=orvilo`.
The shared client factory supplies the private schema, bounded connection pool
and Supabase CA certificate with certificate/hostname verification enabled.
The older `pgbouncer=true` URL parameter is accepted but not forwarded to `pg`.

### `DIRECT_URL` — Prisma migrations

`prisma.config.ts` uses `DIRECT_URL` for CLI migration operations, falling back to
`DATABASE_URL` if absent. The schema no longer contains Prisma 6's `directUrl`.
The template uses the **session pooler** on port `5432` (or a direct database
connection) with `sslmode=require` and `schema=orvilo`. Copy the exact host and
username from the provider; do not assume the two hosts are interchangeable.

Both templates contain `URL_ENCODED_PASSWORD`, not a credential. Percent-encode reserved password characters before placing them in a URL—for example `@` as `%40`, `:` as `%3A`, `/` as `%2F`, `#` as `%23` and `?` as `%3F`. Keep the `orvilo` schema name unchanged.

### `ORVILO_MFA_KEY` — stable authenticator encryption key

This is a **32-byte, base64-encoded** key used to encrypt authenticator secrets. Provision it with an approved local secret generator or secret manager. Keep the same value across restarts and deployments that must read existing MFA credentials; losing or casually rotating it can make stored secrets unusable. Never bundle it into `web/`, expose it through `/api/config`, or store it in Git. It is not a user's authenticator setup key.

### `ORVILO_TEST_KEY` — development-only recovery/test inbox

Set a private development value only when protected recovery codes or `GET /api/v2/test/mailbox` are needed. It enables the development TestMail sink and the `X-Orvilo-Test-Key` check; it is not a production mail provider. Leave it unset in production. Do not expose the key in browser code or use the sink as a public inbox.

## 3. Prepare PostgreSQL

Run these only against the intended development database:

```bash
npm run db:validate
npm run db:generate
npm run db:migrate
npm run db:seed:catalog
npm run db:check
```

| Command | Effect |
|---|---|
| `npm run db:validate` | Validates the Prisma schema; does not apply migrations. |
| `npm run db:generate` | Generates the Prisma client into the installed dependencies; does not seed data. |
| `npm run db:migrate` | Runs `prisma migrate deploy` and **applies pending versioned migrations** to the configured database. |
| `npm run db:seed:catalog` | **Writes catalog products**, using SKU as seed identity. Existing product edits/stock are preserved and missing options on known seeded variants are filled. It creates no user accounts. |
| `npm run db:check` | Connects to the configured database, reads application-table counts and creates an outbox marker inside a transaction that is deliberately rolled back. It reports safe error codes rather than connection strings. |

Migrations and seeds were documented from current source for this task; they were not executed as part of the documentation update.

## 4. Start the application

```bash
npm start
```

`prestart` runs `npm run build`, compiling TypeScript from `src/` to `dist/`, and `server.js` listens on `PORT` or `3000`. Open `http://localhost:3000/shop`. Register a new user through the UI; catalog seeding does not create demo personas.

For watch-mode development:

```bash
npm run dev
```

`predev` also builds first. To use a different port, set `PORT` in the environment.

### Storage selection

- With `DATABASE_URL` set and `SHOPLAB_STORAGE` unset or any value other than `legacy`, the server mounts `/api/v2` and the SPA uses PostgreSQL.
- With `SHOPLAB_STORAGE=legacy`, the SPA uses the in-memory `/api` API even when `DATABASE_URL` exists.
- With `DATABASE_URL` unset, storage is memory regardless.
- `GET /api/config` reports `storage` and development recovery availability. The SPA checks it once at boot.

The legacy router remains mounted in the server, but PostgreSQL storefront calls are deliberately adapted to `/api/v2`; storage selection is not a fallback mechanism for failed database operations.

## 5. Legacy reference mode

Start an isolated local memory server with:

```bash
SHOPLAB_STORAGE=legacy npm start
```

On Windows PowerShell, set the environment variable using PowerShell syntax before running `npm start`. Removing `DATABASE_URL` also selects memory mode, but the explicit flag is safer when a development `.env` is present.

Legacy mode supplies the seeded demo users, global reset/chaos controls, email OTP/test inbox, simulated 3-D Secure, seeded defects and SSE order updates. `POST /api/reset` restores the shared in-memory seed and signs out users; never invoke it on a shared/public instance. These legacy capabilities are not evidence of equivalent PostgreSQL behavior.

Normal / Practice / Defect Lab are target concepts in the compatibility plan. They are separate from `postgres` and `memory` storage and do not currently have a runtime mode selector or scoped reset API.

## 6. Verification and test commands

### Local/static and legacy checks

| Command | Purpose and side effects |
|---|---|
| `npm run build` | Compiles backend TypeScript to ignored `dist/` output. |
| `npm run typecheck` | Type-checks without being a browser or database test. |
| `npm run test:workflows` | Runs the non-database `tests/workflows/*.test.js` workflow tests. |
| `npm run test:pricing` | Builds, then runs the pricing boundary tests. |
| `npm run test:storefront-adapter` | Runs the storefront API-adapter test without certifying visual parity. |
| `npm test` | Runs all configured Playwright projects. Local `webServer` startup is pinned to `SHOPLAB_STORAGE=legacy`; global setup resets the legacy server. |
| `npm run test:api` | Runs only the legacy API Playwright project. |
| `npx playwright test --project=chromium --project=mobile` | Runs desktop and mobile browser projects in legacy mode. |
| `npm run test:bugs` | Runs seeded-defect exercises marked as expected failures; this does not fix the defects. |
| `npm run report` | Opens the most recent Playwright HTML report. |

Playwright reuses an existing local server outside CI. Stop a port-3000 PostgreSQL server before a legacy run so the suite cannot reuse the wrong storage mode. `BASE_URL` disables Playwright-managed startup; because global setup performs reset operations, do not point this suite at a shared/public deployment. `VISUAL=1` enables the otherwise skipped visual snapshot exercise.

### Development-database checks

| Command | Purpose and side effects |
|---|---|
| `npm run test:db` | Builds and runs `database-*.test.cjs` against the real configured database. Tests create uniquely named disposable fixtures and clean up their own records; use a dedicated development database. |
| `npm run smoke:storefront:db` | Requires an already running PostgreSQL-mode server. Creates a disposable browser user and order journey, then cancels/deletes its fixtures. It is not isolated from other activity on a shared database. |
| `npm run test:inbox -- user@example.test` | Reads protected development recovery mail for a recipient from `BASE_URL` or `localhost:3000`; requires `ORVILO_TEST_KEY`. |
| `HEADED=1 npm run smoke:storefront:db` | Runs the same database smoke journey with a visible browser. |

Legacy Playwright success and PostgreSQL integration/browser smoke are separate evidence. Neither establishes design parity or production readiness.

## UI Lab widget exercises

Open the routes below while the storefront runs locally. The default Playwright run starts the practice frame server automatically. When starting the storefront manually, run `npm run vortex:frame` in another terminal for the cross-origin card. Port 3101 is a separate origin, so the parent can receive a message with `postMessage` and cannot read the frame DOM directly.

- [Date range picker](http://localhost:3000/lab/date-picker). Choose a start and end date across months. The fixture opens in November 2026.
- [Modal overlay](http://localhost:3000/lab/modal). Cycle focus inside the dialog and dismiss it with Escape or the backdrop. It uses the browser’s modal dialog semantics.
- [Tabs](http://localhost:3000/lab/tabs). Switch panels with arrow keys. The tab state resets when you reopen the card.
- [Accordion](http://localhost:3000/lab/accordion). Open two answers in turn. Only one answer can stay expanded.
- [Multi-step form](http://localhost:3000/lab/stepper). Enter a recipient and select delivery, then move between steps. The form keeps values until reset and never creates an order.
- [Custom slider](http://localhost:3000/lab/slider). Drag to a value or use arrow keys. Pointer results depend on the position relative to the track.
- [Sortable list](http://localhost:3000/lab/sortable). Reorder three tasks using a drag or arrow keys. The exercise only updates the displayed list.
- [Editable table](http://localhost:3000/lab/editable-table). Edit a quantity, select rows, and archive them. The table uses disposable browser data.
- [Virtualized list](http://localhost:3000/lab/virtual-list). Scroll through 500 logical rows and verify the DOM contains only visible rows. The demo uses fixed row heights.
- [Auto dismiss toast](http://localhost:3000/lab/toasts). Wait for the toast to disappear after three seconds. Use an assertion that waits for hidden state.
- [Split OTP fields](http://localhost:3000/lab/otp). Enter the practice code 246810. This exercise does not authenticate or send a message.
- [Cookies and local storage](http://localhost:3000/lab/storage). Set both the member cookie and local preference, then reload. Reset clears both values for this card.
- [Cross-origin iframe](http://localhost:3000/lab/cross-origin). Send a message from port 3101 using postMessage. This local exercise uses a different origin from the storefront.
- [Locator traps](http://localhost:3000/lab/locator-traps). Scope repeated Email fields and Remove buttons. An unscoped action intentionally triggers a strict-mode error.
- [Request race](http://localhost:3000/lab/race). Compare the latest result with the slower first request. The instability switch permits a stale response to overwrite the latest result.
- [Element replacement](http://localhost:3000/lab/rerender). Enable replacement and locate a button again after it is recreated. The replacement is opt-in.
- [Moving button](http://localhost:3000/lab/animation). Enable movement and click after the target settles. The motion lasts one second and starts disabled.

## Practice features

- [WebSocket ticker and echo chat](http://localhost:3000/lab/websocket) uses the local Node server started by `npm start`. Connect and wait for a price tick, then send up to 120 characters to receive an echo. Hosted builds show an availability notice.
- [Simulated single sign-on](http://localhost:3000/lab/sso) uses the mock identity provider at `/mock-idp`. The only demo credentials are `vortex_demo` and `VortexDemo24!`. Approving consent returns a short-lived code that creates a separate customer session. The production mock provider uses the existing `ORVILO_MFA_KEY` as its signing key.
- [GraphQL catalog query](http://localhost:3000/lab/graphql) sends a read-only query to `POST /api/graphql`. The schema provides `products(q, category, offset, limit)`, `categories(q, offset, limit)`, and `reviews(productId, rating, offset, limit)`. The maximum limit is 50 and the maximum offset is 1000.
- [English and Hindi](http://localhost:3000/shop) are available from the language switcher on shop, cart, and checkout. The choice is saved to `vortex.locale`. Catalog names, addresses, currencies, and backend response text use their source values. Storefront test IDs are the same in both languages.

### Local operator command

```bash
npm run admin:grant -- existing_username
```

This **mutates the development database**: it grants the admin role to an existing username, revokes that user's sessions/pending MFA logins and writes an outbox event. It refuses production environments. Use only when that account and role change are intended.

## 7. Current limitations

### Personal defect practice and the 3D studio

Open `/practice` in PostgreSQL mode with a signed-in account to enter a private practice workspace. Each account has its own catalog snapshot, cart, wishlist, reviews, orders, display name, and defect selection. All eight bugs start off. Reset clears that workspace and its defects. A reset from a stale tab returns 409 until the tab refreshes.

The catalog snapshot supports up to 1000 products, and a workspace supports 100 orders before reset. New or changed shared products appear after a personal reset. Leaving and clearing practice retains a generation counter to reject old reset requests. Credentials, MFA, and real account settings use their existing workflows.

The new schema is in `202611110002_vortex_practice`. Run database tests only against Compose or the disposable GitHub Actions PostgreSQL service. A production migration needs its own explicit authorization.

Open `/showroom` for the Three.js material study. The user loads WebGL on demand, then rotates the mug by drag or keyboard and changes its finish. Resources are disposed on navigation. Reduced-motion preferences stop auto-rotation. Browsers without WebGL retain the product photo and a retry message. This is a conceptual model for the exercise.

All 40 seeded product names have local WebP photos. Their enlarged gallery views crop the same photo. Custom products continue to use the existing generated placeholder. Asset prompts and provenance are recorded in [Asset sources](ASSET_SOURCES.md).

- PostgreSQL and legacy modes do not have identical auth, test-control, event or payment behavior.
- No scoped per-test-run reset API, durable event subscribers, real recovery email delivery or production deployment verification is supplied by setup alone.
- Seller/RFQ workflows, remaining commerce work and complete reference-design parity
  remain under the master plan. The release-preparation Prisma upgrade resolved
  the previously reported dependency findings; see [release validation](RELEASE_VALIDATION.md).
- The [29 October baseline](BASELINE_VALIDATION.md) is historical evidence. Re-run the appropriate commands to verify today's checkout and record skips/failures rather than inheriting old pass counts.
