# Vortex Automation Compatibility Contract

Contract version: 0.1 — draft, 29 October 2026.

This is the website's externally consumable automation contract. It specifies the
target behavior of the playground, not the implementation of any recorder. The web
recorder, Android app and Android recorder remain separate Vortex projects.

## Implementation status

Existing data-testid selectors, business routes and tests are the starting point.
The complete scenario manifest, fixture versioning, explicit three-mode interface
and run-scoped reset API below are planned requirements, not implemented endpoints.
The current PostgreSQL/memory storage choice is not a practice or defect mode.

## Scenario identity and difficulty

Every published scenario must declare: scenarioId, scenarioVersion, title, level,
requiredMode, fixtureVersion, prerequisites, selectors, ordered actions, expected
observable outcomes, timeout policy, reset/cleanup behavior and known limitations.

- Level 1 — Beginner: login, navigation, simple forms, checkboxes and basic tables.
- Level 2 — Intermediate: file uploads, dependent fields, nested frames, dynamic
  tables and multistep business workflows.
- Level 3 — Advanced: shadow DOM, virtualization, retries, concurrent requests,
  session expiration and deliberate locator ambiguity.

Keep difficulty separate from defects. An advanced scenario can work correctly;
it does not need an injected bug. Do not renumber stable scenario IDs when a label,
level or location changes. Publish a new scenario version for behavioral changes.

Initial reference journeys to formalize from existing tests:

- AUTH-LOGIN-001: valid login and session restoration; level 1, normal mode.
- AUTH-DENIED-001: customer cannot call admin endpoints; level 2, normal mode.
- SHOP-CHECKOUT-001: search -> product -> cart -> coupon -> checkout -> order;
  level 2, normal mode.
- FILE-AVATAR-001: upload -> reload -> replace -> remove; level 2, normal mode.
- AUTH-MFA-001: enroll -> challenge -> verify -> reject replay; level 3, practice.
- UI-FRAME-001: interact with nested frames; level 2, practice.
- UI-SHADOW-001: open-root access and documented closed-root boundary; level 3,
  practice. Closed internals are not promised to be selectable.
- ORDER-IDEMPOTENCY-001: duplicate checkout creates one order; level 3, practice.
- DEFECT-SORT-001: scoped incorrect-sort profile with expected correct/faulty
  outcomes; level 2, defect mode. Map it explicitly to legacy BUG-01 when ported.

These IDs are a proposed catalog. They are not claims of a deployed manifest API.

## Selector guarantees

- Normal business journeys expose stable data-testid values and accessible names.
  Preserve existing test IDs unless a documented contract migration is provided.
- Test IDs identify purpose rather than CSS structure or translated display text.
- Use semantic roles/labels for interaction. Do not force-click hidden controls;
  interact with their visible label or supported public surface.
- Repeated rows expose a stable business key or fixture reference. Row position
  alone is not a stable identity when sorting or paging.
- Document iframe boundaries and shadow-root behavior explicitly.
- Maintain a separate catalog of deliberately unstable IDs, duplicate labels,
  moving elements and rerender scenarios. Give each a stable containing scenario
  marker and visible result so instability does not affect unrelated workflows.
- Theme, viewport, animation preferences and locale are explicit test inputs.
- Selector changes that invalidate published journeys require a version increment,
  release note and an updated example.

## Modes and isolation

- **Normal:** reliable business behavior; no injected faults. Practice instructions
  and fault controls must not change another user's normal application state.
- **Practice:** named exercises, versioned fixtures and configurable timing, all
  scoped to the current authorized test run. Baseline correctness is retained.
- **Defect Lab:** explicitly activated defect IDs/fault profiles, visibly marked
  with the run ID and active configuration. Disabled by default.

Mode and defect state must be explicit in the interface and queryable through a
protected test contract. A client-side banner or localStorage flag is not backend
authorization. Changing modes cannot grant permissions or mutate global storage.
Legacy chaos/probability controls do not yet satisfy this contract.

## Fixtures and reset interface

Fixture definitions need a version, logical name, ownership scope and lookup result.
Do not hardcode generated PostgreSQL IDs in externally published examples. A fixed
seed must reproduce scenario data; timestamps and nondeterministic values must be
controlled or documented as variable fields.

The future test-kit/control interface must support:

1. Authorized creation/lookup of a run with testRunId and fixtureVersion.
2. Resolving logical fixture names into that run's actual record identifiers.
3. Reading mode, active faults and scenario state.
4. Resetting a named scenario or run to its documented starting state.
5. Deleting only owned disposable records and reporting cleanup completion.

Exact routes and schemas must be approved in OpenAPI when implemented. No route
names in this draft should be treated as existing API endpoints. Production must
reject privileged fixture/reset requests even if development credentials leak.
Test that concurrent runs cannot observe, reset or delete each other's fixtures.

## Observable results and examples

Publish one tool-neutral walkthrough per scenario: starting URL, fixture names,
actions, resulting UI state, expected API status/body and relevant DB invariants.
Include failure outcomes and cleanup. Supply representative execution traces or
recordings only after capturing them; do not fabricate recording files or results.

Separate projects may consume these walkthroughs to create their own recordings.
The website team owns target behavior and sample journeys, not recorder accuracy,
code generation, replay implementation or product-specific benchmark scores.

For example, SHOP-CHECKOUT-001 must assert persisted order ownership, the displayed
and stored total, stock reduction, cleared cart, duplicate-request behavior and
correct cancellation effects. A success toast alone is not sufficient evidence.

## Versioning and release checks

- Use semantic versions for the contract and fixture definitions; identify each
  scenario version in reports.
- Distinguish breaking selector/behavior/reset changes from additive scenarios.
- Publish migration notes and a reproducible environment description.
- Validate examples against the released website/API, not only static documents.
- Report executed, failed, expected-failure and skipped scenarios separately.
- Do not claim broad tool compatibility from one Playwright run. Supply and run
  the relevant examples before marking a specific tool/version verified.
