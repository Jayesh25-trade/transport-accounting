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

export function FirmSwitcher({ compact }: { compact?: boolean } = {}) {
  const { currentFirm, firms, loading, error, setCurrentFirm, refetchFirms } = useFirm();
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
      <div className="firm-switcher mx-2 my-2 border-red-800/40 justify-between">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
          <span className="text-red-400 text-xs truncate">
            {error ?? "No firms found"}
          </span>
        </div>
        <button
          onClick={() => refetchFirms()}
          className="text-[10px] text-indigo-400 hover:text-indigo-300 underline font-semibold flex-shrink-0 ml-1"
        >
          Retry
        </button>
      </div>
    );
  }

  const currentIdx = firms.findIndex((f) => f.id === currentFirm.id);
  const color = firmColor(currentIdx);

  return (
    <div ref={ref} className="relative my-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-xl border border-[#D8D5CE] bg-white p-2.5 shadow-xs transition-all hover:bg-[#FAF8F5] focus:outline-none focus:ring-2 focus:ring-[#E05638]/40"
        aria-haspopup="listbox"
        aria-expanded={open}
        id="firm-switcher-button"
      >
        <span className="size-2.5 rounded-full bg-[#2E7D32] shrink-0" />
        <div className="flex-1 text-left min-w-0">
          <div className="text-[9px] font-bold tracking-widest text-[#7A7F85] uppercase">Active Firm</div>
          <div className="text-[13px] font-bold text-[#1A1D20] truncate leading-tight">{currentFirm.name}</div>
        </div>
        <ChevronDown
          size={14}
          className={cn(
            "shrink-0 text-[#7A7F85] transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-[#D8D5CE] bg-white shadow-lg py-1.5 animate-fade-in space-y-0.5"
        >
          <div className="px-3 py-1 text-[10px] font-bold tracking-widest text-[#7A7F85] uppercase border-b border-[#EFECE6] mb-1">
            Switch Firm Context
          </div>
          {firms.map((firm, idx) => {
            const isSelected = firm.id === currentFirm.id;
            return (
              <button
                key={firm.id}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  setCurrentFirm(firm.id);
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors text-left",
                  isSelected
                    ? "bg-[#FAF8F5] text-[#E05638] font-bold"
                    : "text-[#5F6368] hover:bg-[#FAF8F5] hover:text-[#1A1D20]"
                )}
              >
                <span
                  className={cn(
                    "size-2 rounded-full shrink-0",
                    isSelected ? "bg-[#2E7D32]" : "bg-[#9E9A91]"
                  )}
                />
                <span className="flex-1 truncate">{firm.name}</span>
                {isSelected && (
                  <Check size={14} className="text-[#2E7D32] shrink-0" />
                )}
              </button>
            );
          })}
          <div className="mt-1 pt-1.5 border-t border-[#EFECE6] px-3 py-1">
            <p className="text-[10px] text-[#7A7F85]">
              🔒 Data is strictly isolated per firm
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
