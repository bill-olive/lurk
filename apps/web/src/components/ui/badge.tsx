"use client";

import { type ReactNode } from "react";
import { clsx } from "clsx";

interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "purple" | "outline";
  size?: "sm" | "md";
  dot?: boolean;
  className?: string;
}

const variantStyles = {
  default: "bg-ink-100 text-ink-600 border-ink-200",
  success: "bg-olive-50 text-olive-700 border-olive-200",
  warning: "bg-yellow-50 text-yellow-700 border-yellow-200",
  danger: "bg-clay-50 text-clay-700 border-clay-200",
  info: "bg-blue-50 text-blue-700 border-blue-200",
  purple: "bg-heather-50 text-heather-700 border-heather-200",
  outline: "bg-transparent text-ink-500 border-ink-200",
};

const dotStyles = {
  default: "bg-ink-400",
  success: "bg-olive-500",
  warning: "bg-yellow-500",
  danger: "bg-clay-500",
  info: "bg-blue-500",
  purple: "bg-heather-500",
  outline: "bg-ink-400",
};

const sizeStyles = {
  sm: "text-2xs px-1.5 py-0.5",
  md: "text-xs px-2 py-0.5",
};

export function Badge({
  children,
  variant = "default",
  size = "md",
  dot = false,
  className,
}: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 font-medium rounded-md border",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {dot && (
        <span
          className={clsx("w-1.5 h-1.5 rounded-full shrink-0", dotStyles[variant])}
        />
      )}
      {children}
    </span>
  );
}
