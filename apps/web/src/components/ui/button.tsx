"use client";

import { type ReactNode, type ButtonHTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "xs" | "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

const variantStyles = {
  primary:
    "bg-clay-500 hover:bg-clay-600 text-white shadow-warm-sm active:bg-clay-700",
  secondary:
    "bg-ink-50 hover:bg-ink-100 text-ink-700 border border-ink-200 active:bg-ink-200",
  danger:
    "bg-accent-red hover:bg-red-600 text-white shadow-warm-sm active:bg-red-700",
  ghost:
    "bg-transparent hover:bg-ink-50 text-ink-400 hover:text-ink-700 active:bg-ink-100",
  outline:
    "bg-transparent border border-ink-200 hover:border-ink-300 text-ink-600 hover:text-ink-800 hover:bg-ink-50",
};

const sizeStyles = {
  xs: "text-xs px-2 py-1 gap-1",
  sm: "text-xs px-3 py-1.5 gap-1.5",
  md: "text-sm px-4 py-2 gap-2",
  lg: "text-sm px-5 py-2.5 gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      loading = false,
      icon,
      iconRight,
      fullWidth = false,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={clsx(
          "inline-flex items-center justify-center font-medium rounded-lg",
          "transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-clay-300/40 focus:ring-offset-1 focus:ring-offset-ivory",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && "w-full",
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : icon ? (
          <span className="shrink-0">{icon}</span>
        ) : null}
        {children}
        {iconRight && <span className="shrink-0">{iconRight}</span>}
      </button>
    );
  }
);

Button.displayName = "Button";
