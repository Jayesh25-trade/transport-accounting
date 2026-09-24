"use client";

import React from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="h-full bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4 p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">
          <h2 className="text-xl font-bold text-red-400">Application Error</h2>
          <p className="text-xs text-slate-400">
            {error?.message || "An unhandled error occurred."}
          </p>
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Reload Application
          </button>
        </div>
      </body>
    </html>
  );
}
