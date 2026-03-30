// =============================================================================
// PolicyEngine — Unit tests
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';

import { PolicyEngine } from '../policy-engine.js';
import { BudgetTracker } from '../budget-tracker.js';
import type {
  Agent,
  Artifact,
  PullRequest,
  YoloConfig,
  OrgPrivacyPolicy,
  GroupPolicy,
  AgentContentAccess,
  RedactionLevel,
} from '@lurk/shared-types';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'agent-001',
    orgId: 'org-001',
    name: 'test-agent',
    type: 'personal',
    description: 'A test agent',
    ownerId: 'user-001',
    ownerType: 'user',
    readScope: {
      ledgerIds: null,
      teamIds: null,
      artifactTypes: null,
      sensitivityMax: 'confidential',
      customerFacingOnly: false,
      tagFilters: [],
    },
    writeScope: {
      ledgerIds: null,
      teamIds: null,
      artifactTypes: null,
      sensitivityMax: 'confidential',
      customerFacingOnly: false,
      tagFilters: [],
    },
    actionBudget: {
      maxForksPerHour: 20,
      maxPRsPerDay: 50,
      maxTokensPerDay: 500_000,
      requireApprovalAbove: 0.7,
      costCapPerMonth: 100,
    },
    triggers: [],
    capabilities: ['read_artifacts', 'fork_artifacts', 'open_prs', 'synthesize', 'notify'],
    modelConfig: {
      defaultTier: 'fast',
      modelOverride: null,
      temperature: 0.3,
      maxResponseTokens: 4096,
      systemPromptPrefix: null,
    },
    templateId: null,
    customPrompts: [],
    status: 'active',
    lastRunAt: '2026-01-01T00:00:00Z',
    totalActions: 10,
    acceptanceRate: 0.8,
    createdBy: 'user-001',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Agent;
}

function makeArtifact(overrides: Partial<Artifact> = {}): Artifact {
  return {
    id: 'art-001',
    ledgerId: 'ledger-001',
    orgId: 'org-001',
    type: 'document:gdoc',
    title: 'Test Document',
    sourceUrl: 'https://docs.google.com/test',
    sourceApp: 'chrome:gdocs',
    mimeType: 'text/plain',
    captureMethod: 'chrome_dom',
    contentHash: 'abc123',
    redactedContent: null,
    featureBundle: {
      topicVectors: [],
      entityCounts: {},
      keyPhrases: [],
      language: 'en',
      wordCount: 100,
      sectionHeaders: [],
      customFeatures: {},
    },
    metadata: { customFields: {} },
    tags: [],
    customerFacing: false,
    customerRefs: [],
    sensitivity: 'internal',
    customerHealth: null,
    authorId: 'user-001',
    ownerIds: ['user-001'],
    teamIds: ['team-001'],
    version: 1,
    parentVersion: null,
    commitHash: 'commit-001',
    commitMessage: 'Initial commit',
    branchId: null,
    capturedAt: '2026-01-01T00:00:00Z',
    modifiedAt: '2026-01-01T00:00:00Z',
    committedAt: '2026-01-01T00:00:00Z',
    accessTier: 'team',
    aclOverrides: [],
    forkedFrom: null,
    mergedInto: null,
    relatedArtifacts: [],
    qualityScore: null,
    stalenessScore: null,
    coverageGaps: null,
    ...overrides,
  } as Artifact;
}

function makePR(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    id: 'pr-001',
    orgId: 'org-001',
    forkId: 'fork-001',
    sourceArtifactId: 'art-fork-001',
    targetArtifactId: 'art-001',
    targetLedgerId: 'ledger-001',
    title: 'Agent update: fix typo',
    description: 'Fixes a typo in the doc',
    diff: {
      type: 'text',
      hunks: [],
      summary: '1 line changed',
      addedLines: 1,
      removedLines: 1,
      changedSections: ['section-1'],
      voiceNarration: null,
    },
    changeSummary: 'Fixed a typo',
    agentId: 'agent-001',
    agentType: 'personal',
    confidence: 0.95,
    justification: 'Typo detected',
    sourceRefs: [],
    status: 'open',
    reviewerId: null,
    reviewAction: null,
    reviewComment: null,
    reviewedAt: null,
    autoMergeEligible: true,
    autoMergedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    mergedAt: null,
    closedAt: null,
    ...overrides,
  } as PullRequest;
}

function makeYoloConfig(overrides: Partial<YoloConfig> = {}): YoloConfig {
  return {
    enabled: true,
    allowedAgentTypes: ['personal', 'team'],
    allowedAgentIds: null,
    allowedCategories: [],
    minConfidence: 0.9,
    maxDiffSize: 20,
    maxSensitivity: 'internal',
    excludeCustomerFacing: true,
    excludeTags: [],
    cooldownAfterReject: 2,
    dailyAutoMergeCap: 50,
    requireSecondAgent: false,
    rollbackWindow: 24,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PolicyEngine', () => {
  let engine: PolicyEngine;
  let budgetTracker: BudgetTracker;

  beforeEach(() => {
    budgetTracker = new BudgetTracker();
    engine = new PolicyEngine(undefined, budgetTracker);
  });

  // -----------------------------------------------------------------------
  // evaluateAgentAction
  // -----------------------------------------------------------------------

  describe('evaluateAgentAction', () => {
    it('should allow a simple action with no kill switches or policy restrictions', () => {
      const agent = makeAgent();
      const artifact = makeArtifact();
      const result = engine.evaluateAgentAction(agent, 'fork', artifact);
      expect(result.allowed).toBe(true);
    });

    it('should deny when global kill switch is active', () => {
      const agent = makeAgent();
      const artifact = makeArtifact();
      const result = engine.evaluateAgentAction(agent, 'fork', artifact, {
        killSwitches: { org_global_kill: true },
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Global kill switch');
    });

    it('should deny when agent kill switch is active', () => {
      const agent = makeAgent();
      const artifact = makeArtifact();
      const result = engine.evaluateAgentAction(agent, 'fork', artifact, {
        killSwitches: { 'agent_kill:agent-001': true },
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('agent-001');
    });

    it('should deny when team kill switch is active', () => {
      const agent = makeAgent();
      const artifact = makeArtifact({ teamIds: ['team-alpha'] });
      const result = engine.evaluateAgentAction(agent, 'fork', artifact, {
        killSwitches: { 'team_kill:team-alpha': true },
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('team-alpha');
    });

    it('should deny when agent is not active', () => {
      const agent = makeAgent({ status: 'paused' });
      const artifact = makeArtifact();
      const result = engine.evaluateAgentAction(agent, 'fork', artifact);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('paused');
    });

    it('should deny when agent lacks required capability', () => {
      const agent = makeAgent({ capabilities: ['read_artifacts'] });
      const artifact = makeArtifact();
      const result = engine.evaluateAgentAction(agent, 'fork', artifact);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('fork_artifacts');
    });

    it('should allow skip action without capability check', () => {
      const agent = makeAgent({ capabilities: [] });
      const artifact = makeArtifact();
      const result = engine.evaluateAgentAction(agent, 'skip', artifact);
      expect(result.allowed).toBe(true);
    });

    it('should deny when artifact sensitivity exceeds write scope', () => {
      const agent = makeAgent({
        writeScope: {
          ledgerIds: null,
          teamIds: null,
          artifactTypes: null,
          sensitivityMax: 'internal',
          customerFacingOnly: false,
          tagFilters: [],
        },
      });
      const artifact = makeArtifact({ sensitivity: 'restricted' });
      const result = engine.evaluateAgentAction(agent, 'fork', artifact);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('sensitivity');
    });

    it('should deny when budget is exceeded (forks)', () => {
      const agent = makeAgent({
        actionBudget: {
          maxForksPerHour: 2,
          maxPRsPerDay: 50,
          maxTokensPerDay: 500_000,
          requireApprovalAbove: 0.7,
          costCapPerMonth: 100,
        },
      });
      // Record enough forks to exceed
      budgetTracker.recordFork('agent-001');
      budgetTracker.recordFork('agent-001');

      const artifact = makeArtifact();
      const result = engine.evaluateAgentAction(agent, 'fork', artifact);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('budget exceeded');
    });

    it('should deny when org privacy policy global kill switch is active', () => {
      const agent = makeAgent();
      const artifact = makeArtifact();
      const result = engine.evaluateAgentAction(agent, 'fork', artifact, {
        orgPrivacyPolicy: {
          globalKillSwitch: true,
          agentKillSwitch: false,
          teamKillSwitches: {},
        } as OrgPrivacyPolicy,
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('privacy policy global kill switch');
    });

    it('should deny when group policy blocks the artifact type', () => {
      const agent = makeAgent();
      const artifact = makeArtifact({ teamIds: ['team-001'], type: 'code:commit' });
      const groupPolicy: GroupPolicy = {
        groupId: 'team-001',
        groupType: 'team',
        defaultArtifactTier: 'team',
        forceLocalOnly: false,
        allowTeamAgents: true,
        allowOrgAgents: true,
        allowCrossTeamAgents: true,
        agentContentAccess: 'redacted',
        requirePRReview: false,
        requireTwoApprovers: false,
        maxAutoMergePerDay: 10,
        piiRedactionLevel: 'standard',
        retentionDays: 365,
        allowExternalSharing: false,
        blockedArtifactTypes: ['code:commit'],
        requireClassification: false,
        allowMeetingCapture: true,
        meetingRetentionDays: 90,
        allowMigrationImport: true,
      };
      const result = engine.evaluateAgentAction(agent, 'fork', artifact, {
        groupPolicies: [groupPolicy],
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('blocked by group policy');
    });

    it('should deny org agents when group policy disallows them', () => {
      const agent = makeAgent({ type: 'org' });
      const artifact = makeArtifact({ teamIds: ['team-001'] });
      const groupPolicy: GroupPolicy = {
        groupId: 'team-001',
        groupType: 'team',
        defaultArtifactTier: 'team',
        forceLocalOnly: false,
        allowTeamAgents: true,
        allowOrgAgents: false,
        allowCrossTeamAgents: true,
        agentContentAccess: 'redacted',
        requirePRReview: false,
        requireTwoApprovers: false,
        maxAutoMergePerDay: 10,
        piiRedactionLevel: 'standard',
        retentionDays: 365,
        allowExternalSharing: false,
        blockedArtifactTypes: [],
        requireClassification: false,
        allowMeetingCapture: true,
        meetingRetentionDays: 90,
        allowMigrationImport: true,
      };
      const result = engine.evaluateAgentAction(agent, 'fork', artifact, {
        groupPolicies: [groupPolicy],
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Org agents are disallowed');
    });

    it('should indicate human review required for org agents', () => {
      const agent = makeAgent({ type: 'org', acceptanceRate: 0.9 });
      const artifact = makeArtifact();
      const result = engine.evaluateAgentAction(agent, 'fork', artifact);
      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('human review');
    });
  });

  // -----------------------------------------------------------------------
  // evaluateYoloEligibility
  // -----------------------------------------------------------------------

  describe('evaluateYoloEligibility', () => {
    it('should declare eligible when all YOLO criteria are met', () => {
      const pr = makePR({ confidence: 0.95 });
      const agent = makeAgent({ type: 'personal' });
      const yolo = makeYoloConfig();
      const result = engine.evaluateYoloEligibility(pr, yolo, agent);
      expect(result.eligible).toBe(true);
      expect(result.reason).toContain('YOLO criteria');
    });

    it('should reject when YOLO is disabled', () => {
      const pr = makePR();
      const agent = makeAgent();
      const yolo = makeYoloConfig({ enabled: false });
      const result = engine.evaluateYoloEligibility(pr, yolo, agent);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('disabled');
    });

    it('should reject when agent type is not in allowed list', () => {
      const pr = makePR();
      const agent = makeAgent({ type: 'org' });
      const yolo = makeYoloConfig({ allowedAgentTypes: ['personal', 'team'] });
      const result = engine.evaluateYoloEligibility(pr, yolo, agent);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('not in YOLO allowedAgentTypes');
    });

    it('should reject when confidence is below minimum', () => {
      const pr = makePR({ confidence: 0.5 });
      const agent = makeAgent();
      const yolo = makeYoloConfig({ minConfidence: 0.9 });
      const result = engine.evaluateYoloEligibility(pr, yolo, agent);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('Confidence');
    });

    it('should reject when diff size exceeds max', () => {
      const pr = makePR({
        confidence: 0.95,
        diff: {
          type: 'text',
          hunks: [],
          summary: 'big diff',
          addedLines: 50,
          removedLines: 50,
          changedSections: [],
          voiceNarration: null,
        },
      });
      const agent = makeAgent();
      const yolo = makeYoloConfig({ maxDiffSize: 20 });
      const result = engine.evaluateYoloEligibility(pr, yolo, agent);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('Diff size');
    });

    it('should reject when daily auto-merge cap is reached', () => {
      const pr = makePR({ confidence: 0.95 });
      const agent = makeAgent();
      const yolo = makeYoloConfig({ dailyAutoMergeCap: 2 });

      // Record two auto-merges
      budgetTracker.recordAutoMerge('agent-001');
      budgetTracker.recordAutoMerge('agent-001');

      const result = engine.evaluateYoloEligibility(pr, yolo, agent);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('auto-merge cap');
    });

    it('should reject when agent is not in allowedAgentIds', () => {
      const pr = makePR({ confidence: 0.95 });
      const agent = makeAgent({ id: 'agent-excluded' });
      const yolo = makeYoloConfig({
        allowedAgentIds: ['agent-allowed-1', 'agent-allowed-2'],
      });
      const result = engine.evaluateYoloEligibility(pr, yolo, agent);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('not in YOLO allowedAgentIds');
    });

    it('should require second agent confirmation when configured', () => {
      const pr = makePR({ confidence: 0.95 });
      const agent = makeAgent();
      const yolo = makeYoloConfig({ requireSecondAgent: true });
      const result = engine.evaluateYoloEligibility(pr, yolo, agent);
      expect(result.eligible).toBe(true);
      expect(result.reason).toContain('second agent confirmation');
    });
  });

  // -----------------------------------------------------------------------
  // evaluateBudget
  // -----------------------------------------------------------------------

  describe('evaluateBudget', () => {
    it('should return within budget when no actions recorded', () => {
      const agent = makeAgent();
      const result = engine.evaluateBudget(agent, agent.actionBudget);
      expect(result.withinBudget).toBe(true);
      expect(result.remaining.forksThisHour).toBe(0);
      expect(result.remaining.prsToday).toBe(0);
      expect(result.remaining.tokensToday).toBe(0);
    });

    it('should return over budget when forks exceeded', () => {
      const agent = makeAgent({
        actionBudget: {
          maxForksPerHour: 3,
          maxPRsPerDay: 50,
          maxTokensPerDay: 500_000,
          requireApprovalAbove: 0.7,
          costCapPerMonth: 100,
        },
      });
      budgetTracker.recordFork('agent-001');
      budgetTracker.recordFork('agent-001');
      budgetTracker.recordFork('agent-001');
      const result = engine.evaluateBudget(agent, agent.actionBudget);
      expect(result.withinBudget).toBe(false);
      expect(result.remaining.forksThisHour).toBe(3);
    });

    it('should return over budget when PRs exceeded', () => {
      const agent = makeAgent({
        actionBudget: {
          maxForksPerHour: 20,
          maxPRsPerDay: 2,
          maxTokensPerDay: 500_000,
          requireApprovalAbove: 0.7,
          costCapPerMonth: 100,
        },
      });
      budgetTracker.recordPR('agent-001');
      budgetTracker.recordPR('agent-001');
      const result = engine.evaluateBudget(agent, agent.actionBudget);
      expect(result.withinBudget).toBe(false);
      expect(result.remaining.prsToday).toBe(2);
    });

    it('should return over budget when tokens exceeded', () => {
      const agent = makeAgent({
        actionBudget: {
          maxForksPerHour: 20,
          maxPRsPerDay: 50,
          maxTokensPerDay: 1000,
          requireApprovalAbove: 0.7,
          costCapPerMonth: 100,
        },
      });
      budgetTracker.recordTokens('agent-001', 500);
      budgetTracker.recordTokens('agent-001', 600);
      const result = engine.evaluateBudget(agent, agent.actionBudget);
      expect(result.withinBudget).toBe(false);
    });

    it('should report correct remaining counts', () => {
      const agent = makeAgent();
      budgetTracker.recordFork('agent-001');
      budgetTracker.recordPR('agent-001');
      budgetTracker.recordTokens('agent-001', 10000);
      const result = engine.evaluateBudget(agent, agent.actionBudget);
      expect(result.withinBudget).toBe(true);
      expect(result.remaining.forksThisHour).toBe(1);
      expect(result.remaining.prsToday).toBe(1);
      expect(result.remaining.tokensToday).toBe(10000);
    });
  });

  // -----------------------------------------------------------------------
  // evaluateKillSwitch
  // -----------------------------------------------------------------------

  describe('evaluateKillSwitch', () => {
    it('should return false when no kill switches are active', () => {
      const result = engine.evaluateKillSwitch('org-001');
      expect(result).toBe(false);
    });

    it('should return true for org global kill', () => {
      const result = engine.evaluateKillSwitch('org-001', undefined, undefined, undefined, {
        org_global_kill: true,
      });
      expect(result).toBe(true);
    });

    it('should return true for org agent kill', () => {
      const result = engine.evaluateKillSwitch('org-001', undefined, undefined, undefined, {
        org_agent_kill: true,
      });
      expect(result).toBe(true);
    });

    it('should return true for team-specific kill switch', () => {
      const result = engine.evaluateKillSwitch('org-001', 'team-001', undefined, undefined, {
        'team_kill:team-001': true,
      });
      expect(result).toBe(true);
    });

    it('should return true for agent-specific kill switch', () => {
      const result = engine.evaluateKillSwitch('org-001', undefined, 'agent-001', undefined, {
        'agent_kill:agent-001': true,
      });
      expect(result).toBe(true);
    });

    it('should return true for user-specific kill switch', () => {
      const result = engine.evaluateKillSwitch('org-001', undefined, undefined, 'user-001', {
        'user_kill:user-001': true,
      });
      expect(result).toBe(true);
    });

    it('should return true for privacy policy global kill switch', () => {
      const result = engine.evaluateKillSwitch(
        'org-001',
        undefined,
        undefined,
        undefined,
        undefined,
        { globalKillSwitch: true } as OrgPrivacyPolicy,
      );
      expect(result).toBe(true);
    });

    it('should return false when kill switches exist but none match', () => {
      const result = engine.evaluateKillSwitch('org-001', 'team-002', 'agent-002', undefined, {
        'team_kill:team-001': true,
        'agent_kill:agent-001': true,
      });
      expect(result).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // evaluateRedactionLevel
  // -----------------------------------------------------------------------

  describe('evaluateRedactionLevel', () => {
    it('should return none for own_ledger source', () => {
      const result = engine.evaluateRedactionLevel('own_ledger', 'team_agent');
      expect(result).toBe('none');
    });

    it('should return aggressive for cross_team_agent source', () => {
      const result = engine.evaluateRedactionLevel('cross_team_agent', 'team_agent');
      expect(result).toBe('aggressive');
    });

    it('should return aggressive for audit_log source', () => {
      const result = engine.evaluateRedactionLevel('audit_log', 'own_ledger');
      expect(result).toBe('aggressive');
    });

    it('should return standard for migration_agent source', () => {
      const result = engine.evaluateRedactionLevel('migration_agent', 'own_ledger');
      expect(result).toBe('standard');
    });

    it('should respect org privacy policy for personal_agent', () => {
      const policy = {
        agentContentAccess: 'features_only' as AgentContentAccess,
      } as OrgPrivacyPolicy;
      const result = engine.evaluateRedactionLevel('personal_agent', 'team_agent', policy);
      expect(result).toBe('aggressive');
    });
  });

  // -----------------------------------------------------------------------
  // Recording methods
  // -----------------------------------------------------------------------

  describe('recording methods', () => {
    it('should record forks and track them in budget', () => {
      engine.recordFork('agent-001');
      engine.recordFork('agent-001');
      expect(budgetTracker.getForksThisHour('agent-001')).toBe(2);
    });

    it('should record PRs and track them in budget', () => {
      engine.recordPR('agent-001');
      expect(budgetTracker.getPRsToday('agent-001')).toBe(1);
    });

    it('should record tokens and track them in budget', () => {
      engine.recordTokens('agent-001', 5000);
      expect(budgetTracker.getTokensToday('agent-001')).toBe(5000);
    });

    it('should record auto-merges and track them', () => {
      engine.recordAutoMerge('agent-001');
      expect(budgetTracker.getAutoMergeCount('agent-001')).toBe(1);
    });
  });
});
