// =============================================================================
// DiffEngine — Computes diffs for text and structured content
//
// Implements a real line-based diff algorithm (LCS) for text
// and a recursive structural diff for JSON content.
//
// The output conforms to @lurk/shared-types Diff/DiffHunk, where each hunk
// has a content string (unified diff format) and a header string.
// =============================================================================

import type {
  Diff,
  DiffHunk,
} from '@lurk/shared-types';

// ---------------------------------------------------------------------------
// Internal line-level diff types (richer than what shared-types exposes)
// ---------------------------------------------------------------------------

export interface DiffLineDetail {
  type: 'add' | 'remove' | 'context';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DetailedDiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLineDetail[];
  header: string;
}

export interface DetailedDiff {
  type: 'text' | 'structured';
  hunks: DetailedDiffHunk[];
  summary: string;
  addedLines: number;
  removedLines: number;
  changedSections: string[];
}

// ---------------------------------------------------------------------------
// DiffEngine
// ---------------------------------------------------------------------------

export class DiffEngine {
  /**
   * Compute a line-based text diff between original and modified strings.
   * Uses the Longest Common Subsequence (LCS) algorithm to identify changes,
   * then groups changes into context-aware hunks.
   *
   * Returns both the standard Diff (shared-types compatible) and a detailed
   * version with per-line metadata accessible via computeDetailedTextDiff.
   */
  computeTextDiff(
    original: string,
    modified: string,
    contextLines: number = 3,
  ): Diff {
    const detailed = this.computeDetailedTextDiff(original, modified, contextLines);
    return detailedToSharedDiff(detailed);
  }

  /**
   * Compute a detailed text diff with per-line type information.
   * Useful for rendering rich diffs in the UI.
   */
  computeDetailedTextDiff(
    original: string,
    modified: string,
    contextLines: number = 3,
  ): DetailedDiff {
    const oldLines = splitLines(original);
    const newLines = splitLines(modified);

    // Compute LCS to find matching lines
    const lcs = computeLCS(oldLines, newLines);

    // Build raw diff operations from LCS
    const rawOps = buildDiffOps(oldLines, newLines, lcs);

    // Group into hunks with context
    const hunks = groupIntoHunks(rawOps, contextLines);

    // Compute stats
    let addedLines = 0;
    let removedLines = 0;
    const changedSections: string[] = [];

    for (const hunk of hunks) {
      for (const line of hunk.lines) {
        if (line.type === 'add') addedLines++;
        if (line.type === 'remove') removedLines++;
      }
      changedSections.push(hunk.header);
    }

    const summary = this.generateDiffSummary({
      type: 'text',
      hunks: hunks.map(detailedHunkToShared),
      summary: '',
      addedLines,
      removedLines,
      changedSections,
      voiceNarration: null,
    });

    return {
      type: 'text',
      hunks,
      summary,
      addedLines,
      removedLines,
      changedSections,
    };
  }

  /**
   * Compute a structured diff for JSON/structured content.
   * Recursively walks both objects and produces a diff with changes
   * expressed as path-based additions, removals, and modifications.
   */
  computeStructuredDiff(
    original: unknown,
    modified: unknown,
  ): Diff {
    const changes = diffStructured(original, modified, '');
    const hunks = structuredChangesToHunks(changes);

    let addedLines = 0;
    let removedLines = 0;
    const changedSections: string[] = [];

    for (const change of changes) {
      if (change.type === 'add') addedLines++;
      if (change.type === 'remove') removedLines++;
      if (change.type === 'modify') {
        addedLines++;
        removedLines++;
      }
      changedSections.push(change.path);
    }

    const summary = this.generateDiffSummary({
      type: 'structured',
      hunks,
      summary: '',
      addedLines,
      removedLines,
      changedSections,
      voiceNarration: null,
    });

    return {
      type: 'structured',
      hunks,
      summary,
      addedLines,
      removedLines,
      changedSections,
      voiceNarration: null,
    };
  }

  /**
   * Generate a human-readable summary of a diff.
   */
  generateDiffSummary(diff: Diff): string {
    const totalChanges = diff.addedLines + diff.removedLines;

    if (totalChanges === 0) {
      return 'No changes detected.';
    }

    const parts: string[] = [];

    if (diff.addedLines > 0) {
      parts.push(`${diff.addedLines} line${diff.addedLines === 1 ? '' : 's'} added`);
    }
    if (diff.removedLines > 0) {
      parts.push(`${diff.removedLines} line${diff.removedLines === 1 ? '' : 's'} removed`);
    }

    const sectionCount = diff.changedSections.length;
    if (sectionCount > 0) {
      parts.push(
        `across ${sectionCount} section${sectionCount === 1 ? '' : 's'}`,
      );
    }

    const prefix = diff.type === 'structured' ? 'Structural diff: ' : '';
    return `${prefix}${parts.join(', ')}.`;
  }

  /**
   * Compute statistics for a diff.
   */
  computeDiffStats(diff: Diff): {
    addedLines: number;
    removedLines: number;
    changedSections: number;
  } {
    return {
      addedLines: diff.addedLines,
      removedLines: diff.removedLines,
      changedSections: diff.changedSections.length,
    };
  }
}

// =============================================================================
// LCS-based line diff algorithm
// =============================================================================

/**
 * Compute the Longest Common Subsequence table.
 * Returns a 2D table where table[i][j] = LCS length of
 * oldLines[0..i-1] and newLines[0..j-1].
 */
function computeLCS(oldLines: string[], newLines: string[]): number[][] {
  const m = oldLines.length;
  const n = newLines.length;

  const table: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        table[i][j] = table[i - 1][j - 1] + 1;
      } else {
        table[i][j] = Math.max(table[i - 1][j], table[i][j - 1]);
      }
    }
  }

  return table;
}

// ---------------------------------------------------------------------------
// Raw diff operation
// ---------------------------------------------------------------------------

interface DiffOp {
  type: 'add' | 'remove' | 'equal';
  oldIndex?: number;
  newIndex?: number;
  content: string;
}

/**
 * Build diff operations by backtracking through the LCS table.
 */
function buildDiffOps(
  oldLines: string[],
  newLines: string[],
  table: number[][],
): DiffOp[] {
  const ops: DiffOp[] = [];
  let i = oldLines.length;
  let j = newLines.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      ops.push({
        type: 'equal',
        oldIndex: i - 1,
        newIndex: j - 1,
        content: oldLines[i - 1],
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || table[i][j - 1] >= table[i - 1][j])) {
      ops.push({
        type: 'add',
        newIndex: j - 1,
        content: newLines[j - 1],
      });
      j--;
    } else {
      ops.push({
        type: 'remove',
        oldIndex: i - 1,
        content: oldLines[i - 1],
      });
      i--;
    }
  }

  ops.reverse();
  return ops;
}

/**
 * Group raw diff operations into hunks with surrounding context lines.
 */
function groupIntoHunks(
  ops: DiffOp[],
  contextLines: number,
): DetailedDiffHunk[] {
  if (ops.length === 0) return [];

  // Find ranges of changes (non-equal operations)
  const changeRanges: Array<{ start: number; end: number }> = [];
  let inChange = false;
  let rangeStart = 0;

  for (let i = 0; i < ops.length; i++) {
    if (ops[i].type !== 'equal') {
      if (!inChange) {
        rangeStart = i;
        inChange = true;
      }
    } else if (inChange) {
      changeRanges.push({ start: rangeStart, end: i - 1 });
      inChange = false;
    }
  }
  if (inChange) {
    changeRanges.push({ start: rangeStart, end: ops.length - 1 });
  }

  if (changeRanges.length === 0) return [];

  // Merge nearby ranges that share context
  const mergedRanges: Array<{ start: number; end: number }> = [];
  let current = changeRanges[0];

  for (let i = 1; i < changeRanges.length; i++) {
    const next = changeRanges[i];
    const gap = next.start - current.end - 1;
    if (gap <= contextLines * 2) {
      current = { start: current.start, end: next.end };
    } else {
      mergedRanges.push(current);
      current = next;
    }
  }
  mergedRanges.push(current);

  // Build hunks from merged ranges
  const hunks: DetailedDiffHunk[] = [];

  for (const range of mergedRanges) {
    const expandedStart = Math.max(0, range.start - contextLines);
    const expandedEnd = Math.min(ops.length - 1, range.end + contextLines);

    const lines: DiffLineDetail[] = [];
    let oldStart = Infinity;
    let newStart = Infinity;
    let oldCount = 0;
    let newCount = 0;

    for (let i = expandedStart; i <= expandedEnd; i++) {
      const op = ops[i];

      if (op.type === 'equal') {
        const oldLineNum = (op.oldIndex ?? 0) + 1;
        const newLineNum = (op.newIndex ?? 0) + 1;
        oldStart = Math.min(oldStart, oldLineNum);
        newStart = Math.min(newStart, newLineNum);
        oldCount++;
        newCount++;
        lines.push({
          type: 'context',
          content: op.content,
          oldLineNumber: oldLineNum,
          newLineNumber: newLineNum,
        });
      } else if (op.type === 'remove') {
        const oldLineNum = (op.oldIndex ?? 0) + 1;
        oldStart = Math.min(oldStart, oldLineNum);
        oldCount++;
        lines.push({
          type: 'remove',
          content: op.content,
          oldLineNumber: oldLineNum,
        });
      } else if (op.type === 'add') {
        const newLineNum = (op.newIndex ?? 0) + 1;
        newStart = Math.min(newStart, newLineNum);
        newCount++;
        lines.push({
          type: 'add',
          content: op.content,
          newLineNumber: newLineNum,
        });
      }
    }

    if (oldStart === Infinity) oldStart = 1;
    if (newStart === Infinity) newStart = 1;

    const header = `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`;
    hunks.push({ oldStart, oldCount, newStart, newCount, lines, header });
  }

  return hunks;
}

// =============================================================================
// Structured (JSON) diff algorithm
// =============================================================================

interface StructuredChange {
  type: 'add' | 'remove' | 'modify';
  path: string;
  oldValue?: unknown;
  newValue?: unknown;
}

/**
 * Recursively diff two values (primitives, arrays, objects).
 */
function diffStructured(
  oldVal: unknown,
  newVal: unknown,
  path: string,
): StructuredChange[] {
  if (oldVal === undefined && newVal === undefined) return [];
  if (oldVal === null && newVal === null) return [];

  if (oldVal === undefined || oldVal === null) {
    return [{ type: 'add', path: path || '(root)', newValue: newVal }];
  }
  if (newVal === undefined || newVal === null) {
    return [{ type: 'remove', path: path || '(root)', oldValue: oldVal }];
  }

  if (typeof oldVal !== typeof newVal) {
    return [
      { type: 'modify', path: path || '(root)', oldValue: oldVal, newValue: newVal },
    ];
  }

  if (Array.isArray(oldVal) && Array.isArray(newVal)) {
    return diffArrays(oldVal, newVal, path);
  }

  if (typeof oldVal === 'object' && typeof newVal === 'object') {
    return diffObjects(
      oldVal as Record<string, unknown>,
      newVal as Record<string, unknown>,
      path,
    );
  }

  if (oldVal !== newVal) {
    return [
      { type: 'modify', path: path || '(root)', oldValue: oldVal, newValue: newVal },
    ];
  }

  return [];
}

function diffObjects(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
  basePath: string,
): StructuredChange[] {
  const changes: StructuredChange[] = [];
  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

  for (const key of allKeys) {
    const childPath = basePath ? `${basePath}.${key}` : key;

    if (!(key in oldObj)) {
      changes.push({ type: 'add', path: childPath, newValue: newObj[key] });
    } else if (!(key in newObj)) {
      changes.push({ type: 'remove', path: childPath, oldValue: oldObj[key] });
    } else {
      changes.push(...diffStructured(oldObj[key], newObj[key], childPath));
    }
  }

  return changes;
}

function diffArrays(
  oldArr: unknown[],
  newArr: unknown[],
  basePath: string,
): StructuredChange[] {
  const changes: StructuredChange[] = [];
  const maxLen = Math.max(oldArr.length, newArr.length);

  for (let i = 0; i < maxLen; i++) {
    const childPath = `${basePath}[${i}]`;

    if (i >= oldArr.length) {
      changes.push({ type: 'add', path: childPath, newValue: newArr[i] });
    } else if (i >= newArr.length) {
      changes.push({ type: 'remove', path: childPath, oldValue: oldArr[i] });
    } else {
      changes.push(...diffStructured(oldArr[i], newArr[i], childPath));
    }
  }

  return changes;
}

/**
 * Convert structured changes into shared-types DiffHunks.
 */
function structuredChangesToHunks(changes: StructuredChange[]): DiffHunk[] {
  if (changes.length === 0) return [];

  const contentLines: string[] = [];
  let removeCount = 0;
  let addCount = 0;

  for (const change of changes) {
    switch (change.type) {
      case 'add':
        contentLines.push(`+ ${change.path}: ${formatValue(change.newValue)}`);
        addCount++;
        break;
      case 'remove':
        contentLines.push(`- ${change.path}: ${formatValue(change.oldValue)}`);
        removeCount++;
        break;
      case 'modify':
        contentLines.push(`- ${change.path}: ${formatValue(change.oldValue)}`);
        contentLines.push(`+ ${change.path}: ${formatValue(change.newValue)}`);
        removeCount++;
        addCount++;
        break;
    }
  }

  const header = '@@ structured diff @@';

  return [
    {
      oldStart: 1,
      oldCount: removeCount,
      newStart: 1,
      newCount: addCount,
      content: contentLines.join('\n'),
      header,
    },
  ];
}

// ---------------------------------------------------------------------------
// Conversion: DetailedDiffHunk -> shared-types DiffHunk
// ---------------------------------------------------------------------------

function detailedHunkToShared(hunk: DetailedDiffHunk): DiffHunk {
  const contentLines: string[] = [];

  for (const line of hunk.lines) {
    switch (line.type) {
      case 'context':
        contentLines.push(` ${line.content}`);
        break;
      case 'add':
        contentLines.push(`+${line.content}`);
        break;
      case 'remove':
        contentLines.push(`-${line.content}`);
        break;
    }
  }

  return {
    oldStart: hunk.oldStart,
    oldCount: hunk.oldCount,
    newStart: hunk.newStart,
    newCount: hunk.newCount,
    content: contentLines.join('\n'),
    header: hunk.header,
  };
}

function detailedToSharedDiff(detailed: DetailedDiff): Diff {
  return {
    type: detailed.type as 'text' | 'structured' | 'binary' | 'multimodal',
    hunks: detailed.hunks.map(detailedHunkToShared),
    summary: detailed.summary,
    addedLines: detailed.addedLines,
    removedLines: detailed.removedLines,
    changedSections: detailed.changedSections,
    voiceNarration: null,
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function splitLines(text: string): string[] {
  if (text === '') return [];
  return text.split('\n');
}

function formatValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'object') {
    try {
      const str = JSON.stringify(value);
      return str.length > 80 ? str.slice(0, 77) + '...' : str;
    } catch {
      return '[object]';
    }
  }
  return String(value);
}
