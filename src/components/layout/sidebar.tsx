"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFirm } from "@/lib/firm-context";
import { cn } from "@/lib/utils";

const NAV: { href: string; label: string; icon: string; section?: string }[] = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/daily-book", label: "Daily Book", icon: "📒", section: "Operations" },
  { href: "/driver-vouchers", label: "Driver Vouchers", icon: "🚚", section: "Operations" },
  { href: "/billing/bills", label: "Bills", icon: "🧾", section: "Accounts" },
  { href: "/billing/new", label: "Create Bill", icon: "➕", section: "Accounts" },
  { href: "/payments", label: "Payments", icon: "💳", section: "Accounts" },
  { href: "/ledger", label: "Ledger", icon: "📖", section: "Accounts" },
  { href: "/masters/parties", label: "Masters", icon: "🗂️", section: "Setup" },
  { href: "/reports/outstanding", label: "Outstanding", icon: "📌", section: "Reports" },
  { href: "/reports/aging", label: "Aging Analysis", icon: "⏳", section: "Reports" },
  { href: "/settings", label: "Settings", icon: "⚙️", section: "Setup" },
];

export function FirmSwitcher({ compact }: { compact?: boolean }) {
  const { currentFirm, firms, loading, setCurrentFirm } = useFirm();

  if (loading || !currentFirm) return null;

  return (
    <div className={cn("rounded-2xl bg-white/6 p-1.5", compact && "flex gap-1.5")}>
      {!compact && (
        <div className="px-2 pt-1 pb-1.5 text-[10px] font-semibold tracking-[0.2em] text-ink-foreground/45 uppercase">
          Active firm
        </div>
      )}
      <div className={cn("flex gap-1.5", !compact && "flex-col")}>
        {firms.map((f) => {
          const short = f.name
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
          const isActive = f.id === currentFirm.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setCurrentFirm(f.id)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[12px] font-semibold transition-colors",
                isActive
                  ? "bg-coral text-coral-foreground"
                  : "text-ink-foreground/55 hover:bg-white/8 hover:text-ink-foreground"
              )}
            >
              <span
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-md text-[9px] font-bold",
                  isActive ? "bg-white/25" : "bg-white/10"
                )}
              >
                {short}
              </span>
              <span className="truncate">{f.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  let lastSection: string | undefined;

  return (
    <nav className="flex flex-col gap-1 text-[13px] font-medium">
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
              <div className="mt-4 mb-1.5 px-3.5 text-[10px] font-semibold tracking-[0.2em] text-ink-foreground/35 uppercase">
                {item.section}
              </div>
            )}
            <Link
              href={item.href}
              onClick={handleLinkClick}
              className={cn(
                "flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 transition-colors",
                active
                  ? "bg-coral font-semibold text-coral-foreground"
                  : "text-ink-foreground/65 hover:bg-white/6 hover:text-ink-foreground"
              )}
            >
              <span aria-hidden>{item.icon}</span>
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
          className="sidebar-backdrop fixed inset-0 z-30 bg-ink/60 lg:hidden"
          onClick={closeMobileSidebar}
          aria-hidden="true"
        />
      )}

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "sidebar fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col gap-5 overflow-y-auto bg-ink p-5 text-ink-foreground lg:flex",
          mobileOpen && "mobile-open flex"
        )}
      >
        {/* Brand Header */}
        <div className="flex items-center gap-2.5">
          <div className="font-display grid size-10 place-items-center rounded-2xl bg-coral text-xl font-bold text-coral-foreground">
            {shortName}
          </div>
          <div>
            <div className="font-display text-lg leading-none font-bold">
              {firstName}
            </div>
            <div className="mt-0.5 text-[10px] tracking-[0.2em] text-ink-foreground/50 uppercase">
              Transport Books
            </div>
          </div>
        </div>

        {/* Firm Switcher */}
        <FirmSwitcher />

        {/* Navigation List */}
        <NavList />

        {/* Working Firm Footer Card */}
        <div className="mt-auto rounded-3xl bg-white/6 p-4">
          <div className="text-[10px] tracking-[0.18em] text-ink-foreground/45 uppercase">
            Working in
          </div>
          <div className="font-display mt-1 text-xl font-bold">
            {currentFirm?.name || "Transport App"}
          </div>
          <div className="mt-1 text-[11px] text-ink-foreground/55">
            CODE {currentFirm?.code || "N/A"}
          </div>
        </div>
      </aside>
    </>
  );
}
