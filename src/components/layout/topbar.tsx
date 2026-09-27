"use client";

import React, { useState, useEffect } from "react";
import { useFirm } from "@/lib/firm-context";
import { FirmSwitcher, NavList } from "./sidebar";

export function Topbar() {
  const { currentFirm } = useFirm();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleToggle = () => setOpen((prev) => !prev);
    const handleClose = () => setOpen(false);

    window.addEventListener("toggle-mobile-sidebar", handleToggle);
    window.addEventListener("close-mobile-sidebar", handleClose);

    return () => {
      window.removeEventListener("toggle-mobile-sidebar", handleToggle);
      window.removeEventListener("close-mobile-sidebar", handleClose);
    };
  }, []);

  const toggleMobileSidebar = () => {
    setOpen((prev) => !prev);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("toggle-mobile-sidebar"));
    }
  };

  const shortName = currentFirm
    ? currentFirm.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "DT";

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between gap-3 bg-ink px-4 py-3 text-ink-foreground lg:hidden">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="font-display grid size-8 shrink-0 place-items-center rounded-xl bg-coral text-sm font-bold text-coral-foreground">
            {shortName}
          </div>
          <div className="text-sm font-semibold truncate">
            {currentFirm?.name || "Transport App"}
          </div>
        </div>
        <button
          type="button"
          id="mobile-menu-toggle"
          onClick={toggleMobileSidebar}
          aria-expanded={open}
          className="rounded-full border-2 border-white/20 px-3 py-1.5 text-xs font-semibold shrink-0"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      {/* Mobile Drawer */}
      {open && (
        <div className="sticky top-[56px] z-30 max-h-[70vh] overflow-y-auto bg-ink px-4 pb-5 text-ink-foreground lg:hidden border-t border-white/10">
          <FirmSwitcher compact />
          <div className="mt-3">
            <NavList onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
