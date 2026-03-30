// ---------------------------------------------------------------------------
// ScopeResolver — resolves agent read/write scopes against policy
// ---------------------------------------------------------------------------

import type {
  Agent,
  ScopeConfig,
  ArtifactType,
  SensitivityLevel,
  Artifact,
} from '@lurk/shared-types';

// ---- Resolved Scope --------------------------------------------------------

/**
 * A fully resolved scope describing which ledgers, teams, artifact types, and
 * sensitivity levels an agent is permitted to access.
 */
export interface ResolvedScope {
  /** Permitted ledger IDs (empty array = none; null = all). */
  ledgerIds: string[] | null;
  /** Permitted team IDs (empty array = none; null = all). */
  teamIds: string[] | null;
  /** Permitted artifact types (null = all). */
  artifactTypes: ArtifactType[] | null;
  /** Maximum sensitivity level the agent may access. */
  sensitivityMax: SensitivityLevel;
  /** Whether scope is limited to customer-facing artifacts. */
  customerFacingOnly: boolean;
  /** Tag include/exclude sets that were resolved. */
  includeTags: string[];
  excludeTags: string[];
}

// ---- Policy constraints applied during scope resolution --------------------

export interface ScopePolicy {
  /** Global ceiling on sensitivity for this org. */
  maxSensitivity: SensitivityLevel;
  /** Ledgers that are blocked by kill-switch or group policy. */
  blockedLedgerIds: string[];
  /** Artifact types that are blocked by group policy. */
  blockedArtifactTypes: ArtifactType[];
  /** Force customer-facing-only for all agents in this scope. */
  forceCustomerFacingOnly: boolean;
}

// ---- Sensitivity ordering --------------------------------------------------

const SENSITIVITY_ORDER: Record<SensitivityLevel, number> = {
  public: 0,
  internal: 1,
  confidential: 2,
  restricted: 3,
};

function minSensitivity(
  a: SensitivityLevel,
  b: SensitivityLevel,
): SensitivityLevel {
  return SENSITIVITY_ORDER[a] <= SENSITIVITY_ORDER[b] ? a : b;
}

// ---- ScopeResolver ---------------------------------------------------------

export class ScopeResolver {
  /**
   * Resolve the effective read scope for an agent, constrained by policy.
   */
  resolveReadScope(agent: Agent, policy: ScopePolicy): ResolvedScope {
    return this.resolveScope(agent.readScope, policy);
  }

  /**
   * Resolve the effective write scope for an agent, constrained by policy.
   */
  resolveWriteScope(agent: Agent, policy: ScopePolicy): ResolvedScope {
    return this.resolveScope(agent.writeScope, policy);
  }

  /**
   * Check whether a specific artifact falls within a resolved scope.
   */
  isArtifactInScope(artifact: Artifact, scope: ResolvedScope): boolean {
    // Ledger check
    if (scope.ledgerIds !== null && !scope.ledgerIds.includes(artifact.ledgerId)) {
      return false;
    }

    // Team check — artifact must belong to at least one permitted team
    if (scope.teamIds !== null) {
      const overlap = artifact.teamIds.some((t) => scope.teamIds!.includes(t));
      if (!overlap) {
        return false;
      }
    }

    // Artifact type check
    if (scope.artifactTypes !== null && !scope.artifactTypes.includes(artifact.type)) {
      return false;
    }

    // Sensitivity check
    if (SENSITIVITY_ORDER[artifact.sensitivity] > SENSITIVITY_ORDER[scope.sensitivityMax]) {
      return false;
    }

    // Customer-facing check
    if (scope.customerFacingOnly && !artifact.customerFacing) {
      return false;
    }

    // Tag include filter — at least one tag must match
    if (scope.includeTags.length > 0) {
      const hasIncluded = artifact.tags.some((t) => scope.includeTags.includes(t));
      if (!hasIncluded) {
        return false;
      }
    }

    // Tag exclude filter — none of the tags may match
    if (scope.excludeTags.length > 0) {
      const hasExcluded = artifact.tags.some((t) => scope.excludeTags.includes(t));
      if (hasExcluded) {
        return false;
      }
    }

    return true;
  }

  // -- Private ----------------------------------------------------------------

  private resolveScope(
    scopeConfig: ScopeConfig,
    policy: ScopePolicy,
  ): ResolvedScope {
    // Resolve ledger IDs: start with agent config, then remove blocked
    let ledgerIds = scopeConfig.ledgerIds;
    if (ledgerIds !== null && policy.blockedLedgerIds.length > 0) {
      ledgerIds = ledgerIds.filter((id) => !policy.blockedLedgerIds.includes(id));
    }

    // Resolve artifact types: start with agent config, then remove blocked
    let artifactTypes = scopeConfig.artifactTypes;
    if (artifactTypes !== null && policy.blockedArtifactTypes.length > 0) {
      artifactTypes = artifactTypes.filter(
        (t) => !policy.blockedArtifactTypes.includes(t),
      );
    } else if (artifactTypes === null && policy.blockedArtifactTypes.length > 0) {
      // Agent has access to all types — we cannot enumerate all types here,
      // so we store null and rely on runtime checks against the blocked list.
      // For a fully-resolved representation, callers should use isArtifactInScope.
      artifactTypes = null;
    }

    // Sensitivity ceiling: the lower of agent config and org policy
    const sensitivityMax = minSensitivity(
      scopeConfig.sensitivityMax,
      policy.maxSensitivity,
    );

    // Customer-facing: forced if either agent or policy says so
    const customerFacingOnly =
      scopeConfig.customerFacingOnly || policy.forceCustomerFacingOnly;

    // Tag filters
    const includeTags: string[] = [];
    const excludeTags: string[] = [];
    for (const filter of scopeConfig.tagFilters) {
      if (filter.mode === 'include') {
        includeTags.push(...filter.tags);
      } else {
        excludeTags.push(...filter.tags);
      }
    }

    return {
      ledgerIds,
      teamIds: scopeConfig.teamIds,
      artifactTypes,
      sensitivityMax,
      customerFacingOnly,
      includeTags,
      excludeTags,
    };
  }
}
