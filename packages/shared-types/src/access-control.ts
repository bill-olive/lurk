// ---------------------------------------------------------------------------
// Access Control Model (PRD Section 9)
// ---------------------------------------------------------------------------

import type { ArtifactType } from './artifact';
import type { AgentContentAccess, RedactionLevel } from './privacy';

// ---- Roles -----------------------------------------------------------------

export type Role =
  | 'org_admin'
  | 'team_admin'
  | 'member'
  | 'viewer'
  | 'service_account'
  | 'migration_admin';

// ---- Access Tiers ----------------------------------------------------------

export type AccessTier =
  | 'public'
  | 'team'
  | 'project'
  | 'confidential'
  | 'restricted';

// ---- ACL Override ----------------------------------------------------------

export type ACLAction = 'grant' | 'deny';

export interface ACLOverride {
  /** The entity being granted/denied (userId, agentId, teamId, or role). */
  principalId: string;
  principalType: 'user' | 'agent' | 'team' | 'role';
  action: ACLAction;
  /** Optional expiry for time-limited access. */
  expiresAt: string | null;
  /** Who created this override. */
  grantedBy: string;
  grantedAt: string;
  reason: string;
}

// ---- Access Outcome --------------------------------------------------------

export type AccessOutcome =
  | 'FULL'
  | 'REDACTED'
  | 'FEATURES_ONLY'
  | 'DENIED';

export interface AccessDecision {
  outcome: AccessOutcome;
  /** Which rule determined the outcome. */
  resolvedBy: string;
  /** If redacted, which level. */
  redactionLevel: RedactionLevel | null;
  /** Whether a kill switch blocked access. */
  killSwitchActive: boolean;
}

// ---- Group Policy ----------------------------------------------------------

export interface GroupPolicy {
  groupId: string;
  groupType: 'team' | 'department' | 'business_unit';

  defaultArtifactTier: AccessTier;
  forceLocalOnly: boolean;

  allowTeamAgents: boolean;
  allowOrgAgents: boolean;
  allowCrossTeamAgents: boolean;
  agentContentAccess: AgentContentAccess;

  /** No YOLO for this group. */
  requirePRReview: boolean;
  requireTwoApprovers: boolean;
  maxAutoMergePerDay: number;

  piiRedactionLevel: RedactionLevel;
  retentionDays: number;
  allowExternalSharing: boolean;

  blockedArtifactTypes: ArtifactType[];
  requireClassification: boolean;

  // -- Meeting-specific --
  allowMeetingCapture: boolean;
  meetingRetentionDays: number;

  // -- Migration-specific --
  allowMigrationImport: boolean;
}
