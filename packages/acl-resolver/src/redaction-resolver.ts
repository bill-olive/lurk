// =============================================================================
// RedactionResolver — Resolves redaction levels based on PRD Section 8.4
//
// Implements the boundary rules table that determines what level of PII
// redaction to apply when content crosses a boundary (user -> agent,
// team -> cross-team agent, etc.).
// =============================================================================

import type {
  RedactionLevel,
  BoundarySource,
  Requestor,
  Artifact,
  AgentType,
} from '@lurk/shared-types';

// ---------------------------------------------------------------------------
// Boundary classification
// ---------------------------------------------------------------------------

export type BoundaryType =
  | 'own_ledger'           // Within user's own ledger -- no redaction
  | 'personal_agent'       // User -> Personal agent -- configurable (default: full)
  | 'team_agent'           // User -> Team agent -- standard redaction
  | 'cross_team_agent'     // Team -> Cross-team agent -- aggressive redaction
  | 'org_agent'            // Any -> Org agent -- per org policy
  | 'migration_agent'      // Any -> Migration agent -- standard redaction
  | 'audit_log'            // Any -> Audit log -- fingerprints only
  | 'external_connector'   // Any -> External connector -- maximum redaction
  | 'customer_health'      // Any -> Customer health score -- aggressive redaction
  | 'same_team'            // Within team -- standard redaction
  | 'unknown';             // Fallback

// ---------------------------------------------------------------------------
// Boundary rules table from PRD Section 8.4
//
// | Boundary                     | PII Treatment         | Content Visible             |
// |------------------------------|-----------------------|-----------------------------|
// | Within user's own ledger     | None -- full content  | Full                        |
// | User -> Personal agent       | Configurable (full)   | Full or redacted            |
// | User -> Team agent           | Standard redaction    | Redacted content or features|
// | Team -> Cross-team agent     | Aggressive redaction  | Features only (default)     |
// | Any -> Org agent             | Per org policy        | Redacted or features        |
// | Any -> Migration agent       | Standard redaction    | Redacted (import-time scrub)|
// | Any -> Audit log             | Fingerprints only     | No content                  |
// | Any -> External connector    | Maximum redaction     | Summary only                |
// | Any -> Customer health score | Aggressive redaction  | Scores and signals only     |
// ---------------------------------------------------------------------------

const BOUNDARY_REDACTION_MAP: Record<BoundaryType, RedactionLevel> = {
  own_ledger: 'none',
  personal_agent: 'none',        // configurable, default: no redaction
  team_agent: 'standard',
  cross_team_agent: 'aggressive',
  org_agent: 'standard',         // per org policy; standard as safe default
  migration_agent: 'standard',
  audit_log: 'aggressive',
  external_connector: 'aggressive',
  customer_health: 'aggressive',
  same_team: 'standard',
  unknown: 'standard',
};

// ---------------------------------------------------------------------------
// Content visibility mapping
// ---------------------------------------------------------------------------

export type ContentVisibility =
  | 'full'
  | 'redacted'
  | 'features_only'
  | 'summary_only'
  | 'fingerprints_only'
  | 'none';

const BOUNDARY_VISIBILITY_MAP: Record<BoundaryType, ContentVisibility> = {
  own_ledger: 'full',
  personal_agent: 'full',
  team_agent: 'redacted',
  cross_team_agent: 'features_only',
  org_agent: 'redacted',
  migration_agent: 'redacted',
  audit_log: 'fingerprints_only',
  external_connector: 'summary_only',
  customer_health: 'features_only',
  same_team: 'redacted',
  unknown: 'redacted',
};

// ---------------------------------------------------------------------------
// RedactionResolver
// ---------------------------------------------------------------------------

export class RedactionResolver {
  /**
   * Determine the boundary type when an agent (or system) accesses content.
   *
   * @param agentType - The type of the requesting agent (undefined for users)
   * @param requestor - The full requestor context
   * @param artifact - The artifact being accessed
   */
  resolveBoundary(
    agentType: AgentType | undefined,
    requestor: Requestor,
    artifact: Artifact,
  ): BoundaryType {
    // User accessing own artifact -- no boundary
    if (
      requestor.type === 'user' &&
      artifact.authorId === requestor.id
    ) {
      return 'own_ledger';
    }

    // Non-agent requestor accessing team content
    if (requestor.type === 'user') {
      const sameTeam = requestor.teamIds.some((tid) =>
        artifact.teamIds.includes(tid),
      );
      return sameTeam ? 'same_team' : 'unknown';
    }

    // Agent requestor -- classify by agent type
    if (!agentType) return 'unknown';

    switch (agentType) {
      case 'personal': {
        // Personal agent accessing its owner's content
        const isOwnerContent =
          artifact.authorId === requestor.id ||
          artifact.ownerIds.includes(requestor.id);
        return isOwnerContent ? 'personal_agent' : 'team_agent';
      }

      case 'team': {
        // Team agent -- check if artifact is within the same team
        const sameTeam = requestor.teamIds.some((tid) =>
          artifact.teamIds.includes(tid),
        );
        return sameTeam ? 'team_agent' : 'cross_team_agent';
      }

      case 'org':
        return 'org_agent';

      case 'function':
        // Function agents are cross-team by nature
        return 'cross_team_agent';

      case 'migration':
        return 'migration_agent';

      case 'voice':
        // Voice agents typically operate within team context
        return 'team_agent';

      case 'calendar':
        // Calendar agents are personal by default
        return 'personal_agent';

      default:
        return 'unknown';
    }
  }

  /**
   * Get the redaction level for a given boundary type.
   */
  resolveRedactionLevel(boundary: BoundaryType): RedactionLevel {
    return BOUNDARY_REDACTION_MAP[boundary];
  }

  /**
   * Get the content visibility for a given boundary type.
   */
  resolveContentVisibility(boundary: BoundaryType): ContentVisibility {
    return BOUNDARY_VISIBILITY_MAP[boundary];
  }

  /**
   * Convenience: resolve redaction directly from source and target boundary sources.
   */
  resolveFromBoundarySources(
    source: BoundarySource,
    _target: BoundarySource,
  ): RedactionLevel {
    const boundaryType = boundarySourceToBoundaryType(source);
    return this.resolveRedactionLevel(boundaryType);
  }

  /**
   * Check if content should be accessible at all across this boundary.
   * Returns false for audit_log boundary (fingerprints only, no content).
   */
  isContentAccessible(boundary: BoundaryType): boolean {
    const visibility = BOUNDARY_VISIBILITY_MAP[boundary];
    return visibility !== 'fingerprints_only' && visibility !== 'none';
  }

  /**
   * Determine whether raw (unredacted) content is allowed at this boundary.
   */
  isRawContentAllowed(boundary: BoundaryType): boolean {
    return boundary === 'own_ledger';
  }

  /**
   * Get a human-readable description of the redaction policy for a boundary.
   */
  describeBoundaryPolicy(boundary: BoundaryType): string {
    const descriptions: Record<BoundaryType, string> = {
      own_ledger:
        'No redaction. Full content visible to the artifact owner.',
      personal_agent:
        'Configurable (default: no redaction). Personal agent has full or redacted access.',
      team_agent:
        'Standard PII redaction. Redacted content or feature bundles visible.',
      cross_team_agent:
        'Aggressive PII redaction. Only feature bundles visible by default.',
      org_agent:
        'Per org policy. Redacted content or feature bundles visible.',
      migration_agent:
        'Standard redaction at import time. Redacted content visible.',
      audit_log:
        'Fingerprints only. No content stored in audit logs.',
      external_connector:
        'Maximum redaction. Only summaries visible to external systems.',
      customer_health:
        'Aggressive redaction. Only scores and signals, no raw quotes.',
      same_team:
        'Standard redaction for within-team access.',
      unknown:
        'Unknown boundary -- standard redaction applied as safe default.',
    };

    return descriptions[boundary];
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function boundarySourceToBoundaryType(source: BoundarySource): BoundaryType {
  switch (source) {
    case 'own_ledger':
      return 'own_ledger';
    case 'personal_agent':
      return 'personal_agent';
    case 'team_agent':
      return 'team_agent';
    case 'cross_team_agent':
      return 'cross_team_agent';
    case 'org_agent':
      return 'org_agent';
    case 'migration_agent':
      return 'migration_agent';
    case 'audit_log':
      return 'audit_log';
    case 'external_connector':
      return 'external_connector';
    case 'customer_health_score':
      return 'customer_health';
    default:
      return 'unknown';
  }
}
