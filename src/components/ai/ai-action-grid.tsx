"use client";

import React from "react";
import {
  BookPlus,
  BookOpen,
  Receipt,
  FileText,
  FilePlus,
  CreditCard,
  Scale,
  Clock,
  BarChart3,
  Upload,
  Sparkles,
  HelpCircle,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type AIActionType =
  | "ADD_DAILY_BOOK"
  | "VIEW_DAILY_BOOK"
  | "ADD_DRIVER_VOUCHER"
  | "VIEW_DRIVER_VOUCHERS"
  | "CREATE_BILL"
  | "VIEW_BILLS"
  | "RECORD_PAYMENT"
  | "VIEW_PAYMENTS"
  | "VIEW_LEDGER"
  | "QUERY_OUTSTANDING"
  | "QUERY_AGING"
  | "QUERY_TODAY_SUMMARY"
  | "QUERY_CUSTOMER_BALANCE"
  | "UPLOAD_DOCUMENT"
  | "QUERY_SHORTAGE";

interface ActionCategory {
  category: string;
  items: {
    id: AIActionType;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    prompt?: string;
    isForm?: boolean;
    color?: string;
  }[];
}

const CATEGORIES: ActionCategory[] = [
  {
    category: "OPERATIONS",
    items: [
      { id: "ADD_DAILY_BOOK", label: "Add Daily Book Entry", icon: BookPlus, isForm: true, color: "text-blue-600 bg-blue-50 border-blue-200" },
      { id: "VIEW_DAILY_BOOK", label: "View Today's Trips", icon: BookOpen, prompt: "Show today's trips" },
      { id: "ADD_DRIVER_VOUCHER", label: "Add Driver Voucher", icon: Receipt, isForm: true, color: "text-amber-600 bg-amber-50 border-amber-200" },
      { id: "VIEW_DRIVER_VOUCHERS", label: "View Driver Vouchers", icon: Receipt, prompt: "Show driver voucher summary" },
    ],
  },
  {
    category: "ACCOUNTS",
    items: [
      { id: "CREATE_BILL", label: "Create Bill", icon: FilePlus, isForm: true, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
      { id: "VIEW_BILLS", label: "View Recent Bills", icon: FileText, prompt: "Show recent bills" },
      { id: "RECORD_PAYMENT", label: "Record Payment", icon: CreditCard, isForm: true, color: "text-purple-600 bg-purple-50 border-purple-200" },
      { id: "VIEW_PAYMENTS", label: "View Today's Payments", icon: CreditCard, prompt: "Show today's payments" },
      { id: "VIEW_LEDGER", label: "View Customer Ledger", icon: Scale, prompt: "Show customer ledger summary" },
    ],
  },
  {
    category: "REPORTS",
    items: [
      { id: "QUERY_OUTSTANDING", label: "Total Outstanding", icon: Clock, prompt: "What is my total outstanding?" },
      { id: "QUERY_AGING", label: "Aging Analysis", icon: BarChart3, prompt: "Show aging report" },
      { id: "QUERY_TODAY_SUMMARY", label: "Today's Summary", icon: TrendingUp, prompt: "Show today's summary" },
      { id: "QUERY_SHORTAGE", label: "Shortage & Debits", icon: HelpCircle, prompt: "Show shortage debit details" },
    ],
  },
  {
    category: "DOCUMENTS",
    items: [
      { id: "UPLOAD_DOCUMENT", label: "Upload Bill / PDF", icon: Upload, isForm: true, color: "text-[#E05638] bg-[#FAF8F5] border-[#D8D5CE]" },
    ],
  },
];

interface AiActionGridProps {
  onSelectAction: (actionId: AIActionType, prompt?: string) => void;
}

export function AiActionGrid({ onSelectAction }: AiActionGridProps) {
  return (
    <div className="space-y-4 py-2">
      <div className="text-center px-2">
        <div className="mx-auto grid size-10 place-items-center rounded-2xl bg-[#E05638]/10 text-[#E05638]">
          <Sparkles size={20} />
        </div>
        <h4 className="font-display mt-2 text-sm font-bold text-[#1A1D20]">
          Transport Accounting Assistant
        </h4>
        <p className="mt-0.5 text-xs text-[#7A7F85]">
          Select an action or ask anything below.
        </p>
      </div>

      <div className="space-y-3 px-1">
        {CATEGORIES.map((cat) => (
          <div key={cat.category} className="space-y-1.5">
            <span className="text-[10px] font-bold tracking-wider text-[#7A7F85] uppercase px-1">
              {cat.category}
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {cat.items.map((item) => {
                const IconComponent = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectAction(item.id, item.prompt)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border border-[#D8D5CE] bg-white p-2.5 text-left text-xs font-medium text-[#1A1D20] shadow-xs transition-all hover:border-[#E05638] hover:bg-[#FAF8F5] active:scale-[0.98]",
                      item.isForm && "border-dashed"
                    )}
                  >
                    <div
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-lg border text-[#1A1D20]",
                        item.color || "bg-[#FAF8F5] border-[#D8D5CE]"
                      )}
                    >
                      <IconComponent size={14} />
                    </div>
                    <span className="leading-tight truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
