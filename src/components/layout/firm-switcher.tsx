"use client";

import React, { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, Loader2, AlertCircle } from "lucide-react";
import { useFirm, type FirmRecord } from "@/lib/firm-context";
import { cn } from "@/lib/utils";

// Stable colour palette for firms (index-based, no DB dependency)
const FIRM_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#3b82f6"];

function firmColor(idx: number) {
  return FIRM_COLORS[idx % FIRM_COLORS.length];
}

export function FirmSwitcher() {
  const { currentFirm, firms, loading, error, setCurrentFirm } = useFirm();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="firm-switcher mx-2 my-2 opacity-60">
        <Loader2 size={14} className="animate-spin flex-shrink-0 text-gray-500" />
        <span className="text-gray-500 text-xs">Loading firms…</span>
      </div>
    );
  }

  if (error || !currentFirm) {
    return (
      <div className="firm-switcher mx-2 my-2 border-red-800/40">
        <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
        <span className="text-red-400 text-xs truncate">
          {error ?? "No firms found"}
        </span>
      </div>
    );
  }

  const currentIdx = firms.findIndex((f) => f.id === currentFirm.id);
  const color = firmColor(currentIdx);

  return (
    <div ref={ref} className="relative mx-2 my-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="firm-switcher w-full"
        aria-haspopup="listbox"
        aria-expanded={open}
        id="firm-switcher-button"
      >
        <span className="firm-indicator" style={{ background: color }} />
        <span className="flex-1 text-left truncate">{currentFirm.name}</span>
        <ChevronDown
          size={14}
          className={cn(
            "flex-shrink-0 text-gray-500 transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-white/10 bg-gray-800 shadow-xl py-1 animate-fade-in"
        >
          {firms.map((firm, idx) => (
            <button
              key={firm.id}
              role="option"
              aria-selected={firm.id === currentFirm.id}
              onClick={() => {
                setCurrentFirm(firm.id);
                setOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors",
                firm.id === currentFirm.id
                  ? "text-white"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-700/50"
              )}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: firmColor(idx) }}
              />
              <span className="flex-1 text-left">{firm.name}</span>
              {firm.id === currentFirm.id && (
                <Check size={13} className="text-green-400" />
              )}
            </button>
          ))}
          <div className="mt-1 pt-1 border-t border-white/10 px-3 py-1.5">
            <p className="text-xs text-gray-600">
              Data is strictly isolated per firm
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
