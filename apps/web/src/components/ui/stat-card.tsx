"use client";

import { type ReactNode } from "react";
import { clsx } from "clsx";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  previousValue?: string | number;
  trend?: "up" | "down" | "flat";
  trendValue?: string;
  icon?: ReactNode;
  variant?: "default" | "success" | "warning" | "danger";
  className?: string;
}

const trendConfig = {
  up: {
    icon: TrendingUp,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
  },
  down: {
    icon: TrendingDown,
    color: "text-red-400",
    bg: "bg-red-400/10",
  },
  flat: {
    icon: Minus,
    color: "text-gray-400",
    bg: "bg-gray-400/10",
  },
};

const iconVariants = {
  default: "bg-lurk-500/15 text-lurk-400",
  success: "bg-emerald-500/15 text-emerald-400",
  warning: "bg-yellow-500/15 text-yellow-400",
  danger: "bg-red-500/15 text-red-400",
};

export function StatCard({
  label,
  value,
  trend,
  trendValue,
  icon,
  variant = "default",
  className,
}: StatCardProps) {
  const trendInfo = trend ? trendConfig[trend] : null;

  return (
    <div
      className={clsx(
        "bg-surface-100 border border-gray-800/60 rounded-xl p-5 transition-all duration-150 hover:border-gray-700",
        className
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          {label}
        </span>
        {icon && (
          <div
            className={clsx(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              iconVariants[variant]
            )}
          >
            {icon}
          </div>
        )}
      </div>
      <div className="flex items-end gap-3">
        <span className="text-2xl font-bold text-gray-100 tracking-tight">
          {value}
        </span>
        {trendInfo && trendValue && (
          <div
            className={clsx(
              "flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium",
              trendInfo.bg,
              trendInfo.color
            )}
          >
            <trendInfo.icon className="w-3 h-3" />
            {trendValue}
          </div>
        )}
      </div>
    </div>
  );
}
