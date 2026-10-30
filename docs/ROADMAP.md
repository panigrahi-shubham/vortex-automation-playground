# Vortex Automation Playground: future roadmap

This roadmap covers the website, its API, database and testing experience. Priorities are proposals, not release dates or claims that a feature is complete. See the [master plan](VORTEX_AUTOMATION_PLAYGROUND_MASTER_PLAN.md) for the detailed scope.

## Current foundation

The deployed website supports a database-backed store, accounts and MFA, cart and simulated checkout, orders, an API and a UI lab. The [deployment status](DEPLOYMENT_STATUS.md) records the verified production journey and current boundaries.

## Next: make practice repeatable

- Provide isolated, scoped test data, fixtures and reset controls that cannot affect other users or production data.
- Document stable UI selectors, API contracts, test journeys and known limitations for framework authors.
- Extend API, database, browser and workflow coverage, and automate suitable checks in CI.
- Improve account recovery with an appropriate delivery mechanism before enabling it in production.

## Expand the playground

- Add clearly separated practice and defect scenarios with predictable behavior and safe fault controls.
- Complete and verify further commerce journeys and the seller and RFQ experiences described in the master plan.
- Expand accessibility, responsive behavior and reference-design verification across screens.
- Improve the event outbox with durable processing, retries and operational visibility.

## Longer-term integration

- Evaluate a generated API client and reusable test kit when their contracts and consumers are ready.
- Evaluate a shared API and database for other Vortex products through a separately planned integration, with appropriate access and data isolation.

Vortex Web Recorder, the Android application and Android Recorder are separate projects. Building their recorders, native screens or APKs is outside this website roadmap.
