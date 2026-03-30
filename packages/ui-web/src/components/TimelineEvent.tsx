// ---------------------------------------------------------------------------
// TimelineEvent — generic timeline event for activity feeds
// ---------------------------------------------------------------------------

import React from 'react';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import { Circle } from 'lucide-react';

// ---- Props -----------------------------------------------------------------

export interface TimelineEventProps {
  /** Icon component to display in the timeline marker. */
  icon?: LucideIcon;
  /** Color for the icon and timeline marker. */
  iconColor?: string;
  /** Event title. */
  title: string;
  /** Optional description / body text. */
  description?: string;
  /** ISO-8601 timestamp. */
  timestamp: string;
  /** Whether to show the connecting line to the next event (default: true). */
  showConnector?: boolean;
  /** Additional metadata displayed as key-value pairs. */
  metadata?: Record<string, string>;
  /** Optional action button or element displayed on the right. */
  action?: React.ReactNode;
  /** Additional CSS class name. */
  className?: string;
}

// ---- Time formatting -------------------------------------------------------

function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return 'just now';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;

  // Fall back to short date
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

// ---- Styles ----------------------------------------------------------------

const styles = {
  container: {
    display: 'flex',
    gap: '12px',
    position: 'relative' as const,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },

  markerColumn: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    flexShrink: 0,
    width: '32px',
  },

  iconCircle: (color: string): React.CSSProperties => ({
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: `${color}15`,
    border: `2px solid ${color}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }),

  connector: {
    width: '2px',
    flex: 1,
    backgroundColor: '#e5e7eb',
    marginTop: '4px',
    minHeight: '16px',
  } as React.CSSProperties,

  content: {
    flex: 1,
    paddingBottom: '20px',
    minWidth: 0,
  } as React.CSSProperties,

  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '8px',
  } as React.CSSProperties,

  title: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#111827',
    lineHeight: '20px',
    margin: 0,
  } as React.CSSProperties,

  timestamp: {
    fontSize: '12px',
    color: '#9ca3af',
    whiteSpace: 'nowrap' as const,
    lineHeight: '20px',
    flexShrink: 0,
  } as React.CSSProperties,

  description: {
    fontSize: '13px',
    color: '#6b7280',
    lineHeight: '18px',
    marginTop: '4px',
  } as React.CSSProperties,

  metadata: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '8px',
    marginTop: '8px',
  } as React.CSSProperties,

  metaTag: {
    fontSize: '11px',
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    padding: '2px 6px',
    borderRadius: '4px',
  } as React.CSSProperties,

  actionRow: {
    marginTop: '8px',
  } as React.CSSProperties,
} as const;

// ---- Component -------------------------------------------------------------

export function TimelineEvent({
  icon,
  iconColor = '#6b7280',
  title,
  description,
  timestamp,
  showConnector = true,
  metadata,
  action,
  className,
}: TimelineEventProps) {
  const IconComponent = icon ?? Circle;

  return (
    <div style={styles.container} className={clsx(className)}>
      {/* Timeline marker */}
      <div style={styles.markerColumn}>
        <div style={styles.iconCircle(iconColor)}>
          <IconComponent size={14} color={iconColor} />
        </div>
        {showConnector && <div style={styles.connector} />}
      </div>

      {/* Content */}
      <div style={styles.content}>
        <div style={styles.header}>
          <p style={styles.title}>{title}</p>
          <span style={styles.timestamp}>{formatRelativeTime(timestamp)}</span>
        </div>

        {description && (
          <p style={styles.description}>{description}</p>
        )}

        {metadata && Object.keys(metadata).length > 0 && (
          <div style={styles.metadata}>
            {Object.entries(metadata).map(([key, value]) => (
              <span key={key} style={styles.metaTag}>
                {key}: {value}
              </span>
            ))}
          </div>
        )}

        {action && <div style={styles.actionRow}>{action}</div>}
      </div>
    </div>
  );
}
