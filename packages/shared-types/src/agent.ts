// ---------------------------------------------------------------------------
// Agent — autonomous entity operating on artifacts (PRD Section 4.5)
// ---------------------------------------------------------------------------

import type { ArtifactType, Timestamp, SensitivityLevel } from './artifact';

// ---- Agent Type ------------------------------------------------------------

export type AgentType =
  | 'personal'
  | 'team'
  | 'org'
  | 'function'
  | 'migration'
  | 'voice'
  | 'calendar';

// ---- Agent Status ----------------------------------------------------------

export type AgentStatus =
  | 'active'
  | 'paused'
  | 'disabled'
  | 'error';

// ---- Owner Type ------------------------------------------------------------

export type AgentOwnerType = 'user' | 'team' | 'org';

// ---- Scope Config ----------------------------------------------------------

export interface TagFilter {
  mode: 'include' | 'exclude';
  tags: string[];
}

export interface ScopeConfig {
  /** Specific ledgers (null = all permitted). */
  ledgerIds: string[] | null;
  /** Specific teams. */
  teamIds: string[] | null;
  /** Specific types. */
  artifactTypes: ArtifactType[] | null;
  /** Maximum sensitivity level. */
  sensitivityMax: SensitivityLevel;
  /** Only customer-facing artifacts? */
  customerFacingOnly: boolean;
  /** Include/exclude by tag. */
  tagFilters: TagFilter[];
}

// ---- Action Budget ---------------------------------------------------------

export interface ActionBudget {
  /** Rate limit on forks. */
  maxForksPerHour: number;
  /** Rate limit on PRs. */
  maxPRsPerDay: number;
  /** LLM token budget. */
  maxTokensPerDay: number;
  /** Confidence threshold below which PR needs human review. */
  requireApprovalAbove: number;
  /** Dollar cap on compute costs. */
  costCapPerMonth: number;
}

// ---- Trigger ---------------------------------------------------------------

export type TriggerType =
  | 'artifact_committed'
  | 'artifact_modified'
  | 'schedule'
  | 'pr_opened'
  | 'pr_merged'
  | 'keyword_detected'
  | 'conflict_detected'
  | 'staleness_threshold'
  | 'customer_event'
  | 'meeting_ended'
  | 'calendar_event'
  | 'migration_batch'
  | 'manual';

export interface TriggerConfig {
  type: TriggerType;
  /** Type-specific filter. */
  filter: Record<string, unknown>;
  /** Minimum interval between triggers (ms). */
  debounceMs: number;
  enabled: boolean;
}

// ---- Capabilities ----------------------------------------------------------

export type AgentCapability =
  | 'read_artifacts'
  | 'fork_artifacts'
  | 'open_prs'
  | 'synthesize'
  | 'summarize'
  | 'detect_conflicts'
  | 'recommend'
  | 'notify'
  | 'auto_merge'
  | 'score_customer_health'
  | 'analyze_artifacts'
  | 'review_calendar'
  | 'voice_narrate'
  | 'migrate_data'
  | 'browse_web';

// ---- Model Config ----------------------------------------------------------

export type ModelTier = 'fast' | 'deep';

export interface ModelConfig {
  /** Default model tier for this agent. */
  defaultTier: ModelTier;
  /** Override to always use a specific model. */
  modelOverride: string | null;
  /** Temperature (0.0 - 1.0). */
  temperature: number;
  /** Maximum tokens for LLM response. */
  maxResponseTokens: number;
  /** System prompt prefix. */
  systemPromptPrefix: string | null;
}

// ---- Custom Prompt ---------------------------------------------------------

export interface CustomPrompt {
  id: string;
  /** Which prompt template this customizes. */
  templateKey: string;
  /** The custom prompt content. */
  content: string;
  /** Who created this customization. */
  createdBy: string;
  createdAt: Timestamp;
}

// ---- Agent -----------------------------------------------------------------

export interface Agent {
  id: string;
  orgId: string;

  // -- Identity --
  /** e.g. 'bill-personal', 'sales-team', 'legal-compliance'. */
  name: string;
  type: AgentType;
  description: string;

  // -- Ownership --
  /** User, team, or org who controls this agent. */
  ownerId: string;
  ownerType: AgentOwnerType;

  // -- Permissions --
  /** What artifacts can this agent read. */
  readScope: ScopeConfig;
  /** What artifacts can this agent fork/PR. */
  writeScope: ScopeConfig;
  actionBudget: ActionBudget;

  // -- Behavior --
  triggers: TriggerConfig[];
  capabilities: AgentCapability[];
  modelConfig: ModelConfig;

  // -- Marketplace --
  /** If created from a marketplace template. */
  templateId: string | null;
  /** User/admin customizations on top of template. */
  customPrompts: CustomPrompt[];

  // -- State --
  status: AgentStatus;
  lastRunAt: Timestamp;
  totalActions: number;
  /** Historical PR acceptance rate (0.0 - 1.0). */
  acceptanceRate: number;

  // -- Audit --
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
