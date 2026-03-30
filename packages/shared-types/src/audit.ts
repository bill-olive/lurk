// ---------------------------------------------------------------------------
// Audit Entry (PRD Section 16)
// ---------------------------------------------------------------------------

import type { Timestamp } from './artifact';

// ---- Actor Type ------------------------------------------------------------

export type AuditActorType =
  | 'user'
  | 'agent'
  | 'system'
  | 'migration'
  | 'admin';

// ---- Target Type -----------------------------------------------------------

export type AuditTargetType =
  | 'artifact'
  | 'ledger'
  | 'fork'
  | 'pull_request'
  | 'agent'
  | 'policy'
  | 'team'
  | 'user'
  | 'organization'
  | 'migration'
  | 'federation'
  | 'notification'
  | 'connector';

// ---- Audit Actions ---------------------------------------------------------

export type AuditAction =
  // Artifact actions
  | 'artifact.created'
  | 'artifact.committed'
  | 'artifact.modified'
  | 'artifact.deleted'
  | 'artifact.access_granted'
  | 'artifact.access_denied'
  // Ledger actions
  | 'ledger.branch_created'
  | 'ledger.merged'
  | 'ledger.reverted'
  | 'ledger.synced'
  // Fork actions
  | 'fork.created'
  | 'fork.abandoned'
  // PR actions
  | 'pr.opened'
  | 'pr.reviewed'
  | 'pr.merged'
  | 'pr.rejected'
  | 'pr.auto_merged'
  | 'pr.closed'
  | 'pr.rollback'
  // Agent actions
  | 'agent.created'
  | 'agent.updated'
  | 'agent.paused'
  | 'agent.resumed'
  | 'agent.disabled'
  | 'agent.executed'
  | 'agent.error'
  | 'agent.circuit_break'
  // Policy actions
  | 'policy.created'
  | 'policy.updated'
  | 'policy.activated'
  | 'policy.deactivated'
  // Migration actions
  | 'migration.planned'
  | 'migration.approved'
  | 'migration.started'
  | 'migration.completed'
  | 'migration.failed'
  | 'migration.rolled_back'
  // Admin actions
  | 'admin.kill_switch_activated'
  | 'admin.kill_switch_deactivated'
  | 'admin.user_created'
  | 'admin.user_updated'
  | 'admin.team_created'
  | 'admin.team_updated'
  | 'admin.federation_created'
  | 'admin.federation_revoked'
  // Privacy actions
  | 'privacy.pii_detected'
  | 'privacy.redaction_applied'
  | 'privacy.data_deleted';

// ---- Redaction State -------------------------------------------------------

export type AuditRedactionState =
  | 'none'
  | 'metadata_only'
  | 'fingerprints_only';

// ---- Audit Entry -----------------------------------------------------------

export interface AuditEntry {
  id: string;
  orgId: string;
  /** Who performed the action. */
  actorId: string;
  actorType: AuditActorType;
  /** What action was performed. */
  action: AuditAction;
  /** Reference to the target entity. */
  targetRef: string;
  targetType: AuditTargetType;
  /** Non-content metadata about the action (fingerprints, counts, etc.). */
  metadata: Record<string, unknown>;
  /** Which policy version was in effect. */
  policyVersion: string;
  /** Which engine version produced this event. */
  engineVersion: string;
  /** What redaction was applied to this audit entry. */
  redactionState: AuditRedactionState;
  createdAt: Timestamp;
}
