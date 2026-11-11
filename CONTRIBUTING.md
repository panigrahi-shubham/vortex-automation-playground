# Contributing

1. Use Node.js 24 and run `npm ci`.
2. Start from the branch for the relevant phase. Keep the existing automation identifiers and exact assertions when extending exercises.
3. Run `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run build`, and `npx playwright test`.
4. Use the Compose database or the disposable CI service for migrations, seeds, and database tests.
5. Explain the change and include verification results in the pull request.

See [Setup](docs/SETUP.md) for local services and [Security](SECURITY.md) for private vulnerability reporting.
