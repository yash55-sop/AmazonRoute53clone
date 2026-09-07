# Backend

FastAPI endpoints are grouped by version and resource. Dependencies own request session cleanup and current-user resolution. Services implement password/session behavior, ownership, normalization, validation, transactions, default records, BIND parsing, export, and bulk deletion. SQLAlchemy models contain persistence relationships and constraints; Pydantic schemas are the single API contract layer.

The application uses synchronous SQLAlchemy sessions because SQLite is local and the workload is small. Service functions own commits and rollbacks. Public health checks intentionally do not depend on database readiness.
