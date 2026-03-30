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
  default: "bg-gray-700/60 text-gray-300 border-gray-600/40",
  success: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  warning: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  danger: "bg-red-500/15 text-red-400 border-red-500/20",
  info: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  purple: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  outline: "bg-transparent text-gray-400 border-gray-600",
};

const dotStyles = {
  default: "bg-gray-400",
  success: "bg-emerald-400",
  warning: "bg-yellow-400",
  danger: "bg-red-400",
  info: "bg-blue-400",
  purple: "bg-purple-400",
  outline: "bg-gray-400",
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
