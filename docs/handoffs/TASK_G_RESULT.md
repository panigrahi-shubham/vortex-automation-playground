# Task G result — production legacy restrictions and guard verification

Task ID: **G**  
Date: 30 October 2026  
Outcome: **completed within the production-routing scope; no deployment performed or claimed**

Production now fails closed when PostgreSQL is not configured, never mounts the legacy in-memory business API, and keeps `/api/v2`, `/api/config`, `/api/health` and static assets working. Request-level tests prove the denied legacy paths are not reachable and that test controls and chaos headers are rejected. Task H and any deployed-host verification remain outstanding.

## Files changed

1. [`src/app.js`](../../src/app.js)
   - Computes production from `NODE_ENV`/`VERCEL_ENV` via the existing `productionLocked()` helper.
   - Fails closed with a sanitized 503 when production has no `DATABASE_URL` or explicitly requests `SHOPLAB_STORAGE=legacy`.
   - Mounts the legacy router only outside production, and only loads it at that point.
   - Adds a production `/api` JSON 404 after the v2 routes so old mutations cannot fall through.
   - Adds `/api/health` in every mode (non-mutating, no database).
   - `/api/config` and the v2 mount order are otherwise unchanged.
2. [`tests/workflows/production-boundaries.test.js`](../../tests/workflows/production-boundaries.test.js) — new request-level tests.
3. [`docs/PRODUCTION_BOUNDARIES.md`](../PRODUCTION_BOUNDARIES.md) — mode matrix, route contract, Lab impact and pending frontend follow-up.
4. This report.

Reviewed and unchanged: [`src/test-hooks/guard.js`](../../src/test-hooks/guard.js) (already blocks reset/chaos/test and strips chaos headers), auth/business modules, Prisma schema/migrations, package scripts, Vercel configuration, environment files, and frontend code. No dependency, schema, migration, or environment change was made.

## Implementation summary

- **Fail closed.** A production process without `DATABASE_URL`, or with `SHOPLAB_STORAGE=legacy`, does not load the memory store, the legacy router, or any compiled database router. Every `/api` business request returns `503 {"error":"Service configuration is incomplete"}`. The message is static and contains no host, credential or environment value. Static documents and SPA deep links still load so the site itself does not crash.
- **No seeded production demo.** Production with a database mounts only `/api/v2`; the legacy router (seeded customers/admins, legacy mutations, admin endpoints, reset/chaos/mailbox) is never required. Development keeps the reference API, including PostgreSQL development mode.
- **Route order.** Health → config → v2 routers → v2 catch-all → development legacy router or production JSON 404. Unknown v2 paths are answered inside the v2 catch-all, and production legacy requests cannot fall through to the SPA.
- **Defence in depth.** The existing guard still rejects `/reset`, `/chaos*` and `/test*` and strips `x-shoplab-latency`, `x-shoplab-fail` and `x-shoplab-bugs` in production. Tests exercise it through real HTTP requests on a disposable mounted router.
- **Recovery.** Production v2 recovery routes reject before validation, rate limiting, hashing or database access: forgot/reset 503, test mailbox 404, independent of `ORVILO_TEST_KEY`.

## Verification

Tooling: Node.js v24.15.0, npm 11.12.1, Prisma 6.19.3, TypeScript 5.9.3.

```text
npm run typecheck    exit 0
npm run build        exit 0
node --test tests/workflows/production-boundaries.test.js    9 passed, 0 failed
npm run test:workflows                                       12 passed, 0 failed
```

The new suite stubs `dotenv` before loading the app, so the real `.env` is never read. It stubs the ten database route factories, keeps the real compiled recovery router, and supplies a Prisma proxy that throws if touched. It uses only ephemeral in-process servers; no database connection, migration, seed, reset (outside disposable memory), credential or shared server was used.

Coverage:

- `NODE_ENV=production` without a database: health 200; config/register/products/v2 503; static guide 200; zero legacy and zero compiled-router loads.
- `VERCEL_ENV=production` with `SHOPLAB_STORAGE=legacy`: same fail-closed result; no legacy import and no v2 mount.
- Each production indicator independently with a database: config 200 `{storage:"postgres",recoveryAvailable:false}`; v2 probe 200; real recovery 503; test mailbox 404; unknown v2 404; legacy register/products 404 JSON; static guide 200; zero legacy loads; zero Prisma reads.
- Development memory mode: config `memory`, legacy products 200, no v2.
- Development PostgreSQL mode: config `postgres`, v2 probe 200, legacy reference products 200, zero Prisma reads.
- Development `SHOPLAB_STORAGE=legacy` with a database: memory mode, legacy products 200, no v2.
- Production guard on real requests: injected `x-shoplab-fail` cannot force a failure, latency/bug headers are stripped, reset/chaos/mailbox return 404, and a sentinel user survives a reset attempt (the handler never ran).

A separate smoke test loaded the production entry with the **real compiled routers**, dotenv stub and nonconnecting dummy URL: 9/9 expected statuses, including config 200, legacy 404s, recovery 503, unknown v2 404, and static 200. The production entry without a database returned 503 for config/register/products/v2 while health and static files stayed 200 (6/6). Both processes ended with a Windows libuv teardown assertion after the server closed; all responses had already been received, so this is reported as a harness teardown artifact rather than an application result.

## Checks not run

- No deployment, Vercel build, public URL, authentication or hosting-provider change. Deployed routing and secrets configuration remain unverified.
- No PostgreSQL connection, database workflow tests, migrations, seed, admin grant or real `.env` access.
- No Playwright/browser suite or legacy full regression run; the browser suite starts a server via `npm start`, which would load the project `.env`, so it was intentionally not used for this boundary task.
- No Task H dependency remediation and no Task F build changes.
- `/api/health` is a liveness response only; database readiness was not implemented or tested.

## Limitations

- The fail-closed decision is made once at module load from environment variables. A malformed (rather than missing) `DATABASE_URL` is not specifically diagnosed; Prisma/runtime errors would surface instead. This task did not add URL validation.
- The frontend still defaults to memory mode when `/api/config` fails, so a misconfigured production deployment shows failing legacy calls rather than an explicit outage state. This is documented as follow-up, not changed here.
- Production Lab uses the existing v2 adapter; the "broken endpoint" exercise reports the adapter's not-available message rather than a server 4xx. The rest of the Lab remains browser-only or v2-backed as listed in the production boundaries document.
- Automated request tests cannot prove the behaviour of the real deployed host; they prove the current checkout's routing when loaded with the stated environment.

## Requested outside this task

- **Frontend follow-up (not owned here):** handle a non-OK `/api/config` with a clear unavailable state, and optionally make the Lab broken-endpoint copy mode-aware.
- **Deployment operator:** configure production with `DATABASE_URL`/`DIRECT_URL` and without `SHOPLAB_STORAGE=legacy`, then verify `/api/health`, `/api/config`, `/api/v2` and the absence of legacy routes on the real URL.
- **Task H:** investigate the dependency findings reported by `npm ci`; nothing was upgraded or suppressed here.

No deployment, milestone completion, or Task H result is claimed.
