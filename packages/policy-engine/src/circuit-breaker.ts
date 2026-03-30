// =============================================================================
// CircuitBreaker — Automatic agent safety controls from PRD Section 5.4
//
// Tracks error rates and rejection rates per agent, auto-pauses agents when
// thresholds are exceeded, and enforces cascade protection (agent chains).
// =============================================================================

import type {
  AgentSafetyConfig,
  CircuitBreakerState,
} from '@lurk/shared-types';

import { BudgetTracker } from './budget-tracker.js';

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_ERROR_THRESHOLD = 0.1; // 10%
const DEFAULT_REJECTION_THRESHOLD = 0.5; // 50%
const DEFAULT_MAX_CHAIN_DEPTH = 3;
const DEFAULT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_PAUSE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// ---------------------------------------------------------------------------
// Internal state for paused agents
// ---------------------------------------------------------------------------

interface PausedAgent {
  pausedAt: number;
  reason: string;
  autoResumeAt: number;
}

// ---------------------------------------------------------------------------
// Chain tracking — tracks which agent triggered which
// ---------------------------------------------------------------------------

interface ChainEntry {
  agentId: string;
  depth: number;
  parentAgentId?: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Rejection tracking (separate from budget tracker's error tracking)
// ---------------------------------------------------------------------------

interface RejectionEntry {
  timestamp: number;
}

// ---------------------------------------------------------------------------
// CircuitBreaker
// ---------------------------------------------------------------------------

export class CircuitBreaker {
  private readonly errorThreshold: number;
  private readonly rejectionThreshold: number;
  private readonly maxChainDepth: number;
  private readonly cascadeProtection: boolean;
  private readonly windowMs: number;
  private readonly pauseDurationMs: number;

  private readonly budgetTracker: BudgetTracker;
  private pausedAgents: Map<string, PausedAgent> = new Map();
  private chains: Map<string, ChainEntry> = new Map();
  private rejections: Map<string, RejectionEntry[]> = new Map();
  private rejectionTotals: Map<string, number> = new Map();

  /** Callback invoked when an agent is auto-paused */
  onAgentPaused?: (agentId: string, reason: string) => void;

  /** Callback invoked when an agent auto-resumes */
  onAgentResumed?: (agentId: string) => void;

  constructor(
    budgetTracker: BudgetTracker,
    config?: Partial<AgentSafetyConfig>,
    options?: { windowMs?: number; pauseDurationMs?: number },
  ) {
    this.budgetTracker = budgetTracker;
    this.errorThreshold = config?.errorRateThreshold ?? DEFAULT_ERROR_THRESHOLD;
    this.rejectionThreshold = config?.rejectionRateThreshold ?? DEFAULT_REJECTION_THRESHOLD;
    this.maxChainDepth = config?.maxChainDepth ?? DEFAULT_MAX_CHAIN_DEPTH;
    this.cascadeProtection = config?.cascadeProtection ?? true;
    this.windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
    this.pauseDurationMs = options?.pauseDurationMs ?? DEFAULT_PAUSE_DURATION_MS;
  }

  // -------------------------------------------------------------------------
  // Record outcomes
  // -------------------------------------------------------------------------

  /**
   * Record a successful action by the agent. Updates both the budget tracker
   * (for error rate denominator) and clears any stale pause state.
   */
  recordSuccess(agentId: string): void {
    this.budgetTracker.recordSuccess(agentId);
    this.incrementRejectionTotal(agentId);
  }

  /**
   * Record an error for the agent. If the error rate exceeds the threshold,
   * the agent is automatically paused.
   */
  recordError(agentId: string): void {
    this.budgetTracker.recordError(agentId);
    this.incrementRejectionTotal(agentId);

    const errorRate = this.budgetTracker.getErrorRate(agentId, this.windowMs);
    if (errorRate >= this.errorThreshold) {
      this.pauseAgent(
        agentId,
        `Error rate ${(errorRate * 100).toFixed(1)}% exceeds threshold ${(this.errorThreshold * 100).toFixed(1)}%`,
      );
    }
  }

  /**
   * Record a PR rejection for the agent. If the rejection rate exceeds the
   * threshold, the agent is automatically paused.
   */
  recordRejection(agentId: string): void {
    const entries = this.rejections.get(agentId) ?? [];
    entries.push({ timestamp: Date.now() });
    this.rejections.set(agentId, entries);
    this.incrementRejectionTotal(agentId);

    const rejectionRate = this.getRejectionRate(agentId);
    if (rejectionRate >= this.rejectionThreshold) {
      this.pauseAgent(
        agentId,
        `PR rejection rate ${(rejectionRate * 100).toFixed(1)}% exceeds threshold ${(this.rejectionThreshold * 100).toFixed(1)}%`,
      );
    }

    // Also record in budget tracker for YOLO cooldown
    this.budgetTracker.recordRejection(agentId);
  }

  // -------------------------------------------------------------------------
  // Chain / cascade protection
  // -------------------------------------------------------------------------

  /**
   * Register that an agent action was triggered by another agent (cascade).
   * Returns false if the chain depth would be exceeded, meaning the action
   * should be blocked.
   */
  registerChainedAction(
    agentId: string,
    triggeringAgentId?: string,
  ): boolean {
    if (!this.cascadeProtection) {
      return true; // No cascade protection, always allow
    }

    if (!triggeringAgentId) {
      // Direct trigger (not chained), depth = 1
      this.chains.set(agentId, {
        agentId,
        depth: 1,
        timestamp: Date.now(),
      });
      return true;
    }

    // Find the triggering agent's chain entry
    const parentChain = this.chains.get(triggeringAgentId);
    const parentDepth = parentChain?.depth ?? 0;
    const newDepth = parentDepth + 1;

    if (newDepth > this.maxChainDepth) {
      return false; // Chain too deep, block the action
    }

    this.chains.set(agentId, {
      agentId,
      depth: newDepth,
      parentAgentId: triggeringAgentId,
      timestamp: Date.now(),
    });

    return true;
  }

  /**
   * Get the current chain depth for an agent.
   */
  getChainDepth(agentId: string): number {
    return this.chains.get(agentId)?.depth ?? 0;
  }

  // -------------------------------------------------------------------------
  // Pause / resume
  // -------------------------------------------------------------------------

  /**
   * Manually pause an agent.
   */
  pauseAgent(agentId: string, reason: string): void {
    const entry: PausedAgent = {
      pausedAt: Date.now(),
      reason,
      autoResumeAt: Date.now() + this.pauseDurationMs,
    };
    this.pausedAgents.set(agentId, entry);
    this.onAgentPaused?.(agentId, reason);
  }

  /**
   * Manually resume an agent.
   */
  resumeAgent(agentId: string): void {
    if (this.pausedAgents.has(agentId)) {
      this.pausedAgents.delete(agentId);
      this.onAgentResumed?.(agentId);
    }
  }

  /**
   * Check whether an agent is currently paused. Also handles auto-resume
   * if the pause duration has elapsed.
   */
  isAgentPaused(agentId: string): boolean {
    const entry = this.pausedAgents.get(agentId);
    if (!entry) return false;

    // Auto-resume if pause duration has elapsed
    if (Date.now() >= entry.autoResumeAt) {
      this.pausedAgents.delete(agentId);
      this.onAgentResumed?.(agentId);
      return false;
    }

    return true;
  }

  // -------------------------------------------------------------------------
  // State inspection
  // -------------------------------------------------------------------------

  /**
   * Get the full circuit breaker state for an agent.
   */
  getState(agentId: string): CircuitBreakerState {
    const errorRate = this.budgetTracker.getErrorRate(agentId, this.windowMs);
    const rejectionRate = this.getRejectionRate(agentId);
    const pauseEntry = this.pausedAgents.get(agentId);
    const chainEntry = this.chains.get(agentId);

    // Count errors and totals in window
    const errorEntries = this.countEntriesInWindow(
      agentId,
      'errors',
    );
    const totalEntries = this.countEntriesInWindow(
      agentId,
      'total',
    );
    const rejectionEntries = this.countRejectionsInWindow(agentId);
    const rejectionTotal = this.rejectionTotals.get(agentId) ?? 0;

    return {
      agentId,
      errorCount: errorEntries,
      totalCount: totalEntries,
      errorRate,
      rejectionCount: rejectionEntries,
      rejectionTotal,
      rejectionRate,
      isPaused: this.isAgentPaused(agentId),
      pausedAt: pauseEntry?.pausedAt,
      pauseReason: pauseEntry?.reason,
      chainDepth: chainEntry?.depth ?? 0,
    };
  }

  /**
   * Check all agents and auto-pause any that exceed thresholds.
   * Returns the list of agents that were paused in this check.
   */
  checkAllAgents(): string[] {
    const paused: string[] = [];

    // Collect all known agent IDs from rejections and budget tracker
    const agentIds = new Set<string>();
    for (const id of this.rejections.keys()) agentIds.add(id);

    for (const agentId of agentIds) {
      if (this.isAgentPaused(agentId)) continue;

      const errorRate = this.budgetTracker.getErrorRate(agentId, this.windowMs);
      if (errorRate >= this.errorThreshold) {
        this.pauseAgent(
          agentId,
          `Error rate ${(errorRate * 100).toFixed(1)}% exceeds threshold`,
        );
        paused.push(agentId);
        continue;
      }

      const rejectionRate = this.getRejectionRate(agentId);
      if (rejectionRate >= this.rejectionThreshold) {
        this.pauseAgent(
          agentId,
          `PR rejection rate ${(rejectionRate * 100).toFixed(1)}% exceeds threshold`,
        );
        paused.push(agentId);
      }
    }

    return paused;
  }

  // -------------------------------------------------------------------------
  // Maintenance
  // -------------------------------------------------------------------------

  /**
   * Prune expired entries to prevent unbounded memory growth.
   */
  prune(): void {
    const cutoff = Date.now() - this.windowMs;

    for (const [agentId, entries] of this.rejections) {
      const filtered = entries.filter((e) => e.timestamp >= cutoff);
      if (filtered.length === 0) {
        this.rejections.delete(agentId);
      } else {
        this.rejections.set(agentId, filtered);
      }
    }

    // Prune old chain entries (older than 1 hour)
    for (const [agentId, entry] of this.chains) {
      if (entry.timestamp < cutoff) {
        this.chains.delete(agentId);
      }
    }

    // Clean up auto-resumed agents
    for (const [agentId, entry] of this.pausedAgents) {
      if (Date.now() >= entry.autoResumeAt) {
        this.pausedAgents.delete(agentId);
      }
    }

    this.budgetTracker.prune();
  }

  /** Clear all state (useful in tests) */
  reset(): void {
    this.pausedAgents.clear();
    this.chains.clear();
    this.rejections.clear();
    this.rejectionTotals.clear();
    this.budgetTracker.reset();
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private getRejectionRate(agentId: string): number {
    const rejections = this.countRejectionsInWindow(agentId);
    const total = this.rejectionTotals.get(agentId) ?? 0;
    if (total === 0) return 0;
    return rejections / total;
  }

  private countRejectionsInWindow(agentId: string): number {
    const entries = this.rejections.get(agentId);
    if (!entries) return 0;
    const cutoff = Date.now() - this.windowMs;
    return entries.filter((e) => e.timestamp >= cutoff).length;
  }

  private incrementRejectionTotal(agentId: string): void {
    const current = this.rejectionTotals.get(agentId) ?? 0;
    this.rejectionTotals.set(agentId, current + 1);
  }

  /**
   * Count budget-tracker entries in the window.
   * This is approximate — we rely on the budget tracker's own methods.
   */
  private countEntriesInWindow(
    agentId: string,
    type: 'errors' | 'total',
  ): number {
    if (type === 'errors') {
      // Error rate * total gives us approximate error count
      const rate = this.budgetTracker.getErrorRate(agentId, this.windowMs);
      // We need to reconstruct approximate count; use rate as a proxy
      // The budget tracker doesn't expose raw counts, so use the rate
      // with a denominator estimate from forks + PRs
      const forks = this.budgetTracker.getForksThisHour(agentId);
      const prs = this.budgetTracker.getPRsToday(agentId);
      const approxTotal = Math.max(forks + prs, 1);
      return Math.round(rate * approxTotal);
    }
    // Total actions approximation
    const forks = this.budgetTracker.getForksThisHour(agentId);
    const prs = this.budgetTracker.getPRsToday(agentId);
    return forks + prs;
  }
}
