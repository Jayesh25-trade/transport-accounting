import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { FirmProvider } from "@/lib/firm-context";
import { FormKeyboardNavigation } from "@/components/ui/form-keyboard-navigation";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: "%s | Transport Management",
    default: "Transport Management System",
  },
  description:
    "Professional transport billing and accounting management for Deepraj & Shivsai Transport",
  keywords: ["transport", "billing", "accounting", "freight", "ERP"],
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full">
        <FirmProvider>
          <FormKeyboardNavigation />
          {children}
        </FirmProvider>
      </body>
    </html>
  );
}
