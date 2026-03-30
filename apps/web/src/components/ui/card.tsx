"use client";

import { type ReactNode } from "react";
import { clsx } from "clsx";

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "bordered" | "ghost" | "glow";
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
  onClick?: () => void;
}

const variantStyles = {
  default: "bg-surface-100 border border-gray-800/60",
  bordered: "bg-surface-50 border border-gray-700",
  ghost: "bg-transparent",
  glow: "bg-surface-100 border border-lurk-500/20 glow-border",
};

const paddingStyles = {
  none: "",
  sm: "p-3",
  md: "p-5",
  lg: "p-6",
};

export function Card({
  children,
  className,
  variant = "default",
  padding = "md",
  hover = false,
  onClick,
}: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-xl transition-all duration-150",
        variantStyles[variant],
        paddingStyles[padding],
        hover && "hover:bg-surface-200 hover:border-gray-700 cursor-pointer",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("flex items-center justify-between mb-4", className)}>
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h3 className={clsx("text-sm font-semibold text-gray-200", className)}>
      {children}
    </h3>
  );
}

export function CardDescription({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={clsx("text-xs text-gray-500 mt-1", className)}>{children}</p>
  );
}

export function CardContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={clsx(className)}>{children}</div>;
}

export function CardFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "flex items-center justify-between mt-4 pt-4 border-t border-gray-800/60",
        className
      )}
    >
      {children}
    </div>
  );
}
