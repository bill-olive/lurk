// ---------------------------------------------------------------------------
// BaseAgent — abstract class implementing the 9-step agent execution model
// ---------------------------------------------------------------------------
//
// The execute() method runs the canonical loop described in the Lurk PRD:
//   1. Trigger   — receive and validate the triggering event
//   2. Scope     — resolve read/write scopes against policy
//   3. Context   — build the context window from in-scope artifacts
//   4. Analyze   — LLM-powered analysis (subclass responsibility)
//   5. Decide    — determine actions based on analysis
//   6. Gate      — enforce policy, budget, and confidence gates
//   7. Execute   — perform the decided actions (fork, PR, notify, etc.)
//   8. Audit     — emit an audit entry for every action
//   9. Notify    — send notifications to affected stakeholders
// ---------------------------------------------------------------------------

import type {
  Agent,
  AgentCapability,
  Artifact,
  AuditEntry,
  AuditAction,
  Notification,
  NotificationType,
  Timestamp,
  AgentAction,
} from '@lurk/shared-types';
import type { AgentContext } from './context.js';
import type { TriggerEvent } from './triggers.js';
import type { ResolvedScope, ScopePolicy } from './scope.js';
import { ScopeResolver } from './scope.js';
import { ContextBuilder } from './context.js';
import { TriggerManager } from './triggers.js';
import { CapabilityRegistry } from './capabilities.js';

// ---- Decision & Result types -----------------------------------------------

/**
 * The output of an agent's analyze() method — what the agent wants to do
 * and how confident it is.
 */
export interface AgentDecision {
  /** The primary action to take. */
  action: AgentAction;
  /** Agent's confidence in this decision (0.0 - 1.0). */
  confidence: number;
  /** Human-readable reasoning for the decision. */
  reasoning: string;
  /** Artifact IDs to operate on. */
  targetArtifactIds: string[];
  /** Proposed changes (content diffs, summaries, etc.). */
  proposedChanges: Record<string, unknown>;
  /** Source artifact IDs that informed this decision. */
  sourceRefs: string[];
}

/**
 * The final result of an agent execution cycle.
 */
export interface AgentExecutionResult {
  /** Whether the execution completed successfully. */
  success: boolean;
  /** The decision made (may be 'skip'). */
  decision: AgentDecision;
  /** Actions that were actually performed. */
  actionsPerformed: AgentAction[];
  /** Audit entries emitted during this execution. */
  auditEntries: AuditEntry[];
  /** Notifications sent during this execution. */
  notifications: Notification[];
  /** Error message if execution failed. */
  error?: string;
  /** Timing breakdown in milliseconds. */
  timing: ExecutionTiming;
}

export interface ExecutionTiming {
  totalMs: number;
  scopeMs: number;
  contextMs: number;
  analyzeMs: number;
  gateMs: number;
  executeMs: number;
  auditMs: number;
  notifyMs: number;
}

/**
 * Configuration for the gate step — policy constraints that must be
 * satisfied before an action is executed.
 */
export interface GateConfig {
  /** Minimum confidence for auto-execution (below this, skip or request review). */
  minConfidence: number;
  /** Maximum forks remaining in this hour's budget. */
  forksRemaining: number;
  /** Maximum PRs remaining in today's budget. */
  prsRemaining: number;
  /** Whether YOLO mode is enabled for auto-merge. */
  yoloEnabled: boolean;
  /** Whether the agent's circuit breaker is open (paused). */
  circuitBreakerOpen: boolean;
}

// ---- Abstract BaseAgent ----------------------------------------------------

export abstract class BaseAgent {
  protected readonly agent: Agent;
  protected readonly scopeResolver: ScopeResolver;
  protected readonly contextBuilder: ContextBuilder;
  protected readonly triggerManager: TriggerManager;
  protected readonly capabilities: CapabilityRegistry;

  constructor(agent: Agent) {
    this.agent = agent;
    this.scopeResolver = new ScopeResolver();
    this.contextBuilder = new ContextBuilder();
    this.triggerManager = new TriggerManager();
    this.capabilities = new CapabilityRegistry();
  }

  // -- Abstract method: subclasses implement the LLM analysis step -----------

  /**
   * Analyze the provided context and return a decision. This is where the
   * LLM call happens in concrete agent implementations.
   */
  abstract analyze(context: AgentContext): Promise<AgentDecision>;

  // -- The 9-step execution loop ---------------------------------------------

  /**
   * Execute the full agent loop for a given trigger event.
   */
  async execute(trigger: TriggerEvent): Promise<AgentExecutionResult> {
    const timing: ExecutionTiming = {
      totalMs: 0,
      scopeMs: 0,
      contextMs: 0,
      analyzeMs: 0,
      gateMs: 0,
      executeMs: 0,
      auditMs: 0,
      notifyMs: 0,
    };
    const totalStart = Date.now();
    const auditEntries: AuditEntry[] = [];
    const notifications: Notification[] = [];
    const actionsPerformed: AgentAction[] = [];

    let decision: AgentDecision = {
      action: 'skip',
      confidence: 0,
      reasoning: 'Not yet analyzed',
      targetArtifactIds: [],
      proposedChanges: {},
      sourceRefs: [],
    };

    try {
      // ---- Step 1: Trigger validation ----
      if (!this.triggerManager.evaluate(trigger)) {
        // No registered trigger matched — this is a no-op
        decision.reasoning = 'No matching trigger';
        return this.buildResult(true, decision, actionsPerformed, auditEntries, notifications, timing, totalStart);
      }

      // ---- Step 2: Scope resolution ----
      const scopeStart = Date.now();
      const scopePolicy = this.buildScopePolicy();
      const readScope = this.scopeResolver.resolveReadScope(this.agent, scopePolicy);
      const writeScope = this.scopeResolver.resolveWriteScope(this.agent, scopePolicy);
      timing.scopeMs = Date.now() - scopeStart;

      // ---- Step 3: Context building ----
      const contextStart = Date.now();
      const artifacts = await this.loadArtifactsInScope(readScope);
      let context = this.contextBuilder.buildContext(artifacts, this.agent);

      // Prune to model's token budget
      const maxTokens = this.agent.modelConfig.maxResponseTokens;
      context = this.contextBuilder.pruneContext(context, maxTokens);
      timing.contextMs = Date.now() - contextStart;

      // ---- Step 4: Analyze (LLM call — subclass responsibility) ----
      const analyzeStart = Date.now();
      decision = await this.analyze(context);
      timing.analyzeMs = Date.now() - analyzeStart;

      // ---- Step 5: Decide (decision already produced by analyze) ----
      // The analyze() call returns the decision. If action is 'skip', we
      // short-circuit the remaining steps.
      if (decision.action === 'skip') {
        return this.buildResult(true, decision, actionsPerformed, auditEntries, notifications, timing, totalStart);
      }

      // ---- Step 6: Gate — enforce policy, budget, and confidence ----
      const gateStart = Date.now();
      const gateConfig = this.buildGateConfig();
      const gateResult = this.evaluateGate(decision, gateConfig);
      timing.gateMs = Date.now() - gateStart;

      if (!gateResult.passed) {
        decision = {
          ...decision,
          action: 'skip',
          reasoning: `Gate blocked: ${gateResult.reason}`,
        };
        auditEntries.push(
          this.createAuditEntry('agent.executed', {
            gateBlocked: true,
            reason: gateResult.reason,
          }),
        );
        return this.buildResult(true, decision, actionsPerformed, auditEntries, notifications, timing, totalStart);
      }

      // ---- Step 7: Execute actions ----
      const executeStart = Date.now();
      const executedActions = await this.executeActions(decision, writeScope);
      actionsPerformed.push(...executedActions);
      timing.executeMs = Date.now() - executeStart;

      // ---- Step 8: Audit ----
      const auditStart = Date.now();
      auditEntries.push(
        this.createAuditEntry('agent.executed', {
          action: decision.action,
          confidence: decision.confidence,
          targetArtifactIds: decision.targetArtifactIds,
          actionsPerformed: executedActions,
        }),
      );
      timing.auditMs = Date.now() - auditStart;

      // ---- Step 9: Notify ----
      const notifyStart = Date.now();
      const newNotifications = this.buildNotifications(decision, executedActions);
      notifications.push(...newNotifications);
      timing.notifyMs = Date.now() - notifyStart;

      return this.buildResult(true, decision, actionsPerformed, auditEntries, notifications, timing, totalStart);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      auditEntries.push(
        this.createAuditEntry('agent.error', { error: errorMessage }),
      );

      return this.buildResult(false, decision, actionsPerformed, auditEntries, notifications, timing, totalStart, errorMessage);
    }
  }

  // -- Hooks for subclasses to override --------------------------------------

  /**
   * Load artifacts that fall within the resolved read scope.
   * Subclasses should override this to query their artifact store.
   */
  protected async loadArtifactsInScope(
    _readScope: ResolvedScope,
  ): Promise<Artifact[]> {
    return [];
  }

  /**
   * Execute the decided actions within the resolved write scope.
   * Subclasses should override this to perform forks, PRs, etc.
   */
  protected async executeActions(
    _decision: AgentDecision,
    _writeScope: ResolvedScope,
  ): Promise<AgentAction[]> {
    return [_decision.action];
  }

  /**
   * Build the scope policy from org/team settings.
   * Subclasses should override to load real policy data.
   */
  protected buildScopePolicy(): ScopePolicy {
    return {
      maxSensitivity: 'internal',
      blockedLedgerIds: [],
      blockedArtifactTypes: [],
      forceCustomerFacingOnly: false,
    };
  }

  /**
   * Build the gate configuration from current budget and policy state.
   * Subclasses should override to load real budget data.
   */
  protected buildGateConfig(): GateConfig {
    return {
      minConfidence: this.agent.actionBudget.requireApprovalAbove,
      forksRemaining: this.agent.actionBudget.maxForksPerHour,
      prsRemaining: this.agent.actionBudget.maxPRsPerDay,
      yoloEnabled: false,
      circuitBreakerOpen: false,
    };
  }

  // -- Private helpers -------------------------------------------------------

  private evaluateGate(
    decision: AgentDecision,
    config: GateConfig,
  ): { passed: boolean; reason: string } {
    // Circuit breaker
    if (config.circuitBreakerOpen) {
      return { passed: false, reason: 'Circuit breaker is open' };
    }

    // Confidence gate
    if (decision.confidence < config.minConfidence) {
      return {
        passed: false,
        reason: `Confidence ${decision.confidence.toFixed(2)} below threshold ${config.minConfidence.toFixed(2)}`,
      };
    }

    // Budget gates
    if (decision.action === 'fork' && config.forksRemaining <= 0) {
      return { passed: false, reason: 'Fork budget exhausted for this hour' };
    }
    if (decision.action === 'pr' && config.prsRemaining <= 0) {
      return { passed: false, reason: 'PR budget exhausted for today' };
    }

    return { passed: true, reason: 'All gates passed' };
  }

  private buildNotifications(
    decision: AgentDecision,
    actions: AgentAction[],
  ): Notification[] {
    const notifications: Notification[] = [];
    const now = new Date().toISOString();

    const typeMap: Partial<Record<AgentAction, NotificationType>> = {
      pr: 'pr_opened',
      notify: 'review_requested',
    };

    for (const action of actions) {
      const notifType = typeMap[action];
      if (!notifType) continue;

      notifications.push({
        id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        orgId: this.agent.orgId,
        userId: this.agent.ownerId,
        type: notifType,
        title: `Agent "${this.agent.name}" — ${action}`,
        body: decision.reasoning,
        sourceRef: this.agent.id,
        voiceNarrationUrl: null,
        channel: 'in_app',
        status: 'pending',
        sentAt: now,
        readAt: null,
      });
    }

    return notifications;
  }

  private createAuditEntry(
    action: AuditAction,
    metadata: Record<string, unknown>,
  ): AuditEntry {
    return {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      orgId: this.agent.orgId,
      actorId: this.agent.id,
      actorType: 'agent',
      action,
      targetRef: this.agent.id,
      targetType: 'agent',
      metadata,
      policyVersion: '1.0.0',
      engineVersion: '0.1.0',
      redactionState: 'none',
      createdAt: new Date().toISOString(),
    };
  }

  private buildResult(
    success: boolean,
    decision: AgentDecision,
    actionsPerformed: AgentAction[],
    auditEntries: AuditEntry[],
    notifications: Notification[],
    timing: ExecutionTiming,
    totalStart: number,
    error?: string,
  ): AgentExecutionResult {
    timing.totalMs = Date.now() - totalStart;
    return {
      success,
      decision,
      actionsPerformed,
      auditEntries,
      notifications,
      ...(error ? { error } : {}),
      timing,
    };
  }
}
