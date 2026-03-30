// =============================================================================
// ACLResolver — Access control resolution implementing PRD Section 9.3
//
// Resolves whether a requestor (user or agent) can access an artifact, and
// at what redaction level. Handles AccessTier levels, ACL overrides, kill
// switches, agent-specific cross-boundary redaction, and group-level policy
// overrides from Section 9.4.
// =============================================================================

import type {
  Requestor,
  Artifact,
  AccessOutcome,
  AccessResolution,
  RedactionLevel,
  OrgPrivacyPolicy,
  GroupPolicy,
  AgentContentAccess,
  ACLOverride,
} from '@lurk/shared-types';

import { RedactionResolver } from './redaction-resolver.js';

// ---------------------------------------------------------------------------
// Configuration passed to the resolver
// ---------------------------------------------------------------------------

export interface ACLResolverConfig {
  /** Organization-level kill switches (flat map). */
  killSwitches?: Record<string, boolean>;
  /** Org privacy policy (contains typed kill switches). */
  orgPrivacyPolicy?: OrgPrivacyPolicy;
  /** Group-level policies for teams/departments. */
  groupPolicies?: GroupPolicy[];
  /**
   * Project scopes for the artifact. The Artifact type itself doesn't carry
   * project scopes directly (they're derived from team memberships), so
   * the caller resolves them and passes them here for project-tier ACL checks.
   */
  artifactProjectScopes?: string[];
}

// ---------------------------------------------------------------------------
// ACLResolver
// ---------------------------------------------------------------------------

export class ACLResolver {
  private readonly redactionResolver: RedactionResolver;

  constructor() {
    this.redactionResolver = new RedactionResolver();
  }

  /**
   * Resolve access for a requestor to an artifact.
   *
   * Follows PRD Section 9.3 algorithm:
   * 1. Kill switch check
   * 2. Explicit DENY overrides
   * 3. Explicit GRANT overrides
   * 4. AccessTier-based resolution
   * 5. Agent-specific cross-boundary redaction
   * 6. Group-level policy overrides (Section 9.4)
   */
  resolveAccess(
    requestor: Requestor,
    artifact: Artifact,
    config: ACLResolverConfig = {},
  ): AccessResolution {
    const { killSwitches, orgPrivacyPolicy, groupPolicies, artifactProjectScopes } = config;

    // 1. Kill switch checks
    const killResult = this.checkKillSwitches(
      requestor,
      artifact,
      killSwitches,
      orgPrivacyPolicy,
    );
    if (killResult) return killResult;

    // 2. Explicit DENY override — takes priority over everything else
    const denyOverride = artifact.aclOverrides.find(
      (o) =>
        o.action === 'deny' &&
        this.matchesPrincipal(o, requestor),
    );
    if (denyOverride) {
      return {
        outcome: 'DENIED',
        redactionLevel: 'aggressive',
        reason: `Explicit DENY override for ${denyOverride.principalType}:${denyOverride.principalId}`,
      };
    }

    // 3. Explicit GRANT override — full access
    const grantOverride = artifact.aclOverrides.find(
      (o) =>
        o.action === 'grant' &&
        this.matchesPrincipal(o, requestor),
    );
    if (grantOverride) {
      // Check if GRANT has expired
      if (grantOverride.expiresAt !== null) {
        const expiresAt = new Date(grantOverride.expiresAt).getTime();
        if (Date.now() > expiresAt) {
          // Expired grant — fall through to tier-based resolution
          // (don't return, let it continue)
        } else {
          return this.resolveGrantAccess(requestor, artifact, grantOverride, orgPrivacyPolicy, groupPolicies);
        }
      } else {
        return this.resolveGrantAccess(requestor, artifact, grantOverride, orgPrivacyPolicy, groupPolicies);
      }
    }

    // 4. AccessTier-based resolution
    const tierResult = this.resolveByTier(requestor, artifact, artifactProjectScopes ?? []);

    // If denied at tier level, check group-level overrides before final denial
    if (tierResult.outcome === 'DENIED' && groupPolicies) {
      const groupOverride = this.checkGroupPolicyOverride(
        requestor,
        artifact,
        groupPolicies,
      );
      if (groupOverride) return groupOverride;
    }

    if (tierResult.outcome === 'DENIED') {
      return tierResult;
    }

    // 5. Agent-specific cross-boundary redaction
    if (requestor.type === 'agent') {
      const redaction = this.resolveAgentRedaction(
        requestor,
        artifact,
        orgPrivacyPolicy,
        groupPolicies,
      );

      // Escalate redaction: never decrease, only increase (PRD 8.5 invariant 7)
      const finalRedaction = escalateRedaction(tierResult.redactionLevel, redaction);
      const outcome = redactionToOutcome(finalRedaction);

      return {
        outcome,
        redactionLevel: finalRedaction,
        reason: `${tierResult.reason}; agent cross-boundary redaction applied (${finalRedaction})`,
      };
    }

    // 6. Group-level policy adjustments for non-agents
    if (groupPolicies) {
      const groupRedaction = this.resolveGroupRedaction(artifact, groupPolicies);
      if (groupRedaction) {
        const finalRedaction = escalateRedaction(
          tierResult.redactionLevel,
          groupRedaction,
        );
        return {
          outcome: redactionToOutcome(finalRedaction),
          redactionLevel: finalRedaction,
          reason: `${tierResult.reason}; group policy redaction applied (${finalRedaction})`,
        };
      }
    }

    return tierResult;
  }

  // -------------------------------------------------------------------------
  // Private: Resolve GRANT access with agent redaction applied
  // -------------------------------------------------------------------------

  private resolveGrantAccess(
    requestor: Requestor,
    artifact: Artifact,
    grantOverride: ACLOverride,
    orgPrivacyPolicy?: OrgPrivacyPolicy,
    groupPolicies?: GroupPolicy[],
  ): AccessResolution {
    // Even with a GRANT, agents may still need redaction
    if (requestor.type === 'agent') {
      const redaction = this.resolveAgentRedaction(
        requestor,
        artifact,
        orgPrivacyPolicy,
        groupPolicies,
      );
      return {
        outcome: redaction === 'none' ? 'FULL' : redactionToOutcome(redaction),
        redactionLevel: redaction,
        reason: `Explicit GRANT for ${grantOverride.principalType}:${grantOverride.principalId} (agent redaction: ${redaction})`,
      };
    }
    return {
      outcome: 'FULL',
      redactionLevel: 'none',
      reason: `Explicit GRANT for ${grantOverride.principalType}:${grantOverride.principalId}`,
    };
  }

  // -------------------------------------------------------------------------
  // Private: Kill switch checks
  // -------------------------------------------------------------------------

  private checkKillSwitches(
    requestor: Requestor,
    artifact: Artifact,
    killSwitches?: Record<string, boolean>,
    privacyPolicy?: OrgPrivacyPolicy,
  ): AccessResolution | null {
    // Flat kill switch map (Organization.killSwitches)
    if (killSwitches) {
      if (killSwitches['org_global_kill']) {
        return denied('Global kill switch is active');
      }
      for (const teamId of artifact.teamIds) {
        if (killSwitches[`team_kill:${teamId}`]) {
          return denied(`Kill switch active for team ${teamId}`);
        }
      }
      if (requestor.type === 'agent') {
        if (killSwitches['org_agent_kill']) {
          return denied('Agent kill switch is active (all agents)');
        }
        if (killSwitches[`agent_kill:${requestor.id}`]) {
          return denied(`Kill switch active for agent ${requestor.id}`);
        }
      }
      if (requestor.type === 'user' && killSwitches[`user_kill:${requestor.id}`]) {
        return denied(`Kill switch active for user ${requestor.id}`);
      }
    }

    // Privacy policy kill switches
    if (privacyPolicy) {
      if (privacyPolicy.globalKillSwitch) {
        return denied('Org privacy policy global kill switch is active');
      }
      for (const teamId of artifact.teamIds) {
        if (privacyPolicy.teamKillSwitches[teamId]) {
          return denied(`Privacy policy kill switch active for team ${teamId}`);
        }
      }
      if (requestor.type === 'agent' && privacyPolicy.agentKillSwitch) {
        return denied('Org privacy policy agent kill switch is active');
      }
    }

    return null;
  }

  // -------------------------------------------------------------------------
  // Private: Tier-based resolution (PRD Section 9.3 match block)
  // -------------------------------------------------------------------------

  private resolveByTier(
    requestor: Requestor,
    artifact: Artifact,
    artifactProjectScopes: string[],
  ): AccessResolution {
    switch (artifact.accessTier) {
      case 'public':
        return {
          outcome: 'FULL',
          redactionLevel: 'none',
          reason: 'Artifact is public -- full access to all org members',
        };

      case 'team': {
        const teamOverlap = hasIntersection(requestor.teamIds, artifact.teamIds);
        if (teamOverlap) {
          return {
            outcome: 'REDACTED',
            redactionLevel: 'standard',
            reason: 'Team-tier access: requestor shares team membership',
          };
        }
        return denied('Team-tier access: requestor has no overlapping team membership');
      }

      case 'project': {
        const projectOverlap = hasIntersection(
          requestor.projectScopes,
          artifactProjectScopes,
        );
        if (projectOverlap) {
          return {
            outcome: 'REDACTED',
            redactionLevel: 'standard',
            reason: 'Project-tier access: requestor shares project scope',
          };
        }
        return denied('Project-tier access: requestor has no overlapping project scope');
      }

      case 'confidential':
        return denied('Confidential-tier: access requires explicit ACL grant');

      case 'restricted': {
        if (requestor.role === 'org_admin') {
          return {
            outcome: 'REDACTED',
            redactionLevel: 'standard',
            reason: 'Restricted-tier: org_admin access with standard redaction',
          };
        }
        if (requestor.type === 'agent') {
          return denied('Restricted-tier: agents excluded by default');
        }
        return denied('Restricted-tier: access requires org_admin role or explicit ACL grant');
      }

      default:
        return denied(`Unknown access tier: ${artifact.accessTier}`);
    }
  }

  // -------------------------------------------------------------------------
  // Private: Agent cross-boundary redaction
  // -------------------------------------------------------------------------

  private resolveAgentRedaction(
    requestor: Requestor,
    artifact: Artifact,
    orgPolicy?: OrgPrivacyPolicy,
    groupPolicies?: GroupPolicy[],
  ): RedactionLevel {
    const agentType = requestor.agentType;

    // Determine the boundary type
    const boundary = this.redactionResolver.resolveBoundary(
      agentType,
      requestor,
      artifact,
    );

    // Get base redaction from boundary
    let redaction = this.redactionResolver.resolveRedactionLevel(boundary);

    // Apply org-level agentContentAccess policy
    if (orgPolicy) {
      const orgRedaction = contentAccessToRedaction(orgPolicy.agentContentAccess);
      redaction = escalateRedaction(redaction, orgRedaction);
    }

    // Apply group-level agentContentAccess for matching groups
    if (groupPolicies) {
      for (const gp of groupPolicies) {
        const appliesToArtifact = artifact.teamIds.includes(gp.groupId);
        if (appliesToArtifact) {
          const groupRedaction = contentAccessToRedaction(gp.agentContentAccess);
          redaction = escalateRedaction(redaction, groupRedaction);
        }
      }
    }

    return redaction;
  }

  // -------------------------------------------------------------------------
  // Private: Group-level policy overrides (Section 9.4)
  // -------------------------------------------------------------------------

  private checkGroupPolicyOverride(
    requestor: Requestor,
    artifact: Artifact,
    groupPolicies: GroupPolicy[],
  ): AccessResolution | null {
    for (const gp of groupPolicies) {
      const requestorInGroup = requestor.teamIds.includes(gp.groupId);
      const artifactInGroup = artifact.teamIds.includes(gp.groupId);

      if (requestorInGroup && artifactInGroup) {
        return this.resolveGroupTierAccess(requestor, gp);
      }
    }
    return null;
  }

  private resolveGroupTierAccess(
    requestor: Requestor,
    gp: GroupPolicy,
  ): AccessResolution | null {
    const redaction = gp.piiRedactionLevel;

    // Check agent type restrictions
    if (requestor.type === 'agent') {
      if (
        (requestor.agentType === 'team' && !gp.allowTeamAgents) ||
        (requestor.agentType === 'org' && !gp.allowOrgAgents) ||
        (requestor.agentType === 'function' && !gp.allowCrossTeamAgents)
      ) {
        return null; // Group doesn't allow this agent type
      }

      return {
        outcome: redactionToOutcome(redaction),
        redactionLevel: redaction,
        reason: `Group policy ${gp.groupId} grants agent access with ${redaction} redaction`,
      };
    }

    return {
      outcome: redactionToOutcome(redaction),
      redactionLevel: redaction,
      reason: `Group policy ${gp.groupId} grants access with ${redaction} redaction`,
    };
  }

  private resolveGroupRedaction(
    artifact: Artifact,
    groupPolicies: GroupPolicy[],
  ): RedactionLevel | null {
    for (const gp of groupPolicies) {
      if (artifact.teamIds.includes(gp.groupId)) {
        return gp.piiRedactionLevel;
      }
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Private: Principal matching against ACLOverride
  // -------------------------------------------------------------------------

  private matchesPrincipal(
    override: ACLOverride,
    requestor: Requestor,
  ): boolean {
    switch (override.principalType) {
      case 'user':
        return requestor.type === 'user' && requestor.id === override.principalId;
      case 'agent':
        return requestor.type === 'agent' && requestor.id === override.principalId;
      case 'team':
        return requestor.teamIds.includes(override.principalId);
      case 'role':
        return requestor.role === override.principalId;
      default:
        return false;
    }
  }
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

const REDACTION_ORDER: Record<RedactionLevel, number> = {
  none: 0,
  minimal: 1,
  standard: 2,
  aggressive: 3,
};

/**
 * Escalate redaction: return the more restrictive of two levels.
 * Per PRD 8.5 invariant 7: "Cross-boundary escalation is one-way --
 * you can increase redaction at a boundary, never decrease it."
 */
function escalateRedaction(
  current: RedactionLevel,
  proposed: RedactionLevel,
): RedactionLevel {
  return REDACTION_ORDER[proposed] > REDACTION_ORDER[current]
    ? proposed
    : current;
}

function redactionToOutcome(redaction: RedactionLevel): AccessOutcome {
  switch (redaction) {
    case 'none':
      return 'FULL';
    case 'minimal':
    case 'standard':
      return 'REDACTED';
    case 'aggressive':
      return 'FEATURES_ONLY';
  }
}

function contentAccessToRedaction(access: AgentContentAccess): RedactionLevel {
  switch (access) {
    case 'full':
      return 'none';
    case 'redacted':
      return 'standard';
    case 'features_only':
      return 'aggressive';
  }
}

function hasIntersection(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  if (a.length < 10 && b.length < 10) {
    return a.some((x) => b.includes(x));
  }
  const set = new Set(b);
  return a.some((x) => set.has(x));
}

function denied(reason: string): AccessResolution {
  return { outcome: 'DENIED', redactionLevel: 'aggressive', reason };
}
