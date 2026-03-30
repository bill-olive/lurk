// =============================================================================
// @lurk/shared-types — Type definition tests
//
// Validates that types are properly defined and exported, type guards work,
// and key type assertions compile correctly.
// =============================================================================

import { describe, it, expect } from 'vitest';

import type {
  Artifact,
  ArtifactType,
  CaptureMethod,
  SensitivityLevel,
  Agent,
  AgentType,
  AgentStatus,
  AgentAction,
  PullRequest,
  PRStatus,
  ReviewAction,
  Diff,
  DiffHunk,
  DiffType,
  YoloConfig,
  AccessTier,
  AccessOutcome,
  ACLOverride,
  ACLAction,
  Role,
  GroupPolicy,
  PIIEntityType,
  RedactionLevel,
  PIIDetection,
  RedactionResult,
  AgentContentAccess,
  OrgPrivacyPolicy,
  PolicyEvaluation,
  YoloEvaluation,
  BudgetEvaluation,
  BudgetRemaining,
  AccessResolution,
  CircuitBreakerState,
  AgentSafetyConfig,
  HumanReviewRule,
  MergeConflict,
  Requestor,
  BoundarySource,
  Timestamp,
  FeatureBundle,
  ArtifactMetadata,
} from '../index';

// ---------------------------------------------------------------------------
// Helpers to create minimal valid objects (compile-time type assertions)
// ---------------------------------------------------------------------------

function createMinimalArtifact(): Artifact {
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
    tags: ['test'],
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
  };
}

function createMinimalAgent(): Agent {
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
      sensitivityMax: 'internal',
      customerFacingOnly: false,
      tagFilters: [],
    },
    writeScope: {
      ledgerIds: null,
      teamIds: null,
      artifactTypes: null,
      sensitivityMax: 'internal',
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
    capabilities: ['read_artifacts', 'fork_artifacts', 'open_prs'],
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
    totalActions: 0,
    acceptanceRate: 0.8,
    createdBy: 'user-001',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('@lurk/shared-types', () => {
  describe('Artifact type', () => {
    it('should accept all valid artifact type values', () => {
      const types: ArtifactType[] = [
        'document:gdoc',
        'document:notion',
        'code:commit',
        'code:pr',
        'comm:email_sent',
        'data:spreadsheet',
        'design:figma',
        'meta:synthesis',
        'migration:slack_message',
      ];
      expect(types).toHaveLength(9);
      types.forEach((t) => expect(typeof t).toBe('string'));
    });

    it('should create a valid Artifact object', () => {
      const artifact = createMinimalArtifact();
      expect(artifact.id).toBe('art-001');
      expect(artifact.type).toBe('document:gdoc');
      expect(artifact.sensitivity).toBe('internal');
      expect(artifact.version).toBe(1);
      expect(artifact.parentVersion).toBeNull();
      expect(artifact.customerFacing).toBe(false);
    });

    it('should accept all valid capture methods', () => {
      const methods: CaptureMethod[] = [
        'chrome_dom',
        'chrome_api',
        'mac_audio',
        'mac_filesystem',
        'mac_ide',
        'ios_voice',
        'ios_photo',
        'migration_import',
        'api_ingest',
        'agent_generated',
      ];
      expect(methods).toHaveLength(10);
    });

    it('should accept all valid sensitivity levels', () => {
      const levels: SensitivityLevel[] = [
        'public',
        'internal',
        'confidential',
        'restricted',
      ];
      expect(levels).toHaveLength(4);
    });
  });

  describe('Agent type', () => {
    it('should accept all valid agent types', () => {
      const types: AgentType[] = [
        'personal',
        'team',
        'org',
        'function',
        'migration',
        'voice',
        'calendar',
      ];
      expect(types).toHaveLength(7);
    });

    it('should create a valid Agent object', () => {
      const agent = createMinimalAgent();
      expect(agent.id).toBe('agent-001');
      expect(agent.type).toBe('personal');
      expect(agent.status).toBe('active');
      expect(agent.capabilities).toContain('read_artifacts');
    });

    it('should accept all valid agent statuses', () => {
      const statuses: AgentStatus[] = ['active', 'paused', 'disabled', 'error'];
      expect(statuses).toHaveLength(4);
    });
  });

  describe('PullRequest type', () => {
    it('should accept all valid PR statuses', () => {
      const statuses: PRStatus[] = [
        'open',
        'approved',
        'merged',
        'rejected',
        'closed',
        'auto_merged',
      ];
      expect(statuses).toHaveLength(6);
    });

    it('should accept all valid review actions', () => {
      const actions: ReviewAction[] = [
        'approve',
        'reject',
        'request_changes',
        'comment',
      ];
      expect(actions).toHaveLength(4);
    });
  });

  describe('AgentAction type', () => {
    it('should accept all valid agent actions', () => {
      const actions: AgentAction[] = [
        'fork',
        'pr',
        'synthesize',
        'notify',
        'skip',
      ];
      expect(actions).toHaveLength(5);
    });
  });

  describe('Access Control types', () => {
    it('should accept all valid access tiers', () => {
      const tiers: AccessTier[] = [
        'public',
        'team',
        'project',
        'confidential',
        'restricted',
      ];
      expect(tiers).toHaveLength(5);
    });

    it('should accept all valid access outcomes', () => {
      const outcomes: AccessOutcome[] = [
        'FULL',
        'REDACTED',
        'FEATURES_ONLY',
        'DENIED',
      ];
      expect(outcomes).toHaveLength(4);
    });

    it('should accept all valid roles', () => {
      const roles: Role[] = [
        'org_admin',
        'team_admin',
        'member',
        'viewer',
        'service_account',
        'migration_admin',
      ];
      expect(roles).toHaveLength(6);
    });

    it('should create a valid ACLOverride', () => {
      const override: ACLOverride = {
        principalId: 'user-001',
        principalType: 'user',
        action: 'grant',
        expiresAt: null,
        grantedBy: 'admin-001',
        grantedAt: '2026-01-01T00:00:00Z',
        reason: 'Project access',
      };
      expect(override.action).toBe('grant');
      expect(override.principalType).toBe('user');
    });
  });

  describe('Privacy types', () => {
    it('should accept all valid redaction levels', () => {
      const levels: RedactionLevel[] = [
        'aggressive',
        'standard',
        'minimal',
        'none',
      ];
      expect(levels).toHaveLength(4);
    });

    it('should accept all valid agent content access levels', () => {
      const levels: AgentContentAccess[] = [
        'features_only',
        'redacted',
        'full',
      ];
      expect(levels).toHaveLength(3);
    });
  });

  describe('Policy evaluation types', () => {
    it('should create a valid PolicyEvaluation', () => {
      const evaluation: PolicyEvaluation = {
        allowed: true,
        reason: 'Action permitted by policy',
      };
      expect(evaluation.allowed).toBe(true);
      expect(evaluation.reason).toBeTruthy();
    });

    it('should create a valid YoloEvaluation', () => {
      const evaluation: YoloEvaluation = {
        eligible: false,
        reason: 'YOLO mode is disabled',
      };
      expect(evaluation.eligible).toBe(false);
    });

    it('should create a valid BudgetEvaluation', () => {
      const remaining: BudgetRemaining = {
        forksThisHour: 5,
        maxForksPerHour: 20,
        prsToday: 10,
        maxPRsPerDay: 50,
        tokensToday: 100000,
        maxTokensPerDay: 500000,
      };
      const evaluation: BudgetEvaluation = {
        withinBudget: true,
        remaining,
      };
      expect(evaluation.withinBudget).toBe(true);
      expect(evaluation.remaining.forksThisHour).toBe(5);
    });
  });

  describe('Requestor type', () => {
    it('should create a valid Requestor for a user', () => {
      const requestor: Requestor = {
        id: 'user-001',
        type: 'user',
        role: 'member',
        teamIds: ['team-001'],
        projectScopes: ['proj-001'],
        orgId: 'org-001',
      };
      expect(requestor.type).toBe('user');
      expect(requestor.role).toBe('member');
    });

    it('should create a valid Requestor for an agent', () => {
      const requestor: Requestor = {
        id: 'agent-001',
        type: 'agent',
        role: 'service_account',
        teamIds: ['team-001'],
        projectScopes: [],
        agentType: 'personal',
        orgId: 'org-001',
      };
      expect(requestor.type).toBe('agent');
      expect(requestor.agentType).toBe('personal');
    });
  });

  describe('BoundarySource type', () => {
    it('should accept all valid boundary sources', () => {
      const sources: BoundarySource[] = [
        'own_ledger',
        'personal_agent',
        'team_agent',
        'cross_team_agent',
        'org_agent',
        'migration_agent',
        'audit_log',
        'external_connector',
        'customer_health_score',
      ];
      expect(sources).toHaveLength(9);
    });
  });

  describe('CircuitBreakerState type', () => {
    it('should create a valid CircuitBreakerState', () => {
      const state: CircuitBreakerState = {
        agentId: 'agent-001',
        errorCount: 2,
        totalCount: 20,
        errorRate: 0.1,
        rejectionCount: 3,
        rejectionTotal: 10,
        rejectionRate: 0.3,
        isPaused: false,
        chainDepth: 1,
      };
      expect(state.isPaused).toBe(false);
      expect(state.errorRate).toBe(0.1);
    });
  });

  describe('HumanReviewRule type', () => {
    it('should create valid human review rules', () => {
      const rules: HumanReviewRule[] = [
        { field: 'confidence', operator: '<', value: 0.7 },
        { field: 'artifact.sensitivity', operator: '>=', value: 'confidential' },
        { field: 'artifact.customerFacing', operator: '==', value: true },
        { field: 'diff.changedLines', operator: '>', value: 50 },
        { field: 'agent.type', operator: '==', value: 'org' },
      ];
      expect(rules).toHaveLength(5);
      expect(rules[0].operator).toBe('<');
    });
  });

  describe('MergeConflict type', () => {
    it('should create a valid MergeConflict', () => {
      const conflict: MergeConflict = {
        startLine: 10,
        endLine: 15,
        ours: 'our version of the line',
        theirs: 'their version of the line',
        base: 'original version of the line',
      };
      expect(conflict.startLine).toBe(10);
      expect(conflict.base).toBeDefined();
    });
  });
});
