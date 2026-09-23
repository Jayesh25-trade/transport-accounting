"use client";

import React from "react";
import { Bell, Search, HelpCircle, Loader2 } from "lucide-react";
import { useFirm } from "@/lib/firm-context";

const FIRM_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#3b82f6"];

export function Topbar() {
  const { currentFirm, firms, loading } = useFirm();
  const firmIdx = firms.findIndex((f) => f.id === currentFirm?.id);
  const color = FIRM_COLORS[firmIdx % FIRM_COLORS.length] ?? "#6366f1";

  return (
    <header className="topbar">
      {/* Search */}
      <div className="flex-1 max-w-sm">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="search"
            placeholder="Search bills, parties, trucks…"
            className="form-input pl-8 py-1.5 text-sm"
            id="topbar-search"
          />
        </div>
      </div>

      <div className="flex-1" />

      {/* Active Firm Badge */}
      {loading ? (
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-800 text-gray-400">
          <Loader2 size={12} className="animate-spin" />
          Loading…
        </div>
      ) : currentFirm ? (
        <div
          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
          style={{
            background: `${color}18`,
            color,
            border: `1px solid ${color}30`,
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
          {currentFirm.name}
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          className="btn btn-ghost btn-sm w-8 h-8 p-0 rounded-full justify-center"
          title="Help"
          id="topbar-help"
        >
          <HelpCircle size={16} />
        </button>
        <button
          className="btn btn-ghost btn-sm w-8 h-8 p-0 rounded-full justify-center relative"
          title="Notifications"
          id="topbar-notifications"
        >
          <Bell size={16} />
        </button>
      </div>

      {/* Avatar */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold cursor-pointer flex-shrink-0"
        style={{ background: color }}
        title="Account"
        id="topbar-avatar"
      >
        {currentFirm ? currentFirm.name[0] : "?"}
      </div>
    </header>
  );
}
