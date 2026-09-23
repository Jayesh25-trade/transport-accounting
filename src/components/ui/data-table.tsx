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
    <div className={cn("data-table-wrapper", className)}>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  col.align === "right" && "text-right",
                  col.align === "center" && "text-center",
                  col.className
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={col.key}>
                      <div className="skeleton h-4 rounded" style={{ width: `${60 + Math.random() * 30}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            : data.length === 0
            ? (
              <tr>
                <td colSpan={columns.length} className="py-0 px-0">
                  {emptyState ?? (
                    <div className="flex flex-col items-center py-10 text-gray-400 text-sm">
                      No records found
                    </div>
                  )}
                </td>
              </tr>
            )
            : data.map((row, i) => (
                <tr
                  key={String((row as Record<string, unknown>)[keyField] ?? i)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(onRowClick && "cursor-pointer")}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        col.align === "right" && "text-right",
                        col.align === "center" && "text-center",
                        (col.key.includes("amount") ||
                          col.key.includes("balance") ||
                          col.key.includes("total") ||
                          col.key.includes("weight")) &&
                          "numeric",
                        col.className
                      )}
                    >
                      {col.render
                        ? col.render(row)
                        : String((row as Record<string, unknown>)[col.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
        {footer && (
          <tfoot>
            <tr>
              <td colSpan={columns.length} className="border-t border-gray-200 dark:border-gray-700">
                {footer}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
