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
      <div className="sticky top-0 z-40 flex items-center justify-between gap-3 bg-[#FAF8F5] border-b border-[#D8D5CE] px-4 py-3 text-[#1A1D20] lg:hidden">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="font-display grid size-8 shrink-0 place-items-center rounded-lg bg-[#E05638] text-xs font-bold text-white shadow-xs">
            {shortName}
          </div>
          <div className="text-sm font-bold text-[#1A1D20] truncate">
            {currentFirm?.name || "Transport App"}
          </div>
        </div>
        <button
          type="button"
          id="mobile-menu-toggle"
          onClick={toggleMobileSidebar}
          aria-expanded={open}
          className="rounded-lg border border-[#D8D5CE] bg-white px-3 py-1.5 text-xs font-semibold text-[#1A1D20] shadow-xs hover:bg-[#F4F1EA] shrink-0"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      {/* Mobile Drawer */}
      {open && (
        <div className="sticky top-[56px] z-30 max-h-[70vh] overflow-y-auto bg-[#FAF8F5] px-4 pb-5 text-[#1A1D20] lg:hidden border-b border-[#D8D5CE]">
          <FirmSwitcher compact />
          <div className="mt-3">
            <NavList onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
