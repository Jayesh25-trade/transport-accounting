import React from "react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  className?: string;
  render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T extends object> {
  columns: Column<T>[];
  data: T[];
  keyField?: string;
  loading?: boolean;
  emptyState?: React.ReactNode;
  onRowClick?: (row: T) => void;
  className?: string;
  footer?: React.ReactNode;
}

export function TableShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-[#D8D5CE] bg-white shadow-xs", className)}>
      <table className="w-full border-collapse text-[13.5px] text-[#1A1D20]">{children}</table>
    </div>
  );
}

export function Th({
  children,
  align,
  colSpan,
  className,
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
  colSpan?: number;
  className?: string;
}) {
  return (
    <th
      colSpan={colSpan}
      className={cn(
        "bg-[#FAF8F5] border-b border-[#D8D5CE] px-3.5 py-3 text-left text-[11px] font-semibold tracking-wider text-[#5F6368] uppercase whitespace-nowrap",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align,
  colSpan,
  className,
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
  colSpan?: number;
  className?: string;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        "border-b border-[#EFECE6] px-3.5 py-3 text-[#1A1D20] align-middle",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className
      )}
    >
      {children}
    </td>
  );
}

export function DataTable<T extends object>({
  columns,
  data,
  keyField = "id",
  loading,
  emptyState,
  onRowClick,
  className,
  footer,
}: DataTableProps<T>) {
  return (
    <TableShell className={className}>
      <thead>
        <tr>
          {columns.map((col) => (
            <Th
              key={col.key}
              align={col.align}
              className={col.className}
            >
              {col.label}
            </Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {columns.map((col) => (
                  <Td key={col.key}>
                    <div className="skeleton h-4 rounded bg-[#EFECE6]" style={{ width: `${60 + Math.random() * 30}%` }} />
                  </Td>
                ))}
              </tr>
            ))
          : data.length === 0
          ? (
            <tr>
              <Td colSpan={columns.length} className="py-0 px-0">
                {emptyState ?? (
                  <div className="flex flex-col items-center py-10 text-[#7A7F85] text-sm">
                    No records found
                  </div>
                )}
              </Td>
            </tr>
          )
          : data.map((row, i) => (
              <tr
                key={String((row as Record<string, unknown>)[keyField] ?? i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "hover:bg-[#FAF8F5] transition-colors",
                  onRowClick && "cursor-pointer"
                )}
              >
                {columns.map((col) => (
                  <Td
                    key={col.key}
                    align={col.align}
                    className={cn(
                      (col.key.includes("amount") ||
                        col.key.includes("balance") ||
                        col.key.includes("total") ||
                        col.key.includes("weight")) &&
                        "font-mono-nums",
                      col.className
                    )}
                  >
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[col.key] ?? "")}
                  </Td>
                ))}
              </tr>
            ))}
      </tbody>
      {footer && (
        <tfoot>
          <tr>
            <Td colSpan={columns.length} className="border-t border-[#D8D5CE] bg-[#FAF8F5]">
              {footer}
            </Td>
          </tr>
        </tfoot>
      )}
    </TableShell>
  );
}
