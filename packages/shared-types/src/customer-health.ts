// ---------------------------------------------------------------------------
// Customer Health (PRD Section 6.7)
// ---------------------------------------------------------------------------

import type { Timestamp } from './artifact';

// ---- Health Trend ----------------------------------------------------------

export type HealthTrend =
  | 'improving'
  | 'stable'
  | 'declining'
  | 'critical';

// ---- Alert Level -----------------------------------------------------------

export type AlertLevel =
  | 'none'
  | 'watch'
  | 'action_required'
  | 'escalation';

// ---- Health Signal Source ---------------------------------------------------

export type HealthSignalSource =
  | 'call_sentiment'
  | 'support_tickets'
  | 'engagement_frequency'
  | 'contract_renewal'
  | 'email_sentiment'
  | 'crm_activity'
  | 'product_usage'
  | 'nps_score';

// ---- Health Signal ---------------------------------------------------------

export interface HealthSignal {
  source: HealthSignalSource;
  /** Human-readable signal value. */
  value: string;
  /** Importance weight (0.0 - 1.0). */
  weight: number;
}

// ---- Customer Health Signal ------------------------------------------------

export interface CustomerHealthSignal {
  customerId: string;
  customerName: string;
  /** Health score (0 - 100). */
  healthScore: number;
  trend: HealthTrend;
  signals: HealthSignal[];
  recommendations: string[];
  alertLevel: AlertLevel;
  /** Which agent computed this. */
  agentId: string;
  lastUpdatedAt: Timestamp;
}
