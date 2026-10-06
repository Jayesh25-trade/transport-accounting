"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { AiChatDrawer } from "@/components/ai/ai-chat-drawer";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Reset body overflow on route navigation to prevent modal overflow traps
  useEffect(() => {
    document.body.style.overflow = "";
  }, [pathname]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />
      <Topbar />
      <main className="mx-auto max-w-[1320px] px-4 py-6 pb-24 md:px-8 md:py-8 md:pb-28 lg:ml-[248px]">
        {children}
      </main>
      <AiChatDrawer />
    </div>
  );
}

