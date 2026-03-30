// ---------------------------------------------------------------------------
// Organization, User, Team (PRD Section 16 — Firestore Collections)
// ---------------------------------------------------------------------------

import type { Timestamp } from './artifact';
import type { Role, AccessTier } from './access-control';
import type { GroupPolicy } from './access-control';
import type { OrgPrivacyPolicy } from './privacy';
import type { NotificationPreferences } from './notification';
import type { YoloConfig } from './yolo';

// ---- Platform --------------------------------------------------------------

export type UserPlatform =
  | 'mac'
  | 'ios'
  | 'chrome_standalone';

// ---- Billing Config --------------------------------------------------------

export interface BillingConfig {
  plan: 'free' | 'team' | 'enterprise';
  seats: number;
  /** Monthly token budget (Anthropic API). */
  monthlyTokenBudget: number;
  /** Monthly cost cap in USD. */
  monthlyCostCapUsd: number;
  stripeCustomerId: string | null;
  billingEmail: string;
}

// ---- Organization ----------------------------------------------------------

export interface Organization {
  id: string;
  name: string;
  domain: string;
  privacyPolicy: OrgPrivacyPolicy;
  featureFlags: Record<string, boolean>;
  killSwitches: Record<string, boolean>;
  /** Reference to default policies doc. */
  defaultPoliciesRef: string;
  connectorDefaults: Record<string, unknown>;
  federationAgreements: string[];
  billingConfig: BillingConfig;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ---- Agent Preferences (User) ----------------------------------------------

export interface AgentPreferences {
  /** Whether personal agent is enabled. */
  personalAgentEnabled: boolean;
  /** Custom prompts for personal agent. */
  personalAgentPrompts: Record<string, string>;
  /** Preferred model tier. */
  preferredModelTier: 'fast' | 'deep';
}

// ---- User ------------------------------------------------------------------

export interface User {
  id: string;
  orgId: string;
  email: string;
  displayName: string;
  teams: string[];
  roles: Role[];
  accessTier: AccessTier;
  ledgerId: string;
  agentPreferences: AgentPreferences;
  notificationPreferences: NotificationPreferences;
  yoloConfig: YoloConfig;
  platform: UserPlatform;
  lastSeenAt: Timestamp;
  createdAt: Timestamp;
}

// ---- Team ------------------------------------------------------------------

export interface Team {
  id: string;
  orgId: string;
  name: string;
  members: string[];
  admins: string[];
  groupPolicy: GroupPolicy;
  agentIds: string[];
  projectScopes: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
