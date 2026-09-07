# Database

SQLite is configured through `DATABASE_URL`; relative paths resolve against `backend`. Startup calls `create_all()` for a fresh database and idempotently seeds `admin`. Passwords use salted scrypt hashes and session rows contain only token digests.

`User` owns sessions and hosted zones. `HostedZone` owns DNS records. Foreign keys and common search fields are indexed. Check constraints restrict zone types, record types, routing policy, and positive TTL values. Database foreign keys are enabled on every SQLite connection, and zone deletion cascades to records.

This automatic initialization is intentionally small-project oriented. Before changing a production schema, introduce migrations and back up the persistent SQLite file.
