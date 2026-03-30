// ---------------------------------------------------------------------------
// AgentBadge — displays agent type with color-coded styling
// ---------------------------------------------------------------------------

import React from 'react';
import clsx from 'clsx';
import {
  User,
  Users,
  Building2,
  Briefcase,
  Mic,
  Calendar,
  type LucideIcon,
} from 'lucide-react';
import type { AgentType } from '@lurk/shared-types';

// ---- Color schemes per agent type ------------------------------------------

interface AgentBadgeTheme {
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  icon: LucideIcon;
  label: string;
}

const AGENT_THEMES: Record<AgentType, AgentBadgeTheme> = {
  personal: {
    backgroundColor: '#dbeafe',
    textColor: '#1e40af',
    borderColor: '#93c5fd',
    icon: User,
    label: 'Personal',
  },
  team: {
    backgroundColor: '#dcfce7',
    textColor: '#166534',
    borderColor: '#86efac',
    icon: Users,
    label: 'Team',
  },
  org: {
    backgroundColor: '#f3e8ff',
    textColor: '#6b21a8',
    borderColor: '#c4b5fd',
    icon: Building2,
    label: 'Org',
  },
  function: {
    backgroundColor: '#fef3c7',
    textColor: '#92400e',
    borderColor: '#fcd34d',
    icon: Briefcase,
    label: 'Function',
  },
  voice: {
    backgroundColor: '#fce7f3',
    textColor: '#9d174d',
    borderColor: '#f9a8d4',
    icon: Mic,
    label: 'Voice',
  },
  calendar: {
    backgroundColor: '#cffafe',
    textColor: '#155e75',
    borderColor: '#67e8f9',
    icon: Calendar,
    label: 'Calendar',
  },
  migration: {
    backgroundColor: '#f3f4f6',
    textColor: '#374151',
    borderColor: '#d1d5db',
    icon: Building2,
    label: 'Migration',
  },
};

// ---- Props -----------------------------------------------------------------

export interface AgentBadgeProps {
  /** The agent type to display. */
  type: AgentType;
  /** Optional agent name to show alongside the type label. */
  name?: string;
  /** Badge size variant. */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS class name. */
  className?: string;
}

// ---- Styles ----------------------------------------------------------------

const sizeStyles: Record<string, React.CSSProperties> = {
  sm: { padding: '2px 8px', fontSize: '11px', gap: '4px' },
  md: { padding: '4px 10px', fontSize: '12px', gap: '6px' },
  lg: { padding: '6px 14px', fontSize: '14px', gap: '8px' },
};

const iconSizes: Record<string, number> = {
  sm: 12,
  md: 14,
  lg: 16,
};

// ---- Component -------------------------------------------------------------

export function AgentBadge({
  type,
  name,
  size = 'md',
  className,
}: AgentBadgeProps) {
  const theme = AGENT_THEMES[type];

  if (!theme) {
    return null;
  }

  const IconComponent = theme.icon;
  const displayLabel = name ? `${name}` : theme.label;

  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: '9999px',
    fontWeight: 500,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    lineHeight: 1,
    border: `1px solid ${theme.borderColor}`,
    backgroundColor: theme.backgroundColor,
    color: theme.textColor,
    whiteSpace: 'nowrap',
    ...sizeStyles[size],
  };

  return (
    <span style={style} className={clsx(className)}>
      <IconComponent
        size={iconSizes[size]}
        style={{ flexShrink: 0 }}
      />
      {displayLabel}
    </span>
  );
}
