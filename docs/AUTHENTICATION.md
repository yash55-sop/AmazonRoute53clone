# Authentication

The demo uses engineered server-side sessions rather than AWS IAM. Login verifies the user's salted scrypt password, creates a cryptographically random token, stores its SHA-256 digest in SQLite, and sends the raw token only in an HTTP-only cookie. Local cookies use SameSite=Lax; when `SESSION_COOKIE_SECURE=true`, deployment cookies use `SameSite=None; Secure` for cross-site Vercel-to-Railway requests. Cookie security and lifetime are configured by environment.

Every protected request resolves the session from SQLite, rejects expiry, and returns the owning user. Logout removes the row and clears the cookie. The frontend checks `/auth/me` on load, displays a session-loading state, redirects unauthenticated users to `/login`, and never stores tokens in browser storage.
