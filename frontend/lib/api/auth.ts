import { ApiError, apiRequest } from "./client";
import type { AuthUser, LoginCredentials } from "../../types/api";

export { ApiError as AuthError };

export function login(credentials: LoginCredentials): Promise<AuthUser> {
  return apiRequest<AuthUser>("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export function getCurrentUser(): Promise<AuthUser> {
  return apiRequest<AuthUser>("/auth/me", { cache: "no-store" });
}

export function logout(): Promise<void> {
  return apiRequest<void>("/auth/logout", { method: "POST" });
}

export { ApiError };
