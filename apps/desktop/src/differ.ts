// =============================================================================
// Differ — Text diff computation for file versioning
//
// Generates unified diffs and stats for content changes.
// Wraps a simple LCS-based diff since we can't import @lurk/diff-engine
// directly (it may have incompatible module format). This is a lightweight
// standalone implementation for the desktop daemon.
// =============================================================================

export interface DiffResult {
  patch: string;
  stats: { added: number; removed: number; changed: number };
}

export class Differ {
  computeDiff(oldContent: string, newContent: string): DiffResult {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');

    const hunks: string[] = [];
    let added = 0;
    let removed = 0;

    // Simple line-by-line diff using LCS approach
    const lcs = this.lcsMatrix(oldLines, newLines);
    const diffOps = this.backtrack(lcs, oldLines, newLines);

    let currentHunk: string[] = [];
    let hunkOldStart = 0;
    let hunkNewStart = 0;
    let hunkOldCount = 0;
    let hunkNewCount = 0;
    let contextBefore: string[] = [];

    for (const op of diffOps) {
      if (op.type === 'equal') {
        if (currentHunk.length > 0) {
          // Add trailing context (up to 3 lines)
          currentHunk.push(` ${op.line}`);
          hunkOldCount++;
          hunkNewCount++;

          // Check if we should flush the hunk
          const trailingContext = currentHunk.filter((l) => l.startsWith(' ')).length;
          if (trailingContext >= 3) {
            hunks.push(this.formatHunk(hunkOldStart, hunkOldCount, hunkNewStart, hunkNewCount, currentHunk));
            currentHunk = [];
            hunkOldCount = 0;
            hunkNewCount = 0;
          }
        }
        contextBefore.push(` ${op.line}`);
        if (contextBefore.length > 3) contextBefore.shift();
      } else {
        if (currentHunk.length === 0) {
          // Start new hunk with leading context
          hunkOldStart = Math.max(1, op.oldIdx - contextBefore.length + 1);
          hunkNewStart = Math.max(1, op.newIdx - contextBefore.length + 1);
          hunkOldCount = contextBefore.length;
          hunkNewCount = contextBefore.length;
          currentHunk = [...contextBefore];
        }

        if (op.type === 'remove') {
          currentHunk.push(`-${op.line}`);
          hunkOldCount++;
          removed++;
        } else if (op.type === 'add') {
          currentHunk.push(`+${op.line}`);
          hunkNewCount++;
          added++;
        }
        contextBefore = [];
      }
    }

    // Flush remaining hunk
    if (currentHunk.length > 0) {
      hunks.push(this.formatHunk(hunkOldStart, hunkOldCount, hunkNewStart, hunkNewCount, currentHunk));
    }

    return {
      patch: hunks.join('\n'),
      stats: { added, removed, changed: Math.min(added, removed) },
    };
  }

  private formatHunk(
    oldStart: number, oldCount: number,
    newStart: number, newCount: number,
    lines: string[],
  ): string {
    return `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@\n${lines.join('\n')}`;
  }

  private lcsMatrix(a: string[], b: string[]): number[][] {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    return dp;
  }

  private backtrack(
    dp: number[][],
    a: string[],
    b: string[],
  ): Array<{ type: 'equal' | 'add' | 'remove'; line: string; oldIdx: number; newIdx: number }> {
    const ops: Array<{ type: 'equal' | 'add' | 'remove'; line: string; oldIdx: number; newIdx: number }> = [];
    let i = a.length;
    let j = b.length;

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
        ops.unshift({ type: 'equal', line: a[i - 1], oldIdx: i, newIdx: j });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        ops.unshift({ type: 'add', line: b[j - 1], oldIdx: i, newIdx: j });
        j--;
      } else {
        ops.unshift({ type: 'remove', line: a[i - 1], oldIdx: i, newIdx: j });
        i--;
      }
    }

    return ops;
  }
}
