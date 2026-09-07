import { publicConfig } from "../config/public.ts";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${publicConfig.apiUrl}${path}`, {
    ...init,
    credentials: path.startsWith("/auth/") ? "include" : "omit",
    headers: init?.body
      ? { "Content-Type": "application/json", ...init.headers }
      : init?.headers,
  });
  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const payload = (await response.json()) as {
        detail?: string | { message?: string };
      };
      if (typeof payload.detail === "string") message = payload.detail;
      else if (payload.detail?.message) message = payload.detail.message;
    } catch {
      /* retain the status-based message */
    }
    throw new ApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
