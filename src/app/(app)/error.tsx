"use client";

import React, { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/primitives";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[APP_MODULE_ERROR]", error);
  }, [error]);

  return (
    <div className="p-8 max-w-xl mx-auto my-12 bg-white dark:bg-gray-900 border border-red-200 dark:border-red-900/50 rounded-2xl shadow-lg animate-fade-in text-center space-y-4">
      <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-950/50 flex items-center justify-center mx-auto text-red-600 dark:text-red-400">
        <AlertTriangle size={28} />
      </div>

      <div className="space-y-1">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          Module Error Encountered
        </h2>
        <p className="text-xs text-gray-500 max-w-md mx-auto">
          {error?.message || "An unexpected error occurred while rendering this page module."}
        </p>
      </div>

      <div className="flex items-center justify-center gap-3 pt-2">
        <Button variant="primary" size="sm" onClick={() => reset()} icon={RefreshCw}>
          Try Again
        </Button>
        <Link href="/dashboard">
          <Button variant="secondary" size="sm" icon={Home}>
            Return to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
