"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFirm } from "@/lib/firm-context";
import { cn } from "@/lib/utils";

const NAV: { href: string; label: string; section?: string }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/daily-book", label: "Daily Book", section: "Operations" },
  { href: "/driver-vouchers", label: "Driver Vouchers", section: "Operations" },
  { href: "/billing/bills", label: "Bills", section: "Accounts" },
  { href: "/billing/new", label: "Create Bill", section: "Accounts" },
  { href: "/payments", label: "Payments", section: "Accounts" },
  { href: "/ledger", label: "Ledger", section: "Accounts" },
  { href: "/masters/parties", label: "Masters", section: "Setup" },
  { href: "/reports/outstanding", label: "Outstanding", section: "Reports" },
  { href: "/reports/aging", label: "Aging Analysis", section: "Reports" },
  { href: "/settings", label: "Settings", section: "Setup" },
];

export function FirmSwitcher({ compact }: { compact?: boolean }) {
  const { currentFirm, firms, loading, setCurrentFirm } = useFirm();

  if (loading || !currentFirm) return null;

  const inactiveFirms = firms.filter((f) => f.id !== currentFirm.id);

  return (
    <div className={cn("rounded-xl border border-[#D8D5CE] bg-white p-3 shadow-xs flex flex-col gap-2.5", compact && "p-2")}>
      {/* Active Firm Container - Informational context only */}
      <div>
        <div className="px-1 text-[10px] font-semibold tracking-[0.15em] text-[#7A7F85] uppercase">
          Active Firm
        </div>
        <div className="mt-1 flex items-center gap-2 rounded-lg bg-[#FAF8F5] px-2.5 py-1.5 border border-[#EFECE6]">
          <span className="size-2 rounded-full bg-[#2E7D32]" />
          <span className="text-[13px] font-bold text-[#1A1D20] truncate">
            {currentFirm.name}
          </span>
        </div>
      </div>

      {/* Switch Firm Options - Inactive firms only */}
      {inactiveFirms.length > 0 && (
        <div className="pt-1 border-t border-[#EFECE6]">
          <div className="px-1 mb-1 text-[10px] font-semibold tracking-[0.15em] text-[#7A7F85] uppercase">
            Switch Firm
          </div>
          <div className="flex flex-col gap-1">
            {inactiveFirms.map((f) => {
              const short = f.name
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setCurrentFirm(f.id)}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] font-medium text-[#5F6368] hover:bg-[#F4F1EA] hover:text-[#1A1D20] transition-colors"
                >
                  <span className="grid size-5 shrink-0 place-items-center rounded bg-[#EFECE6] text-[9px] font-bold text-[#1A1D20]">
                    {short}
                  </span>
                  <span className="truncate">{f.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  let lastSection: string | undefined;

  return (
    <nav className="flex flex-col gap-0.5 text-[13px] font-medium">
      {NAV.map((item) => {
        const showSection = item.section && item.section !== lastSection;
        lastSection = item.section;

        let active = false;
        if (item.href === "/dashboard") {
          active = pathname === "/dashboard" || pathname === "/";
        } else if (item.href === "/masters/parties") {
          active = pathname.startsWith("/masters");
        } else if (item.href === "/billing/bills") {
          active = pathname === "/billing/bills" || pathname.startsWith("/billing/bills/");
        } else if (item.href === "/billing/new") {
          active = pathname === "/billing/new";
        } else {
          active = pathname === item.href || pathname.startsWith(item.href + "/");
        }

        const handleLinkClick = () => {
          if (onNavigate) onNavigate();
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("close-mobile-sidebar"));
          }
        };

        return (
          <div key={item.href}>
            {showSection && (
              <div className="mt-4 mb-1.5 px-3 text-[10px] font-bold tracking-[0.18em] text-[#7A7F85] uppercase">
                {item.section}
              </div>
            )}
            <Link
              href={item.href}
              onClick={handleLinkClick}
              className={cn(
                "flex items-center rounded-lg px-3 py-2 transition-all duration-150",
                active
                  ? "bg-[#E05638] font-semibold text-white shadow-xs"
                  : "text-[#5F6368] hover:bg-[#EFECE6] hover:text-[#1A1D20]"
              )}
            >
              <span>{item.label}</span>
            </Link>
          </div>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const { currentFirm } = useFirm();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleToggle = () => setMobileOpen((prev) => !prev);
    const handleClose = () => setMobileOpen(false);

    window.addEventListener("toggle-mobile-sidebar", handleToggle);
    window.addEventListener("close-mobile-sidebar", handleClose);

    return () => {
      window.removeEventListener("toggle-mobile-sidebar", handleToggle);
      window.removeEventListener("close-mobile-sidebar", handleClose);
    };
  }, []);

  const closeMobileSidebar = () => {
    setMobileOpen(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("close-mobile-sidebar"));
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

  const firstName = currentFirm ? currentFirm.name.split(" ")[0] : "Transport";

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="sidebar-backdrop fixed inset-0 z-30 bg-black/40 backdrop-blur-xs lg:hidden"
          onClick={closeMobileSidebar}
          aria-hidden="true"
        />
      )}

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "sidebar fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col gap-4 overflow-y-auto bg-[#FAF8F5] border-r border-[#D8D5CE] p-4 text-[#1A1D20] lg:flex",
          mobileOpen && "mobile-open flex bg-[#FAF8F5]"
        )}
      >
        {/* Brand Header */}
        <div className="flex items-center gap-2.5 px-1 py-1">
          <div className="font-display grid size-9 place-items-center rounded-xl bg-[#E05638] text-base font-bold text-white shadow-xs">
            {shortName}
          </div>
          <div>
            <div className="font-display text-base leading-none font-bold text-[#1A1D20]">
              {firstName}
            </div>
            <div className="mt-0.5 text-[10px] font-semibold tracking-[0.18em] text-[#7A7F85] uppercase">
              Transport Books
            </div>
          </div>
        </div>

        {/* Firm Switcher */}
        <FirmSwitcher />

        {/* Navigation List */}
        <NavList />

        {/* Working Firm Footer Card */}
        <div className="mt-auto rounded-xl border border-[#D8D5CE] bg-white p-3 shadow-xs">
          <div className="text-[10px] font-semibold tracking-[0.18em] text-[#7A7F85] uppercase">
            Working Context
          </div>
          <div className="font-display mt-1 text-sm font-bold text-[#1A1D20] truncate">
            {currentFirm?.name || "Transport App"}
          </div>
          <div className="mt-0.5 text-[11px] text-[#5F6368]">
            CODE {currentFirm?.code || "N/A"}
          </div>
        </div>
      </aside>
    </>
  );
}
