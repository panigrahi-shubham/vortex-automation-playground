# Per-user practice and defect modes

Status — approved by the owner on 11 November 2026.

## User experience

A signed-in customer opens Practice from the account menu. The page shows a personal practice workspace, the eight optional defects, and a reset button. Every defect starts off. A visible practice indicator follows the user through the storefront. The user's selection persists in PostgreSQL across sign-ins.

Practice activity belongs to the signed-in account. Ordinary shopping continues to use the existing catalog and commerce workflows. A user enters practice explicitly and can leave it at any time.

## Isolation and data ownership

Add a PracticeProfile with a unique userId, enabled flag, validated defect list, generation number, and a JSON workspace. Its foreign key cascades with account deletion. The workspace contains a catalog snapshot, cart, wishlist, practice orders, and practice display name. The snapshot retains product IDs for familiar automation exercises.

Enabling practice copies the available catalog into the personal workspace. Practice reads and mutations use that snapshot. Checkout adjusts snapshot stock and creates a practice order. Practice reviews, display-name edits, and faulty quantities stay in the workspace. The shared Product, User profile, Order, Review, and outbox tables receive no practice mutations.

The authenticated user's session supplies the owner ID. Request bodies, query strings, and headers cannot select another account. Practice state stays on the request and in that user's database row. Concurrent mutations lock that profile row in a transaction.

Enable row-level security on the new table and revoke browser-role access. Express uses its existing server database connection and authorization checks.

## API and activation

- GET /api/v2/vortex/practice returns the caller's profile, generation, supported defects, and active state.
- PUT /api/v2/vortex/practice accepts enabled and a validated array of BUG-01 through BUG-08.
- POST /api/v2/vortex/practice/reset requires the current generation, resets that caller's workspace, disables defects, and increments the generation.
- DELETE /api/v2/vortex/practice exits practice and removes the personal workspace.

Mount authenticated practice dispatch before the existing v2 storefront routes. It serves supported catalog, cart, wishlist, checkout, order, and display-name operations from the active workspace. Admin, credentials, MFA, password recovery, and real account settings always retain their existing routes and checks.

New identifiers use vortex. Existing shoplab storage keys, x-shoplab headers, ORVILO environment names, and the orvilo schema keep their established contracts. Legacy defect controls retain their existing behavior.

## Eight defects

1. BUG-01 reverses ascending price results.
2. BUG-02 adds the next snapshot product when the requested ID is divisible by five.
3. BUG-03 counts tax twice in the practice checkout total.
4. BUG-04 makes search case sensitive.
5. BUG-05 makes SAVE10 discount one percent.
6. BUG-06 accepts invalid cart quantities in the personal workspace.
7. BUG-07 overlaps adjacent catalog pages by one item.
8. BUG-08 drops the final character from the practice display name.

Reuse the behavioral expectations from tests/bugs/seeded-bugs.spec.ts through new v2 integration cases. Keep the existing reference suite intact. New tests explicitly observe the intended faulty result and recovery after reset.

## Reset, concurrency, and error handling

Reset requires the current generation so a stale browser cannot reset newer work. A mismatch returns 409. All profile mutations use one row lock and increment the generation. An API error rolls back its transaction. Practice checkout requires an idempotency key and replays the original personal order for retries.

Reset refreshes only the caller's catalog snapshot and practice data. It preserves real sessions, credentials, customer data, shared catalog, other users, and audit history. Rate limits reuse src/auth/throttle.ts.

## Verification and rollout

Use the disposable PostgreSQL CI service for migrations and integration tests. Cover all eight defects, two simultaneous users, reset and checkout retries, stale generations, rejected owner injection, and unchanged shared records after practice activity.

Run the existing 256 passing Playwright cases and retain the existing opt-in visual skip. Run typecheck, build, lint, formatting, workflow, pricing, adapter, database, and dependency checks.

The UI refresh can be reviewed independently while this design awaits approval. Production release requires the new schema to be applied through a specifically authorized migration, followed by deployment verification.
