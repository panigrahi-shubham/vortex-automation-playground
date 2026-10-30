# Round 3 integration review

Reviewed: 30 October 2026.

## Delivered versus pending

- Task F: build/install script changes and build documentation are present.
- Task G: production restriction changes, tests and report are now present and
  accepted within their scoped routing/security boundary.
- Task H: investigation and report are now present and accepted as an
  investigation; the dependency findings remain unresolved.

The current app no longer mounts the legacy router in production. Missing
DATABASE_URL or an explicit production legacy-storage request makes API requests
fail closed with sanitized 503 responses; liveness and static pages remain
available. Configured production retains v2 dispatch and blocks legacy business
routes. This review does not approve public release or resolve dependency risks.

## Task F corrections

The returned configuration used an array for `functions.api/index.js.includeFiles`.
The current official [Vercel schema](https://openapi.vercel.sh/vercel.json) requires
a string. Replaced it with the single brace-expanded glob
`{web,dist,node_modules/.prisma}/**`.

Corrected `docs/DEPLOYMENT_BUILD.md` to use the GitHub repository root as Vercel's
Root Directory. `git rev-parse --show-toplevel` confirms that the local
`shoplabdemowebsite` folder is itself the repository, not a nested project within
the remote repository. The original Task F report remains historical evidence;
its array/root-directory recommendations are superseded by these corrections.

## Fresh verification

- `npm run typecheck`: passed.
- `npm run vercel-build`: passed, including Prisma generation and TypeScript build.
- Built Express entry loaded successfully with dotenv reading disabled and dummy
  database configuration; no database query or listener was started.
- Retrieved the official Vercel JSON schema and confirmed the corrected
  includeFiles value matches its string type and length restriction.
- Node's built-in glob expansion matched files in all three required trees:
  30 web files, 28 compiled files and 19 generated Prisma files. The dispatcher
  module was included. This is local glob evidence, not host-side bundle proof.

The contributor's isolated clean-install evidence was reviewed but not repeated
here. No dependency was upgraded, live database queried, migration applied or
deployment started. Linux binary packaging and actual Vercel routing remain
host-side acceptance checks. Vercel deployment tools remain unavailable in the
main session.

## Next handoff

### Follow-up verification after G and H arrived

- `npm run typecheck`: passed.
- `npm run test:workflows`: 12 passed, including production-boundary tests that
  exercise both production indicators, denied legacy routes, recovery locks,
  configuration failures, development compatibility and header suppression.
- `npm run vercel-build`: passed with Prisma generation and TypeScript compilation.
- Legacy API regression: 71 passed in approximately 9 seconds against a newly
  created, disposable memory server on port 3107. Only that owned memory process
  was reset by test setup; it was stopped after verification.
- `npm audit --omit=dev --json`: exit 1, three high findings, zero critical.
  Fresh dependency inspection confirms Prisma 6.19.3 → @prisma/config 6.19.3 →
  deepmerge-ts 7.1.5. The
  [published advisory](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) confirms
  versions below 8.0.0 are affected. No remediation was applied or suppressed.

Task H's major-migration recommendation is not an implemented fix. A separate
Prisma migration and its database/runtime compatibility checks remain work; no
risk acceptance is implied by this review. The frontend's configuration-failure
fallback still needs a clear unavailable state rather than attempting legacy
calls. PostgreSQL business-flow checks and Linux/host packaging checks remain
pending. No full browser suite or live database test was repeated in this follow-up.

The corrected Task F glob remains intact. Vercel deployment tools are still
unavailable; the website has not been deployed by this session.
