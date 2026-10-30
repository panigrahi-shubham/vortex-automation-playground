# Performance and durable-job acceptance plan

Status: planned acceptance checks, not measured results or deployed guarantees.

## Performance evidence

Measure predictability under normal, practice and defect modes separately. Never
mix intentionally delayed/failing exercises into normal-mode performance figures.

Capture:
- Page initial load and time until its primary interaction is usable.
- Warm and cold API latency, request status and error rate.
- Query duration/count for list, checkout, reset and notification operations.
- Scenario/run reset duration and completion/failure state.
- Concurrent-run throughput and interference, including database connection waits.

Record commit, contract/fixture version, browser/runtime, viewport, region/network,
dataset size, cache state, concurrency, warmup and sample count. Report median,
p95 and worst observed latency. Keep cold starts separate and retain raw results.

First collect a baseline. Then set explicit budgets from its measurements and the
documented deployment limits; budget values are not yet agreed. Do not invent
passing numbers or optimize only for a synthetic score. A reliable starting state,
bounded timeout and understandable failure are more important for this playground.

## Durable background-job proof of concept

Complete this proof before committing to Milestone 6's execution architecture.
The existing outbox dispatcher is a foundation, not evidence that deployed jobs
are durable or scheduled. Select a supported scheduler/worker mechanism after
checking its actual hosting limits and the project's no-required-paid-API goal.

Use one outbox event and an idempotent database subscriber. Demonstrate:

1. Domain mutation and outbox insertion commit or roll back together.
2. Duplicate deliveries apply the subscriber effect once.
3. Two workers cannot incorrectly own the same current lease.
4. A crash before handling allows retry after lease expiry.
5. A crash after handling but before acknowledgment does not duplicate effects.
6. Handler failure produces bounded backoff and an inspectable failure state.
7. Worker timeouts, lease duration/renewal and function execution limits agree.
8. Restarting the application does not lose pending work or job progress.
9. An authorized operator can inspect/retry failures without resetting all data.
10. Fault profiles, jobs and fixtures remain isolated by test run where applicable.

Save the actual execution evidence and a short architecture decision before
building notification delivery or automatic order progression on top of it.
Document database connections, batch size, execution duration, retry ceiling,
retention and cleanup limits for the selected implementation. No platform quota
or execution guarantee is assumed by this document.
