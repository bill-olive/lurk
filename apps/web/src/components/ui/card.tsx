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
  default: "bg-white border border-ink-100 shadow-warm-sm",
  bordered: "bg-ivory border border-ink-200",
  ghost: "bg-transparent",
  glow: "bg-white border border-clay-200 shadow-warm",
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
        hover && "hover:bg-ink-50 hover:border-ink-200 cursor-pointer hover:shadow-warm",
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
    <h3 className={clsx("text-body-sm font-semibold text-ink-800", className)}>
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
    <p className={clsx("text-2xs text-ink-400 mt-1", className)}>{children}</p>
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
        "flex items-center justify-between mt-4 pt-4 border-t border-ink-100",
        className
      )}
    >
      {children}
    </div>
  );
}
