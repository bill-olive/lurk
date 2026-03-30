// =============================================================================
// MergeEngine — Implements merge strategies from PRD Section 14.3
//
// Strategies:
//   fast_forward  — no divergence, move pointer
//   three_way     — standard three-way merge for text
//   theirs        — accept incoming changes (YOLO default)
//   ours          — keep current version (reject)
//   semantic_merge — placeholder delegating to LLM
//   agent_resolve  — placeholder delegating to agent
//   manual         — flag for human resolution
// =============================================================================

import type {
  MergeConflict,
} from '@lurk/shared-types';

// ---------------------------------------------------------------------------
// Merge strategy type (mirrors PRD Section 14.3)
// ---------------------------------------------------------------------------

export type MergeStrategy =
  | 'fast_forward'
  | 'three_way'
  | 'semantic_merge'
  | 'agent_resolve'
  | 'manual'
  | 'theirs'
  | 'ours';

// ---------------------------------------------------------------------------
// Merge result
// ---------------------------------------------------------------------------

export interface MergeResult {
  success: boolean;
  strategy: MergeStrategy;
  /** The merged content (undefined if merge failed). */
  merged?: string;
  /** Conflicts found during merge (empty if clean merge). */
  conflicts: MergeConflict[];
  /** Error message if merge failed. */
  error?: string;
  /** Whether the result requires external resolution (LLM or human). */
  requiresExternalResolution: boolean;
}

// ---------------------------------------------------------------------------
// Callback types for LLM/agent delegation
// ---------------------------------------------------------------------------

/**
 * Callback for semantic_merge strategy.
 * The LLM receives base, ours, theirs, and returns the merged content.
 */
export type SemanticMergeCallback = (
  base: string,
  ours: string,
  theirs: string,
  conflicts: MergeConflict[],
) => Promise<string>;

/**
 * Callback for agent_resolve strategy.
 * An agent resolves the conflicts and returns merged content.
 */
export type AgentResolveCallback = (
  base: string,
  ours: string,
  theirs: string,
  conflicts: MergeConflict[],
) => Promise<string>;

// ---------------------------------------------------------------------------
// MergeEngine
// ---------------------------------------------------------------------------

export class MergeEngine {
  private semanticMergeCallback?: SemanticMergeCallback;
  private agentResolveCallback?: AgentResolveCallback;

  /**
   * Register a callback for semantic_merge strategy.
   * This would typically call Claude to intelligently merge structured content.
   */
  registerSemanticMerge(callback: SemanticMergeCallback): void {
    this.semanticMergeCallback = callback;
  }

  /**
   * Register a callback for agent_resolve strategy.
   * This would typically delegate to an agent to resolve conflicts.
   */
  registerAgentResolve(callback: AgentResolveCallback): void {
    this.agentResolveCallback = callback;
  }

  /**
   * Merge two versions using the specified strategy.
   *
   * @param base - The common ancestor content (null for fast-forward)
   * @param ours - The current version's content
   * @param theirs - The incoming version's content
   * @param strategy - Which merge strategy to use
   */
  async merge(
    base: string | null,
    ours: string,
    theirs: string,
    strategy: MergeStrategy,
  ): Promise<MergeResult> {
    switch (strategy) {
      case 'fast_forward':
        return this.fastForward(base, ours, theirs);

      case 'three_way':
        return this.threeWay(base ?? '', ours, theirs);

      case 'theirs':
        return this.mergeTheirs(theirs);

      case 'ours':
        return this.mergeOurs(ours);

      case 'semantic_merge':
        return this.semanticMerge(base ?? '', ours, theirs);

      case 'agent_resolve':
        return this.agentResolve(base ?? '', ours, theirs);

      case 'manual':
        return this.flagManual(base ?? '', ours, theirs);

      default:
        return {
          success: false,
          strategy,
          conflicts: [],
          error: `Unknown merge strategy: ${strategy}`,
          requiresExternalResolution: false,
        };
    }
  }

  /**
   * Auto-select the best strategy based on the inputs.
   */
  selectStrategy(
    base: string | null,
    ours: string,
    theirs: string,
  ): MergeStrategy {
    // No base = fast forward candidate
    if (base === null || base === ours) {
      return 'fast_forward';
    }

    // If ours hasn't changed from base, fast-forward
    if (ours === base) {
      return 'fast_forward';
    }

    // If theirs hasn't changed from base, keep ours
    if (theirs === base) {
      return 'ours';
    }

    // Both have changed — try three-way
    return 'three_way';
  }

  // -------------------------------------------------------------------------
  // Strategy: fast_forward
  //
  // No divergence — simply accept the incoming content.
  // Valid when base === ours (ours hasn't changed since fork point).
  // -------------------------------------------------------------------------

  private fastForward(
    base: string | null,
    ours: string,
    theirs: string,
  ): MergeResult {
    // If ours === theirs, no merge needed
    if (ours === theirs) {
      return {
        success: true,
        strategy: 'fast_forward',
        merged: ours,
        conflicts: [],
        requiresExternalResolution: false,
      };
    }

    // Fast-forward is valid when ours hasn't diverged from base
    if (base === null || ours === base) {
      return {
        success: true,
        strategy: 'fast_forward',
        merged: theirs,
        conflicts: [],
        requiresExternalResolution: false,
      };
    }

    // Can't fast-forward — both sides have changed
    return {
      success: false,
      strategy: 'fast_forward',
      conflicts: [],
      error: 'Cannot fast-forward: both sides have diverged from base',
      requiresExternalResolution: false,
    };
  }

  // -------------------------------------------------------------------------
  // Strategy: three_way
  //
  // Standard three-way merge. Processes line by line, using the base to
  // determine which side changed each line. Produces conflicts when both
  // sides modified the same region.
  // -------------------------------------------------------------------------

  private threeWay(
    base: string,
    ours: string,
    theirs: string,
  ): MergeResult {
    const baseLines = splitLines(base);
    const ourLines = splitLines(ours);
    const theirLines = splitLines(theirs);

    // Compute diff hunks: base->ours and base->theirs
    const ourChanges = computeLineChanges(baseLines, ourLines);
    const theirChanges = computeLineChanges(baseLines, theirLines);

    const result: string[] = [];
    const conflicts: MergeConflict[] = [];
    let baseIdx = 0;

    // Merge by walking through base lines and applying non-conflicting changes
    const allChangedLines = new Set<number>();
    const ourChangeMap = new Map<number, LineChange>();
    const theirChangeMap = new Map<number, LineChange>();

    for (const c of ourChanges) {
      ourChangeMap.set(c.baseLine, c);
      allChangedLines.add(c.baseLine);
    }
    for (const c of theirChanges) {
      theirChangeMap.set(c.baseLine, c);
      allChangedLines.add(c.baseLine);
    }

    // Sort changed lines
    const sortedChanges = Array.from(allChangedLines).sort((a, b) => a - b);

    for (const lineIdx of sortedChanges) {
      // Output any unchanged lines between last position and this change
      while (baseIdx < lineIdx) {
        if (baseIdx < baseLines.length) {
          result.push(baseLines[baseIdx]);
        }
        baseIdx++;
      }

      const ourChange = ourChangeMap.get(lineIdx);
      const theirChange = theirChangeMap.get(lineIdx);

      if (ourChange && !theirChange) {
        // Only we changed this line — take ours
        applyChange(ourChange, result);
        baseIdx = lineIdx + 1;
      } else if (!ourChange && theirChange) {
        // Only they changed this line — take theirs
        applyChange(theirChange, result);
        baseIdx = lineIdx + 1;
      } else if (ourChange && theirChange) {
        // Both changed the same line
        if (ourChange.newContent === theirChange.newContent) {
          // Same change — no conflict
          applyChange(ourChange, result);
          baseIdx = lineIdx + 1;
        } else {
          // Conflict!
          conflicts.push({
            startLine: lineIdx + 1,
            endLine: lineIdx + 1,
            ours: ourChange.newContent ?? '',
            theirs: theirChange.newContent ?? '',
            base: baseLines[lineIdx] ?? '',
          });
          // Include conflict markers in the merged output
          result.push('<<<<<<< ours');
          if (ourChange.type !== 'delete') {
            result.push(ourChange.newContent ?? '');
          }
          result.push('=======');
          if (theirChange.type !== 'delete') {
            result.push(theirChange.newContent ?? '');
          }
          result.push('>>>>>>> theirs');
          baseIdx = lineIdx + 1;
        }
      }
    }

    // Output remaining unchanged lines
    while (baseIdx < baseLines.length) {
      result.push(baseLines[baseIdx]);
      baseIdx++;
    }

    // If there are lines in ours or theirs beyond base length, append them
    // (handled by the change detection already)

    const merged = result.join('\n');

    return {
      success: conflicts.length === 0,
      strategy: 'three_way',
      merged,
      conflicts,
      requiresExternalResolution: conflicts.length > 0,
    };
  }

  // -------------------------------------------------------------------------
  // Strategy: theirs — accept incoming changes (YOLO default)
  // -------------------------------------------------------------------------

  private mergeTheirs(theirs: string): MergeResult {
    return {
      success: true,
      strategy: 'theirs',
      merged: theirs,
      conflicts: [],
      requiresExternalResolution: false,
    };
  }

  // -------------------------------------------------------------------------
  // Strategy: ours — keep current version (reject incoming)
  // -------------------------------------------------------------------------

  private mergeOurs(ours: string): MergeResult {
    return {
      success: true,
      strategy: 'ours',
      merged: ours,
      conflicts: [],
      requiresExternalResolution: false,
    };
  }

  // -------------------------------------------------------------------------
  // Strategy: semantic_merge — delegate to LLM
  //
  // For structured content (JSON, specs, etc.) where a line-based merge
  // doesn't capture semantic meaning. Requires a registered callback.
  // -------------------------------------------------------------------------

  private async semanticMerge(
    base: string,
    ours: string,
    theirs: string,
  ): Promise<MergeResult> {
    // First, detect conflicts via three-way
    const threeWayResult = this.threeWay(base, ours, theirs);

    if (threeWayResult.conflicts.length === 0) {
      // No conflicts — three-way is sufficient
      return {
        ...threeWayResult,
        strategy: 'semantic_merge',
      };
    }

    // Conflicts exist — delegate to LLM if callback is registered
    if (!this.semanticMergeCallback) {
      return {
        success: false,
        strategy: 'semantic_merge',
        merged: threeWayResult.merged,
        conflicts: threeWayResult.conflicts,
        error: 'Semantic merge requires LLM callback (not registered). '
          + `${threeWayResult.conflicts.length} conflict(s) need resolution.`,
        requiresExternalResolution: true,
      };
    }

    try {
      const merged = await this.semanticMergeCallback(
        base,
        ours,
        theirs,
        threeWayResult.conflicts,
      );
      return {
        success: true,
        strategy: 'semantic_merge',
        merged,
        conflicts: [],
        requiresExternalResolution: false,
      };
    } catch (err) {
      return {
        success: false,
        strategy: 'semantic_merge',
        merged: threeWayResult.merged,
        conflicts: threeWayResult.conflicts,
        error: `Semantic merge LLM callback failed: ${err instanceof Error ? err.message : String(err)}`,
        requiresExternalResolution: true,
      };
    }
  }

  // -------------------------------------------------------------------------
  // Strategy: agent_resolve — delegate to an agent
  //
  // Similar to semantic_merge but uses an agent to resolve conflicts.
  // -------------------------------------------------------------------------

  private async agentResolve(
    base: string,
    ours: string,
    theirs: string,
  ): Promise<MergeResult> {
    // Detect conflicts
    const threeWayResult = this.threeWay(base, ours, theirs);

    if (threeWayResult.conflicts.length === 0) {
      return {
        ...threeWayResult,
        strategy: 'agent_resolve',
      };
    }

    if (!this.agentResolveCallback) {
      return {
        success: false,
        strategy: 'agent_resolve',
        merged: threeWayResult.merged,
        conflicts: threeWayResult.conflicts,
        error: 'Agent resolve requires agent callback (not registered). '
          + `${threeWayResult.conflicts.length} conflict(s) need resolution.`,
        requiresExternalResolution: true,
      };
    }

    try {
      const merged = await this.agentResolveCallback(
        base,
        ours,
        theirs,
        threeWayResult.conflicts,
      );
      return {
        success: true,
        strategy: 'agent_resolve',
        merged,
        conflicts: [],
        requiresExternalResolution: false,
      };
    } catch (err) {
      return {
        success: false,
        strategy: 'agent_resolve',
        merged: threeWayResult.merged,
        conflicts: threeWayResult.conflicts,
        error: `Agent resolve callback failed: ${err instanceof Error ? err.message : String(err)}`,
        requiresExternalResolution: true,
      };
    }
  }

  // -------------------------------------------------------------------------
  // Strategy: manual — flag for human resolution
  //
  // Identifies conflicts but does not attempt resolution. Returns the
  // three-way merge result with conflict markers for human review.
  // -------------------------------------------------------------------------

  private flagManual(
    base: string,
    ours: string,
    theirs: string,
  ): MergeResult {
    const threeWayResult = this.threeWay(base, ours, theirs);

    return {
      success: false,
      strategy: 'manual',
      merged: threeWayResult.merged,
      conflicts: threeWayResult.conflicts,
      error: threeWayResult.conflicts.length > 0
        ? `${threeWayResult.conflicts.length} conflict(s) flagged for manual resolution`
        : undefined,
      requiresExternalResolution: threeWayResult.conflicts.length > 0,
    };
  }
}

// =============================================================================
// Three-way merge utilities
// =============================================================================

interface LineChange {
  baseLine: number;   // 0-indexed line in base
  type: 'modify' | 'delete' | 'insert';
  newContent?: string;
}

/**
 * Compute line-level changes from base to modified.
 * Returns a list of changes with the base line index and the new content.
 */
function computeLineChanges(
  baseLines: string[],
  modifiedLines: string[],
): LineChange[] {
  const changes: LineChange[] = [];
  const lcs = computeSimpleLCS(baseLines, modifiedLines);

  // Walk through LCS to find changes
  let baseIdx = 0;
  let modIdx = 0;
  let lcsIdx = 0;

  while (baseIdx < baseLines.length || modIdx < modifiedLines.length) {
    if (
      lcsIdx < lcs.length &&
      baseIdx < baseLines.length &&
      modIdx < modifiedLines.length &&
      baseLines[baseIdx] === lcs[lcsIdx] &&
      modifiedLines[modIdx] === lcs[lcsIdx]
    ) {
      // Matching line — no change
      baseIdx++;
      modIdx++;
      lcsIdx++;
    } else if (
      baseIdx < baseLines.length &&
      (lcsIdx >= lcs.length || baseLines[baseIdx] !== lcs[lcsIdx])
    ) {
      // Base line was deleted or modified
      if (
        modIdx < modifiedLines.length &&
        (lcsIdx >= lcs.length || modifiedLines[modIdx] !== lcs[lcsIdx])
      ) {
        // Modified line is also different — this is a modification
        changes.push({
          baseLine: baseIdx,
          type: 'modify',
          newContent: modifiedLines[modIdx],
        });
        baseIdx++;
        modIdx++;
      } else {
        // Base line was deleted
        changes.push({
          baseLine: baseIdx,
          type: 'delete',
        });
        baseIdx++;
      }
    } else if (
      modIdx < modifiedLines.length &&
      (lcsIdx >= lcs.length || modifiedLines[modIdx] !== lcs[lcsIdx])
    ) {
      // Line was inserted in modified
      changes.push({
        baseLine: baseIdx,
        type: 'insert',
        newContent: modifiedLines[modIdx],
      });
      modIdx++;
    } else {
      // Safety fallback — advance both
      baseIdx++;
      modIdx++;
    }
  }

  return changes;
}

/**
 * Compute the LCS sequence (not the table) for two arrays of strings.
 */
function computeSimpleLCS(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;
  const table: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        table[i][j] = table[i - 1][j - 1] + 1;
      } else {
        table[i][j] = Math.max(table[i - 1][j], table[i][j - 1]);
      }
    }
  }

  // Backtrack to get the actual LCS
  const result: string[] = [];
  let i = m;
  let j = n;

  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.push(a[i - 1]);
      i--;
      j--;
    } else if (table[i - 1][j] >= table[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  result.reverse();
  return result;
}

function applyChange(change: LineChange, output: string[]): void {
  switch (change.type) {
    case 'modify':
      if (change.newContent !== undefined) {
        output.push(change.newContent);
      }
      break;
    case 'insert':
      if (change.newContent !== undefined) {
        output.push(change.newContent);
      }
      break;
    case 'delete':
      // Don't output anything — the line is removed
      break;
  }
}

function splitLines(text: string): string[] {
  if (text === '') return [];
  return text.split('\n');
}
