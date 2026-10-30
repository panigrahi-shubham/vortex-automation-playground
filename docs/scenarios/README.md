# Automation scenario catalog

Catalog version: **0.1.0** · Contract version: **0.1 draft** · Status: **source-backed draft**.

This directory describes behavior that exists in the current working source. It does not claim that the planned fixture-version service, three-mode interface, or run-scoped reset API has been implemented.

- [Machine-readable catalog](catalog.v0.1.json)
- [Three reference walkthroughs](REFERENCE_JOURNEYS.md)
- [Automation compatibility contract](../AUTOMATION_COMPATIBILITY.md)
- [Environment and storage setup](../SETUP.md)

## Reading the catalog

`implementationStatus: implemented-source-backed` means the route, selectors, actions, and outcomes are tied to existing tests or the existing PostgreSQL smoke script. It is not a new execution result or a recorder-compatibility claim.

`requiredMode` uses the target contract vocabulary:

- **Normal** — reliable business behavior.
- **Practice** — an automation exercise with a visible result.
- **Defect Lab** — an explicitly activated fault profile. This catalog publishes no Defect Lab scenario.

These labels do **not** select a runtime mode. The current application instead selects storage independently:

| `supportedStorageModes` value | Current meaning |
| --- | --- |
| `memory` | Legacy `/api` memory storage, forced by `SHOPLAB_STORAGE=legacy` or used without `DATABASE_URL`. |
| `postgres` | `/api/v2` PostgreSQL storage when `DATABASE_URL` is configured and storage is not forced to legacy. |

Every `fixtureVersion` is deliberately `null`: no versioned external fixture API exists. Prerequisites identify the current seed or disposable-account mechanism instead of inventing fixture versions or hard-coding generated database IDs.

## Published scenarios

| Scenario | Level | Starting route | Storage | Primary evidence |
| --- | --- | --- | --- | --- |
| `AUTH-LOGIN-001` | 1 | `/login` | memory | `tests/e2e/auth.spec.ts` |
| `AUTH-EMAIL-OTP-001` | 2 | `/login/verify` | memory | `tests/e2e/auth.spec.ts` |
| `AUTH-MFA-001` | 3 | `/account/security` | postgres | `scripts/smoke-v2-storefront.cjs` |
| `AUTH-DENIED-001` | 2 | `/admin` | memory | `tests/e2e/admin.spec.ts`, `tests/api/admin.api.spec.ts` |
| `CATALOG-FILTER-001` | 1 | `/shop` | memory | `tests/e2e/catalog.spec.ts` |
| `SHOP-CHECKOUT-001` | 2 | `/shop` | memory, postgres | `tests/e2e/checkout.spec.ts`, database smoke |
| `ORDER-CANCEL-001` | 2 | `/orders/{orderId}` | memory, postgres | `tests/e2e/orders.spec.ts`, database smoke |
| `UI-DIALOG-001` | 1 | `/lab` | memory | `tests/e2e/lab.spec.ts` |
| `UI-FRAME-001` | 2 | `/lab` | memory | `tests/e2e/lab.spec.ts` |
| `UI-SHADOW-001` | 3 | `/lab` | memory | `tests/e2e/lab.spec.ts` |

The file/line references inside the JSON are the authoritative evidence for each ordered action and observable result. A route's presence in both storage modes is not, by itself, evidence for supporting a scenario in both; only scenarios with matching source evidence list both.

## Reset and cleanup boundaries

- The Playwright reference suite's global setup calls **`POST /api/reset` once before the run**. This is a global legacy-memory reset, not a named-scenario or test-run reset.
- The PostgreSQL smoke registers a disposable account and removes its own related records afterward. That cleanup is not a general reset endpoint and must not be broadened to shared data.
- UI Lab scenarios use a fresh page or reload for client-side state; they do not have a scenario-reset service.
- Do not run a reset, browser suite, or database smoke against shared/public infrastructure. Use an authorized disposable environment.

## Maintaining scenario identity

### Validate the catalog locally

From the repository root, use Node's built-in parser and assertions; this command
does not start a server or connect to a database:

```sh
node -e 'const fs = require("node:fs"), assert = require("node:assert/strict"); const c = JSON.parse(fs.readFileSync("docs/scenarios/catalog.v0.1.json", "utf8")); assert.equal(c.scenarioCount, c.scenarios.length); assert.equal(new Set(c.scenarios.map(s => s.scenarioId)).size, c.scenarios.length); for (const s of c.scenarios) { assert.equal(s.fixtureVersion, null); assert.ok(s.steps.length && s.observableResults.length && s.sourceReferences.length); s.steps.forEach((step, i) => assert.equal(step.order, i + 1)); } console.log("PASS: " + c.scenarios.length + " unique scenarios; JSON and basic consistency valid");'
```

This is a structural check, not a browser execution or full selector validation.

Keep `scenarioId` stable across label, difficulty, or documentation-location changes. Increment `scenarioVersion` for behavioral changes and the catalog version for a catalog release. Breaking selector, behavior, or reset changes also require migration notes under the compatibility contract.

Selectors in the catalog use a compact notation such as `data-testid=order-id`, `role=button name=Sign in`, and `label: Your name`. The source references show the exact Playwright expression where compact notation could be ambiguous. Prefer roles, labels, stable test IDs, and business names over row position or generated PostgreSQL IDs.

Before marking a particular recorder or tool version as verified, execute the relevant walkthrough with that tool and retain real results. The three provided Playwright references are not blanket compatibility evidence.
