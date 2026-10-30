# Production boundaries

This document describes the configuration and routing boundary enforced by [`src/app.js`](../src/app.js). It covers the legacy in-memory API, test controls, recovery delivery, health/config, and what remains available in the UI Lab. Deployment is not claimed; the deployed environment still needs verification.

## 1. Production detection

Production means either indicator is exactly `production`:

- `NODE_ENV=production`
- `VERCEL_ENV=production`

The shared helper in [`src/test-hooks/guard.js`](../src/test-hooks/guard.js) is used for both mounting decisions and request-time guards. Development with neither indicator keeps the reference behaviour.

## 2. Configuration contract

| Mode | `DATABASE_URL` | `SHOPLAB_STORAGE` | Result |
| --- | --- | --- | --- |
| Development / reference | unset | unset | Memory store; legacy `/api` mounted; no v2 |
| Development / reference | set | unset | PostgreSQL store; v2 mounted; legacy `/api` still mounted for reference |
| Development / reference | set | `legacy` | Memory store; legacy `/api` mounted; no v2 |
| Production | set | unset | PostgreSQL store; v2 only; legacy `/api` absent |
| Production | unset | any | **Fail closed**: all `/api` business requests return 503 |
| Production | set | `legacy` | **Fail closed**: all `/api` business requests return 503 |

In the fail-closed cases the app does not load the legacy router, the memory store, or any compiled database router. It also does not expose a memory fallback. The 503 body is always:

```json
{ "error": "Service configuration is incomplete" }
```

The reason is not echoed to clients, so no connection string, credential, host or environment value is disclosed. `/api/health` remains available (see below) so a hosting liveness check can distinguish a running process from a crashed one.

## 3. Route contract

| Route | Development | Production with database | Production misconfigured |
| --- | --- | --- | --- |
| `/api/health` | 200 `{ok,uptime,version}` | 200 same | 200 same (non-mutating, no DB) |
| `/api/config` | 200 `{storage,recoveryAvailable}` | 200 `{storage:"postgres",recoveryAvailable:false}` | 503 sanitized error |
| `/api/v2/*` | Mounted when PostgreSQL; 404 otherwise | Real routers; unknown v2 path 404 JSON | 503 |
| Legacy `/api/*` | Legacy memory router | 404 JSON (`Not found`) | 503 |
| Static files and SPA deep links | Served | Served | Served |
| `/pages/testing-guide.html`, `/terms`, `/lab/*`, `/bank/3ds` | Served | Served | Served |

Mount order is: `/api/health`, `/api/config`, v2 routers, v2 catch-all, then either the development legacy router or the production JSON 404. The v2 catch-all prevents unknown v2 paths from falling through to a legacy handler. The production `/api` 404 is mounted before static files, so an old mutation can never fall through to the SPA shell.

`/api/health` does not query PostgreSQL. It reports that the process is alive, not that the database is reachable. A database-aware readiness check is outside this task.

## 4. Legacy API and test controls

The legacy router in [`server/api.js`](../server/api.js) contains seeded customers and admins, password login, cart/checkout/order mutations, admin product/user endpoints, chaos controls, reset, and the test inbox. It is now a development/reference surface only: production never imports it, so those accounts and mutations have no public route.

Defence in depth remains in [`src/test-hooks/guard.js`](../src/test-hooks/guard.js), which is mounted inside the legacy router:

- `POST /api/reset`, `GET/POST /api/chaos*`, and `/api/test*` return 404 in production even if the router were mounted accidentally.
- `x-shoplab-latency`, `x-shoplab-fail`, and `x-shoplab-bugs` are removed in production before route handling, so forced failures, delays and seeded-bug mode cannot be requested through headers.
- Production app-level tests mount the legacy router on a disposable application and confirm a chaos header cannot force an error, test-control paths are rejected, and a reset request does not reach the state-changing handler.

## 5. Recovery and test inbox

Recovery routes are v2 routes and exist only in PostgreSQL mode. `recoveryAvailable()` is false when either production indicator is set, regardless of `ORVILO_TEST_KEY`:

| Request | Production result |
| --- | --- |
| `POST /api/v2/password/forgot` | 503 `Password recovery delivery is not configured` |
| `POST /api/v2/password/reset` | 503 same |
| `GET /api/v2/test/mailbox` | 404 `Not found` |

These checks run before validation, rate limiting, hashing or any database call. Tests assert that the fake Prisma proxy is never read.

## 6. UI Lab in production

In PostgreSQL mode the frontend hides `[data-legacy-only]` elements and the chaos panel, and disables the legacy SSE stream. With the production boundary:

**Unavailable in production**

- Chaos panel and `POST /api/chaos`, `POST /api/reset`, `/api/test/mailbox` and `/api/events`.
- Test Inbox navigation and mailbox view (hidden, and the API is rejected).
- Any exercise that assumes the seeded legacy personas, legacy carts/orders, or header-injected failures as public controls.

**Still available (static or browser-only)** — dialogs, tabs/popups, iframes, shadow DOM, drag and drop, mouse hover/double/right click, canvas signature, form controls, dynamic waits, infinite scroll, file upload, keyboard, clipboard, geolocation, clock/timer, dynamic IDs, web table, visual snapshot target, and the accessibility audit target. JSON download is generated in the browser.

**Still available through the v2 adapter** — the Lab's deal-of-the-day and product network calls, and CSV product download. The "broken endpoint" exercise still produces an error, but in database mode it surfaces the adapter's "not available in database mode yet" message rather than an HTTP error from the legacy route.

**Frontend follow-up (outside this task)** — when `/api/config` returns 503, [`web/js/core.js`](../web/js/core.js) currently leaves the runtime in its default memory mode and the UI attempts legacy calls that now fail. A release-quality frontend should show an explicit unavailable state instead. The Lab broken-endpoint wording could also be made mode-aware. Neither change is required for the security boundary.

## 7. Verification

```text
npm run typecheck                                              exit 0
npm run build                                                  exit 0
node --test tests/workflows/production-boundaries.test.js      9 passed
npm run test:workflows                                        12 passed
```

The new test file stubs `dotenv` (so the real `.env` is never read), stubs all database routers except the real compiled recovery router, and uses a Prisma proxy that throws on access. It spawns no database connection and uses only disposable in-process servers on ephemeral ports.

A separate smoke test loaded the production entry with the real compiled routers, a dotenv stub and a nonconnecting dummy PostgreSQL URL:

- `/api/health` 200, `/api/config` 200 `{storage:"postgres",recoveryAvailable:false}`.
- `POST /api/register` and `GET /api/products` 404 JSON; legacy router never loaded.
- `/api/v2/password/forgot` 503, `/api/v2/test/mailbox` 404, unknown v2 404.
- `/pages/testing-guide.html` and `/assets/fonts.css` 200.

The same entry with production and no database returned 503 for config, register, products and v2, while health and static files stayed available.

Database workflow tests, the Playwright suite, migrations, and any deployed-host check were not run. Deployed production routing remains to be verified after an authorized deployment.
