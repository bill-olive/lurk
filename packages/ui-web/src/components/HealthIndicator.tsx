// ---------------------------------------------------------------------------
// HealthIndicator — circular progress ring showing customer health score
// ---------------------------------------------------------------------------

import React from 'react';
import clsx from 'clsx';
import type { AlertLevel } from '@lurk/shared-types';

// ---- Color by alert level --------------------------------------------------

const ALERT_COLORS: Record<AlertLevel, { ring: string; text: string; bg: string }> = {
  none: { ring: '#22c55e', text: '#166534', bg: '#dcfce7' },
  watch: { ring: '#f59e0b', text: '#92400e', bg: '#fef3c7' },
  action_required: { ring: '#f97316', text: '#9a3412', bg: '#ffedd5' },
  escalation: { ring: '#ef4444', text: '#991b1b', bg: '#fee2e2' },
};

// ---- Props -----------------------------------------------------------------

export interface HealthIndicatorProps {
  /** Health score (0 - 100). */
  score: number;
  /** Alert level determines the color scheme. */
  alertLevel: AlertLevel;
  /** Diameter of the indicator in pixels (default: 64). */
  size?: number;
  /** Stroke width of the progress ring (default: 4). */
  strokeWidth?: number;
  /** Optional label displayed below the score. */
  label?: string;
  /** Additional CSS class name. */
  className?: string;
}

// ---- Component -------------------------------------------------------------

export function HealthIndicator({
  score,
  alertLevel,
  size = 64,
  strokeWidth = 4,
  label,
  className,
}: HealthIndicatorProps) {
  const colors = ALERT_COLORS[alertLevel] ?? ALERT_COLORS.none;

  // SVG circle geometry
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(100, score));
  const offset = circumference - (clampedScore / 100) * circumference;

  const containerStyle: React.CSSProperties = {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  };

  const ringContainerStyle: React.CSSProperties = {
    position: 'relative',
    width: `${size}px`,
    height: `${size}px`,
  };

  const scoreStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: 700,
    fontSize: `${Math.round(size * 0.3)}px`,
    color: colors.text,
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '11px',
    fontWeight: 500,
    color: colors.text,
    backgroundColor: colors.bg,
    padding: '2px 8px',
    borderRadius: '9999px',
    whiteSpace: 'nowrap',
  };

  return (
    <div style={containerStyle} className={clsx(className)}>
      <div style={ringContainerStyle}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ transform: 'rotate(-90deg)' }}
        >
          {/* Background track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
          />
          {/* Progress arc */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={colors.ring}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        <div style={scoreStyle}>{clampedScore}</div>
      </div>
      {label && <span style={labelStyle}>{label}</span>}
    </div>
  );
}
