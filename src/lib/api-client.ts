"use client";

/**
 * Typed API client for all master-data endpoints.
 * All requests carry the active firm's PostgreSQL UUID in x-firm-id header.
 * Business data is NEVER sent without a valid firm context.
 *
 * NOTE: x-firm-id is NOT authentication. It is the active firm context selector.
 * Real auth/session management is a future phase concern.
 */

import { useMemo } from "react";
import { useFirm } from "@/lib/firm-context";

// ─── Response shape from createApiHandler ───────────────────
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { message: string; code: string; details?: unknown[] };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown[]
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiFetch<T>(
  url: string,
  firmUuid: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-firm-id": firmUuid,
      ...(options?.headers ?? {}),
    },
  });

  const json: ApiResponse<T> = await res.json();

  if (!json.success || !res.ok) {
    const msg = json.error?.message ?? "An unexpected error occurred";
    throw new ApiError(msg, json.error?.code ?? "UNKNOWN", json.error?.details);
  }

  return json.data as T;
}

// ─── Hook: returns typed fetch functions bound to active firm ─
export function useApiClient() {
  const { currentFirm } = useFirm();

  // If firms haven't loaded yet, firmUuid will be empty string —
  // callers should guard on `currentFirm === null` before calling.
  const firmUuid = currentFirm?.id ?? "";
  const ready = !!currentFirm;

  return useMemo(
    () => ({
      get: <T>(url: string) => apiFetch<T>(url, firmUuid),
      post: <T>(url: string, body: unknown) =>
        apiFetch<T>(url, firmUuid, {
          method: "POST",
          body: JSON.stringify(body),
        }),
      put: <T>(url: string, body: unknown) =>
        apiFetch<T>(url, firmUuid, {
          method: "PUT",
          body: JSON.stringify(body),
        }),
      firmUuid,
      ready,
    }),
    [firmUuid, ready]
  );
}
