# Vortex website — tasks for another AI

Prepared: 30 October 2026.
Repository: `C:\Projects2\orvilo\shoplabdemowebsite`.

## Owner: how to use this file

Give another AI this entire file and say:

> Complete Task A only. Read the common instructions, inspect the current files,
> implement the changes and return the completion report. Do not just propose a plan.

Use the same instruction with **Task B** or **Task C** for another session. If you
use one AI, run A, B and C sequentially. These tasks have different output files
and can run concurrently in separate working copies. Do not ask every AI to finish
the entire master plan. Bring their changed files and completion reports back to
the main development chat for integration.

**Important checkout detail:** this working tree already contains substantial
uncommitted work, including untracked `src/`, `web/`, `prisma/` and `docs/` files.
A fresh GitHub clone or worktree created from HEAD will not include all of it.
Use the current working files or a local snapshot that includes those files.
Exclude `.env`, credentials, `node_modules/`, generated build output and test
reports from anything shared with an external AI. Do not upload the entire folder
without checking what is included. An external AI can work from `.env.example`;
these three tasks do not require database credentials.

Aim for these reviewable deliverables today. Completing these tasks does **not**
complete all eight milestones, production deployment, seller/RFQ workflows,
isolated database fixtures or durable jobs. Report completed work by acceptance
checks, not a claimed percentage or a promised deadline.

## Common instructions for the implementing AI

1. Work on the existing website. Preserve Express, Prisma/PostgreSQL and the
   modular vanilla JavaScript frontend. Do not scaffold a replacement application.
2. Read `docs/VORTEX_AUTOMATION_PLAYGROUND_MASTER_PLAN.md` first; it is the current
   plan. Read `docs/AUTOMATION_COMPATIBILITY.md` and `docs/BASELINE_VALIDATION.md`
   where relevant. Older specs and early MIGRATION entries can be superseded.
3. Only implement the selected task. Read files outside its ownership if needed,
   but do not edit them. Report necessary cross-task changes to the main developer.
4. Preserve database/schema names, package identity, environment variables,
   API paths, test-control headers, localStorage/sessionStorage keys, fixture
   identifiers and existing `data-testid` values. Visible branding can change.
5. Do not read or print `.env`, request credentials, change live database data,
   reset databases, grant roles, deploy, push or force-reset the checkout.
6. Do not edit package manifests/lockfiles, Prisma migrations, backend behavior,
   CI configuration or the master plan. The main developer owns those changes.
7. Vortex Web Recorder, Android app and Android Recorder are separate projects.
   Do not build them here. Responsive mobile-browser support remains in scope.
8. Inspect current code before claiming a feature exists. Distinguish PostgreSQL
   `/api/v2` behavior from legacy in-memory `/api` behavior. Storage selection
   does not implement Normal / Practice / Defect Lab modes.
9. Use source-based assertions and actual command results. Do not invent passing
   tests, screenshot approval, performance figures or completed milestones.
10. Keep changes focused. Do not bulk-format unrelated files, disable tests, lower
    assertions or add dependencies just to complete these tasks.

### Current baseline — context, not your own verification

On 29 October the final local run recorded 213 Playwright tests passed, 1 visual
test skipped; type checking and 18 focused unit/adapter/database tests passed.
The Playwright suite runs the legacy backend; database tests are separate.
Seeded-defect tests intentionally expect failures. Do not describe them as fixed.
Three high-severity audit entries in the Prisma dependency chain remain open;
dependency remediation belongs to the main developer.

## Task A — Finish visible Vortex branding

### Outcome

The website consistently presents **VORTEX**, subtitle **AUTOMATION PLAYGROUND**,
and tagline **Built to Break. Designed to Test.** Keep the existing store and lab
functional. This task changes identity, not the site's technology or business logic.

### Files you own

- `web/index.html`.
- `web/js/app.js` and `web/js/core.js`: branding/title text only.
- `web/js/views/auth.js`, `mailbox.js`, `lab.js`: visible branding text only.
- `web/pages/bank-3ds.html`, `popup.html`, `terms.html`.
- `web/css/orvilo.css`: narrowly scoped branding layout rules only.
- `tests/e2e/catalog.spec.ts`, `tests/e2e/lab.spec.ts`: update assertions only
  where the intentional branding change changes the expected title/dialog text.
- `docs/handoffs/TASK_A_RESULT.md`: your completion report.

### Work

1. Inspect titles, metadata, header, footer, sign-in/register copy, terms, popup,
   simulated bank confirmation and lab dialogs/accessibility labels.
2. Replace visible Orvilo branding with Vortex. Use a compact header wordmark and
   place the full subtitle/tagline where they fit. Update the inline favicon mark
   to match using the existing SVG approach; no generated image dependency.
3. Preserve internal names such as `orvilo.css`, `shoplab.*` storage keys,
   `x-shoplab-*` headers, `ORVILO_*` variables and demo account/email identifiers.
   Do not run a global search-and-replace across the repository.
4. Retain the recent API docs wrapping and cookie banner overflow fixes.
5. Update existing text assertions that legitimately change with the branding.
   Keep download shapes, event behavior and business assertions intact.

### Acceptance

- Changed titles, dialogs and visible identity are consistent; no unrelated
  behavior or selector changes.
- Inspect desktop and a 412-pixel mobile viewport, including signed-out header,
  docs and cookie banner; no horizontal scrolling or overlapping controls.
- Run `npm run typecheck` and `npx playwright test --project=chromium --project=mobile`.
  Let Playwright manage its local server; if port 3000 is already occupied by a
  database-mode server, coordinate with the owner before running legacy tests.
- Record actual results, skipped coverage and any unavailable browser checks.

## Task B — Correct setup docs and inventory all design references

### Outcome

A new developer can understand how the current site runs, and the team has a
source-backed list of implemented, partial and missing reference screens.

### Files you own

- `README.md`.
- `docs/SETUP.md`.
- `docs/PAGE_DESIGN_INVENTORY.md`.
- `docs/handoffs/TASK_B_RESULT.md`.

Do not modify reference designs, screenshots, `.env.example`, implementation files
or historical specifications. These are input material.

### Work

1. Read `package.json`, `.env.example`, `server.js`, `src/app.js`, storage/config
   code, frontend route definitions and current modules. Never read real `.env`.
2. Replace misleading README claims such as “no database, no build step” with
   accurate primary PostgreSQL setup and a clearly separate legacy reference mode.
3. Document supported runtime, `npm ci`, browser installation, build/type checks,
   local startup and the existing migration/seed/check commands. Explain what each
   command changes; document them without executing migrations or seeds.
4. Explain DATABASE_URL versus DIRECT_URL, URL-encoded password placeholders,
   stable MFA encryption-key management and development-only test keys using
   `.env.example`. Never embed a real connection string or create a new secret.
5. Recursively inspect `design/`, including nested folders. Inspect the sibling
   `C:\Projects2\orvilo\Orvilo-design-screens` if it exists. Compare duplicate
   references rather than double-counting them; link exact relative filenames.
6. For each distinct screen/reference, record its purpose, corresponding route,
   source files, PostgreSQL versus legacy support, implemented/partial/missing
   status, visible gaps and verification still needed. Do not declare visual parity
   from a matching filename or an existing route. Flag inaccessible image previews.
7. Link the current master plan and baseline report. Keep old test results dated;
   they are historical evidence, not verification of today's checkout.

### Acceptance

- Every design folder, including nested folders, is accounted for with a stated
  inventory method and exact reference paths.
- Every documented script/route/environment name exists in current source.
- Mode limitations and incomplete pages are explicit. No credentials or claims
  that all eight milestones are finished.
- Check relative documentation links. This is documentation-only work; do not
  run a full test suite or access the live database just to write it.

## Task C — Create a source-backed automation scenario catalog

### Outcome

Create a small, useful catalog another automation tool or tester can consume,
using journeys that already exist. This prepares the compatibility contract
without implementing a recorder or pretending future controls are operational.

### Files you own

- `docs/scenarios/catalog.v0.1.json`.
- `docs/scenarios/README.md`.
- `docs/scenarios/REFERENCE_JOURNEYS.md`.
- `docs/handoffs/TASK_C_RESULT.md`.

This task does not change the UI, API, tests, runtime modes or reset infrastructure.

### Work

1. Read the automation compatibility contract and existing browser/API tests.
   Create 8–12 scenarios for implemented journeys, including login, access denial,
   catalog filtering, cart/checkout, order cancellation, dialogs, nested frames
   and shadow DOM. Reuse scenario IDs already proposed by the contract where they fit.
2. For each entry provide: scenarioId, scenarioVersion, title, difficulty,
   implementationStatus, supportedStorageModes, route, prerequisites, ordered
   steps, actual selectors, expected observable results, cleanup/reset availability,
   source references and known limitations.
3. Explain that proposed Normal/Practice/Defect Lab labels are target concepts;
   current storage modes are a separate field. Do not mark a runtime mode selector
   or scoped reset API as available when it does not exist.
4. Prefer stable test IDs and roles/labels; document deliberately unstable lab
   locators separately. Preserve intentionally difficult exercises.
5. Explicitly distinguish email OTP in legacy mode from authenticator MFA in
   PostgreSQL mode, and legacy global reset from future isolated resets. Do not
   instruct external testers to reset a shared/public instance.
6. Write three concise, reproducible walkthroughs: a customer business journey,
   nested frames and shadow DOM. Use actual selectors from source, fixture lookup
   guidance and observable assertions. Avoid hard-coded PostgreSQL product IDs,
   user credentials and dependency on another Vortex project.

### Acceptance

- JSON parses, scenario IDs are unique and required fields are consistent.
- Every selector, route and assertion is supported by a cited current source/test.
- Planned behavior is clearly labeled; no fake endpoint, fixture version or claim
  of a successful execution. Catalog version 0.1 does not imply versioned DB fixtures.
- Include an inexpensive validation command using Node's built-in JSON parser;
  no dependencies or package-script changes. Full browser tests are unnecessary
  for this metadata-only task unless separately authorized by the owner.

## Required completion report for each task

Write the task's result file and include:

1. Task ID and a short outcome.
2. Exact changed/new files and why they changed.
3. Verification commands and their actual results; list anything not run.
4. Known limitations and remaining work.
5. Any requested changes outside your ownership, without editing those files.

Do not mark the overall milestone complete. Do not commit or stage the whole
working tree. If returning a patch from a separate copy, include new files as well
as tracked changes: a plain `git diff` omits untracked files.

## Main developer: integrate after handoff

- Review ownership, preserve existing uncommitted work and resolve any overlap.
- Confirm no secrets, internal renames, disabled assertions or invented features.
- Run focused checks for changes, then one combined regression run rather than
  making every documentation worker repeat the full suite.
- Verify PostgreSQL browser behavior separately; legacy suite success does not
  prove it. Database smoke tests must use the intended development environment.
- Own dependency remediation, clean-install verification, error conventions,
  scoped fixtures, backend workflows, production configuration and release checks.
- Update milestone status from actual integrated results. Do not treat task
  reports alone as proof that the whole website is ready to release.
