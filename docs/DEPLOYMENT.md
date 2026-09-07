# Deployment

## Local Docker Compose

Install Docker Desktop with Docker Compose, then run these commands from the repository root:

```powershell
docker compose build
docker compose up
```

Open <http://localhost:3000>. The API and its health endpoint are available at <http://localhost:8000> and <http://localhost:8000/health>.

The browser-facing frontend build uses `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1`. The Docker-only hostname `backend` is intentionally not used because it cannot be resolved by a user's browser.

Stop the containers without deleting application data:

```powershell
docker compose down
```

SQLite is stored at `/app/data/route53.db` in the backend container and persisted in the `route53_data` named volume. A normal `docker compose down` preserves it. The following command permanently deletes the volume and its database:

```powershell
docker compose down -v
```

## Persistence check

1. Run `docker compose up --build`.
2. Log in and create `docker-test.example.com` plus an A record.
3. Run `docker compose down`.
4. Run `docker compose up`.
5. Confirm the zone and record still exist.

Do not add `-v` to the first `down` command.

## Railway backend

Configure Railway with:

- Root directory: `backend/`
- Builder: Dockerfile
- Persistent-volume mount: `/app/data`
- One backend replica, because SQLite is a single-instance datastore

Set these environment variables:

```text
APP_ENV=production
DATABASE_URL=sqlite:////app/data/route53.db
FRONTEND_ORIGIN=https://<vercel-or-custom-frontend-domain>
SESSION_COOKIE_NAME=route53_session
SESSION_COOKIE_SECURE=true
SESSION_LIFETIME_SECONDS=86400
```

Railway supplies `PORT`; the image starts Uvicorn on `0.0.0.0` using that value. The non-root backend user owns `/app/data`, so SQLite can create and update the database on a new volume. Startup creates missing tables and seeds the demo user only when absent; it does not recreate or clear an existing database.

For cookie authentication, use frontend and API custom domains under the same parent site when possible, such as `console.example.com` and `api.example.com`. The application intentionally retains its HTTP-only, SameSite=Lax session cookie.

## Vercel frontend

Configure Vercel with:

- Root directory: `frontend/`
- Framework preset: Next.js
- Build command: `npm run build`

Set the public API URL at build time:

```text
NEXT_PUBLIC_API_URL=https://<railway-or-custom-api-domain>/api/v1
```

The Dockerfile is for local reproducibility and portability. Vercel can continue using its standard Next.js build and does not require Docker.
