"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { clsx } from "clsx";
import {
  FileText,
  LayoutDashboard,
  Shield,
  Bot,
  Users,
  ScrollText,
  ArrowLeftRight,
  Plug,
  HeartPulse,
  BarChart3,
  Power,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Feather,
} from "lucide-react";
import { useState } from "react";

const navSections = [
  {
    title: "Library",
    items: [
      { label: "Artifacts", href: "/artifacts", icon: FileText },
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "Governance",
    items: [
      { label: "Policies", href: "/policies", icon: Shield },
      { label: "Agents", href: "/agents", icon: Bot },
      { label: "Teams & Access", href: "/teams", icon: Users },
    ],
  },
  {
    title: "Data",
    items: [
      { label: "Audit Trail", href: "/audit", icon: ScrollText },
      { label: "Migration", href: "/migration", icon: ArrowLeftRight },
      { label: "Connectors", href: "/connectors", icon: Plug },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { label: "Customer Health", href: "/customer-health", icon: HeartPulse },
      { label: "Analytics", href: "/analytics", icon: BarChart3 },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Kill Switches", href: "/kill-switches", icon: Power },
    ],
  },
  {
    title: "Learn",
    items: [
      { label: "Tutorials", href: "/tutorials", icon: BookOpen },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={clsx(
        "fixed left-0 top-0 h-screen bg-white border-r border-ink-100 flex flex-col z-40 transition-all duration-300",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-ink-100 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-clay-500 flex items-center justify-center shrink-0">
          <Feather className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-body-sm font-bold text-ink-800 tracking-tight font-serif">
              Lurk
            </span>
            <span className="text-2xs text-ink-300">Knowledge Platform</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2.5">
        {navSections.map((section) => (
          <div key={section.title} className="mb-4">
            {!collapsed && (
              <div className="px-3 py-1 mb-1">
                <span className="text-2xs font-semibold text-ink-300 uppercase tracking-widest">
                  {section.title}
                </span>
              </div>
            )}
            {section.items.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" &&
                  pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "flex items-center gap-3 px-3 py-2 text-body-sm font-medium rounded-lg transition-all duration-200 mb-0.5",
                    isActive
                      ? "text-clay-600 bg-clay-50"
                      : "text-ink-400 hover:text-ink-700 hover:bg-ink-50"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon
                    className={clsx(
                      "w-4 h-4 shrink-0",
                      isActive ? "text-clay-500" : "text-ink-300"
                    )}
                  />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-2.5 border-t border-ink-100 shrink-0">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center p-2 rounded-lg text-ink-300 hover:text-ink-500 hover:bg-ink-50 transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>
    </aside>
  );
}
