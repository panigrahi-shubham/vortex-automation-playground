# ShopLab v2 — an e-commerce playground for Playwright

A realistic practice store with a real JSON API, every journey a tester meets in an interview or on a project, a UI Lab full of awkward widgets, server-side chaos controls, and eight seeded bugs to hunt.

It ships with a **214-test Playwright + TypeScript reference suite** (POM, fixtures, API seeding, network mocking, mobile, bug hunt) that runs green, fully parallel, against a single server.

```bash
npm install
npx playwright install chromium
npm start                 # http://localhost:3000
npx playwright test       # starts the server for you if it isn't running
npx playwright show-report
```

No database, no build step, no external assets: one Express server, an in-memory store, and a vanilla-JS single-page app. `POST /api/reset` puts everything back to the seed.

---

## What changed from v1

| | v1 | v2 |
|---|---|---|
| Routing | `#/hash` routes | Real URLs (`/product/5`, `/checkout/payment`) with the History API, so `toHaveURL` and deep links work |
| Auth | login, 4 users | + register, forgot/reset password, email OTP (2FA), remember me, account lockout after 5 failures, session expiry, returnTo redirects |
| Catalog | search, 1 category, sort, pager | multi-category, price range, in-stock, rating, 6 sorts, page size, URL-synced filters, product page with variants, gallery, tabs, reviews, wishlist |
| Cart | add / remove | quantity stepper, 4 coupons, 3 shipping methods, free-shipping threshold, save-for-later, clear with a confirmation modal |
| Checkout | 3 fields | 4-step wizard: address (dependent country → state dropdown, per-country postal rules), delivery, payment (Luhn, expiry, CVV, test cards, **3-D Secure in an iframe**), review + terms |
| Orders | list | detail page, live status over Server-Sent Events, cancel, CSV invoice download, buy again |
| Extras | — | account (profile, password, avatar upload), admin console (product CRUD, sortable/paginated table, order status, lock users), test inbox, API docs page, command palette (Ctrl+K), dark mode, cookie banner, mobile layout |
| Test control | global chaos | + per-request chaos headers (parallel-safe), session TTL, order auto-progress, mailbox API |
| Bugs | 3 | 8 (answer key in `BUGS.md`) |

## Test accounts (password `secret123`)

| User | Behaviour |
|---|---|
| `standard_user` | Happy path |
| `locked_user` | 423 Locked |
| `slow_user` | Login takes 3 s |
| `problem_user` | Seeded bugs are always on |
| `mfa_user` | Sends a 6-digit code to the test inbox |
| `admin_user` | Admin console at `/admin` |

New accounts need a password with 8+ characters, upper and lower case, and a number.

**Payment cards** (any future expiry, any CVV): `4242 4242 4242 4242` success · `4000 0027 6000 3184` 3-D Secure (code `123456`) · `4000 0000 0000 0002` declined · `4000 0000 0000 9995` insufficient funds · `4000 0000 0000 0069` expired at the bank.

**Coupons:** `SAVE10` 10% off · `FLAT50` $50 off orders of $200 or more · `FREESHIP` · `EXPIRED20` (always expired).

## Journeys to automate

1. **Sign in:** happy path, validation, wrong password, locked, 5-strike lockout, slow login, returnTo redirect, remember me, logout.
2. **Register:** field errors, duplicate username or email, password-strength meter, terms link in a new tab.
3. **Forgot password:** request a code, read it from the test inbox (UI at `/mailbox` or `GET /api/test/mailbox`), reset it, sign in.
4. **2FA:** sign in as `mfa_user`, read the OTP, fill the 6 auto-advancing boxes.
5. **Browse:** search, debounce, filters, sorting, pagination, back button, deep links, empty and error states.
6. **Product:** variants, quantity limits, out of stock, tabs, reviews (including a duplicate review returning 409), wishlist.
7. **Cart:** quantities, coupons, shipping, totals arithmetic, save for later, clear with confirmation.
8. **Checkout:** every validation rule, step guards, declined and 3-D Secure payments, double-submit protection.
9. **Orders:** history and filters, live status updates, cancel, invoice download, buy again, opening someone else's order (404).
10. **Account:** profile, password change, avatar upload (`setInputFiles`, drag-and-drop, 415 and 413 errors).
11. **Admin:** role-based access (403), product CRUD reflected in the shop, sortable table, order status, lock and unlock users.
12. **UI Lab (`/lab`):** native dialogs, new tabs and popups, nested iframes, open and closed shadow DOM, drag and drop, hover, double-click and right-click, canvas drawing, every form control, dynamic waits, infinite scroll, downloads, keyboard, clipboard, geolocation, `page.clock`, network mocking, unstable IDs, web tables, visual snapshots, and an axe accessibility target.

## Locator strategy

Every interactive element has an accessible role and name, so prefer `getByRole` and `getByLabel`. `data-testid` is there as a fallback, and the config sets `testIdAttribute: 'data-testid'`. Some names deliberately overlap, which teaches when to use `exact: true` and scoping:

- `Password` and `Confirm password`
- `Quantity` and `Increase quantity`
- `Remove` and `Remove <product>`
- `Apply` and `Apply price`

## Chaos and test control

| Global (affects everyone) | Per request (parallel-safe) |
|---|---|
| Chaos panel, bottom right, or `POST /api/chaos {latencyMs, errorRate, bugMode, sessionTtlSec, orderProgressSec}` | `x-shoplab-latency: 1500` |
| `POST /api/reset` restores all seed data | `x-shoplab-fail: 503` |
| `GET /api/test/mailbox?to=` | `x-shoplab-bugs: 1` |

Send headers with `page.route(... route.continue({ headers }))`, `page.setExtraHTTPHeaders()`, or `test.use({ extraHTTPHeaders })`.

Orders move Placed → Processing → Shipped → Delivered every 15 s by default, and the change is pushed to the browser over SSE (`GET /api/events?token=`). Because that connection stays open, `waitForLoadState('networkidle')` never resolves on this app. Wait for something meaningful on the page instead.

## The reference suite

```
tests/
  support/   fixtures.ts (fresh user per test, storageState auth, POM injection)
             shop-api.ts (typed API client used for seeding)
             test-data.ts, global-setup.ts (health check + reset)
  pages/     Page Object Model: login, shop, product, cart, checkout, orders, account, admin
  e2e/       UI journeys: auth, catalog, cart, checkout, orders, account, admin, network, lab, mobile
  api/       pure API tests: auth, catalog, cart/checkout/orders, admin
  bugs/      seeded-bug hunt, each test marked test.fail()
  serial/    server-wide chaos, real session expiry, order auto-progress, catalog CRUD
```

Patterns worth studying:

- **Isolation:** the `user` fixture registers a brand-new user for every test, so carts and orders never collide and the suite runs with any number of workers.
- **Auth without the login screen:** a `storageState` fixture writes the token into localStorage. The admin spec shows the `addInitScript` alternative.
- **Seed via the API, assert via the UI:** `api.placeOrder()` and `api.addToCart()` keep UI tests short.
- **Projects:** `api`, `chromium`, `mobile` (Pixel 7), `bugs`, and `global-state`, which uses `dependencies` so it runs last.
- **Network:** fulfil, patch a real response, abort, add latency, inspect the request, and make the random deal of the day deterministic.

Useful commands:

```bash
npm run test:api                          # API only, no browser
npx playwright test --project=chromium    # desktop UI
npm run test:bugs                         # the bug hunt
npx playwright test --ui                  # watch mode
VISUAL=1 npx playwright test -g visual --update-snapshots   # create a visual baseline
npm run typecheck
```

Run against a deployed copy with `BASE_URL=https://your-app.onrender.com npx playwright test`. Global setup waits up to 90 s for a sleeping free instance to wake.

## Deploy free on Render

Push this folder to GitHub, then in Render choose **New → Blueprint** (it reads `render.yaml`) or **Web Service** (build `npm install --omit=dev`, start `npm start`). A free instance sleeps after about 15 minutes of inactivity. Data lives in memory, so a restart or `POST /api/reset` restores the seed.

`.github/workflows/playwright.yml` runs the type check and the whole suite on every push and uploads the HTML report.
