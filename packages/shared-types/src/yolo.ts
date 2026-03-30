// ---------------------------------------------------------------------------
// YOLO Mode Configuration (PRD Section 4.6)
// ---------------------------------------------------------------------------

import type { AgentType } from './agent';
import type { SensitivityLevel } from './artifact';

export interface YoloConfig {
  enabled: boolean;

  // -- What can auto-merge --
  /** Which agent types can auto-merge. */
  allowedAgentTypes: AgentType[];
  /** Specific agents (null = all of allowed types). */
  allowedAgentIds: string[] | null;
  /** e.g. ['formatting', 'typo', 'data_refresh']. */
  allowedCategories: string[];

  // -- Guardrails --
  /** Minimum agent confidence (0.0 - 1.0). */
  minConfidence: number;
  /** Max lines changed. */
  maxDiffSize: number;
  /** Max sensitivity of affected artifact. */
  maxSensitivity: SensitivityLevel;
  /** Never auto-merge customer-facing artifacts. */
  excludeCustomerFacing: boolean;
  /** Never auto-merge artifacts with these tags. */
  excludeTags: string[];

  // -- Safety --
  /** Hours to pause YOLO after a rejection. */
  cooldownAfterReject: number;
  /** Max auto-merges per day. */
  dailyAutoMergeCap: number;
  /** Require two agents to agree before auto-merge. */
  requireSecondAgent: boolean;
  /** Hours during which auto-merge can be undone. */
  rollbackWindow: number;
}
