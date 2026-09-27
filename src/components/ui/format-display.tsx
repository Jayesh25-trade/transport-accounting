import React from "react";
import { cn } from "@/lib/utils";

interface MoneyDisplayProps {
  amount: number | null | undefined;
  currency?: string;
  decimals?: number;
  className?: string;
  placeholder?: string;
}

export function MoneyDisplay({
  amount,
  currency = "₹",
  decimals = 2,
  className,
  placeholder = "—",
}: MoneyDisplayProps) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return <span className={cn("text-gray-400", className)}>{placeholder}</span>;
  }

  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);

  return (
    <span className={cn("tnum font-semibold", className)}>
      {currency ? `${currency}${formatted}` : formatted}
    </span>
  );
}

interface WeightDisplayProps {
  weightInTonnes: number | null | undefined;
  unit?: string;
  decimals?: number;
  className?: string;
  placeholder?: string;
}

export function WeightDisplay({
  weightInTonnes,
  unit = "T",
  decimals = 3,
  className,
  placeholder = "—",
}: WeightDisplayProps) {
  if (weightInTonnes === null || weightInTonnes === undefined || isNaN(weightInTonnes)) {
    return <span className={cn("text-gray-400", className)}>{placeholder}</span>;
  }

  const formatted = weightInTonnes.toFixed(decimals);

  return (
    <span className={cn("tnum font-medium", className)}>
      {formatted} {unit}
    </span>
  );
}
