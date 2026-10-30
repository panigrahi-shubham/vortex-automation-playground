# Release build and Vercel packaging

Current release update (30 October): Prisma/client/adapter are now 7.10.1, Node
24.x is required, and the bundled Supabase CA enables verified TLS. See
[RELEASE_VALIDATION.md](RELEASE_VALIDATION.md) for the current tests and snapshot.
Task F's original Windows tracing figures below are historical, not a measurement
of the new driver bundle.

Status: release build is reproducible from a clean checkout and the Express entry loads after a clean install. Host-side Vercel packaging and any deployment remain **unverified**; see [Pending host verification](#8-pending-host-verification).

This document covers the release build only. Production route restrictions and dependency-audit remediation belong to separate tasks.

## 1. Runtime shape

- [`api/index.js`](../api/index.js) exports [`src/app.js`](../src/app.js), a plain CommonJS Express app. `vercel.json` rewrites every path to that one function.
- The app selects storage from the environment: PostgreSQL when `DATABASE_URL` is set and `SHOPLAB_STORAGE` is not `legacy`; otherwise in-memory legacy storage.
- In PostgreSQL mode, `src/app.js` mounts compiled routers from `dist/` via literal `require('../dist/...')` calls. `dist/` is git-ignored and must exist before the function is bundled.
- Static SPA files, fonts, styles, scripts, standalone lab documents, `/terms`, and `/bank/3ds` are served from [`web/`](../web) by Express. `web/pages/testing-guide.html` is one of those static documents.
- Prisma Client (`@prisma/client` 7.10.1) is generated from the Prisma schema and
  used with `@prisma/adapter-pg` through `server/database.cjs`. Its generated
  runtime assets must be bundled alongside the shared factory and public CA.

## 2. Build contract

| Command | Behaviour | Why it exists |
| --- | --- | --- |
| `npm ci` | Installs from `package-lock.json`, then runs `postinstall`. | `postinstall` runs `prisma generate`, so type checks and builds never see an uninitialized client stub. |
| `npm run build` | `prisma generate && tsc -p tsconfig.build.json`. | Produces `dist/` and refreshes the client in one deterministic step. |
| `npm run vercel-build` | `npm run build`. | Documented Vercel hook for build outputs that must be inside a Function. |
| `npm run typecheck` | `tsc -p .` (no emit). | Verifies generated Prisma types before/independent of emitting. |
| `npm start` | `prestart` build, then `node server.js`. | Local server only; Vercel uses the exported handler and does not run `start`. |

Prisma generation is build-time only. It reads the schema and writes the client; it does not connect, migrate, seed, or validate database contents. `postinstall` needs the `prisma` CLI from `devDependencies`, so any install that omits dev dependencies must run `prisma generate` explicitly.

## 3. Vercel project settings

| Setting | Recommended value | Notes |
| --- | --- | --- |
| Root Directory | repository root (`.` / leave unset) | This GitHub repository already has `package.json` and `api/index.js` at its root. The local parent workspace is not the repository root; do not add a nonexistent nested `shoplabdemowebsite` root. |
| Framework Preset | Other / no framework | The app is a single Express Function; no static output directory. |
| Install Command | `npm ci` | Default `npm install` also runs `postinstall`; `npm ci` is deterministic. Vercel installs `devDependencies` by default, which provides the `prisma` CLI and `typescript`. |
| Build Command | leave blank, or `npm run vercel-build` | A `vercel-build` script is run automatically and is the documented way to add build outputs to a Function. Do not point it at a command that skips `dist/`. |
| Output Directory | blank | Assets are served by Express, not by Vercel's static output. |
| Node.js Version | 24.x | Matches `engines.node` and the configured Vercel project. |
| Function region / plan | operator choice | Not part of this task. |

## 4. Function bundling

Current [`vercel.json`](../vercel.json):

```json
{
  "version": 2,
  "rewrites": [{ "source": "/(.*)", "destination": "/api" }],
  "functions": {
    "api/index.js": {
      "includeFiles": "{web,dist,server/certs,node_modules/.prisma}/**"
    }
  }
}
```

- The rewrite is unchanged; it preserves SPA deep links such as `/shop`, `/orders`, and `/pages/testing-guide.html`.
- `includeFiles` is a single brace-expanded glob string, as required by the
  [Vercel configuration schema](https://openapi.vercel.sh/vercel.json). It adds
  files to the Function beyond static dependency tracing:
  - `web/**` — every static asset and standalone document (30 files at the time of writing), including assets that Express resolves at runtime from a filesystem path.
  - `dist/**` — every compiled module (28 JavaScript files), including `dist/events/dispatcher.js`, which dependency tracing does not reach statically.
  - `node_modules/.prisma/**` — generated client/runtime assets.
  - `server/certs/**` — public Supabase trust certificate. The shared client
    factory in `server/database.cjs` is also a traced runtime dependency.
- Vercel limits a Node.js Function to 250 MB uncompressed. The local dependency trace measured about 41.6 MB on Windows; the Linux engine and optional `sharp` binary differ in size, so the host-side figure must be measured, not assumed.

## 5. Environment variables

Only names are listed; never commit values.

| Name | Stage | Required | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | runtime | For PostgreSQL mode | Prisma runtime connection (transaction pooler). Its presence switches the app out of legacy memory storage. |
| `DIRECT_URL` | migrations | For `prisma migrate deploy` | CLI connection selected by `prisma.config.ts`. Not needed to serve requests. |
| `ORVILO_MFA_KEY` | runtime | For authenticator MFA | Stable 32-byte base64 key. Keep it stable across deployments. |
| `ORVILO_TEST_KEY` | development only | No | Protected test-inbox key. Leave unset in production; the recovery helper is unavailable when absent. |
| `SHOPLAB_STORAGE` | development only | No | Set to `legacy` to force in-memory storage. Do not set it in production. |
| `NODE_ENV` / `VERCEL_ENV` | platform-provided | No | Set by Vercel. Production guards treat either being `production` as production. |
| `PORT` | local only | No | Used by `server.js`; Vercel manages the Function port. |

Build-only verification used dummy `postgresql://...@127.0.0.1:59999/...` URLs and no real secrets. `prisma generate` completed without any database environment variable, and no query was made during verification.

## 6. Required artifacts checklist

After `npm ci && npm run build`, confirm:

- `web/index.html`, `web/assets/fonts.css`, `web/css/app.css`, `web/css/orvilo.css`, `web/js/app.js`.
- `web/pages/testing-guide.html`, `terms.html`, `popup.html`, `frame-outer.html`, `frame-inner.html`, `bank-3ds.html`.
- `dist/` contains the compiled `auth`, `db`, `events`, `modules`, and `workflows` trees (28 JavaScript files at the time of writing).
- `node_modules/.prisma/client` contains the generated client/runtime assets.
- `server/database.cjs` and `server/certs/supabase-root-2021.crt` are present.

## 7. Clean-build verification procedure

Run in a disposable copy that excludes `.env`, `node_modules`, `dist`, `.git`, and test artifacts:

```bash
npm ci
npm run typecheck
npm run build        # or: npm run vercel-build
node -e "require('./api/index.js')"
```

Then start the exported app on an ephemeral local port and request `/api/config`, `/api/v2/does-not-exist`, `/shop`, `/pages/testing-guide.html`, `/terms`, `/lab/popup`, `/assets/fonts.css`, `/css/app.css`, and `/js/app.js`. Expected: 200 except the unknown `/api/v2` path (404), with no database access.

Results from the Task F run are recorded in [`docs/handoffs/TASK_F_RESULT.md`](handoffs/TASK_F_RESULT.md).

## 8. Pending host verification

- No Vercel project, CLI session, or authentication was used. The Function bundle, 250 MB limit, cold start, and Linux query-engine binary were **not** inspected on Vercel. A successful local build is not a successful deployment.
- `includeFiles` glob expansion is documented behaviour but has not been observed in a real Vercel build.
- On Linux, npm must install the matching `sharp` platform package (`@img/sharp-linux-x64` for the standard x64 runtime). The Windows verification trace warned only about non-Windows optional `sharp` binaries, which is expected and not an application error.
- Prisma's engine is generated during the Vercel build on Linux, so it should target the build image rather than Windows; this remains to be observed on the host.
- Production route restrictions (legacy `/api` exposure) are Task G. The 3 high-severity findings reported by `npm ci` are Task H; nothing was upgraded, downgraded, or suppressed here.

## 9. Primary sources

- Vercel, [Configuring a Build](https://vercel.com/docs/builds/configure-a-build) (updated 28 August 2026) — `vercel-build` for including build outputs in a Function.
- Vercel, [Static Configuration with vercel.json](https://vercel.com/docs/project-configuration/vercel-json) (updated 14 August 2026) — `functions` and `includeFiles`.
- Vercel, [Advanced Node.js Usage](https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration) (updated 27 April 2026) — including files in a Function.
- Vercel, [Vercel Functions Limits](https://vercel.com/docs/functions/limitations) (updated 24 August 2026) — 250 MB uncompressed bundle limit.
- Vercel, [Using the Node.js Runtime](https://vercel.com/docs/functions/runtimes/node-js) (updated 11 August 2026) — Node.js versions and dependency installation.
- Vercel, [How to ship an Express app on Vercel](https://vercel.com/kb/guide/ship-a-express-app-on-vercel) — single-Function Express pattern.
