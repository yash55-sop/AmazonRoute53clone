// NEXT_PUBLIC values are public and are embedded at build time.
export const publicConfig = {
  apiUrl: (
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"
  ).replace(/\/+$/, ""),
} as const;
