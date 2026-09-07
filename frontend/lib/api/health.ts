import { publicConfig } from "../config/public.ts";
import type { HealthResponse } from "../../types/api.ts";

export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch(`${publicConfig.apiUrl}/health`, {
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`Health request failed (${response.status}).`);
  }

  const data: unknown = await response.json();
  if (
    typeof data !== "object" ||
    data === null ||
    !("status" in data) ||
    data.status !== "ok"
  ) {
    throw new Error("Unexpected health response.");
  }

  return { status: data.status };
}
