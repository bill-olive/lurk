// =============================================================================
// @lurk/shared-types — Canonical type definitions for the Lurk platform
// =============================================================================
//
// All types are defined in dedicated sub-modules and re-exported here so that
// consumers can import from either '@lurk/shared-types' (flat) or from
// '@lurk/shared-types/src/<module>' (scoped).
// =============================================================================

// Core primitives (PRD Section 4)
export * from './artifact';
export * from './ledger';
export * from './fork';
export * from './pull-request';
export * from './agent';
export * from './yolo';

// Privacy and access control (PRD Sections 8 & 9)
export * from './privacy';
export * from './access-control';

// Agent type configurations (PRD Section 6)
export * from './agent-types';

// Domain types
export * from './customer-health';
export * from './migration';
export * from './notification';
export * from './organization';
export * from './audit';
export * from './marketplace';
export * from './federation';
export * from './feature-flags';

// API request/response contracts (PRD Section 15)
export * from './api';

// ---------------------------------------------------------------------------
// Supplementary types that don't belong to a single module
// ---------------------------------------------------------------------------

/** Agent execution decision output from LLM. */
export type AgentAction = 'fork' | 'pr' | 'synthesize' | 'notify' | 'skip';

/** Boundary source for redaction resolution. */
export type BoundarySource =
  | 'own_ledger'
  | 'personal_agent'
  | 'team_agent'
  | 'cross_team_agent'
  | 'org_agent'
  | 'migration_agent'
  | 'audit_log'
  | 'external_connector'
  | 'customer_health_score';

/** Describes who is making an access request (used by ACL resolver). */
export interface Requestor {
  id: string;
  type: 'user' | 'agent';
  role: import('./access-control').Role;
  teamIds: string[];
  projectScopes: string[];
  agentType?: import('./agent').AgentType;
  orgId: string;
}

// ---------------------------------------------------------------------------
// Policy evaluation result types
// ---------------------------------------------------------------------------

export interface PolicyEvaluation {
  allowed: boolean;
  reason: string;
}

export interface YoloEvaluation {
  eligible: boolean;
  reason: string;
}

export interface BudgetEvaluation {
  withinBudget: boolean;
  remaining: BudgetRemaining;
}

export interface BudgetRemaining {
  forksThisHour: number;
  maxForksPerHour: number;
  prsToday: number;
  maxPRsPerDay: number;
  tokensToday: number;
  maxTokensPerDay: number;
}

export interface AccessResolution {
  outcome: import('./access-control').AccessOutcome;
  redactionLevel: import('./privacy').RedactionLevel;
  reason: string;
}

// ---------------------------------------------------------------------------
// Circuit breaker types (PRD Section 5.4)
// ---------------------------------------------------------------------------

export interface CircuitBreakerState {
  agentId: string;
  errorCount: number;
  totalCount: number;
  errorRate: number;
  rejectionCount: number;
  rejectionTotal: number;
  rejectionRate: number;
  isPaused: boolean;
  pausedAt?: number;
  pauseReason?: string;
  chainDepth: number;
}

// ---------------------------------------------------------------------------
// Agent safety configuration (PRD Section 5.4)
// ---------------------------------------------------------------------------

export interface AgentSafetyConfig {
  maxAgentActionsPerMinute: number;
  maxForksPerAgentPerHour: number;
  maxPRsPerAgentPerDay: number;
  maxTokensPerAgentPerDay: number;
  errorRateThreshold: number;
  rejectionRateThreshold: number;
  cascadeProtection: boolean;
  maxChainDepth: number;
  requireHumanReviewWhen: HumanReviewRule[];
  autoRollbackWindow: number;
  rollbackOnOwnerReject: boolean;
}

export interface HumanReviewRule {
  field: string;
  operator: '<' | '>' | '>=' | '<=' | '==' | '!=';
  value: string | number | boolean;
}

// ---------------------------------------------------------------------------
// Merge conflict detail (used by diff-engine)
// ---------------------------------------------------------------------------

export interface MergeConflict {
  startLine: number;
  endLine: number;
  ours: string;
  theirs: string;
  base?: string;
}
