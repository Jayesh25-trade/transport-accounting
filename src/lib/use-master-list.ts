"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useApiClient, ApiError } from "@/lib/api-client";
import { useFirm } from "@/lib/firm-context";

interface UseMasterListOptions<T> {
  /** e.g. "/api/parties" */
  endpoint: string;
}

interface UseMasterListResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Generic data-fetching hook for master list pages.
 * Automatically refreshes when the active firm changes.
 */
export function useMasterList<T>({
  endpoint,
}: UseMasterListOptions<T>): UseMasterListResult<T> {
  const api = useApiClient();
  const { currentFirm } = useFirm();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetch = useCallback(async () => {
    if (!api.ready) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<T[]>(endpoint);
      setData(result);
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setError(
          err instanceof ApiError ? err.message : "Failed to load data"
        );
      }
    } finally {
      setLoading(false);
    }
  }, [api.ready, api.firmUuid, endpoint]);

  // Re-fetch when firm changes
  useEffect(() => {
    setData([]);
    fetch();
  }, [currentFirm?.id, endpoint]);

  return { data, loading, error, refresh: fetch };
}

// ─── Generic create/update mutation hook ──────────────────────
interface UseMutationResult {
  submitting: boolean;
  submitError: string | null;
  create: (body: unknown) => Promise<boolean>;
  update: (id: string, body: unknown) => Promise<boolean>;
}

export function useMasterMutation(endpoint: string): UseMutationResult {
  const api = useApiClient();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function create(body: unknown): Promise<boolean> {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.post(endpoint, body);
      return true;
    } catch (err: any) {
      setSubmitError(err instanceof ApiError ? err.message : "Save failed");
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function update(id: string, body: unknown): Promise<boolean> {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.put(`${endpoint}/${id}`, body);
      return true;
    } catch (err: any) {
      setSubmitError(err instanceof ApiError ? err.message : "Save failed");
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  return { submitting, submitError, create, update };
}
