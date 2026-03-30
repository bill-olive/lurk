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
      <div className="flex items-center gap-2 p-1 bg-surface-200/50 rounded-lg">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleChange(tab.id)}
            className={clsx(
              "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-150",
              activeTab === tab.id
                ? "bg-surface-100 text-gray-100 shadow-sm"
                : "text-gray-500 hover:text-gray-300"
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={clsx(
                  "text-2xs px-1.5 py-0.5 rounded-full",
                  activeTab === tab.id
                    ? "bg-lurk-600/30 text-lurk-300"
                    : "bg-surface-300 text-gray-500"
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
    <div className="border-b border-gray-800/60">
      <div className="flex items-center gap-0 -mb-px">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleChange(tab.id)}
            className={clsx(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all duration-150",
              activeTab === tab.id
                ? "border-lurk-500 text-lurk-400"
                : "border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-700"
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={clsx(
                  "text-2xs px-1.5 py-0.5 rounded-full",
                  activeTab === tab.id
                    ? "bg-lurk-600/20 text-lurk-300"
                    : "bg-surface-300 text-gray-500"
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
