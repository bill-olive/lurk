// =============================================================================
// BudgetTracker — In-memory sliding-window counters for agent action budgets
//
// Tracks forks/hour, PRs/day, tokens/day per agent using timestamped entries
// that are pruned on access (sliding window). Also tracks auto-merge counts
// and rejection timestamps for YOLO cooldown logic.
// =============================================================================

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface TimestampedEntry {
  timestamp: number;
  value: number;
}

interface AgentCounters {
  forks: TimestampedEntry[];
  prs: TimestampedEntry[];
  tokens: TimestampedEntry[];
  autoMerges: TimestampedEntry[];
  lastRejectionAt?: number;
  errors: TimestampedEntry[];
  totalActions: TimestampedEntry[];
}

// ---------------------------------------------------------------------------
// Time constants
// ---------------------------------------------------------------------------

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// BudgetTracker
// ---------------------------------------------------------------------------

export class BudgetTracker {
  private counters: Map<string, AgentCounters> = new Map();

  // -------------------------------------------------------------------------
  // Recording methods
  // -------------------------------------------------------------------------

  recordFork(agentId: string): void {
    const c = this.getOrCreate(agentId);
    c.forks.push({ timestamp: Date.now(), value: 1 });
    c.totalActions.push({ timestamp: Date.now(), value: 1 });
  }

  recordPR(agentId: string): void {
    const c = this.getOrCreate(agentId);
    c.prs.push({ timestamp: Date.now(), value: 1 });
    c.totalActions.push({ timestamp: Date.now(), value: 1 });
  }

  recordTokens(agentId: string, tokens: number): void {
    const c = this.getOrCreate(agentId);
    c.tokens.push({ timestamp: Date.now(), value: tokens });
  }

  recordAutoMerge(agentId: string): void {
    const c = this.getOrCreate(agentId);
    c.autoMerges.push({ timestamp: Date.now(), value: 1 });
  }

  recordRejection(agentId: string): void {
    const c = this.getOrCreate(agentId);
    c.lastRejectionAt = Date.now();
  }

  recordError(agentId: string): void {
    const c = this.getOrCreate(agentId);
    c.errors.push({ timestamp: Date.now(), value: 1 });
    c.totalActions.push({ timestamp: Date.now(), value: 1 });
  }

  recordSuccess(agentId: string): void {
    const c = this.getOrCreate(agentId);
    c.totalActions.push({ timestamp: Date.now(), value: 1 });
  }

  // -------------------------------------------------------------------------
  // Query methods — sliding window counts
  // -------------------------------------------------------------------------

  /** Count of forks by this agent in the last hour */
  getForksThisHour(agentId: string): number {
    const c = this.counters.get(agentId);
    if (!c) return 0;
    return this.sumWindow(c.forks, ONE_HOUR_MS);
  }

  /** Count of PRs by this agent today (rolling 24h window) */
  getPRsToday(agentId: string): number {
    const c = this.counters.get(agentId);
    if (!c) return 0;
    return this.sumWindow(c.prs, ONE_DAY_MS);
  }

  /** Total tokens consumed by this agent today (rolling 24h window) */
  getTokensToday(agentId: string): number {
    const c = this.counters.get(agentId);
    if (!c) return 0;
    return this.sumWindow(c.tokens, ONE_DAY_MS);
  }

  /** Count of auto-merges by this agent today (rolling 24h window) */
  getAutoMergeCount(agentId: string): number {
    const c = this.counters.get(agentId);
    if (!c) return 0;
    return this.sumWindow(c.autoMerges, ONE_DAY_MS);
  }

  /** Timestamp of the agent's last rejection, or undefined if none */
  getLastRejectionTime(agentId: string): number | undefined {
    const c = this.counters.get(agentId);
    return c?.lastRejectionAt;
  }

  /**
   * Error rate in the given window (defaults to 1 hour).
   * Returns a number 0.0-1.0: errors / totalActions.
   */
  getErrorRate(agentId: string, windowMs: number = ONE_HOUR_MS): number {
    const c = this.counters.get(agentId);
    if (!c) return 0;
    const errors = this.sumWindow(c.errors, windowMs);
    const total = this.sumWindow(c.totalActions, windowMs);
    if (total === 0) return 0;
    return errors / total;
  }

  /**
   * Actions per minute across all agents in the given window (defaults to 1 minute).
   * This is the global org-level rate.
   */
  getGlobalActionsPerMinute(): number {
    const oneMinuteMs = 60 * 1000;
    const now = Date.now();
    const cutoff = now - oneMinuteMs;
    let total = 0;

    for (const [, counters] of this.counters) {
      for (const entry of counters.totalActions) {
        if (entry.timestamp >= cutoff) {
          total += entry.value;
        }
      }
    }

    return total;
  }

  // -------------------------------------------------------------------------
  // Maintenance
  // -------------------------------------------------------------------------

  /**
   * Prune old entries beyond the maximum window (24 hours).
   * Call periodically to prevent unbounded memory growth.
   */
  prune(): void {
    const cutoff = Date.now() - ONE_DAY_MS;

    for (const [agentId, c] of this.counters) {
      c.forks = c.forks.filter((e) => e.timestamp >= cutoff);
      c.prs = c.prs.filter((e) => e.timestamp >= cutoff);
      c.tokens = c.tokens.filter((e) => e.timestamp >= cutoff);
      c.autoMerges = c.autoMerges.filter((e) => e.timestamp >= cutoff);
      c.errors = c.errors.filter((e) => e.timestamp >= cutoff);
      c.totalActions = c.totalActions.filter((e) => e.timestamp >= cutoff);

      // Remove entirely empty agents
      if (
        c.forks.length === 0 &&
        c.prs.length === 0 &&
        c.tokens.length === 0 &&
        c.autoMerges.length === 0 &&
        c.errors.length === 0 &&
        c.totalActions.length === 0
      ) {
        this.counters.delete(agentId);
      }
    }
  }

  /** Clear all tracked data (useful in tests) */
  reset(): void {
    this.counters.clear();
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private getOrCreate(agentId: string): AgentCounters {
    let c = this.counters.get(agentId);
    if (!c) {
      c = {
        forks: [],
        prs: [],
        tokens: [],
        autoMerges: [],
        errors: [],
        totalActions: [],
      };
      this.counters.set(agentId, c);
    }
    return c;
  }

  /**
   * Sum values within the sliding window, pruning expired entries in-place.
   */
  private sumWindow(entries: TimestampedEntry[], windowMs: number): number {
    const cutoff = Date.now() - windowMs;
    let sum = 0;
    let firstValid = 0;

    for (let i = 0; i < entries.length; i++) {
      if (entries[i].timestamp >= cutoff) {
        if (firstValid === 0 && i > 0) {
          firstValid = i;
        }
        sum += entries[i].value;
      }
    }

    // Lazy pruning: remove expired entries from the front
    if (firstValid > 0) {
      entries.splice(0, firstValid);
    }

    return sum;
  }
}
