// ---------------------------------------------------------------------------
// Fork — copy of an artifact for proposing changes (PRD Section 4.3)
// ---------------------------------------------------------------------------

import type { Timestamp } from './artifact';
import type { AgentType } from './agent';

// ---- Fork Status -----------------------------------------------------------

export type ForkStatus =
  | 'active'
  | 'merged'
  | 'abandoned'
  | 'rejected';

// ---- Fork ------------------------------------------------------------------

export interface Fork {
  id: string;
  orgId: string;

  // -- Source --
  /** What was forked. */
  upstreamArtifactId: string;
  /** At which version. */
  upstreamVersion: number;
  /** From whose ledger. */
  upstreamLedgerId: string;

  // -- Fork state --
  /** The agent's working ledger. */
  forkLedgerId: string;
  /** Branch in the fork ledger. */
  forkBranchId: string;
  /** The forked artifact copy. */
  artifactId: string;

  // -- Agent context --
  /** Which agent created this fork. */
  agentId: string;
  agentType: AgentType;
  /** Why the agent forked this. */
  reason: string;
  /** 0.0 - 1.0 agent confidence in proposed change. */
  confidence: number;

  // -- Lifecycle --
  status: ForkStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
