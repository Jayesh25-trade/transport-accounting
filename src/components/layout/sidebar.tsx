"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFirm } from "@/lib/firm-context";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  BookOpen,
  Receipt,
  FileText,
  FilePlus,
  CreditCard,
  Scale,
  Users,
  Building2,
  Truck,
  MapPin,
  Sliders,
  Settings,
  Clock,
  BarChart3,
  FolderKanban,
} from "lucide-react";
import { FirmSwitcher } from "@/components/layout/firm-switcher";
export { FirmSwitcher };

// ─── Navigation definition with icons ─────────────────────────
type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  section?: string;
  indent?: boolean;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/daily-book", label: "Daily Book", icon: BookOpen, section: "Operations" },
  { href: "/driver-vouchers", label: "Driver Vouchers", icon: Receipt },
  { href: "/billing/bills", label: "Bills", icon: FileText, section: "Accounts" },
  { href: "/billing/new", label: "Create Bill", icon: FilePlus },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/ledger", label: "Ledger", icon: Scale },
  // Masters (Setup) — all modules listed
  { href: "/masters/parties", label: "Parties", icon: Users, section: "Setup" },
  { href: "/masters/companies", label: "Companies", icon: Building2, indent: true },
  { href: "/masters/trucks", label: "Trucks", icon: Truck, indent: true },
  { href: "/masters/locations", label: "Locations", icon: MapPin, indent: true },
  { href: "/masters/customer-rules", label: "Customer Rules", icon: Sliders, indent: true },
  { href: "/masters/bank-accounts", label: "Bank Accounts", icon: Building2, indent: true },
  { href: "/masters/bill-settings", label: "Bill Settings", icon: Settings, indent: true },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/reports/outstanding", label: "Outstanding", icon: Clock, section: "Reports" },
  { href: "/reports/aging", label: "Aging Analysis", icon: BarChart3 },
];

const MASTERS_HREFS = [
  "/masters/parties",
  "/masters/companies",
  "/masters/trucks",
  "/masters/locations",
  "/masters/customer-rules",
  "/masters/bank-accounts",
  "/masters/bill-settings",
];

export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [mastersOpen, setMastersOpen] = useState(
    MASTERS_HREFS.some((h) => pathname.startsWith(h))
  );

  useEffect(() => {
    if (MASTERS_HREFS.some((h) => pathname.startsWith(h))) {
      setMastersOpen(true);
    }
  }, [pathname]);

  const handleLinkClick = () => {
    if (onNavigate) onNavigate();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("close-mobile-sidebar"));
    }
  };

  let lastSection: string | undefined;
  const mastersActive = MASTERS_HREFS.some((h) => pathname.startsWith(h));

  return (
    <nav className="flex flex-col gap-0.5 text-[13px] font-medium">
      {NAV.map((item) => {
        const IconComponent = item.icon;
        const isMastersFirst = item.href === "/masters/parties";
        const isMastersItem = MASTERS_HREFS.includes(item.href);

        const showSection = item.section && item.section !== lastSection;
        if (item.section) lastSection = item.section;

        let active = false;
        if (item.href === "/dashboard") {
          active = pathname === "/dashboard" || pathname === "/";
        } else if (item.href === "/billing/bills") {
          active = pathname === "/billing/bills" || pathname.startsWith("/billing/bills/");
        } else if (item.href === "/billing/new") {
          active = pathname === "/billing/new";
        } else {
          active = pathname === item.href || pathname.startsWith(item.href + "/");
        }

        // For indented items (all masters except first): only show if mastersOpen
        if (isMastersItem && !isMastersFirst) {
          if (!mastersOpen) return null;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleLinkClick}
              className={cn(
                "flex items-center gap-2.5 rounded-lg pl-7 pr-3 py-1.5 transition-all duration-150 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-[#E05638] focus-visible:ring-offset-2",
                active
                  ? "bg-[#E05638] font-semibold text-white shadow-xs"
                  : "text-[#5F6368] hover:bg-[#EFECE6] hover:text-[#1A1D20]"
              )}
            >
              <IconComponent size={14} className={cn("shrink-0", active ? "text-white" : "text-[#7A7F85]")} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        }

        return (
          <div key={item.href}>
            {showSection && (
              <div className="mt-4 mb-1.5 px-3 text-[10px] font-bold tracking-[0.18em] text-[#1A1D20] uppercase">
                {item.section}
              </div>
            )}

            {/* Masters collapsible group header */}
            {isMastersFirst && (
              <button
                type="button"
                onClick={() => setMastersOpen((v) => !v)}
                className={cn(
                  "w-full flex items-center justify-between rounded-lg px-3 py-2 transition-all duration-150 text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-[#E05638] focus-visible:ring-offset-2",
                  mastersActive
                    ? "text-[#E05638] font-semibold"
                    : "text-[#5F6368] hover:bg-[#EFECE6] hover:text-[#1A1D20]"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <FolderKanban size={16} className={cn("shrink-0", mastersActive ? "text-[#E05638]" : "text-[#7A7F85]")} />
                  <span>Masters</span>
                </div>
                {mastersOpen ? (
                  <ChevronDown size={13} className="opacity-70" />
                ) : (
                  <ChevronRight size={13} className="opacity-70" />
                )}
              </button>
            )}

            {/* The "Parties" link itself appears inside the expanded Masters */}
            {isMastersFirst && mastersOpen && (
              <Link
                href={item.href}
                onClick={handleLinkClick}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg pl-7 pr-3 py-1.5 transition-all duration-150 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-[#E05638] focus-visible:ring-offset-2",
                  active
                    ? "bg-[#E05638] font-semibold text-white shadow-xs"
                    : "text-[#5F6368] hover:bg-[#EFECE6] hover:text-[#1A1D20]"
                )}
              >
                <IconComponent size={14} className={cn("shrink-0", active ? "text-white" : "text-[#7A7F85]")} />
                <span className="truncate">Parties</span>
              </Link>
            )}

            {/* Regular link */}
            {!isMastersFirst && !isMastersItem && (
              <Link
                href={item.href}
                onClick={handleLinkClick}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[#E05638] focus-visible:ring-offset-2",
                  active
                    ? "bg-[#E05638] font-semibold text-white shadow-xs"
                    : "text-[#5F6368] hover:bg-[#EFECE6] hover:text-[#1A1D20]"
                )}
              >
                <IconComponent size={16} className={cn("shrink-0", active ? "text-white" : "text-[#7A7F85]")} />
                <span className="truncate">{item.label}</span>
              </Link>
            )}
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

  const fullFirmName = currentFirm ? currentFirm.name : "Transport";

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
          "sidebar fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col gap-3 overflow-hidden hover:overflow-y-auto bg-[#FAF8F5] border-r border-[#D8D5CE] p-4 text-[#1A1D20] lg:flex",
          mobileOpen && "mobile-open flex overflow-y-auto bg-[#FAF8F5]"
        )}
      >
        {/* Brand Header */}
        <div className="flex items-center gap-2.5 px-1 py-1">
          <div className="font-display grid size-9 place-items-center rounded-xl bg-[#E05638] text-base font-bold text-white shadow-xs shrink-0">
            {shortName}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-sm leading-tight font-bold text-[#1A1D20] truncate" title={fullFirmName}>
              {fullFirmName}
            </div>
            <div className="mt-0.5 text-[10px] font-semibold tracking-[0.18em] text-[#7A7F85] uppercase">
              Transport Books
            </div>
          </div>
        </div>

        {/* Single Unified Firm Switcher Dropdown */}
        <FirmSwitcher />

        {/* Navigation List */}
        <NavList />
      </aside>
    </>
  );
}
