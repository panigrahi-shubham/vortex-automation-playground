# Task H result — dependency findings investigation

Task ID: **H**  
Date: 30 October 2026  
Outcome: **investigation complete; findings unresolved; no remediation applied; no deployment performed or claimed**

The fresh audit still reports three high-severity findings in the Prisma CLI/config chain. The vulnerable package is loaded during build-time Prisma config discovery but is not used by the running HTTP client. There is no supported non-major fix in Prisma 6.19.3; the fixed stable line is Prisma 7.10.1, which requires a major migration. This task documents the evidence and recommends that migration as a separate change. It does not resolve the finding, clean the audit, or approve the release.

## Files changed

1. [`docs/DEPENDENCY_REMEDIATION.md`](../DEPENDENCY_REMEDIATION.md) — full investigation: audit results, dependency path, advisory, build/runtime exposure, rejected override, Prisma 7 consequences, recommendation and limitations.
2. This report.

Nothing else was created or modified. Installed dependencies, [`package.json`](../../package.json), `package-lock.json`, [`prisma/schema.prisma`](../../prisma/schema.prisma), Prisma configuration, application code, tests and deployment configuration are unchanged.

## Commands and results

All commands were read-only. No install, audit fix, override, lockfile write, Prisma command, credential access or database connection was performed.

| Command | Result |
| --- | --- |
| `npm audit --json` | exit 1; 3 high, 0 critical; fix offered `prisma@7.10.1` (`isSemVerMajor: true`) |
| `npm audit --omit=dev --json` | exit 1; identical 3 high findings and counts (119 prod, 19 dev, 29 optional, 165 total) |
| `npm ls prisma @prisma/client @prisma/config deepmerge-ts --all` | `@prisma/client@6.19.3 → prisma@6.19.3 → @prisma/config@6.19.3 → deepmerge-ts@7.1.5` |
| `npm ls --omit=dev prisma @prisma/config deepmerge-ts` | same chain survives production filtering |
| `package-lock.json` inspection | `prisma`, `@prisma/client`, `@prisma/config`, `deepmerge-ts` have no `dev: true` flag; control dev dependency `@playwright/test` does |
| `npm view prisma dist-tags` | `latest = 8.0.0-rc.28` (prerelease), `prev = 7.10.1` |
| `npm view @prisma/client dist-tags.latest` | `7.10.1` |
| `npm view prisma@7.10.1 engines` | `^20.19 \|\| ^22.12 \|\| >=24.0` |
| `npm view @prisma/config@7.10.1 dependencies` | includes `deepmerge-ts 8.0.2` (fixed) |
| `npm view @prisma/adapter-pg@7.10.1 dependencies` | includes `pg ^8.16.3` |
| `npm view deepmerge-ts dist-tags.latest` | `8.0.2` |
| Runtime source inspection | `@prisma/client/runtime` has no `deepmerge-ts` reference; generated client imports `runtime/library.js` only |
| CLI config inspection | `@prisma/config/dist/index.js:894` imports `deepmerge-ts`; line 917 passes it as the `c12` merger; `loadConfigFromFile` calls this path at line 825 |
| Repository inspection | no `prisma.config.*`; no `package.json#prisma`; schema uses `url` and `directUrl` |
| Import count | 29 files import `@prisma/client` (25 `src/`, 3 `scripts/`, 1 `tests/`) |

## Findings

- The advisory is [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) / `CVE-2026-40345`: high, CVSS 8.2, CWE-674, "DeepmergeTS has stack exhaustion when merging recursive object graphs".
- Affected range is `deepmerge-ts <8.0.0`; the installed `7.1.5` is vulnerable; `8.0.0` is the first patched version.
- `@prisma/config@6.19.3` pins `deepmerge-ts` to exactly `7.1.5`, so Prisma 6 cannot pick up the fix through normal semver resolution.
- The full chain appears in `npm audit --omit=dev` and in `npm ls --omit=dev`, so the "CLI is only a devDependency" explanation is not sufficient. npm keeps the CLI via `@prisma/client`'s optional peer relationship.
- The running server does not load `@prisma/config` or `deepmerge-ts`; the vulnerable merge is reached through Prisma CLI config loading during `prisma generate` (build) or other CLI commands.
- No `prisma.config.*` file or `package.json#prisma` key exists, so no repository input currently flows through that merge with untrusted content. This narrows build-time exposure but does not prove zero risk, and it would change if a config file were added.

## Recommendation

1. **Plan a separate Prisma 7.10.1 migration.** Upgrade `prisma` and `@prisma/client` together, pinned to 7.10.1 (not the prerelease `latest`), which brings `@prisma/config@7.10.1` and `deepmerge-ts@8.0.2`.
2. **Do not use an override** to force `deepmerge-ts@8` under Prisma 6. Prisma does not declare that combination supported, the dependency is an exact pin, and the v8 release changes merge semantics and types. An override would require a lockfile change and compatibility testing outside this task's scope.
3. **Do not suppress the audit or use `npm audit fix --force`.** Record the three high findings as unresolved debt until the migration is completed. If the release gate requires zero high findings, treat the migration as a release blocker.
4. **Until then,** keep Prisma CLI execution out of the runtime, avoid adding a `prisma.config.*` that consumes untrusted content, and state the audit result honestly in release notes.

The migration consequences are listed in the investigation document: Node floor, generator/output/import changes across 29 files, driver adapter (`@prisma/adapter-pg` + `pg`), `prisma.config.ts` datasource and removal of `directUrl`, `.env` loading, SSL changes, build/package updates and database revalidation.

## Checks not run

- No install, `npm ci --omit=dev`, Vercel build, function packaging inspection or public deployment, so the exact production bundle contents are unverified.
- No exploit attempt and no instrumentation of the installed CLI; build-time reachability is based on source inspection.
- No Prisma 7 upgrade, override, lockfile edit, manifest edit, schema edit or application-code change.
- No database connection, migration, seed, reset or database workflow test.
- No real `.env`, credential or host secret was read.

## Limitations

- Whether the hosting provider installs the CLI into the production function and whether it is traced into the bundle is still unknown. The lockfile and `npm ls --omit=dev` show it is classified as production, not that it ships in the function.
- The exposure assessment is evidence plus inference. The absence of a config file means no attacker-controlled input path was found, not that the vulnerable code cannot run.
- Advisory severity, ranges and documentation can change after 30 October 2026.

## Requested outside this task

- **Release owner:** decide whether the Prisma 7.10.1 migration is a release blocker and schedule it with database and Vercel verification.
- **Migration implementer:** follow the Prisma 7 upgrade guide, keep the project's CommonJS/ESM decision evidence-based, and re-run audit after the upgrade to confirm all three findings clear.
- **Deployment operator:** verify the production function only contains the runtime Prisma client and adapter, not the CLI.

This investigation alone does not resolve a dependency finding and does not approve a deployment. No milestone or deployment completion is claimed.
