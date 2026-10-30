# Vortex — round 3: remove deployment blockers

Date: 30 October 2026.
Current checkout: `C:\Projects2\orvilo\shoplabdemowebsite`.

## Owner: dispatch instructions

Give this file to another AI and say:

> Complete Task F only. Inspect the current checkout, implement the bounded fix,
> verify it, and write the required report. Do not stop at a plan or deploy.

Then use **Task G only** and **Task H only** for subsequent sessions. Prefer F → G
→ H when using one checkout. Separate copies can work concurrently within their
ownership boundaries, but clean installs must not replace another session's active
dependencies. Return all new/changed files and reports for integration review.

These tasks prepare a release; they do not claim a deployment. No Vercel deployment
tools were available in the main session as of this handoff. Another AI must not
invent a public URL, assume authentication, or replace Vercel with another host.

Do not outsource new seller, messaging, Android or recorder features now. Keep the
website's existing journeys stable so the owner can start independent framework
development tomorrow. Do not write that personal automation framework.

## Common rules

- Read `docs/SETUP.md`, the current master plan and both integration reviews under
  `docs/handoffs/`. Older reports are historical evidence, not today's test results.
- Use the current working files. Significant `src/`, `web/`, `prisma/` and `docs/`
  content is untracked/uncommitted; a clone/worktree from HEAD can omit it.
- Preserve Express, Prisma 6, PostgreSQL, modular frontend JavaScript, existing
  migrations, API paths, database/schema/package names, storage keys and selectors.
- Never read or print real `.env` or existing credentials. Use placeholders and
  nonconnecting dummy URLs for build-only verification when configuration requires
  them. Do not copy real secrets to a temporary checkout, report or remote service.
- No live database writes, migration/seed/reset commands, admin grants, deployments,
  pushes, destructive Git operations or broad formatting changes.
- Only modify the selected task's owned files. Report other required changes.
- Do not introduce a framework rewrite, real payment/email delivery, global reset
  UI, generated SDK or the owner's hybrid automation framework.
- Never use `npm audit fix --force`. Do not downgrade, suppress or mark a check
  passed simply to make a report green.
- Default acceptance evidence is local/static or a disposable process. No tests
  against shared/public infrastructure. Never reuse an unknown server for resets.

## Task F — Verify and fix the Vercel release build

### Ownership

You may edit only:

- `package.json` — build/install/deployment scripts or a justified runtime bound;
  preserve dependency versions and package name.
- `package-lock.json` — only corresponding root metadata if necessary; no package
  upgrades or general lockfile regeneration.
- `vercel.json`.
- `api/index.js`.
- `tsconfig.build.json` — only if the build requires it.
- `scripts/check-release-build.cjs` — optional new local verification helper.
- `docs/DEPLOYMENT_BUILD.md`.
- `docs/handoffs/TASK_F_RESULT.md`.

Do not modify `src/app.js`, guards, backend modules, Prisma schema/migrations,
business tests, static pages or environment files. Task G owns production routing.

### Work

1. Inspect the current function entry, imports and build outputs. The function
   exports `src/app.js`, whose PostgreSQL routers load compiled `dist/` modules;
   `dist/` is ignored. `npm start` has a prestart build, but that alone is not proof
   that a hosting function build will compile/package those modules.
2. Verify the current Vercel Express/function build requirements against official
   documentation. Use primary sources and cite the pages inspected; do not assume
   every older `vercel.json` setting is still the preferred configuration.
3. Implement the smallest supported build/package fix. Ensure Prisma client
   generation and TypeScript compilation happen at the appropriate build stage,
   and required static assets and compiled modules reach the function bundle.
   Never connect to PostgreSQL or run migrations during the build.
4. Preserve SPA deep links, `/api/v2` routing, standalone lab documents, fonts,
   static assets and `/pages/testing-guide.html`. Do not rewrite the application.
5. Verify a clean installation/build in an isolated temporary snapshot containing
   the current working source and lockfile, excluding `.env`, dependencies, Git
   internals and generated/test artifacts. Do not run `npm ci` in another active
   session's working tree or discard the owner's files.
6. Check the exported Express entry loads with the built files. If a local host
   is needed, use an unused port, a disposable process and nonconnecting dummy
   database configuration. Perform only requests that cannot touch the database.
   Stop only processes created by your task.
7. Record the required Vercel build settings, environment-variable names and
   unresolved bundle assumptions. A successful local build is not a successful
   Vercel deployment. If bundling cannot be inspected without a connected host,
   explicitly leave that verification pending rather than guessing.

### Acceptance

- Clean install, Prisma generation, build and type checks pass in the isolated
  snapshot, or an actual blocker is precisely reported.
- Required compiled files and web assets exist; no secret or `.env` is included.
- No schema migration, database connection, dependency upgrade or application
  behavior change was needed for this build task.
- Any Vercel-specific configuration is justified by current official documentation.
- No deployment is claimed; public-host packaging must still be verified there.

## Task G — Restrict production legacy APIs and verify guards

### Ownership

You may edit only:

- `src/app.js` — production/configuration gating and router mounting only.
- `src/test-hooks/guard.js`.
- `tests/workflows/production-boundaries.test.js` — new focused tests.
- `docs/PRODUCTION_BOUNDARIES.md`.
- `docs/handoffs/TASK_G_RESULT.md`.

Do not modify auth/business modules, package scripts, Prisma files, environment
files, Vercel configuration or frontend code. Report UI mode-gating gaps separately.

### Work

1. Inspect existing production detection and guards before changing anything.
   Current production locking checks `NODE_ENV=production` OR
   `VERCEL_ENV=production`. It hides legacy reset/chaos/test paths and strips chaos
   headers, but do not assume that this also disables legacy business mutations.
2. The production release must use the PostgreSQL application. Make production
   configuration fail closed when `DATABASE_URL` is missing or legacy storage is
   explicitly requested, with a clear sanitized error and no secret values.
   Preserve local development/reference memory behavior.
3. Prevent public production access to the legacy memory business API and its
   seeded users/admins. Keep a safe non-mutating health response if required by
   local/hosting checks. Preserve legitimate `/api/v2` routes and `/api/config`.
   Ensure route order does not accidentally block v2 or make old mutations fall
   through to another handler.
4. Test recovery/test inbox production rejection and chaos-header suppression
   without changing MFA keys, enabling recovery in production or weakening auth.
   Source inspection alone is insufficient to claim that a request is blocked.
5. Use disposable local processes/request fixtures. Tests must not load the real
   `.env`, connect to the real database, reset an existing server or rely on fixed
   occupied ports. `src/app.js` currently loads dotenv from its own project path:
   prevent that loader from reading the real file using an explicit safe stub or
   an isolated source snapshot without `.env`. Merely changing the process working
   directory is insufficient. Use safe database-route factory stubs if needed.
6. Cover both production indicators independently, normal development behavior,
   missing/legacy production configuration, forbidden legacy routes, allowed v2
   dispatch and the safe health/config contract. Show that denied requests never
   reach a state-changing handler. Avoid tests that only assert a helper's name.
7. Document which legacy-dependent UI Lab exercises are unavailable in production
   and which static/browser-only exercises remain. Do not pretend a whole lab is
   verified simply because its route returns HTML. Identify frontend requests that
   should later be hidden/disabled; do not broaden this task into a redesign.

### Acceptance

- Focused new production-boundary tests and existing non-database workflow tests
  pass. Run type checks; run existing legacy API checks only in an isolated memory
  process if justified by your changes. Never aim them at a shared deployment.
- Production cannot silently become an in-memory demo with known seeded admins.
- Database application routing, development reference mode and static documents
  are preserved. No unauthenticated bypass, new secret or public reset is added.
- Reports distinguish tested request behavior, source-only assessment and any
  pending deployed-environment verification.

## Task H — Investigate the remaining dependency findings

### Ownership

Create only:

- `docs/DEPENDENCY_REMEDIATION.md`.
- `docs/handoffs/TASK_H_RESULT.md`.

This is a bounded investigation. Do not edit installed dependencies, manifests,
lockfiles, Prisma configuration or application code.

### Work

1. Run a fresh read-only `npm audit --json` and `npm audit --omit=dev --json`.
   Nonzero audit exit status is expected when findings exist; record it accurately.
2. Trace the actual installed dependency paths with the available npm inspection
   commands. Do not assume Prisma-related findings disappear just because the CLI
   is declared a dev dependency.
3. Verify current advisories and patched versions from official package/advisory
   sources. Earlier evidence identified `prisma` → `@prisma/config` →
   `deepmerge-ts`, with a suggested major Prisma upgrade. Recheck rather than
   assuming those findings or fixes are unchanged.
4. Explain affected usage, realistic exposure, build/runtime distinction and what
   remains uncertain. Do not label an advisory harmless or exploitable without
   evidence.
5. Identify a supported minimal remediation if available. A transitive major
   override must not be recommended merely because it silences audit; establish
   API compatibility first. If a Prisma major migration is needed, list the code,
   configuration, driver/runtime and verification consequences without applying it.
6. End with a concrete recommendation: immediately compatible fix, justified
   migration task, or explicit unresolved risk for release review. No automatic
   risk acceptance or hidden suppression.

### Acceptance

- Fresh findings, dependency paths, primary-source links and exact recommended
  versions are provided with a clear distinction between evidence and inference.
- No install, forced fix, lockfile change, credential access or database activity.
- The report states that dependency investigation alone does not resolve a finding
  or approve public deployment.

## Completion report — all tasks

Provide the task ID, exact files changed, implementation summary, commands and
actual results, checks not run, known limitations and any change requested outside
ownership. Cite current primary sources for hosting/dependency claims.

Do not claim the entire milestone or deployment complete. Do not stage/commit the
whole checkout. Return newly created files explicitly; `git diff` alone omits them.

## Main developer integration sequence

1. Review F and G together for build/runtime compatibility; assess H's findings.
2. Verify build/type checks and relevant tests once against the combined result.
3. Check PostgreSQL business journeys against the intended development database.
4. Configure hosting and secrets through authorized account tools, without exposing
   credentials. Review the exact release snapshot before publishing because the
   current application contains substantial uncommitted work.
5. Deploy only the reviewed snapshot when the hosting connection is available.
6. Verify the real URL, protected controls, static guide, assets, registration,
   login, cart, checkout, orders and cancellation. Record actual failures/skips.

If a deployment step cannot run, report the missing capability. A ready-looking
configuration file and local tests are not evidence that the website is live.
