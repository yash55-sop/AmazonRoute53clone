# Development

Use the tested commands in the root README for fresh setup, local servers, linting, tests, and production builds. The frontend defaults to `http://localhost:8000/api/v1`; FastAPI allows credentialed requests only from `http://localhost:3000`. Copy `.env.example` files only when local overrides are needed.

Tests never use the development database. Backend integration tests override the database dependency with isolated in-memory SQLite engines. Local database files, environment overrides, build output, and dependency directories are ignored by Git.
