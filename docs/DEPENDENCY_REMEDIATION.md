# Dependency remediation investigation

Update, 30 October 2026: the later release-preparation change upgraded Prisma,
client and PostgreSQL adapter to 7.10.1, added driver/schema/TLS configuration and
verified a zero-finding audit. The investigation below is historical; its
"unresolved" status is superseded by `RELEASE_VALIDATION.md` for the current tree.

Task: **H**  
Date: 30 October 2026  
Status: **investigation complete; findings unresolved; no remediation applied**

This document records what the fresh dependency audit found, how the affected packages are reached, where the vulnerable code can actually run, what a supported fix requires, and what should happen next. It does not approve a deployment, resolve an advisory, or claim that the dependency tree is clean.

## Scope and constraints

- Read-only inspection: audit commands, `npm ls`, `npm view`, lockfile and source inspection, and primary-source documentation.
- No install, `npm audit fix`, `npm audit fix --force`, override, downgrade, suppression, lockfile change, manifest change, Prisma configuration change or application-code change.
- No credential, `.env`, database, migration, seed, reset or deployment activity.
- Only two files were created for this task: this document and [`docs/handoffs/TASK_H_RESULT.md`](handoffs/TASK_H_RESULT.md).

## Fresh audit results

Tooling: Node.js v24.15.0, npm 11.12.1, TypeScript 5.9.3, installed Prisma 6.19.3.

```text
npm audit --json                 exit 1
npm audit --omit=dev --json      exit 1
```

Both runs reported the same result:

| Package | Severity | Vulnerable range | Reported via | Fix offered |
| --- | --- | --- | --- | --- |
| `deepmerge-ts` | high | `<8.0.0` | GHSA-ggr8-5vv4-36mx (direct advisory) | `prisma@7.10.1` (major) |
| `@prisma/config` | high | `6.13.0-dev.1 - 7.10.0 \|\| 8.1.0-dev.1 - 8.1.0-dev.4` | `deepmerge-ts` | `prisma@7.10.1` (major) |
| `prisma` | high | `6.13.0-dev.1 - 7.10.0 \|\| 8.0.0-rc.3 - 8.1.0-dev.4` | `@prisma/config` | `prisma@7.10.1` (major) |

Totals: **3 high, 0 critical**; npm metadata counts 119 production, 19 dev, 29 optional and 165 total dependencies. The `--omit=dev` run produced the same three findings and the same counts, so this cannot be dismissed as a dev-only audit artifact.

The complete installed chain is:

```text
@prisma/client@6.19.3
└── prisma@6.19.3                     (optional peer, also a direct devDependency)
    └── @prisma/config@6.19.3
        └── deepmerge-ts@7.1.5        (exact pin in @prisma/config)
```

`npm ls --omit=dev prisma @prisma/config deepmerge-ts` still resolves that full chain. In `package-lock.json`, `prisma`, `@prisma/client`, `@prisma/config` and `deepmerge-ts` have no `dev: true` flag, while a control dev dependency such as `@playwright/test` is marked `dev: true`. `@prisma/client` declares `prisma` and `typescript` as optional peers (`peerDependenciesMeta`), which is how npm keeps the Prisma CLI in the production-filtered tree even though it is also listed under `devDependencies`.

**Evidence:** npm's production-filtered tree and lockfile include the affected chain.  
**Not verified:** whether the real hosting install/build and function bundle contain the CLI. That host-level packaging check was outside this read-only task.

## Advisory

- GitHub advisory: [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)
- CVE: `CVE-2026-40345`
- Title: "DeepmergeTS has stack exhaustion when merging recursive object graphs"
- Severity: high, CVSS 8.2 as stated on the advisory page (npm's JSON record contained no CVSS vector)
- Weakness: CWE-674 (uncontrolled recursion)
- Affected: `deepmerge-ts <8.0.0`
- Patched: `deepmerge-ts 8.0.0`
- Installed here: `deepmerge-ts 7.1.5`

The advisory describes a crafted recursive object graph causing stack exhaustion. It is a denial-of-service condition that requires an input graph capable of triggering the recursion; the advisory does not establish that merely importing the package is sufficient.

## Where the vulnerable code is reached

### Runtime server

The Express application and the generated Prisma client do not use the vulnerable merge path:

- `@prisma/client/runtime` contains no reference to `deepmerge-ts`.
- The generated entry `node_modules/.prisma/client/index.js` requires `@prisma/client/runtime/library.js` and contains no reference to `@prisma/config` or `deepmerge-ts`.
- [`src/app.js`](../src/app.js) loads compiled route modules and [`src/db/client.ts`](../src/db/client.ts), which calls `new PrismaClient()`; it does not load the Prisma CLI or config loader.

### Build and CLI

- `@prisma/config/dist/index.js` line 894 dynamically imports `deepmerge-ts`, and line 917 passes `deepmerge` as the `merger` to `c12`.
- `loadConfigFromFile` calls `loadConfigTsOrJs` at line 825 before it decides that no config file exists, so the module is loaded during Prisma CLI config discovery.
- The repository has no `prisma.config.*` file and no `prisma` key in [`package.json`](../package.json).
- [`prisma/schema.prisma`](../prisma/schema.prisma) declares the datasource directly; no config file supplies merge layers.
- `prisma generate` runs via `postinstall`, `build`, `vercel-build` and `predev`, so the CLI path is part of every build.

**Evidence:** the vulnerable package is loaded by the Prisma CLI/config loader, not by the runtime HTTP client.  
**Inference:** with no Prisma config file and no untrusted config content, no input path that reaches `deepmerge` with an attacker-controlled recursive graph was found in this repository. The practical build-time exposure is therefore narrow, but it is not proven to be zero. A malicious or compromised build input, a future `prisma.config.*` that incorporates untrusted data, or a compromised install could change that assessment. The finding is not labelled harmless.

## Remediation options considered

### 1. Force `deepmerge-ts@8.0.2` under Prisma 6 with an override

Rejected as a supported fix.

- `@prisma/config@6.19.3` pins `deepmerge-ts` to exactly `7.1.5`.
- The [deepmerge-ts v8.0.0 release](https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0) keeps a `deepmerge` entrypoint, but also changes Map merging and renames types. Prisma 6 does not declare compatibility with v8.
- An override would require a lockfile change and compatibility testing that this task was explicitly not allowed to perform.
- It would silence the audit without a vendor-supported statement that Prisma 6 works with the new major. That is the kind of green-washing this task must avoid.
- It is not recommended even as a stopgap unless the release owner separately accepts an unsupported configuration after testing.

### 2. Upgrade to the fixed stable Prisma line

The audit's proposed fix is `prisma@7.10.1` with `isSemVerMajor: true`. Registry checks confirm:

- `prisma@7.10.1` is the current `prev` tag; `@prisma/client@7.10.1` is `latest`.
- The `prisma` `latest` tag is **`8.0.0-rc.28`**, a prerelease. It must not be used for this release.
- `@prisma/config@7.10.1` depends on `deepmerge-ts@8.0.2`, which is outside the affected range.
- `@prisma/adapter-pg@7.10.1` depends on `pg ^8.16.3`, `@types/pg`, `postgres-array` and `@prisma/driver-adapter-utils`.

This is the only vendor-supported line that removes the advisory, and it is a major migration rather than a patch.

### 3. Defer and document

Leaving 6.19.3 in place keeps three high audit findings. That is a legitimate owner decision only if it is recorded as unresolved risk and not described as a clean or approved release. It is not a remediation.

## Consequences of a Prisma 7.10.1 migration

The following is an impact list, not an implementation. None of it was applied.

1. **Manifest and runtime floor.** Upgrade `prisma` and `@prisma/client` together to 7.10.1. Prisma 7.10.1 requires Node `^20.19 || ^22.12 || >=24.0`; the project currently declares `>=20.9.0`, so `engines` and CI/local Node versions must be raised. TypeScript must be at least 5.4; the repository already uses 5.9.3. Use an exact or tightly pinned 7.10.1 range, not the `latest` tag.
2. **Generator and imports.** `prisma-client-js` is deprecated in favour of `prisma-client`; the new generator requires an `output` path, and application code imports from the generated location instead of `@prisma/client`. Twenty-nine files currently import `@prisma/client` (25 under `src/`, 3 under `scripts/`, 1 under `tests/`). Build, typecheck, test and editor paths all need to resolve the generated output.
3. **Driver adapter.** Prisma 7 uses driver adapters instead of the bundled Rust engine. PostgreSQL needs `@prisma/adapter-pg` and `pg`, and [`src/db/client.ts`](../src/db/client.ts) must construct `PrismaClient` with an adapter. Connection pooling, timeouts and SSL behaviour must be revalidated against Supabase.
4. **`prisma.config.ts`.** Per the [Prisma config reference](https://www.prisma.io/docs/orm/reference/prisma-config-reference), the datasource URL is configured in `prisma.config.ts`; `directUrl` was removed. [`prisma/schema.prisma`](../prisma/schema.prisma) currently uses `url = env("DATABASE_URL")` and `directUrl = env("DIRECT_URL")`, so both the schema and the deployment's pooled/direct connection strategy need revision. The CLI no longer loads `.env` automatically, so the new config must load `dotenv` (or the environment must be supplied by the host).
5. **Build and packaging.** The generated output must be produced during install/build and included in the Vercel function. Task F's `includeFiles` currently covers `web/**`, `dist/**` and `node_modules/.prisma/**`; a new output path and the `@prisma/adapter-pg`/`pg` runtime dependencies must be included and re-tested against the function size limit.
6. **Module format.** The [generator documentation](https://www.prisma.io/docs/orm/prisma-schema/overview/generators) allows `moduleFormat = "esm"` or `"cjs"`. The [Prisma 7 upgrade guide](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7) recommends ES modules, while this project is CommonJS (no `"type": "module"`). The `cjs` option appears to preserve the current module system, but adapter/runtime behaviour under the compiled CJS build must be verified rather than assumed.
7. **Database and test surface.** There are 10 migrations, database workflow tests, catalog/review/wishlist/cart/order modules and storefront smoke scripts. Migration deploy, generated SQL, session/MFA/recovery code and the Postgres SSL path must be revalidated on a disposable database before release.
8. **Operational change.** A migration of this size needs its own task, rollback plan and deployment window. It must not be mixed into the current release without that planning.

## Recommendation

**Treat the Prisma 7.10.1 migration as a justified, separate remediation task, and record the current three high findings as explicitly unresolved risk until it is complete.**

- There is **no supported non-major fix** for Prisma 6.19.3.
- Do **not** add a `deepmerge-ts` override, suppress the advisory, or run `npm audit fix --force`.
- Do **not** use the prerelease `latest` tag; if the migration proceeds, pin `prisma` and `@prisma/client` at 7.10.1 and let `@prisma/config` bring `deepmerge-ts` 8.0.2.
- Until the migration lands, keep the current runtime free of Prisma CLI execution, avoid introducing a `prisma.config.*` that consumes untrusted content, and document the audit failure as known debt in release notes.
- If the release policy requires zero high findings, the migration is a release blocker, not an optional cleanup.

This investigation alone does not resolve the finding and does not approve a deployment.

## Evidence summary

| Claim | Basis |
| --- | --- |
| Three high findings, both audit modes exit 1 | Fresh `npm audit --json` and `npm audit --omit=dev --json` on 30 October 2026 |
| Chain is `prisma → @prisma/config → deepmerge-ts@7.1.5` | `npm ls --all`, lockfile inspection |
| Chain is in the production-filtered tree | `npm ls --omit=dev`; no `dev` flag on the four lockfile entries |
| Installed version is vulnerable | `deepmerge-ts@7.1.5`, advisory range `<8.0.0` |
| Runtime client does not load the merge path | No `deepmerge-ts` in `@prisma/client/runtime`; generated client imports only `runtime/library.js` |
| CLI config loader does load the module | `@prisma/config/dist/index.js` lines 894 and 917; `loadConfigFromFile` line 825 |
| No config input exists in this repository | No `prisma.config.*`; no `package.json#prisma` key |
| Fixed stable line is 7.10.1 | Registry `prev=7.10.1`, `@prisma/client latest=7.10.1`, `@prisma/config 7.10.1` depends on `deepmerge-ts 8.0.2` |
| `latest` is unsafe for this release | `prisma` `latest=8.0.0-rc.28` (prerelease) |
| Migration is major | Audit `isSemVerMajor: true`; Prisma 7 generator, adapter, config and Node-floor changes |

## Limitations

- No host build, `npm ci --omit=dev`, Vercel function packaging or public deployment was run, so the production bundle's exact contents remain unverified.
- No exploit attempt, instrumentation of the installed CLI, or execution of `prisma generate`/`validate` against a modified dependency was performed; the exposure assessment is source inspection plus inference.
- No database was contacted, so the Prisma 7 driver-adapter and migration behaviour is untested.
- Advisory details are as published on the GHSA page at the time of this investigation; severity and ranges can change.

## Primary sources

- [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)
- [Prisma 7 upgrade guide](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7)
- [Prisma config reference](https://www.prisma.io/docs/orm/reference/prisma-config-reference)
- [Prisma generator reference](https://www.prisma.io/docs/orm/prisma-schema/overview/generators)
- [deepmerge-ts v8.0.0 release](https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0)
- [prisma@7.10.1 on npm](https://www.npmjs.com/package/prisma/v/7.10.1)
- [@prisma/client@7.10.1 on npm](https://www.npmjs.com/package/@prisma/client/v/7.10.1)
