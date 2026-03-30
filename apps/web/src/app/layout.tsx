"use client";

import { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { OrgContext, useOrgProvider, useAuth, SidebarContext, useSidebarProvider } from "@/lib/hooks";
import "./globals.css";

function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const orgValue = useOrgProvider();
  const sidebarValue = useSidebarProvider();
  const { user, loading } = useAuth();
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <SidebarContext.Provider value={sidebarValue}>
      <OrgContext.Provider value={orgValue}>
        <Sidebar />
        <div className={`transition-all duration-300 ${sidebarValue.collapsed ? "ml-16" : "ml-60"}`}>
          <Header />
          <main className="px-8 py-6 min-h-[calc(100vh-3.5rem)]">{children}</main>
        </div>
      </OrgContext.Provider>
    </SidebarContext.Provider>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>Lurk — Knowledge Platform</title>
        <meta name="description" content="Lurk - Artifact-centric knowledge collaboration" />
      </head>
      <body className="bg-ivory text-ink font-sans antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
