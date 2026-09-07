# Contributing

Start a focused branch from `main`, such as `feat/hosted-zone-models` or `fix/health-status`. Keep changes reviewable and submit a pull request with the behavior changed and validation performed. No remote or branch protection is configured by this scaffold.

- Read [Architecture](docs/ARCHITECTURE.md) and the relevant frontend/backend guide before changing boundaries.
- Keep components and modules focused. Reuse existing code and native platform features before adding dependencies. Introduce feature directories when they have a real implementation.
- Keep frontend HTTP requests in `lib/api`, API types in `types`, business rules in backend services, and persistence in repositories/database modules as those features arrive.
- Follow `.editorconfig`. Use Prettier for frontend files and Ruff for Python; keep documentation readable Markdown.
- Run formatting, lint, type checks, tests, and the frontend production build before committing. Commands are in [Development](docs/DEVELOPMENT.md#quality-checks).
- Add a small regression test for meaningful behavior changes. Do not add test frameworks or duplicate suites without a concrete need.
- Never commit secrets, local environment files, virtual environments, dependencies, or SQLite databases. Update `.env.example` with safe placeholders when configuration changes.
- Update docs when behavior, setup, API contracts, or architecture changes. Keep planned behavior explicitly marked until it exists.
- Preserve the assignment boundary: this app simulates console behavior; it does not provision AWS resources or publish DNS records.

