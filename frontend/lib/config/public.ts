// NEXT_PUBLIC values are public and are embedded at build time.
const defaultApiUrl =
  process.env.NODE_ENV === "production"
    ? "https://amazonroute53clone-production.up.railway.app/api/v1"
    : "http://localhost:8000/api/v1";

export const publicConfig = {
  apiUrl: (process.env.NEXT_PUBLIC_API_URL ?? defaultApiUrl).replace(
    /\/+$/,
    "",
  ),
} as const;
