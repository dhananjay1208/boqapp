import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BOQ Management System",
  description: "Bill of Quantities Management System for Construction Projects",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar - hidden on mobile */}
          <aside className="hidden md:flex md:w-64 md:flex-col">
            <Sidebar />
          </aside>

          {/* Main content area */}
          <main className="flex-1 overflow-y-auto bg-slate-50">
            {children}
          </main>
        </div>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
