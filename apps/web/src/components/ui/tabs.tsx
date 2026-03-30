"use client";

import { type ReactNode, useState } from "react";
import { clsx } from "clsx";

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab?: string;
  onChange?: (tabId: string) => void;
  children?: ReactNode;
  variant?: "default" | "pills";
}

export function Tabs({
  tabs,
  activeTab: controlledActive,
  onChange,
  variant = "default",
}: TabsProps) {
  const [internalActive, setInternalActive] = useState(tabs[0]?.id);
  const activeTab = controlledActive ?? internalActive;

  const handleChange = (tabId: string) => {
    setInternalActive(tabId);
    onChange?.(tabId);
  };

  if (variant === "pills") {
    return (
      <div className="flex items-center gap-2 p-1 bg-ink-50 rounded-lg">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleChange(tab.id)}
            className={clsx(
              "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-150",
              activeTab === tab.id
                ? "bg-white text-ink-800 shadow-warm-sm"
                : "text-ink-400 hover:text-ink-600"
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={clsx(
                  "text-2xs px-1.5 py-0.5 rounded-full",
                  activeTab === tab.id
                    ? "bg-clay-100 text-clay-600"
                    : "bg-ink-100 text-ink-400"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="border-b border-ink-100">
      <div className="flex items-center gap-0 -mb-px">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleChange(tab.id)}
            className={clsx(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all duration-150",
              activeTab === tab.id
                ? "border-clay-500 text-clay-600"
                : "border-transparent text-ink-400 hover:text-ink-600 hover:border-ink-200"
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={clsx(
                  "text-2xs px-1.5 py-0.5 rounded-full",
                  activeTab === tab.id
                    ? "bg-clay-100 text-clay-600"
                    : "bg-ink-100 text-ink-400"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

interface TabPanelProps {
  id: string;
  activeTab: string;
  children: ReactNode;
}

export function TabPanel({ id, activeTab, children }: TabPanelProps) {
  if (id !== activeTab) return null;
  return <div className="animate-fade-in">{children}</div>;
}
