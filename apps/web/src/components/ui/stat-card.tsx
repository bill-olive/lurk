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
    color: "text-olive-600",
    bg: "bg-olive-50",
  },
  down: {
    icon: TrendingDown,
    color: "text-accent-red",
    bg: "bg-red-50",
  },
  flat: {
    icon: Minus,
    color: "text-ink-400",
    bg: "bg-ink-100",
  },
};

const iconVariants = {
  default: "bg-clay-100 text-clay-500",
  success: "bg-olive-100 text-olive-500",
  warning: "bg-yellow-50 text-yellow-600",
  danger: "bg-clay-50 text-accent-red",
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
        "bg-white border border-ink-100 rounded-editorial p-5 transition-all duration-150 hover:border-ink-200 hover:shadow-warm",
        className
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-caption font-medium text-ink-400 uppercase tracking-wider">
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
        <span className="text-2xl font-bold text-ink-800 tracking-tight">
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
