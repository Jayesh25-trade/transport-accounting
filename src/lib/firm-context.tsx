"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { usePathname } from "next/navigation";

// ─── Types ───────────────────────────────────────────────────
export interface FirmRecord {
  /** Real PostgreSQL UUID from the firms table */
  id: string;
  name: string;
  code: string;
}

interface FirmContextType {
  /** Currently selected firm (real UUID resolved from DB) */
  currentFirm: FirmRecord | null;
  /** All available firms */
  firms: FirmRecord[];
  /** True while firms are being loaded from API */
  loading: boolean;
  /** Error message if firm load failed */
  error: string | null;
  /** Switch to a different firm by its DB UUID */
  setCurrentFirm: (firmId: string) => void;
  /** Re-fetch firm list from server (e.g. after login or manual retry) */
  refetchFirms: () => Promise<void>;
}

// ─── Context ─────────────────────────────────────────────────
const FirmContext = createContext<FirmContextType | null>(null);

// ─── Provider ────────────────────────────────────────────────
export function FirmProvider({ children }: { children: React.ReactNode }) {
  const [firms, setFirms] = useState<FirmRecord[]>([]);
  const [currentFirmId, setCurrentFirmId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pathname = usePathname();

  const refetchFirms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/firms");

      // Handle unauthenticated state gracefully (e.g. on /login page)
      if (res.status === 401) {
        setFirms([]);
        setCurrentFirmId(null);
        setError(null);
        return;
      }

      const json = await res.json();
      if (!res.ok || !json.success || !Array.isArray(json.data)) {
        throw new Error(json.error?.message ?? "Failed to load firms from server");
      }

      const loaded: FirmRecord[] = json.data;
      setFirms(loaded);

      // Restore persisted selection, or default to first firm
      const saved = typeof window !== "undefined" ? localStorage.getItem("transport-firm-id") : null;
      const valid = saved && loaded.some((f) => f.id === saved) ? saved : null;
      setCurrentFirmId(valid ?? loaded[0]?.id ?? null);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load firms");
    } finally {
      setLoading(false);
    }
  }, []);

  // Trigger load on mount and when navigating away from /login if firms are missing
  useEffect(() => {
    if (pathname === "/login") {
      setLoading(false);
      setError(null);
      return;
    }
    refetchFirms();
  }, [pathname, refetchFirms]);

  const setCurrentFirm = useCallback(
    (firmId: string) => {
      if (firms.some((f) => f.id === firmId)) {
        setCurrentFirmId(firmId);
        if (typeof window !== "undefined") {
          localStorage.setItem("transport-firm-id", firmId);
        }
      }
    },
    [firms]
  );

  const currentFirm = firms.find((f) => f.id === currentFirmId) ?? null;

  return (
    <FirmContext.Provider
      value={{ currentFirm, firms, loading, error, setCurrentFirm, refetchFirms }}
    >
      {children}
    </FirmContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────
export function useFirm(): FirmContextType {
  const ctx = useContext(FirmContext);
  if (!ctx) throw new Error("useFirm must be used inside FirmProvider");
  return ctx;
}

