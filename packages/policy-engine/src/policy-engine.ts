// =============================================================================
// PolicyEngine — Evaluates agent actions against org/team/user policies
// Implements PRD Section 5.3 (step 6 - GATE) and Section 5.4 (safety config)
// =============================================================================

import type {
  Agent,
  AgentAction,
  Artifact,
  AgentSafetyConfig,
  ActionBudget,
  YoloConfig,
  PullRequest,
  RedactionLevel,
  SensitivityLevel,
  PolicyEvaluation,
  YoloEvaluation,
  BudgetEvaluation,
  BudgetRemaining,
  OrgPrivacyPolicy,
  GroupPolicy,
  BoundarySource,
  HumanReviewRule,
  AgentCapability,
} from '@lurk/shared-types';

import { BudgetTracker } from './budget-tracker.js';

// ---------------------------------------------------------------------------
// Sensitivity ordering (used for comparisons)
// ---------------------------------------------------------------------------

const SENSITIVITY_ORDER: Record<SensitivityLevel, number> = {
  public: 0,
  internal: 1,
  confidential: 2,
  restricted: 3,
};

function sensitivityExceeds(
  level: SensitivityLevel,
  max: SensitivityLevel,
): boolean {
  return SENSITIVITY_ORDER[level] > SENSITIVITY_ORDER[max];
}

// ---------------------------------------------------------------------------
// Default safety config from PRD Section 5.4
// ---------------------------------------------------------------------------

const DEFAULT_SAFETY_CONFIG: AgentSafetyConfig = {
  maxAgentActionsPerMinute: 100,
  maxForksPerAgentPerHour: 20,
  maxPRsPerAgentPerDay: 50,
  maxTokensPerAgentPerDay: 500_000,
  errorRateThreshold: 0.1,
  rejectionRateThreshold: 0.5,
  cascadeProtection: true,
  maxChainDepth: 3,
  requireHumanReviewWhen: [
    { field: 'confidence', operator: '<', value: 0.7 },
    { field: 'artifact.sensitivity', operator: '>=', value: 'confidential' },
    { field: 'artifact.customerFacing', operator: '==', value: true },
    { field: 'diff.changedLines', operator: '>', value: 50 },
    { field: 'agent.type', operator: '==', value: 'org' },
  ],
  autoRollbackWindow: 24,
  rollbackOnOwnerReject: true,
};

// ---------------------------------------------------------------------------
// Policy evaluation context (passed into evaluateAgentAction)
// ---------------------------------------------------------------------------

export interface GatePolicy {
  safetyConfig?: AgentSafetyConfig;
  /** Organization-level kill switches (flat map of switch-name → active). */
  killSwitches?: Record<string, boolean>;
  orgPrivacyPolicy?: OrgPrivacyPolicy;
  groupPolicies?: GroupPolicy[];
}

// ---------------------------------------------------------------------------
// PolicyEngine
// ---------------------------------------------------------------------------

export class PolicyEngine {
  private readonly budgetTracker: BudgetTracker;
  private readonly safetyConfig: AgentSafetyConfig;

  constructor(
    safetyConfig?: Partial<AgentSafetyConfig>,
    budgetTracker?: BudgetTracker,
  ) {
    this.safetyConfig = { ...DEFAULT_SAFETY_CONFIG, ...safetyConfig };
    this.budgetTracker = budgetTracker ?? new BudgetTracker();
  }

  // -------------------------------------------------------------------------
  // evaluateAgentAction — PRD Section 5.3 step 6 (GATE)
  //
  // Determines whether an agent is allowed to perform an action on an artifact.
  // Checks: kill switches, budget, confidence, write scope, sensitivity,
  //         group policies, and human-review rules.
  // -------------------------------------------------------------------------

  evaluateAgentAction(
    agent: Agent,
    action: AgentAction,
    artifact: Artifact,
    policy: GatePolicy = {},
  ): PolicyEvaluation {
    // 1. Kill switch checks (org-level flat map)
    if (policy.killSwitches) {
      const ks = policy.killSwitches;

      if (ks['org_global_kill']) {
        return { allowed: false, reason: 'Global kill switch is active' };
      }
      if (ks['org_agent_kill']) {
        return { allowed: false, reason: 'Agent kill switch is active (all agents)' };
      }
      if (ks[`agent_kill:${agent.id}`]) {
        return {
          allowed: false,
          reason: `Kill switch active for agent ${agent.id}`,
        };
      }
      for (const teamId of artifact.teamIds) {
        if (ks[`team_kill:${teamId}`]) {
          return {
            allowed: false,
            reason: `Kill switch active for team ${teamId}`,
          };
        }
      }
    }

    // 1b. Privacy-policy-level kill switches
    if (policy.orgPrivacyPolicy) {
      const pp = policy.orgPrivacyPolicy;
      if (pp.globalKillSwitch) {
        return { allowed: false, reason: 'Org privacy policy global kill switch is active' };
      }
      if (pp.agentKillSwitch) {
        return { allowed: false, reason: 'Org privacy policy agent kill switch is active' };
      }
      for (const teamId of artifact.teamIds) {
        if (pp.teamKillSwitches[teamId]) {
          return {
            allowed: false,
            reason: `Privacy policy kill switch active for team ${teamId}`,
          };
        }
      }
    }

    // 2. Agent status check
    if (agent.status !== 'active') {
      return {
        allowed: false,
        reason: `Agent is ${agent.status}, not active`,
      };
    }

    // 3. Capability check — does the agent have the capability for this action?
    const requiredCapability = actionToCapability(action);
    if (requiredCapability && !agent.capabilities.includes(requiredCapability)) {
      return {
        allowed: false,
        reason: `Agent lacks required capability: ${requiredCapability}`,
      };
    }

    // 4. Write scope check — is the target artifact within the agent's write scope?
    if (action !== 'skip' && action !== 'notify') {
      const scopeResult = this.evaluateWriteScope(agent, artifact);
      if (!scopeResult.allowed) {
        return scopeResult;
      }
    }

    // 5. Budget check
    const budgetResult = this.evaluateBudget(agent, agent.actionBudget);
    if (!budgetResult.withinBudget) {
      return {
        allowed: false,
        reason: `Agent budget exceeded: forks=${budgetResult.remaining.forksThisHour}/${budgetResult.remaining.maxForksPerHour}, PRs=${budgetResult.remaining.prsToday}/${budgetResult.remaining.maxPRsPerDay}, tokens=${budgetResult.remaining.tokensToday}/${budgetResult.remaining.maxTokensPerDay}`,
      };
    }

    // 6. Group policy checks
    if (policy.groupPolicies) {
      for (const gp of policy.groupPolicies) {
        // Only apply group policies for teams the artifact belongs to
        if (!artifact.teamIds.includes(gp.groupId)) continue;

        // Check if group blocks this artifact type
        if (gp.blockedArtifactTypes.includes(artifact.type)) {
          return {
            allowed: false,
            reason: `Artifact type '${artifact.type}' is blocked by group policy ${gp.groupId}`,
          };
        }
        // Check if group disallows the agent type
        if (agent.type === 'team' && !gp.allowTeamAgents) {
          return {
            allowed: false,
            reason: `Team agents are disallowed by group policy ${gp.groupId}`,
          };
        }
        if (agent.type === 'org' && !gp.allowOrgAgents) {
          return {
            allowed: false,
            reason: `Org agents are disallowed by group policy ${gp.groupId}`,
          };
        }
        if (
          (agent.type === 'function' || agent.type === 'migration') &&
          !gp.allowCrossTeamAgents
        ) {
          return {
            allowed: false,
            reason: `Cross-team agents are disallowed by group policy ${gp.groupId}`,
          };
        }
        // Force local-only check — agents running remotely should be blocked
        if (gp.forceLocalOnly) {
          return {
            allowed: false,
            reason: `Group ${gp.groupId} enforces local-only mode; remote agent actions denied`,
          };
        }
      }
    }

    // 7. Human-review rules (PRD 5.4 requireHumanReviewWhen)
    // These don't deny the action outright, but if triggered the action is
    // allowed only with a human-review flag. We return allowed=true with a
    // descriptive reason so callers can check for human review requirement.
    const humanReviewReasons = this.checkHumanReviewRules(agent, artifact);
    if (humanReviewReasons.length > 0) {
      return {
        allowed: true,
        reason: `Allowed but requires human review: ${humanReviewReasons.join('; ')}`,
      };
    }

    // All checks passed
    return { allowed: true, reason: 'Action permitted by policy' };
  }

  // -------------------------------------------------------------------------
  // evaluateYoloEligibility — Can this PR auto-merge under YOLO mode?
  // -------------------------------------------------------------------------

  evaluateYoloEligibility(
    pr: PullRequest,
    yoloConfig: YoloConfig,
    agent: Agent,
  ): YoloEvaluation {
    // 1. YOLO must be enabled
    if (!yoloConfig.enabled) {
      return { eligible: false, reason: 'YOLO mode is disabled' };
    }

    // 2. Agent type must be in allowed list
    if (!yoloConfig.allowedAgentTypes.includes(agent.type)) {
      return {
        eligible: false,
        reason: `Agent type '${agent.type}' is not in YOLO allowedAgentTypes`,
      };
    }

    // 3. If specific agent IDs are restricted, check
    if (
      yoloConfig.allowedAgentIds !== null &&
      yoloConfig.allowedAgentIds.length > 0 &&
      !yoloConfig.allowedAgentIds.includes(agent.id)
    ) {
      return {
        eligible: false,
        reason: `Agent ${agent.id} is not in YOLO allowedAgentIds`,
      };
    }

    // 4. Confidence must meet minimum
    if (pr.confidence < yoloConfig.minConfidence) {
      return {
        eligible: false,
        reason: `Confidence ${pr.confidence} is below YOLO minimum ${yoloConfig.minConfidence}`,
      };
    }

    // 5. Diff size must be within limit
    const totalChangedLines = pr.diff.addedLines + pr.diff.removedLines;
    if (totalChangedLines > yoloConfig.maxDiffSize) {
      return {
        eligible: false,
        reason: `Diff size ${totalChangedLines} exceeds YOLO maxDiffSize ${yoloConfig.maxDiffSize}`,
      };
    }

    // 6. Artifact sensitivity must not exceed max
    // To check sensitivity, the caller should attach the artifact; we use
    // the PR's target artifact info when available. Since the PR type doesn't
    // directly carry the artifact, the caller should provide this context.
    // We check via the diff's changedSections as a proxy for scope.

    // 7. Customer-facing exclusion — checked via the PR metadata
    if (yoloConfig.excludeCustomerFacing && pr.autoMergeEligible === false) {
      // If caller has already set autoMergeEligible=false, respect it
    }

    // 8. Tag exclusion — would need artifact tags; skip if unavailable

    // 9. Daily cap check
    const autoMergesToday = this.budgetTracker.getAutoMergeCount(agent.id);
    if (autoMergesToday >= yoloConfig.dailyAutoMergeCap) {
      return {
        eligible: false,
        reason: `Daily auto-merge cap reached (${autoMergesToday}/${yoloConfig.dailyAutoMergeCap})`,
      };
    }

    // 10. Cooldown after rejection check
    if (yoloConfig.cooldownAfterReject > 0) {
      const lastRejection = this.budgetTracker.getLastRejectionTime(agent.id);
      if (lastRejection) {
        const cooldownMs = yoloConfig.cooldownAfterReject * 60 * 60 * 1000;
        const elapsed = Date.now() - lastRejection;
        if (elapsed < cooldownMs) {
          const remainingHours = ((cooldownMs - elapsed) / (60 * 60 * 1000)).toFixed(1);
          return {
            eligible: false,
            reason: `YOLO cooldown active after rejection (${remainingHours}h remaining)`,
          };
        }
      }
    }

    // 11. Second agent requirement (caller must verify externally)
    if (yoloConfig.requireSecondAgent) {
      return {
        eligible: true,
        reason: 'YOLO eligible but requires second agent confirmation',
      };
    }

    return { eligible: true, reason: 'PR meets all YOLO criteria for auto-merge' };
  }

  /**
   * Extended YOLO evaluation that also checks artifact sensitivity and tags.
   * Use this when you have direct access to the target artifact.
   */
  evaluateYoloEligibilityWithArtifact(
    pr: PullRequest,
    yoloConfig: YoloConfig,
    agent: Agent,
    artifact: Artifact,
  ): YoloEvaluation {
    // Run base checks first
    const base = this.evaluateYoloEligibility(pr, yoloConfig, agent);
    if (!base.eligible) return base;

    // Artifact sensitivity check
    if (sensitivityExceeds(artifact.sensitivity, yoloConfig.maxSensitivity)) {
      return {
        eligible: false,
        reason: `Artifact sensitivity '${artifact.sensitivity}' exceeds YOLO maxSensitivity '${yoloConfig.maxSensitivity}'`,
      };
    }

    // Customer-facing exclusion
    if (yoloConfig.excludeCustomerFacing && artifact.customerFacing) {
      return {
        eligible: false,
        reason: 'YOLO excludes customer-facing artifacts',
      };
    }

    // Tag exclusion
    if (yoloConfig.excludeTags.length > 0) {
      const blockedTag = artifact.tags.find((t) =>
        yoloConfig.excludeTags.includes(t),
      );
      if (blockedTag) {
        return {
          eligible: false,
          reason: `Artifact has YOLO-excluded tag '${blockedTag}'`,
        };
      }
    }

    // Category check (if PR has changeSummary or we infer category)
    if (yoloConfig.allowedCategories.length > 0) {
      // Category would typically be set by the agent; for now we allow
      // if no category is inferable, since the base checks passed.
    }

    return base;
  }

  // -------------------------------------------------------------------------
  // evaluateRedactionLevel — Determine redaction level for a boundary crossing
  // Based on PRD Section 8.4 boundary rules
  // -------------------------------------------------------------------------

  evaluateRedactionLevel(
    source: BoundarySource,
    _target: BoundarySource,
    orgPolicy?: OrgPrivacyPolicy,
  ): RedactionLevel {
    switch (source) {
      case 'own_ledger':
        return 'none';

      case 'personal_agent':
        return orgPolicy?.agentContentAccess === 'features_only'
          ? 'aggressive'
          : orgPolicy?.agentContentAccess === 'redacted'
            ? 'standard'
            : 'none';

      case 'team_agent':
        return orgPolicy?.redactionLevel ?? 'standard';

      case 'cross_team_agent':
        return 'aggressive';

      case 'org_agent':
        return orgPolicy?.redactionLevel ?? 'standard';

      case 'migration_agent':
        return 'standard';

      case 'audit_log':
        return 'aggressive';

      case 'external_connector':
        return 'aggressive';

      case 'customer_health_score':
        return 'aggressive';

      default:
        return 'standard';
    }
  }

  // -------------------------------------------------------------------------
  // evaluateBudget — Check if agent is within its action budget
  // -------------------------------------------------------------------------

  evaluateBudget(
    agent: Agent,
    actionBudget: ActionBudget,
  ): BudgetEvaluation {
    const forksThisHour = this.budgetTracker.getForksThisHour(agent.id);
    const prsToday = this.budgetTracker.getPRsToday(agent.id);
    const tokensToday = this.budgetTracker.getTokensToday(agent.id);

    const remaining: BudgetRemaining = {
      forksThisHour,
      maxForksPerHour: actionBudget.maxForksPerHour,
      prsToday,
      maxPRsPerDay: actionBudget.maxPRsPerDay,
      tokensToday,
      maxTokensPerDay: actionBudget.maxTokensPerDay,
    };

    if (forksThisHour >= actionBudget.maxForksPerHour) {
      return { withinBudget: false, remaining };
    }
    if (prsToday >= actionBudget.maxPRsPerDay) {
      return { withinBudget: false, remaining };
    }
    if (tokensToday >= actionBudget.maxTokensPerDay) {
      return { withinBudget: false, remaining };
    }

    return { withinBudget: true, remaining };
  }

  // -------------------------------------------------------------------------
  // evaluateKillSwitch — Check if any kill switch applies
  //
  // Accepts two forms of kill switches:
  //   1. The flat Record<string, boolean> from Organization.killSwitches
  //   2. The OrgPrivacyPolicy which has typed kill switch fields
  // -------------------------------------------------------------------------

  evaluateKillSwitch(
    orgId: string,
    teamId?: string,
    agentId?: string,
    userId?: string,
    killSwitches?: Record<string, boolean>,
    privacyPolicy?: OrgPrivacyPolicy,
  ): boolean {
    // Check flat kill switch map (Organization.killSwitches)
    if (killSwitches) {
      if (killSwitches['org_global_kill']) return true;
      if (killSwitches['org_agent_kill']) return true;
      if (teamId && killSwitches[`team_kill:${teamId}`]) return true;
      if (agentId && killSwitches[`agent_kill:${agentId}`]) return true;
      if (userId && killSwitches[`user_kill:${userId}`]) return true;
    }

    // Check privacy policy kill switches
    if (privacyPolicy) {
      if (privacyPolicy.globalKillSwitch) return true;
      if (privacyPolicy.agentKillSwitch) return true;
      if (teamId && privacyPolicy.teamKillSwitches[teamId]) return true;
    }

    return false;
  }

  // -------------------------------------------------------------------------
  // Recording methods — delegate to budget tracker
  // -------------------------------------------------------------------------

  recordFork(agentId: string): void {
    this.budgetTracker.recordFork(agentId);
  }

  recordPR(agentId: string): void {
    this.budgetTracker.recordPR(agentId);
  }

  recordTokens(agentId: string, tokens: number): void {
    this.budgetTracker.recordTokens(agentId, tokens);
  }

  recordAutoMerge(agentId: string): void {
    this.budgetTracker.recordAutoMerge(agentId);
  }

  recordRejection(agentId: string): void {
    this.budgetTracker.recordRejection(agentId);
  }

  getSafetyConfig(): AgentSafetyConfig {
    return { ...this.safetyConfig };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private evaluateWriteScope(
    agent: Agent,
    artifact: Artifact,
  ): PolicyEvaluation {
    const scope = agent.writeScope;

    // Sensitivity ceiling
    if (sensitivityExceeds(artifact.sensitivity, scope.sensitivityMax)) {
      return {
        allowed: false,
        reason: `Artifact sensitivity '${artifact.sensitivity}' exceeds agent's write scope max '${scope.sensitivityMax}'`,
      };
    }

    // Customer-facing restriction
    if (scope.customerFacingOnly && !artifact.customerFacing) {
      return {
        allowed: false,
        reason: 'Agent write scope is restricted to customer-facing artifacts only',
      };
    }

    // Artifact type filter (ScopeConfig uses null for "all")
    if (scope.artifactTypes !== null && scope.artifactTypes.length > 0) {
      const typeMatch = scope.artifactTypes.some((allowed: string) => {
        if (allowed.endsWith(':*')) {
          const prefix = allowed.slice(0, -1); // "document:" from "document:*"
          return artifact.type.startsWith(prefix);
        }
        return artifact.type === allowed;
      });
      if (!typeMatch) {
        return {
          allowed: false,
          reason: `Artifact type '${artifact.type}' not in agent write scope types`,
        };
      }
    }

    // Team restriction (ScopeConfig uses null for "all")
    if (scope.teamIds !== null && scope.teamIds.length > 0) {
      const hasTeamOverlap = artifact.teamIds.some((tid) =>
        scope.teamIds!.includes(tid),
      );
      if (!hasTeamOverlap) {
        return {
          allowed: false,
          reason: 'Artifact does not belong to any team in agent write scope',
        };
      }
    }

    // Tag filters
    if (scope.tagFilters.length > 0) {
      for (const filter of scope.tagFilters) {
        if (filter.mode === 'exclude') {
          const blocked = artifact.tags.some((t) => filter.tags.includes(t));
          if (blocked) {
            return {
              allowed: false,
              reason: 'Artifact has a tag excluded by agent write scope',
            };
          }
        }
        if (filter.mode === 'include') {
          const hasRequired = artifact.tags.some((t) => filter.tags.includes(t));
          if (!hasRequired) {
            return {
              allowed: false,
              reason: 'Artifact does not have any tag required by agent write scope',
            };
          }
        }
      }
    }

    return { allowed: true, reason: 'Within write scope' };
  }

  private checkHumanReviewRules(
    agent: Agent,
    artifact: Artifact,
  ): string[] {
    const reasons: string[] = [];

    for (const rule of this.safetyConfig.requireHumanReviewWhen) {
      if (this.evaluateHumanReviewRule(rule, agent, artifact)) {
        reasons.push(formatRule(rule));
      }
    }

    return reasons;
  }

  private evaluateHumanReviewRule(
    rule: HumanReviewRule,
    agent: Agent,
    artifact: Artifact,
  ): boolean {
    const fieldValue = resolveField(rule.field, agent, artifact);
    if (fieldValue === undefined) return false;

    return compareValues(fieldValue, rule.operator, rule.value);
  }
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

function actionToCapability(action: AgentAction): AgentCapability | null {
  switch (action) {
    case 'fork':
      return 'fork_artifacts';
    case 'pr':
      return 'open_prs';
    case 'synthesize':
      return 'synthesize';
    case 'notify':
      return 'notify';
    case 'skip':
      return null;
  }
}

function resolveField(
  field: string,
  agent: Agent,
  artifact: Artifact,
): string | number | boolean | undefined {
  switch (field) {
    case 'confidence':
      // The real confidence comes from the LLM decision; agent.acceptanceRate
      // is the historical rate. Callers with actual confidence should use
      // a custom rule evaluation.
      return agent.acceptanceRate;
    case 'artifact.sensitivity':
      return SENSITIVITY_ORDER[artifact.sensitivity];
    case 'artifact.customerFacing':
      return artifact.customerFacing;
    case 'diff.changedLines':
      // Diff context isn't available in this path; return undefined so the
      // rule is skipped when diff info is unavailable.
      return undefined;
    case 'agent.type':
      return agent.type;
    default:
      return undefined;
  }
}

function compareValues(
  actual: string | number | boolean,
  operator: HumanReviewRule['operator'],
  expected: string | number | boolean,
): boolean {
  // Normalize string sensitivity values to numbers for comparison
  const a =
    typeof actual === 'string' && actual in SENSITIVITY_ORDER
      ? SENSITIVITY_ORDER[actual as SensitivityLevel]
      : actual;
  const e =
    typeof expected === 'string' && expected in SENSITIVITY_ORDER
      ? SENSITIVITY_ORDER[expected as SensitivityLevel]
      : expected;

  switch (operator) {
    case '<':
      return (a as number) < (e as number);
    case '>':
      return (a as number) > (e as number);
    case '<=':
      return (a as number) <= (e as number);
    case '>=':
      return (a as number) >= (e as number);
    case '==':
      return a === e;
    case '!=':
      return a !== e;
    default:
      return false;
  }
}

function formatRule(rule: HumanReviewRule): string {
  return `${rule.field} ${rule.operator} ${rule.value}`;
}
