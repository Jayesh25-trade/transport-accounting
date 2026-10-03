"use client";

import React, { useState, useEffect } from "react";
import { Download, Monitor, CheckCircle2, X, Info } from "lucide-react";
import { Button } from "@/components/ui/primitives";

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already running as standalone PWA
    if (typeof window !== "undefined") {
      const isStandaloneMatch =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;
      setIsStandalone(isStandaloneMatch);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  return { deferredPrompt, isStandalone };
}

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: any;
}

export function PwaInstallModal({ isOpen, onClose, deferredPrompt }: InstallModalProps) {
  if (!isOpen) return null;

  async function handleNativeInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        onClose();
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-[#D8D5CE] space-y-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FDF2F0] border border-[#E05638]/20 flex items-center justify-center text-[#E05638]">
              <Monitor size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1A1D20]">Install Transport Accounting</h3>
              <p className="text-xs text-[#5F6368]">Desktop &amp; Mobile App Installation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#7A7F85] hover:text-[#1A1D20] p-1 rounded-lg hover:bg-[#FAF8F5]"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-[#1A1D20] leading-relaxed">
          Install this application on your computer or phone for faster access, desktop window support, and quick launcher integration.
        </p>

        {deferredPrompt ? (
          <div className="space-y-3 pt-1">
            <Button
              variant="coral"
              className="w-full justify-center py-2.5"
              onClick={handleNativeInstall}
            >
              <Download size={15} className="mr-2" /> Install App Now
            </Button>
            <p className="text-[11px] text-[#7A7F85] text-center">
              Clicking install will trigger your browser's official application installation prompt.
            </p>
          </div>
        ) : (
          <div className="rounded-xl bg-[#FAF8F5] border border-[#EFECE6] p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#1A1D20]">
              <Info size={14} className="text-[#E05638]" />
              <span>How to install in Google Chrome:</span>
            </div>
            <ol className="space-y-2 text-xs text-[#374151]">
              <li className="flex items-start gap-2">
                <span className="font-bold text-[#E05638] shrink-0">1.</span>
                <span>Click the <strong>three dots (⋮)</strong> menu in the top-right corner of Chrome.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-[#E05638] shrink-0">2.</span>
                <span>Select <strong>"Cast, save, and share"</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-[#E05638] shrink-0">3.</span>
                <span>Select <strong>"Install page as app"</strong> (or "Install Transport Accounting").</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-[#E05638] shrink-0">4.</span>
                <span>Confirm installation in the popup.</span>
              </li>
            </ol>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-[#EFECE6]">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
