# Website baseline validation

Executed locally on 29 October 2026 against this working checkout. Runtime:
Windows, Node.js 24.15.0, npm 11.12.1. These results do not certify a deployed
environment, design parity or completion of Milestone 1.

## Fresh results

- `npm run typecheck`: passed.
- `npm run test:workflows`: 3 passed.
- `npm run test:pricing`: build passed; 2 tests passed.
- `npm run test:storefront-adapter`: 1 passed.
- `npm run test:db`: build passed; 12 database integration tests passed.
- `npm test`: final full run exited successfully; **213 passed, 1 skipped**
  across 214 scheduled tests, taking approximately 1.7 minutes.

The Playwright suite uses the legacy memory backend, desktop Chromium and the
Pixel 7 browser profile. Its seeded-defect exercises intentionally expect
failures; their successful classification does not mean those defects were fixed.
The visual snapshot exercise is skipped unless `VISUAL=1` is configured. This run
does not establish visual regression coverage or equivalence between storage modes.
PostgreSQL behavior was checked separately by the 12 database integration tests;
the separate database browser smoke command was not rerun in this review.

## Failure found and corrected

The first full run reported 207 passed, 1 failed, 1 skipped and 5 not run because
the global-state project depends on the other projects. Mobile `/docs` overflowed
the viewport by 6 pixels. Inspection after fonts loaded identified long unbroken
API-description values. A fresh visitor's cookie banner could also overflow.

The docs content now has a scoped wrapper and wrapping rules for endpoint text
and tables. The cookie banner is bounded to the viewport with 16-pixel side
clearance. Horizontal overflow was corrected through layout and wrapping rules.
The targeted mobile test passed, the independent five-test global-state rerun
passed, and then the full suite passed as reported above. A manual Playwright
measurement with an undismissed cookie banner and loaded fonts confirmed a
412-pixel viewport and 412-pixel document width on `/docs`.

## Remaining Milestone 1 work

- Apply visible Vortex branding and reconcile setup documentation with the
  current PostgreSQL application and legacy reference mode.
- Complete the page/design inventory and configuration/error-contract review.
- Verify a clean install separately; this validation used existing dependencies.
- Resolve the dependency audit findings and rerun relevant checks after changes.

`npm audit --omit=dev --json` returned three high-severity findings in the
`prisma` → `@prisma/config` → `deepmerge-ts` dependency chain, including
GHSA-ggr8-5vv4-36mx. The audit suggested Prisma 7.10.1 as a major-version fix.
Despite the CLI's declaration as a development dependency, these entries appeared
in the production-filtered audit and remain unresolved. No forced upgrade was
performed during this baseline review.

Performance budgets, durable background-job validation and deployment checks are
future acceptance work described in [Operational Validation](OPERATIONAL_VALIDATION.md).
No performance or release-readiness claims follow from these functional results.
