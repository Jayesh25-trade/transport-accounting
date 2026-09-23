import React from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ElementType;
  iconColor?: string;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconColor = "#6366f1",
  trend,
  trendLabel,
  className,
}: StatCardProps) {
  return (
    <div className={cn("stat-card", className)}>
      <div className="flex items-start justify-between">
        <div className="stat-label">{label}</div>
        {Icon && (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `${iconColor}15`, color: iconColor }}
          >
            <Icon size={16} />
          </div>
        )}
      </div>
      <div className="stat-value">{value}</div>
      {(sub || trendLabel) && (
        <div className="flex items-center gap-1.5 mt-1">
          {trendLabel && trend && (
            <span
              className={cn(
                "text-xs font-semibold",
                trend === "up" && "text-success",
                trend === "down" && "text-danger",
                trend === "neutral" && "text-gray-500"
              )}
            >
              {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}{" "}
              {trendLabel}
            </span>
          )}
          {sub && <span className="stat-sub">{sub}</span>}
        </div>
      )}
    </div>
  );
}

/* ─── Skeleton ─────────────────────────────────────────────── */
export function StatCardSkeleton() {
  return (
    <div className="stat-card">
      <div className="skeleton h-3 w-24 mb-3 rounded" />
      <div className="skeleton h-7 w-32 mb-2 rounded" />
      <div className="skeleton h-2.5 w-16 rounded" />
    </div>
  );
}
