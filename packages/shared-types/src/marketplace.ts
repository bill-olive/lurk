// ---------------------------------------------------------------------------
// Agent Marketplace and Custom Agent Builder (PRD Section 10)
// ---------------------------------------------------------------------------

import type { Timestamp, ArtifactType } from './artifact';
import type { AgentType, AgentCapability, TriggerType, ScopeConfig } from './agent';

// ---- Model Reference -------------------------------------------------------

export type MarketplaceModelRef =
  | 'sonnet_4_6'
  | 'opus_4_6';

// ---- Agent Template --------------------------------------------------------

export interface AgentTemplate {
  id: string;
  name: string;
  type: AgentType;
  description: string;
  /** Default model for this template. */
  defaultModel: MarketplaceModelRef;
  defaultTriggers: TriggerType[];
  defaultCapabilities: AgentCapability[];
  defaultScope: Partial<ScopeConfig>;
  /** Which prompts can be customized by the deploying admin. */
  customizablePrompts: string[];
  /** Template category for marketplace browsing. */
  category: AgentTemplateCategory;
  /** Whether this is a built-in template. */
  isBuiltIn: boolean;
  createdBy: string;
  createdAt: Timestamp;
}

export type AgentTemplateCategory =
  | 'sales'
  | 'engineering'
  | 'compliance'
  | 'brand'
  | 'customer_success'
  | 'onboarding'
  | 'security'
  | 'analytics'
  | 'productivity'
  | 'custom';

// ---- Agent Marketplace -----------------------------------------------------

export interface AgentMarketplace {
  builtInTemplates: AgentTemplate[];
  communityTemplates: AgentTemplate[];
}

// ---- Custom Agent Builder --------------------------------------------------

export interface CustomAgentBuilderInput {
  /** Natural language description of what the agent should do. */
  naturalLanguageDescription: string;
  /** Optional constraints the admin wants to enforce. */
  constraints: CustomAgentConstraints;
}

export interface CustomAgentConstraints {
  /** Force a specific agent type. */
  forceAgentType: AgentType | null;
  /** Force specific artifact types in scope. */
  forceArtifactTypes: ArtifactType[] | null;
  /** Force specific team scope. */
  forceTeamIds: string[] | null;
  /** Maximum confidence threshold for auto-merge. */
  maxAutoMergeConfidence: number | null;
}

export interface CustomAgentBuilderResult {
  /** The generated agent configuration. */
  agentConfig: GeneratedAgentConfig;
  /** Explanation of why this configuration was chosen. */
  explanation: string;
  /** Suggested test artifact IDs for sandbox testing. */
  suggestedTestArtifacts: string[];
}

export interface GeneratedAgentConfig {
  name: string;
  type: AgentType;
  description: string;
  triggers: TriggerType[];
  capabilities: AgentCapability[];
  scope: Partial<ScopeConfig>;
  modelTier: MarketplaceModelRef;
  generatedPrompts: Record<string, string>;
}

// ---- Test Result -----------------------------------------------------------

export interface AgentTestResult {
  agentConfigId: string;
  /** Artifacts that were analyzed. */
  analyzedArtifactIds: string[];
  /** PRs that would be created (not committed). */
  simulatedPRs: SimulatedPR[];
  /** Overall pass rate. */
  confidenceDistribution: ConfidenceDistribution;
  /** Estimated actions per day at this configuration. */
  estimatedActionsPerDay: number;
}

export interface SimulatedPR {
  targetArtifactId: string;
  title: string;
  description: string;
  confidence: number;
  diffSummary: string;
}

export interface ConfidenceDistribution {
  /** Percentage of simulated actions with confidence >= 0.9. */
  high: number;
  /** Percentage with confidence 0.7 - 0.9. */
  medium: number;
  /** Percentage with confidence < 0.7. */
  low: number;
}
