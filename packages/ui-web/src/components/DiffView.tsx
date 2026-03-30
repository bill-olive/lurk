// ---------------------------------------------------------------------------
// DiffView — unified diff viewer with line numbers and syntax highlighting
// ---------------------------------------------------------------------------

import React from 'react';
import clsx from 'clsx';

// ---- Types -----------------------------------------------------------------

export type DiffLineType = 'added' | 'removed' | 'context';

export interface DiffLine {
  type: DiffLineType;
  content: string;
  oldLineNumber: number | null;
  newLineNumber: number | null;
}

export interface DiffHunkData {
  header: string;
  lines: DiffLine[];
}

export interface DiffViewProps {
  /** Diff hunks to display. */
  hunks: DiffHunkData[];
  /** Title shown above the diff (e.g., artifact title). */
  title?: string;
  /** Maximum height in pixels before scrolling. */
  maxHeight?: number;
  /** Additional CSS class name. */
  className?: string;
}

// ---- Styles ----------------------------------------------------------------

const styles = {
  container: {
    fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
    fontSize: '13px',
    lineHeight: '20px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  } as React.CSSProperties,

  title: {
    padding: '8px 12px',
    backgroundColor: '#f3f4f6',
    borderBottom: '1px solid #d1d5db',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '13px',
    fontWeight: 600,
    color: '#374151',
  } as React.CSSProperties,

  scrollArea: (maxHeight?: number): React.CSSProperties => ({
    overflowY: maxHeight ? 'auto' : undefined,
    maxHeight: maxHeight ? `${maxHeight}px` : undefined,
  }),

  hunkHeader: {
    padding: '4px 12px',
    backgroundColor: '#dbeafe',
    color: '#1e40af',
    fontSize: '12px',
    fontWeight: 500,
    borderTop: '1px solid #d1d5db',
  } as React.CSSProperties,

  lineRow: (type: DiffLineType): React.CSSProperties => ({
    display: 'flex',
    backgroundColor:
      type === 'added'
        ? '#dcfce7'
        : type === 'removed'
          ? '#fee2e2'
          : 'transparent',
    borderLeft:
      type === 'added'
        ? '3px solid #22c55e'
        : type === 'removed'
          ? '3px solid #ef4444'
          : '3px solid transparent',
  }),

  lineNumber: {
    display: 'inline-block',
    width: '48px',
    minWidth: '48px',
    padding: '0 8px',
    textAlign: 'right' as const,
    color: '#9ca3af',
    userSelect: 'none' as const,
    borderRight: '1px solid #e5e7eb',
  } as React.CSSProperties,

  lineContent: (type: DiffLineType): React.CSSProperties => ({
    flex: 1,
    padding: '0 12px',
    whiteSpace: 'pre',
    color:
      type === 'added'
        ? '#166534'
        : type === 'removed'
          ? '#991b1b'
          : '#374151',
  }),

  prefix: (type: DiffLineType): React.CSSProperties => ({
    display: 'inline-block',
    width: '12px',
    fontWeight: 700,
    color:
      type === 'added'
        ? '#22c55e'
        : type === 'removed'
          ? '#ef4444'
          : '#9ca3af',
    userSelect: 'none' as const,
  }),
} as const;

// ---- Component -------------------------------------------------------------

function DiffLineRow({ line }: { line: DiffLine }) {
  const prefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';

  return (
    <div style={styles.lineRow(line.type)}>
      <span style={styles.lineNumber}>
        {line.oldLineNumber ?? ''}
      </span>
      <span style={styles.lineNumber}>
        {line.newLineNumber ?? ''}
      </span>
      <span style={styles.lineContent(line.type)}>
        <span style={styles.prefix(line.type)}>{prefix}</span>
        {line.content}
      </span>
    </div>
  );
}

function DiffHunk({ hunk }: { hunk: DiffHunkData }) {
  return (
    <div>
      {hunk.header && (
        <div style={styles.hunkHeader}>{hunk.header}</div>
      )}
      {hunk.lines.map((line, i) => (
        <DiffLineRow key={i} line={line} />
      ))}
    </div>
  );
}

export function DiffView({ hunks, title, maxHeight, className }: DiffViewProps) {
  return (
    <div style={styles.container} className={clsx(className)}>
      {title && <div style={styles.title}>{title}</div>}
      <div style={styles.scrollArea(maxHeight)}>
        {hunks.map((hunk, i) => (
          <DiffHunk key={i} hunk={hunk} />
        ))}
        {hunks.length === 0 && (
          <div
            style={{
              padding: '24px',
              textAlign: 'center',
              color: '#9ca3af',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            No changes
          </div>
        )}
      </div>
    </div>
  );
}
