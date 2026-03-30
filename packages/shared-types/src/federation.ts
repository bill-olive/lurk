// ---------------------------------------------------------------------------
// Cross-Org Collaboration / Federation (PRD Section 11)
// ---------------------------------------------------------------------------

import type { Timestamp } from './artifact';
import type { ScopeConfig } from './agent';
import type { RedactionLevel } from './privacy';

// ---- Federation Status -----------------------------------------------------

export type FederationStatus =
  | 'pending_approval'
  | 'active'
  | 'expired'
  | 'revoked';

// ---- Federation Agreement --------------------------------------------------

export interface FederationAgreement {
  id: string;
  orgAId: string;
  orgBId: string;
  /** What can be shared. */
  sharedScope: ScopeConfig;
  /** Always aggressive for cross-org. */
  redactionLevel: RedactionLevel;
  /** Auto-expire sharing after N days. */
  expirationDays: number;
  expirationDate: Timestamp;
  /** Always audited. */
  auditRequired: boolean;
  status: FederationStatus;
  /** Approved by org A admin. */
  approvedByA: string | null;
  /** Approved by org B admin. */
  approvedByB: string | null;
  createdAt: Timestamp;
}

// ---- Guest Access ----------------------------------------------------------

export type GuestRole = 'guest';

export type GuestCapability =
  | 'view_shared'
  | 'capture_to_host_org';

export type GuestRestriction =
  | 'no_agents'
  | 'no_migration'
  | 'no_admin';

export interface GuestAccess {
  id: string;
  /** The guest user's ID. */
  guestUserId: string;
  /** The org that invited the guest. */
  hostOrgId: string;
  /** The guest's email. */
  email: string;
  displayName: string;
  role: GuestRole;
  capabilities: GuestCapability[];
  restrictions: GuestRestriction[];
  /** Artifacts explicitly shared with this guest. */
  sharedArtifactIds: string[];
  /** Team IDs whose artifacts are shared with this guest. */
  sharedTeamIds: string[];
  /** Invitation expiry. */
  expiresAt: Timestamp | null;
  invitedBy: string;
  createdAt: Timestamp;
}
