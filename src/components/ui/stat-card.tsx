import React from "react";
import { cn } from "@/lib/utils";

export type StatTone = "coral" | "ink" | "sun" | "turq" | "neutral";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  hint?: string;
  tone?: StatTone;
  icon?: React.ElementType;
  iconColor?: string;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  className?: string;
}

const TONE_BAR_STYLES: Record<StatTone, string> = {
  coral: "border-t-4 border-[#E05638]",
  ink: "border-t-4 border-[#1A1D20]",
  sun: "border-t-4 border-[#D97706]",
  turq: "border-t-4 border-[#0D9488]",
  neutral: "",
};

export function StatCard({
  label,
  value,
  sub,
  hint,
  tone,
  icon: Icon,
  iconColor = "#E05638",
  trend,
  trendLabel,
  className,
}: StatCardProps) {
  const displaySub = sub || hint;
  return (
    <div
      className={cn(
        "rounded-2xl border border-[#D8D5CE] bg-white p-4 shadow-xs transition-all hover:shadow-sm min-w-0 overflow-hidden flex flex-col justify-between",
        tone && TONE_BAR_STYLES[tone],
        className
      )}
    >
      <div className="flex items-center justify-between gap-1 min-w-0">
        <div className="text-[11px] font-bold tracking-wider text-[#5F6368] uppercase truncate min-w-0" title={label}>
          {label}
        </div>
        {Icon && (
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `${iconColor}14`, color: iconColor }}
          >
            <Icon size={14} />
          </div>
        )}
      </div>
      <div
        className="text-lg sm:text-xl font-bold tracking-tight text-[#1A1D20] mt-2 font-mono-nums truncate min-w-0"
        title={String(value)}
      >
        {value}
      </div>
      {(displaySub || trendLabel) && (
        <div className="flex items-center gap-1.5 mt-1.5 min-w-0">
          {trendLabel && trend && (
            <span
              className={cn(
                "text-[11px] font-semibold shrink-0",
                trend === "up" && "text-[#2E7D32]",
                trend === "down" && "text-[#D32F2F]",
                trend === "neutral" && "text-[#7A7F85]"
              )}
            >
              {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}{" "}
              {trendLabel}
            </span>
          )}
          {displaySub && <span className="text-[11px] text-[#7A7F85] truncate min-w-0">{displaySub}</span>}
        </div>
      )}
    </div>
  );
}

/* ─── Skeleton ─────────────────────────────────────────────── */
export function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-[#D8D5CE] bg-white p-4 shadow-xs min-w-0">
      <div className="skeleton h-3 w-20 mb-2 rounded" />
      <div className="skeleton h-6 w-28 mb-1.5 rounded" />
      <div className="skeleton h-2.5 w-14 rounded" />
    </div>
  );
}
