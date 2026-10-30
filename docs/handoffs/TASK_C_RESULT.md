# Task C result — automation scenario catalog

Status: **complete (documentation only)**  
Date: 30 October 2026

## Delivered

1. [`docs/scenarios/catalog.v0.1.json`](../scenarios/catalog.v0.1.json)
   - Ten scenarios covering legacy login, legacy email OTP, PostgreSQL authenticator MFA, admin denial, catalog filters, checkout, cancellation, native dialogs, nested frames, and shadow DOM.
   - Every scenario declares its stable ID and version, difficulty, implementation status, target required mode, supported storage modes, route, null fixture version, prerequisites, ordered selectors/actions, observable results, timeout policy, reset availability, cleanup, source references, and known limitations.
   - PostgreSQL order/product identity is resolved at runtime by business name or generated result; no generated database ID or credential is embedded.

2. [`docs/scenarios/README.md`](../scenarios/README.md)
   - Explains catalog fields, evidence status, scenario index, selector notation, versioning, and maintenance boundaries.
   - Separates target Normal/Practice/Defect Lab labels from current memory/PostgreSQL storage selection.
   - Distinguishes legacy global reset, disposable PostgreSQL smoke cleanup, and unavailable run-scoped reset.

3. [`docs/scenarios/REFERENCE_JOURNEYS.md`](../scenarios/REFERENCE_JOURNEYS.md)
   - Provides three reproducible source-backed walkthroughs: customer checkout, nested frames, and shadow DOM.
   - Includes exact selectors, observable outcomes, existing-test commands, source links, safety prerequisites, and reporting limitations.
   - States that closed-shadow-root internals are not selectable and that the walkthrough uses only the component's public `reveal()` method.

## Validation performed

Ran a Node.js built-in `JSON.parse` and filesystem consistency check; no third-party validation dependency was added.

Result:

```text
PASS JSON parsed; 10 scenarios; 10 unique IDs; required fields, sequential steps, storage/mode values, source ranges, and local Markdown links validated.
```

The check verified:

- catalog JSON parses;
- `scenarioCount` matches the array length;
- all ten `scenarioId` values are unique;
- all required fields are present;
- scenario versions use semantic-version syntax;
- target mode and storage values use declared vocabulary;
- every `fixtureVersion` is null rather than fabricated;
- steps are sequentially ordered and include actions and selectors;
- reset metadata is complete;
- every source-reference file exists and every cited line range is within that file;
- local Markdown links in the two scenario documents resolve.

## Explicit boundaries and not-run coverage

- No browser, API, workflow, or smoke test was executed for Task C; the catalog's `implemented-source-backed` status is source evidence, not a new runtime result.
- No database connection, migration, seed, reset, role grant, deployment, or live-data operation was performed.
- No UI, API, runtime mode, reset infrastructure, test, package manifest, lockfile, Prisma migration, backend, CI, or master-plan file was changed.
- No fixture-version API, three-mode selector, Defect Lab activation, or scenario/test-run-scoped reset is claimed to exist.
- The exact Robot Building Kit checkout assertions come from the legacy browser test. The related PostgreSQL smoke covers checkout and cleanup but is not represented as an identical step-for-step execution.
- Checkout UI evidence alone is not represented as proof of stock decrement, stored-total integrity, duplicate-request idempotency, or cancellation stock restoration.
- No external recorder/tool compatibility, execution trace, recording, or benchmark result is claimed.
