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
        "rounded-2xl border border-[#D8D5CE] bg-white p-6 shadow-xs transition-shadow hover:shadow-md",
        tone && TONE_BAR_STYLES[tone],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="text-xs font-semibold tracking-wider text-[#5F6368] uppercase">{label}</div>
        {Icon && (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `${iconColor}12`, color: iconColor }}
          >
            <Icon size={16} />
          </div>
        )}
      </div>
      <div className="text-2xl font-bold tracking-tight text-[#1A1D20] mt-2 font-mono-nums">{value}</div>
      {(displaySub || trendLabel) && (
        <div className="flex items-center gap-1.5 mt-1.5">
          {trendLabel && trend && (
            <span
              className={cn(
                "text-xs font-semibold",
                trend === "up" && "text-[#2E7D32]",
                trend === "down" && "text-[#D32F2F]",
                trend === "neutral" && "text-[#7A7F85]"
              )}
            >
              {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}{" "}
              {trendLabel}
            </span>
          )}
          {displaySub && <span className="text-xs text-[#7A7F85]">{displaySub}</span>}
        </div>
      )}
    </div>
  );
}

/* ─── Skeleton ─────────────────────────────────────────────── */
export function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-[#D8D5CE] bg-white p-6 shadow-xs">
      <div className="skeleton h-3 w-24 mb-3 rounded" />
      <div className="skeleton h-7 w-32 mb-2 rounded" />
      <div className="skeleton h-2.5 w-16 rounded" />
    </div>
  );
}
