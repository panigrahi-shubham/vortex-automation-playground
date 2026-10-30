# Vortex — deployment-focused parallel work, round 2

Date: 30 October 2026.
Working repository: `C:\Projects2\orvilo\shoplabdemowebsite`.

## Owner: give each AI one task

Send this file and say **“Implement Task D only”** or **“Implement Task E only.”**
Use different sessions or run them sequentially. These two tasks have separate
output files and can run alongside deployment preparation. Neither task is a
prerequisite for the first deployment; do not delay fixing hosting blockers to
expand their scope. Bring changed/new files and result reports back for review.

This round deliberately delegates two bounded tasks. The main developer owns
dependency fixes, clean-install/build verification, Vercel configuration,
environment secrets, database migration decisions, public test-control locks,
deployment and the PostgreSQL/deployed smoke checks.

This is website work. Do not build the Android APK, a recorder or the owner's
personal hybrid automation framework. The owner will build that framework
independently without AI assistance.

## Common constraints

- Read the current master plan, `docs/SETUP.md`,
  `docs/AUTOMATION_COMPATIBILITY.md` and
  `docs/handoffs/INTEGRATION_REVIEW.md` before editing.
- Preserve the current Express/Prisma/PostgreSQL/modular-JavaScript architecture.
  Do not replace it or introduce a frontend framework.
- Work from the current checkout, not an old GitHub clone. Much of the application
  remains uncommitted/untracked. A fresh worktree from HEAD can omit that work.
  Use a current local snapshot if working separately; exclude `.env`, credentials,
  installed dependencies, generated output and test reports from material shared
  with an external AI.
- Never read/print real `.env`, request production credentials, mutate a live
  database, seed/reset data, grant roles, deploy, push or discard existing changes.
- Never change database/schema/package identity, env names, session/storage keys,
  API paths, current selectors, backend behavior or public test-control policy.
- Do not edit `package.json`, lockfiles, `prisma/`, `src/`, `server/`, `api/`,
  `vercel.json`, build/CI config, existing frontend views or the master plan.
- Only edit the files owned by your selected task. Report cross-file requests
  rather than modifying another task's files.
- Existing `/api/v2` PostgreSQL behavior differs from legacy `/api`. Do not blend
  their contracts or advertise planned features as available.
- The 30 October review recorded passing type checks and 213 passing legacy
  Playwright tests, with one visual test skipped. That is dated context, not your
  own verification and not evidence of a deployed site or Android coverage.
- Keep implementation scoped. No new dependencies, generated SDK, broad formatter
  changes, full-site redesign or automation-framework generation.

## Task D — Core PostgreSQL API contract

### Deliverable and ownership

Create only:

- `docs/api/openapi.core.v0.1.json`.
- `docs/api/README.md`.
- `docs/handoffs/TASK_D_RESULT.md`.

### Work

Create a **partial, source-backed OpenAPI 3.0.3 JSON contract** for exactly these
ten current operations. Set the server base to `/api/v2`; paths below are relative:

1. `POST /register`.
2. `POST /login`.
3. `GET /me`.
4. `POST /logout`.
5. `GET /categories`.
6. `GET /products`.
7. `GET /products/{id}`.
8. `GET /cart`.
9. `GET /orders`.
10. `GET /orders/{id}`.

Inspect current routes, service/serialization functions, session middleware and
relevant tests. Auth is the application's own session mechanism, not Supabase
Auth. Determine the actual Authorization scheme from middleware. Distinguish
successful login from an MFA challenge; never imply the challenge token is an
authenticated session. The MFA verification operations themselves remain outside
this contract's initial scope.

For each operation:

- Specify actual parameters, validation constraints, request body, authentication,
  response status/content/schema and meaningful known error cases.
- Follow wire serialization, not raw Prisma types. Respect nullable values,
  numeric representations, pagination and nested envelopes.
- Add unique operationIds, descriptions and source references using `x-source`.
- Use fictitious examples only; no real credentials, tokens, customer records or
  guessed stable PostgreSQL IDs.
- Make optional/required security accurate for each operation. Do not claim
  statuses, schema fields or rate-limit guarantees that source does not establish.
- Do not change code to make it match your preferred contract. Record current
  inconsistencies and limitations instead.

The README must clearly call this a partial core contract, list included/excluded
operations and explain how an API client can use the server base. Checkout,
mutating cart operations, cancellation, admin, MFA, recovery and legacy APIs are
not documented as complete by this file. Do not generate client code or framework
examples; those belong to later work/the owner's own framework.

### Acceptance and verification

- JSON parses; all local `$ref` values resolve; operationIds are unique; all
  declared path parameters are required and accounted for; referenced security
  schemes exist.
- Compare every operation with the source and cite evidence. JSON parsing alone
  is not OpenAPI conformance or runtime verification.
- Use an existing installed specification validator if available without changing
  dependencies; otherwise explicitly report that full conformance validation was
  not run. Include a dependency-free consistency check command in the README.
- No database, browser suite or live endpoint mutation is required for this task.
- Report discrepancies rather than inventing successful response examples.

## Task E — Tester-facing guide page

### Deliverable and ownership

Create only:

- `web/pages/testing-guide.html`.
- `docs/TESTING_GUIDE_PAGE.md`.
- `docs/handoffs/TASK_E_RESULT.md`.

### Work

Implement a useful static guide at **`/pages/testing-guide.html`**. The existing
static middleware serves this path; do not add an SPA route or alter rewrites.
No navigation changes outside this page: request a main-navigation link separately
in your result if useful. This page can ship independently of Task D.

Use the existing local fonts and CSS paths, Vortex identity and accessible HTML.
Prefer semantic markup and existing styles, with page-scoped inline CSS only as
needed. Do not add a package, remote asset, tracking script or external AI service.

Include:

- A short explanation of the website as a browser/API testing target.
- Six concise journeys: sign up/sign in, catalog filtering, wishlist/cart,
  checkout/order detail, cancellation and UI Lab exploration.
- Real links to current application routes. Require an existing account for
  protected journeys; do not present a signed-in user state as guaranteed.
- A clear distinction between current PostgreSQL and legacy capabilities.
  Authenticator MFA, legacy email OTP, recovery availability, payment and test
  controls must not be conflated.
- Honest notices: planned test-run reset and runtime Normal/Practice/Defect Lab
  controls are not yet operational; no real payment or email delivery is required.
- Practical observable outcomes, known limitations and a manual results checklist.
  Do not write the owner's framework, assertions library or Appium code.
- Explain that the Android app will be a separate API client; the deployed
  website does not imply an APK or verified Appium coverage.

Do not hard-code a deployment hostname, credentials, generated record IDs, a
database URL or private test keys. Do not link to repository `docs/` paths as if
they are publicly served. Do not add a global reset button, API mutation, login
form, invented user persona or new backend capability.

The companion Markdown file should document the public path, content sources,
manual acceptance checklist and any limitation. It must distinguish current
features from future work. The guide is informational; it does not certify that
all journeys have passed on a future deployment.

### Acceptance and verification

- Inspect at 1440-pixel and 412-pixel widths: readable layout, keyboard navigation,
  visible focus and no horizontal overflow. Support reduced motion and both
  existing themes where applicable.
- Verify same-origin destination routes against the router/source. Avoid dead
  placeholder links and links that expose privileged operator functions.
- If a local server is available, perform only safe page reads and take temporary
  screenshots. Do not start competing processes on an occupied port or reset the
  server. Clearly record if browser checks could not run.
- Inline JavaScript is unnecessary. If introduced, justify it and verify that
  untrusted input cannot become HTML; do not fetch privileged information.

## Completion report required from each AI

Write your task's result file with:

1. Task ID and actual outcome.
2. Every changed/new file.
3. Verification commands/checks and exact results.
4. Limitations, unresolved questions and checks not run.
5. Any requested change outside your file ownership.

Keep reports free of credentials and generated authentication material. Do not
claim the deployment or milestone is complete. Return new files explicitly:
plain `git diff` does not include untracked files. Do not stage the whole checkout.

## Integration rule for the main developer

Review and validate returned files once before adding them to a release snapshot.
Do not integrate a partially edited task into an active deployment. Deploy the
reviewed core website first if these additions are not ready. Keep existing API
and database behavior stable for tomorrow's independent framework development.
