# Task F result — release build verification and fix

Task ID: **F**  
Date: 30 October 2026  
Outcome: **completed within the owned release-build scope; no deployment performed or claimed**

The release build was reproduced from a clean, isolated snapshot. The reproduced blocker was an uninitialized Prisma Client after `npm ci`, which broke type checking and left a `dist/` tree that could not load at runtime. The fix adds explicit Prisma generation to the install/build lifecycle and adds the compiled modules and generated client to the Function bundle. After the fix, a fresh clean install, type check, build, and Express entry smoke test all passed. Host-side Vercel packaging is still pending.

## Files changed

1. [`package.json`](../../package.json)
   - Added `"postinstall": "prisma generate"`.
   - Changed `"build"` to `"prisma generate && tsc -p tsconfig.build.json"`.
   - Added `"vercel-build": "npm run build"`.
   - No dependency, engine, name, or version changes.
2. [`vercel.json`](../../vercel.json)
   - Extended `functions["api/index.js"].includeFiles` from `"web/**"` to `["web/**", "dist/**", "node_modules/.prisma/**"]`.
   - Rewrite and version unchanged.
3. [`docs/DEPLOYMENT_BUILD.md`](../DEPLOYMENT_BUILD.md) — new operator reference for build settings, environment-variable names, required artifacts, and pending host checks.
4. This report.

Reviewed and intentionally unchanged: [`api/index.js`](../../api/index.js) (already the correct single-Function entry), [`tsconfig.build.json`](../../tsconfig.build.json) (already emits `src/` to `dist/`), [`src/app.js`](../../src/app.js), Prisma schema/migrations, application routes, static pages, and tests. Task F did not modify `package-lock.json`; no lockfile change is required because no dependencies changed.

## Implementation summary

- `dist/` is git-ignored, and `src/app.js` requires compiled modules only when PostgreSQL storage is selected. Vercel therefore must generate Prisma Client and compile TypeScript before bundling the Function.
- Before the fix, `npm ci` left the generated client as an uninitialized stub: `npm run typecheck` failed with missing `User`, `PrismaClientKnownRequestError`, and `Decimal` exports, and requiring the entry threw `@prisma/client did not initialize yet`.
- `postinstall` makes a clean install produce a usable client, which also fixes type checking in isolation.
- `vercel-build` is the documented Vercel hook for build outputs that must be inside a Function; it delegates to the same deterministic build.
- `includeFiles` now explicitly carries `dist/**` (including `dist/events/dispatcher.js`, which dependency tracing does not reach) and the generated Prisma client/engine. `web/**` remains included for runtime-served assets.
- No runtime behavior, API path, storage selection, schema, or dependency changed. Prisma generation is build-time only and does not connect to a database.

## Verification

Verification used a temporary copy of the working tree excluding `.env`, `.env.*`, `.local`, `.git`, `node_modules`, `dist`, and test reports (`env_files=0 node_modules_dirs=0 dist_dirs=0 git_dirs=0`, 6.4 MB). Tooling: Node.js v24.15.0, npm 11.12.1, Prisma 6.19.3, TypeScript 5.9.3.

### Clean install and build

```text
npm ci
  postinstall: prisma generate
  ✔ Generated Prisma Client (v6.19.3) ... in 164ms
  added 140 packages
  3 high severity vulnerabilities
  exit 0
```

The 3 high-severity audit findings are pre-existing and belong to Task H. They were not fixed, suppressed, or bypassed; `npm audit fix --force` was not used.

```text
npm run typecheck      exit 0
npm run build          exit 0, Prisma regenerated, compiled_js=28
npm run vercel-build   exit 0
```

Type checking passed immediately after `npm ci`, confirming `postinstall` is sufficient for a clean install.

### Function dependency trace

Offline `@vercel/nft` trace of `api/index.js` (installed only in the disposable snapshot, not added to the project):

```text
traced_files=392
dist_files=27 web_files=30 prisma_files=5 engine_files=1
engine=node_modules/.prisma/client/query_engine-windows.dll.node
traced_size_mb=41.6
```

`dist/events/dispatcher.js` is the single compiled module not reached by static tracing; `dist/**` in `includeFiles` covers it. All 30 `web/` files were traced and are also covered by `web/**`. The 17 trace warnings were all unresolved `sharp` binaries for other platforms (for example `@img/sharp-linux-x64/sharp.node`), expected on a Windows snapshot; Linux installs the matching optional package.

### Express entry and safe routes

The built entry loaded with dummy, nonconnecting database URLs (`127.0.0.1:59999`, `connect_timeout=1`). Ten GET requests were served through the exported app on an ephemeral port; no database query was made.

| Request | Status | Content type |
| --- | --- | --- |
| `/api/config` | 200 | JSON — `{"storage":"postgres","recoveryAvailable":false}` |
| `/api/v2/does-not-exist` | 404 | JSON |
| `/shop` (SPA deep link) | 200 | HTML |
| `/pages/testing-guide.html` | 200 | HTML |
| `/terms` | 200 | HTML |
| `/lab/popup` | 200 | HTML |
| `/lab/frame-outer` | 200 | HTML |
| `/assets/fonts.css` | 200 | CSS |
| `/css/app.css` | 200 | CSS |
| `/js/app.js` | 200 | JavaScript |

All ten checks passed (`failed=0`). `recoveryAvailable:false` is correct with `ORVILO_TEST_KEY` absent. The Node process then exited non-zero on a Windows libuv teardown assertion (`src\win\async.c`) after the server had closed; this is a harness/teardown artifact, not an application response failure, and is reported rather than hidden.

## Checks not run

- No Vercel project, CLI authentication, build, bundle inspection, or deployment. Function size, cold start, Linux query engine, and `includeFiles` expansion on the host are unverified.
- No database connection, query, migration, seed, reset, admin grant, or credential use.
- No Playwright/browser suite, workflow suite, or business tests; Task F verified only build output and safe HTTP delivery.
- No Task G production route-restriction work and no Task H dependency remediation.
- No public URL is claimed, and no hosting provider was changed.

## Limitations and pending host verification

- A successful local build is not a successful Vercel deployment.
- Prisma's engine and `sharp`'s native binary are platform-specific. They must be produced by Vercel's Linux install/build; the Windows trace cannot prove the host bundle contents.
- Vercel's 250 MB uncompressed Function limit was not measured for the real bundle. The local trace (41.6 MB) is only an indicator.
- `includeFiles` glob semantics are taken from Vercel's documentation and validated locally only as glob targets that exist; host expansion remains to be observed.

## External ownership requests

- **Deployment operator:** create/confirm the Vercel project with Root Directory `shoplabdemowebsite`, install `npm ci`, leave Output Directory blank, configure `DATABASE_URL`, `DIRECT_URL`, and `ORVILO_MFA_KEY` (never `ORVILO_TEST_KEY` or `SHOPLAB_STORAGE=legacy` in production), then confirm that `dist/`, `web/`, and the Linux Prisma engine are in the built Function and that the routes above respond.
- **Task G:** production restrictions for the legacy `/api` surface and guard tests.
- **Task H:** review and remediate the 3 high-severity dependency findings without breaking changes.

## Primary sources

- Vercel, [Configuring a Build](https://vercel.com/docs/builds/configure-a-build) — `vercel-build` for build outputs inside a Function.
- Vercel, [Static Configuration with vercel.json](https://vercel.com/docs/project-configuration/vercel-json) — `functions` / `includeFiles`.
- Vercel, [Advanced Node.js Usage](https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration) — including files in a Function.
- Vercel, [Vercel Functions Limits](https://vercel.com/docs/functions/limitations) — 250 MB uncompressed bundle limit.
- Vercel, [Using the Node.js Runtime](https://vercel.com/docs/functions/runtimes/node-js) — Node.js versions and dependency installation.
- Vercel, [How to ship an Express app on Vercel](https://vercel.com/kb/guide/ship-a-express-app-on-vercel) — single-Function Express pattern.

No deployment, milestone completion, or full release approval is claimed.
