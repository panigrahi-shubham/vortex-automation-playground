# Release preparation — 30 October 2026

Status: application prepared and locally verified; publishing was approved by the
user. A corrected staging build is now READY in the personal Vercel account, Node
24.x, Mumbai region. Workspace authorization is blocking protected-preview access
and deployed application checks. See [Deployment Status](DEPLOYMENT_STATUS.md).

## Changes

- Upgraded Prisma, Prisma Client and the PostgreSQL adapter to exactly 7.10.1;
  pinned pg 8.23.1. No overrides, suppressed advisories or prerelease upgrade.
- Retained the supported `prisma-client-js` generator and CommonJS imports for
  this release. Moving to the newer generator is separate maintenance work.
- Moved CLI connection configuration to `prisma.config.ts`, using DIRECT_URL
  ahead of DATABASE_URL. No model/table changes or new migrations were introduced.
- Shared runtime/operator client factory explicitly selects the private schema,
  connection limits/timeouts and verified TLS. The published Supabase root CA is
  bundled for Supabase database hosts; rejectUnauthorized remains true and Node
  retains hostname verification. The certificate is public, not a credential.
- Updated transaction retry handling for nested Prisma 7 SQLSTATEs and direct
  adapter transaction-write conflicts. Retries remain bounded and apply only to
  transactions that may safely repeat; unrelated SQL errors are not retried.
- Configuration HTTP failures, invalid responses and network errors now display
  a clear unavailable screen. The browser does not silently issue legacy API
  calls. A retry button reloads and can recover.
- Production legacy restrictions from Task G remain intact.

## Actual verification

- Clean isolated snapshot: npm ci, vercel-build and typecheck passed with no real
  .env file or database connection. Install audit reported zero vulnerabilities.
- Working checkout build, typecheck and Prisma schema validation: passed.
- Ten production HTTP checks against the clean built snapshot passed using real
  routers and nonconnecting dummy configuration: health/config, rejected legacy
  routes, unauthorized v2 access, invalid pagination, recovery/test locks and the
  static guide. No database query was needed for these checks.
- Non-database workflow/boundary/retry checks: 17 passed.
- Database integration: final parallel run, 12 passed.
- Pricing checks: 2 passed. Storefront adapter check: 1 passed.
- Complete legacy Playwright suite: 216 passed, 1 existing opt-in visual test
  skipped. The three new runtime outage/recovery tests are included in that count.
- PostgreSQL browser smoke: all checks passed, including registration, wishlist,
  variants, reviews, coupon/shipping, checkout, order/invoice/cancellation,
  profile/settings/avatar, password/recovery, MFA and admin product lifecycle.
  Its own disposable account and records were cleaned up.
- Fresh production-filtered npm audit: zero findings at all severities.

Initial migration checks exposed the untrusted Supabase certificate chain and
changed adapter error shapes. Those failures were fixed, not ignored. Concurrent
database tests then exposed direct adapter conflicts and retry exhaustion; the
retry handling/backoff was corrected and the final full database run passed.
The browser smoke passed after the driver/TLS upgrade; the final retry-path
change was verified by focused fault injection and the parallel database run.

The database checks use the existing development database and disposable fixtures.
They are not proof of isolated per-test workspaces, sustained load capacity or
deployed-host correctness. Expected-failure legacy bug exercises remain intentional.

## Source snapshot and remaining steps

See [RELEASE_SNAPSHOT.md](RELEASE_SNAPSHOT.md) for the exact 142-file snapshot and
its manifest digest. Real environment files, local backups, installed/generated
files, design references and unrelated scripts are excluded. Environment settings
must be transferred separately as encrypted values, with no ORVILO_TEST_KEY or
legacy storage in the deployment.

The approved snapshot has been uploaded and a staging build completed. Vercel
required the build-only outputDirectory=web correction, recorded in the snapshot
manifest. Inspect runtime behavior and production restrictions once authorized
preview access works. Promote only after deployed checks pass. Host build success
does not certify database access, browser journeys or a public production release.

## References

- [Prisma 7 upgrade guide](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7)
- [Prisma PostgreSQL adapter/schema configuration](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql)
- [Supabase TLS guidance](https://supabase.com/docs/guides/platform/ssl-enforcement)
- [Public CA download](https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt)

Bundled CA SHA-256 fingerprint:
`80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`.
