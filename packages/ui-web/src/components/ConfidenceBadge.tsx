// ---------------------------------------------------------------------------
// ConfidenceBadge — color-coded confidence score badge
// ---------------------------------------------------------------------------

import React from 'react';
import clsx from 'clsx';

// ---- Props -----------------------------------------------------------------

export interface ConfidenceBadgeProps {
  /** Confidence score (0.0 - 1.0). */
  score: number;
  /** Whether to show the percentage label (default: true). */
  showLabel?: boolean;
  /** Badge size variant. */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS class name. */
  className?: string;
}

// ---- Color gradient logic --------------------------------------------------

interface BadgeColors {
  backgroundColor: string;
  textColor: string;
  borderColor: string;
}

function getConfidenceColors(score: number): BadgeColors {
  if (score < 0.5) {
    // Red zone: low confidence
    return {
      backgroundColor: '#fee2e2',
      textColor: '#991b1b',
      borderColor: '#fca5a5',
    };
  }
  if (score < 0.7) {
    // Yellow zone: moderate confidence
    return {
      backgroundColor: '#fef3c7',
      textColor: '#92400e',
      borderColor: '#fcd34d',
    };
  }
  // Green zone: high confidence
  return {
    backgroundColor: '#dcfce7',
    textColor: '#166534',
    borderColor: '#86efac',
  };
}

function getConfidenceLabel(score: number): string {
  if (score < 0.3) return 'Very Low';
  if (score < 0.5) return 'Low';
  if (score < 0.7) return 'Moderate';
  if (score < 0.85) return 'High';
  return 'Very High';
}

// ---- Size styles -----------------------------------------------------------

const sizeStyles: Record<string, React.CSSProperties> = {
  sm: { padding: '1px 6px', fontSize: '10px' },
  md: { padding: '2px 8px', fontSize: '12px' },
  lg: { padding: '4px 12px', fontSize: '14px' },
};

// ---- Component -------------------------------------------------------------

export function ConfidenceBadge({
  score,
  showLabel = true,
  size = 'md',
  className,
}: ConfidenceBadgeProps) {
  const clamped = Math.max(0, Math.min(1, score));
  const colors = getConfidenceColors(clamped);
  const percentage = Math.round(clamped * 100);

  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    borderRadius: '9999px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    lineHeight: 1.2,
    border: `1px solid ${colors.borderColor}`,
    backgroundColor: colors.backgroundColor,
    color: colors.textColor,
    whiteSpace: 'nowrap',
    ...sizeStyles[size],
  };

  const dotStyle: React.CSSProperties = {
    width: size === 'sm' ? '6px' : size === 'md' ? '8px' : '10px',
    height: size === 'sm' ? '6px' : size === 'md' ? '8px' : '10px',
    borderRadius: '50%',
    backgroundColor: colors.textColor,
    opacity: 0.7,
    flexShrink: 0,
  };

  return (
    <span style={style} className={clsx(className)}>
      <span style={dotStyle} />
      <span>{percentage}%</span>
      {showLabel && (
        <span style={{ fontWeight: 400, opacity: 0.8 }}>
          {getConfidenceLabel(clamped)}
        </span>
      )}
    </span>
  );
}
