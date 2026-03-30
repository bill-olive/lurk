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
    "bg-lurk-600 hover:bg-lurk-500 text-white shadow-sm shadow-lurk-900/30 active:bg-lurk-700",
  secondary:
    "bg-surface-200 hover:bg-surface-300 text-gray-200 border border-gray-700 active:bg-surface-400",
  danger:
    "bg-red-600/90 hover:bg-red-500 text-white shadow-sm shadow-red-900/30 active:bg-red-700",
  ghost:
    "bg-transparent hover:bg-surface-200 text-gray-400 hover:text-gray-200 active:bg-surface-300",
  outline:
    "bg-transparent border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-gray-100 hover:bg-surface-100",
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
          "transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-lurk-500/40 focus:ring-offset-1 focus:ring-offset-surface",
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
