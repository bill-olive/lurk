"use client";

import { type ReactNode } from "react";
import { clsx } from "clsx";
import { Inbox } from "lucide-react";
import { Button } from "./button";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center py-16 px-6 text-center",
        className
      )}
    >
      <div className="w-12 h-12 rounded-xl bg-ink-50 flex items-center justify-center mb-4">
        {icon || <Inbox className="w-6 h-6 text-ink-300" />}
      </div>
      <h3 className="text-sm font-semibold text-ink-600 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-ink-300 max-w-sm mb-4">{description}</p>
      )}
      {action && (
        <Button variant="secondary" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
