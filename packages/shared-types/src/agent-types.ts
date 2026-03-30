// ---------------------------------------------------------------------------
// Detailed Agent Type Configurations (PRD Section 6)
// ---------------------------------------------------------------------------

import type { AgentCapability, ModelConfig, ScopeConfig, TriggerConfig, ActionBudget } from './agent';

// ---- Base Agent Config (common to all specific agent types) ----------------

interface BaseAgentConfig {
  scope: ScopeConfig;
  modelConfig: ModelConfig;
  capabilities: AgentCapability[];
  triggers: TriggerConfig[];
  actionBudget: ActionBudget;
}

// ---- 6.1 Personal Agent ---------------------------------------------------

export interface PersonalAgentConfig extends BaseAgentConfig {
  agentType: 'personal';
  /** The user this agent acts on behalf of. */
  userId: string;
  /** Detect stale references, formatting issues, deprecated APIs. */
  autoDetectStaleRefs: boolean;
  /** Cross-reference meeting action items against existing artifacts. */
  meetingActionCrossRef: boolean;
  /** Auto-generate summaries of the user's work. */
  autoSummarize: boolean;
}

// ---- 6.2 Team Agent -------------------------------------------------------

export interface TeamAgentConfig extends BaseAgentConfig {
  agentType: 'team';
  teamId: string;
  /** Detect contradictions between team specs. */
  crossArtifactConflictDetection: boolean;
  /** Synthesize call transcripts into trend reports. */
  weeklyTrendSynthesis: boolean;
  /** Auto-fix new member artifacts that reference outdated standards. */
  onboardingStandardsCheck: boolean;
}

// ---- 6.3 Org Agent --------------------------------------------------------

export interface OrgAgentConfig extends BaseAgentConfig {
  agentType: 'org';
  /** Compliance scan: flag regulatory red flags. */
  complianceScan: boolean;
  /** Brand consistency: detect off-brand language. */
  brandConsistencyCheck: boolean;
  /** Security: detect leaked credentials. */
  securityScan: boolean;
  /** Patterns to scan for in security mode. */
  securityPatterns: string[];
  /** Brand guidelines reference artifact IDs. */
  brandGuidelineArtifactIds: string[];
  /** Compliance rule set identifiers. */
  complianceRuleSets: string[];
}

// ---- 6.4 Function Agent ---------------------------------------------------

export interface FunctionAgentConfig extends BaseAgentConfig {
  agentType: 'function';
  /** Business function name (e.g. 'Customer Success', 'Revenue Operations', 'Product'). */
  functionName: string;
  /** Teams this function agent spans. */
  crossTeamIds: string[];
  /** Whether to score customer health. */
  scoreCustomerHealth: boolean;
  /** Whether to generate alignment artifacts. */
  generateAlignmentArtifacts: boolean;
  /** Whether to synthesize feature request rankings. */
  featureRequestSynthesis: boolean;
}

// ---- 6.5 Voice Agent ------------------------------------------------------

export interface VoiceAgentConfig extends BaseAgentConfig {
  agentType: 'voice';
  /** Whether to generate structured meeting summaries. */
  generateSummary: boolean;
  /** Whether to extract action items from transcripts. */
  extractActionItems: boolean;
  /** Whether to auto-open PRs on affected artifacts. */
  autoOpenPRsOnAffected: boolean;
  /** Whether to generate voice narration via OpenAI TTS. */
  generateVoiceNarration: boolean;
  /** TTS voice preference. */
  ttsVoice: string;
  /** Max character length for TTS input. */
  ttsMaxLength: number;
}

// ---- 6.6 Calendar Agent ---------------------------------------------------

export interface CalendarAgentConfig extends BaseAgentConfig {
  agentType: 'calendar';
  /** User whose calendar to analyze. */
  userId: string;
  /** How many days ahead to review. */
  lookAheadDays: number;
  /** Time to run daily analysis (HH:MM format). */
  dailyRunTime: string;
  /** Minimum number of participants to flag as large meeting. */
  largeMeetingThreshold: number;
  /** Whether to check if action items from previous occurrences are complete. */
  checkActionItemCompletion: boolean;
  /** Whether to suggest cancellations. */
  suggestCancellations: boolean;
  /** Whether to suggest shortening. */
  suggestShortening: boolean;
}

// ---- 6.7 Customer Health Agent --------------------------------------------

export interface CustomerHealthAgentConfig extends BaseAgentConfig {
  agentType: 'customer_health';
  /** Run frequency. */
  scheduleIntervalHours: number;
  /** Signal source weights for health score computation. */
  signalWeights: Record<string, number>;
  /** Alert level that triggers notifications. */
  notifyAtAlertLevel: 'watch' | 'action_required' | 'escalation';
  /** Team IDs to notify on alerts. */
  alertTeamIds: string[];
  /** Whether to auto-create meta:customer_health artifacts. */
  createHealthArtifacts: boolean;
}

// ---- 6.8 Analytics Agent --------------------------------------------------

export interface AnalyticsAgentConfig extends BaseAgentConfig {
  agentType: 'analytics';
  /** Run frequency. */
  scheduleIntervalHours: number;
  /** Whether to score individual artifact quality. */
  scoreQuality: boolean;
  /** Whether to compute staleness scores. */
  scoreStaleness: boolean;
  /** Whether to detect coverage gaps. */
  detectCoverageGaps: boolean;
  /** Whether to auto-open PRs on stale artifacts. */
  autoFixStaleArtifacts: boolean;
  /** Number of days without update to consider an artifact stale. */
  stalenessDaysThreshold: number;
  /** Whether to generate org-wide analytics report. */
  generateOrgReport: boolean;
}

// ---- Discriminated Union of All Agent Configs ------------------------------

export type AgentConfig =
  | PersonalAgentConfig
  | TeamAgentConfig
  | OrgAgentConfig
  | FunctionAgentConfig
  | VoiceAgentConfig
  | CalendarAgentConfig
  | CustomerHealthAgentConfig
  | AnalyticsAgentConfig;
