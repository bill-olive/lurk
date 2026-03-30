// ---------------------------------------------------------------------------
// Ledger — per-user versioned artifact store (PRD Section 4.2)
// ---------------------------------------------------------------------------

import type { Timestamp, SensitivityLevel } from './artifact';
import type { YoloConfig } from './yolo';

// ---- Sync State ------------------------------------------------------------

export type ConflictState =
  | 'none'
  | 'diverged_resolvable'
  | 'diverged_manual';

export interface SyncState {
  lastSyncAt: Timestamp;
  localHead: string;
  remoteHead: string;
  /** Commits not yet synced to cloud. */
  pendingCommits: number;
  /** PRs not yet synced. */
  pendingPRs: number;
  conflictState: ConflictState;
}

// ---- Branch ----------------------------------------------------------------

/** Reference to another ledger's branch (for cross-ledger tracking). */
export interface UpstreamRef {
  ledgerId: string;
  branchId: string;
  commitHash: string;
}

export interface Branch {
  id: string;
  /** e.g. 'main', 'agent/pricing-update'. */
  name: string;
  /** Commit hash of the branch head. */
  head: string;
  /** If tracking another ledger's branch. */
  upstream: UpstreamRef | null;
  /** userId or agentId. */
  createdBy: string;
  createdAt: Timestamp;
}

// ---- Commit Entry ----------------------------------------------------------

export type AuthorType = 'user' | 'agent';

export interface CommitEntry {
  /** SHA-256(parentHash + artifactId + version + content_hash + timestamp). */
  hash: string;
  /** null for initial commit; can have multiple parents for merges. */
  parentHash: string | null;
  artifactId: string;
  version: number;
  message: string;
  /** User or agent that authored this commit. */
  authorId: string;
  authorType: AuthorType;
  timestamp: Timestamp;
  /** HMAC signature using org signing key. */
  signature: string;
  /** Which policy was in effect. */
  policyVersion: string;
}

// ---- Ledger ----------------------------------------------------------------

export interface Ledger {
  id: string;
  userId: string;
  orgId: string;

  // -- Versioning (Lurk-native, git-inspired primitives) --
  /** Commit hash of latest state on main. */
  head: string;
  branches: Branch[];
  /** Ordered commit history (DAG). */
  commitLog: CommitEntry[];

  // -- Stats --
  artifactCount: number;
  lastCommitAt: Timestamp;

  // -- Policy --
  defaultSensitivity: SensitivityLevel;
  /** Commit on every capture, or batch. */
  autoCommit: boolean;
  yoloMode: YoloConfig;

  // -- Local storage (Mac/iOS) --
  /** e.g. ~/Library/Application Support/Lurk/ledgers/{id}/ */
  localPath: string;
  localSizeBytes: number;
  syncState: SyncState;
}

// ---- Merge -----------------------------------------------------------------

export type MergeStrategy =
  | 'fast_forward'
  | 'three_way'
  | 'semantic_merge'
  | 'agent_resolve'
  | 'manual'
  | 'theirs'
  | 'ours';

export interface MergeResult {
  success: boolean;
  commitHash: string | null;
  strategy: MergeStrategy;
  conflictsResolved: number;
  conflictsRemaining: number;
  message: string;
}

export interface SyncResult {
  success: boolean;
  commitsPushed: number;
  commitsPulled: number;
  newSyncState: SyncState;
  errors: string[];
}
