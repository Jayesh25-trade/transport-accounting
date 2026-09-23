"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  Users,
  Truck,
  Building2,
  MapPin,
  CreditCard,
  BookMarked,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FirmSwitcher } from "./firm-switcher";

interface NavItem {
  label: string;
  href?: string;
  icon: React.ElementType;
  badge?: string;
  children?: NavItem[];
  section?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Daily Book",
    href: "/daily-book",
    icon: BookOpen,
    badge: "New",
  },
  {
    label: "Driver Vouchers",
    href: "/driver-vouchers",
    icon: FileText,
  },
  {
    label: "Billing",
    icon: FileText,
    children: [
      { label: "Bills", href: "/billing/bills", icon: FileText },
      { label: "Create Bill", href: "/billing/new", icon: FileText },
    ],
  },
  {
    label: "Payments",
    href: "/payments",
    icon: CreditCard,
  },
  {
    label: "Ledger",
    href: "/ledger",
    icon: BookMarked,
  },
  {
    label: "Masters",
    icon: Users,
    children: [
      { label: "Parties", href: "/masters/parties", icon: Users },
      { label: "Companies", href: "/masters/companies", icon: Building2 },
      { label: "Trucks", href: "/masters/trucks", icon: Truck },
      { label: "Locations", href: "/masters/locations", icon: MapPin },
      { label: "Customer Rules", href: "/masters/customer-rules", icon: Settings2 },
    ],
  },
  {
    label: "Reports",
    icon: BarChart3,
    children: [
      { label: "Outstanding", href: "/reports/outstanding", icon: BarChart3 },
      { label: "Aging Analysis", href: "/reports/aging", icon: BarChart3 },
    ],
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

interface SidebarItemProps {
  item: NavItem;
  collapsed: boolean;
  depth?: number;
}

function SidebarNavItem({ item, collapsed, depth = 0 }: SidebarItemProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(() => {
    if (item.children) {
      return item.children.some((c) => c.href && pathname.startsWith(c.href));
    }
    return false;
  });

  const isActive = item.href
    ? pathname === item.href || pathname.startsWith(item.href + "/")
    : false;

  if (item.children) {
    const anyChildActive = item.children.some(
      (c) => c.href && (pathname === c.href || pathname.startsWith(c.href + "/"))
    );
    return (
      <div>
        <button
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "sidebar-item w-full text-left",
            anyChildActive && !open && "text-gray-100"
          )}
          style={{ paddingLeft: depth ? `${0.875 + depth * 0.75}rem` : undefined }}
          title={collapsed ? item.label : undefined}
        >
          <item.icon className="item-icon" />
          {!collapsed && (
            <>
              <span className="flex-1">{item.label}</span>
              {open ? (
                <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
              )}
            </>
          )}
        </button>
        {!collapsed && open && (
          <div>
            {item.children.map((child) => (
              <SidebarNavItem
                key={child.href ?? child.label}
                item={child}
                collapsed={collapsed}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href!}
      className={cn("sidebar-item", isActive && "active")}
      style={{ paddingLeft: depth ? `${0.875 + depth * 0.75}rem` : undefined }}
      title={collapsed ? item.label : undefined}
    >
      <item.icon className="item-icon" />
      {!collapsed && (
        <>
          <span className="flex-1">{item.label}</span>
          {item.badge && <span className="item-badge">{item.badge}</span>}
        </>
      )}
    </Link>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={cn("sidebar", collapsed && "collapsed")}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-icon">
          <Truck size={16} color="#fff" />
        </div>
        {!collapsed && (
          <span className="truncate leading-tight">
            Transport<br />
            <span className="text-gray-400 font-normal text-xs">Management</span>
          </span>
        )}
      </div>

      {/* Firm Switcher */}
      {!collapsed && <FirmSwitcher />}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV_ITEMS.map((item) => (
          <SidebarNavItem
            key={item.href ?? item.label}
            item={item}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* Collapse Toggle */}
      <div className="border-t border-white/5 p-2">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="sidebar-item w-full"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="item-icon" />
          ) : (
            <>
              <ChevronLeft className="item-icon" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
