// =============================================================================
// ACLResolver — Unit tests
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';

import { ACLResolver } from '../resolver.js';
import type {
  Requestor,
  Artifact,
  OrgPrivacyPolicy,
  GroupPolicy,
  ACLOverride,
  AccessTier,
  AgentType,
} from '@lurk/shared-types';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeRequestor(overrides: Partial<Requestor> = {}): Requestor {
  return {
    id: 'user-001',
    type: 'user',
    role: 'member',
    teamIds: ['team-001'],
    projectScopes: ['proj-001'],
    orgId: 'org-001',
    ...overrides,
  };
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

function makeGroupPolicy(overrides: Partial<GroupPolicy> = {}): GroupPolicy {
  return {
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
    blockedArtifactTypes: [],
    requireClassification: false,
    allowMeetingCapture: true,
    meetingRetentionDays: 90,
    allowMigrationImport: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ACLResolver', () => {
  let resolver: ACLResolver;

  beforeEach(() => {
    resolver = new ACLResolver();
  });

  // -----------------------------------------------------------------------
  // Access Tiers
  // -----------------------------------------------------------------------

  describe('resolveAccess — access tiers', () => {
    it('should grant FULL access for public tier artifacts', () => {
      const requestor = makeRequestor({ teamIds: [] });
      const artifact = makeArtifact({ accessTier: 'public' });
      const result = resolver.resolveAccess(requestor, artifact);
      expect(result.outcome).toBe('FULL');
      expect(result.redactionLevel).toBe('none');
    });

    it('should grant REDACTED access for team tier when requestor shares team', () => {
      const requestor = makeRequestor({ teamIds: ['team-001'] });
      const artifact = makeArtifact({ accessTier: 'team', teamIds: ['team-001'] });
      const result = resolver.resolveAccess(requestor, artifact);
      expect(result.outcome).toBe('REDACTED');
      expect(result.redactionLevel).toBe('standard');
    });

    it('should DENY access for team tier when requestor has no matching team', () => {
      const requestor = makeRequestor({ teamIds: ['team-002'] });
      const artifact = makeArtifact({ accessTier: 'team', teamIds: ['team-001'] });
      const result = resolver.resolveAccess(requestor, artifact);
      expect(result.outcome).toBe('DENIED');
    });

    it('should grant REDACTED for project tier when requestor shares project scope', () => {
      const requestor = makeRequestor({ projectScopes: ['proj-A'] });
      const artifact = makeArtifact({ accessTier: 'project' });
      const result = resolver.resolveAccess(requestor, artifact, {
        artifactProjectScopes: ['proj-A'],
      });
      expect(result.outcome).toBe('REDACTED');
    });

    it('should DENY access for project tier without matching project scope', () => {
      const requestor = makeRequestor({ projectScopes: ['proj-B'] });
      const artifact = makeArtifact({ accessTier: 'project' });
      const result = resolver.resolveAccess(requestor, artifact, {
        artifactProjectScopes: ['proj-A'],
      });
      expect(result.outcome).toBe('DENIED');
    });

    it('should DENY access for confidential tier (requires explicit grant)', () => {
      const requestor = makeRequestor();
      const artifact = makeArtifact({ accessTier: 'confidential' });
      const result = resolver.resolveAccess(requestor, artifact);
      expect(result.outcome).toBe('DENIED');
      expect(result.reason).toContain('Confidential');
    });

    it('should grant REDACTED for restricted tier to org_admin', () => {
      const requestor = makeRequestor({ role: 'org_admin' });
      const artifact = makeArtifact({ accessTier: 'restricted' });
      const result = resolver.resolveAccess(requestor, artifact);
      expect(result.outcome).toBe('REDACTED');
      expect(result.redactionLevel).toBe('standard');
    });

    it('should DENY restricted tier for agents', () => {
      const requestor = makeRequestor({
        type: 'agent',
        role: 'service_account',
        agentType: 'team',
      });
      const artifact = makeArtifact({ accessTier: 'restricted' });
      const result = resolver.resolveAccess(requestor, artifact);
      expect(result.outcome).toBe('DENIED');
      expect(result.reason).toContain('agents excluded');
    });

    it('should DENY restricted tier for non-admin users', () => {
      const requestor = makeRequestor({ role: 'member' });
      const artifact = makeArtifact({ accessTier: 'restricted' });
      const result = resolver.resolveAccess(requestor, artifact);
      expect(result.outcome).toBe('DENIED');
    });
  });

  // -----------------------------------------------------------------------
  // ACL Overrides (GRANT / DENY)
  // -----------------------------------------------------------------------

  describe('resolveAccess — ACL overrides', () => {
    it('should DENY when explicit DENY override matches user', () => {
      const requestor = makeRequestor({ id: 'user-banned' });
      const artifact = makeArtifact({
        accessTier: 'public',
        aclOverrides: [
          {
            principalId: 'user-banned',
            principalType: 'user',
            action: 'deny',
            expiresAt: null,
            grantedBy: 'admin',
            grantedAt: '2026-01-01T00:00:00Z',
            reason: 'Security concern',
          },
        ],
      });
      const result = resolver.resolveAccess(requestor, artifact);
      expect(result.outcome).toBe('DENIED');
      expect(result.reason).toContain('Explicit DENY');
    });

    it('should grant FULL access with explicit GRANT override for users', () => {
      const requestor = makeRequestor({ id: 'user-special' });
      const artifact = makeArtifact({
        accessTier: 'confidential',
        aclOverrides: [
          {
            principalId: 'user-special',
            principalType: 'user',
            action: 'grant',
            expiresAt: null,
            grantedBy: 'admin',
            grantedAt: '2026-01-01T00:00:00Z',
            reason: 'Project access',
          },
        ],
      });
      const result = resolver.resolveAccess(requestor, artifact);
      expect(result.outcome).toBe('FULL');
      expect(result.reason).toContain('Explicit GRANT');
    });

    it('should match GRANT override by team', () => {
      const requestor = makeRequestor({ teamIds: ['team-special'] });
      const artifact = makeArtifact({
        accessTier: 'confidential',
        aclOverrides: [
          {
            principalId: 'team-special',
            principalType: 'team',
            action: 'grant',
            expiresAt: null,
            grantedBy: 'admin',
            grantedAt: '2026-01-01T00:00:00Z',
            reason: 'Team access',
          },
        ],
      });
      const result = resolver.resolveAccess(requestor, artifact);
      expect(result.outcome).toBe('FULL');
    });

    it('should match GRANT override by role', () => {
      const requestor = makeRequestor({ role: 'team_admin' });
      const artifact = makeArtifact({
        accessTier: 'confidential',
        aclOverrides: [
          {
            principalId: 'team_admin',
            principalType: 'role',
            action: 'grant',
            expiresAt: null,
            grantedBy: 'admin',
            grantedAt: '2026-01-01T00:00:00Z',
            reason: 'Role-based access',
          },
        ],
      });
      const result = resolver.resolveAccess(requestor, artifact);
      expect(result.outcome).toBe('FULL');
    });

    it('DENY override should take priority over GRANT', () => {
      const requestor = makeRequestor({ id: 'user-both' });
      const artifact = makeArtifact({
        accessTier: 'public',
        aclOverrides: [
          {
            principalId: 'user-both',
            principalType: 'user',
            action: 'grant',
            expiresAt: null,
            grantedBy: 'admin',
            grantedAt: '2026-01-01T00:00:00Z',
            reason: 'Grant',
          },
          {
            principalId: 'user-both',
            principalType: 'user',
            action: 'deny',
            expiresAt: null,
            grantedBy: 'admin',
            grantedAt: '2026-01-01T00:00:00Z',
            reason: 'Deny',
          },
        ],
      });
      const result = resolver.resolveAccess(requestor, artifact);
      expect(result.outcome).toBe('DENIED');
    });
  });

  // -----------------------------------------------------------------------
  // Kill switches
  // -----------------------------------------------------------------------

  describe('resolveAccess — kill switches', () => {
    it('should DENY when global kill switch is active', () => {
      const requestor = makeRequestor();
      const artifact = makeArtifact({ accessTier: 'public' });
      const result = resolver.resolveAccess(requestor, artifact, {
        killSwitches: { org_global_kill: true },
      });
      expect(result.outcome).toBe('DENIED');
      expect(result.reason).toContain('Global kill switch');
    });

    it('should DENY agents when agent kill switch is active', () => {
      const requestor = makeRequestor({
        type: 'agent',
        agentType: 'team',
      });
      const artifact = makeArtifact({ accessTier: 'public' });
      const result = resolver.resolveAccess(requestor, artifact, {
        killSwitches: { org_agent_kill: true },
      });
      expect(result.outcome).toBe('DENIED');
    });

    it('should DENY when team kill switch matches artifact team', () => {
      const requestor = makeRequestor();
      const artifact = makeArtifact({ teamIds: ['team-locked'] });
      const result = resolver.resolveAccess(requestor, artifact, {
        killSwitches: { 'team_kill:team-locked': true },
      });
      expect(result.outcome).toBe('DENIED');
    });

    it('should DENY when privacy policy global kill switch is active', () => {
      const requestor = makeRequestor();
      const artifact = makeArtifact({ accessTier: 'public' });
      const result = resolver.resolveAccess(requestor, artifact, {
        orgPrivacyPolicy: {
          globalKillSwitch: true,
          agentKillSwitch: false,
          teamKillSwitches: {},
        } as OrgPrivacyPolicy,
      });
      expect(result.outcome).toBe('DENIED');
    });
  });

  // -----------------------------------------------------------------------
  // Agent cross-boundary redaction
  // -----------------------------------------------------------------------

  describe('resolveAccess — agent cross-boundary redaction', () => {
    it('should apply standard redaction for team agent accessing team content', () => {
      const requestor = makeRequestor({
        type: 'agent',
        role: 'service_account',
        agentType: 'team',
        teamIds: ['team-001'],
      });
      const artifact = makeArtifact({
        accessTier: 'team',
        teamIds: ['team-001'],
      });
      const result = resolver.resolveAccess(requestor, artifact);
      expect(result.reason).toContain('agent cross-boundary redaction');
    });

    it('should apply aggressive redaction for cross-team agent (function type)', () => {
      const requestor = makeRequestor({
        type: 'agent',
        role: 'service_account',
        agentType: 'function',
        teamIds: ['team-002'],
      });
      const artifact = makeArtifact({
        accessTier: 'public',
        teamIds: ['team-001'],
      });
      const result = resolver.resolveAccess(requestor, artifact);
      // function agents get cross_team_agent boundary -> aggressive
      expect(result.redactionLevel).toBe('aggressive');
    });

    it('should escalate redaction with org-level agentContentAccess policy', () => {
      const requestor = makeRequestor({
        type: 'agent',
        role: 'service_account',
        agentType: 'personal',
        id: 'agent-personal',
      });
      const artifact = makeArtifact({
        accessTier: 'public',
        authorId: 'agent-personal',
        ownerIds: ['agent-personal'],
      });
      const result = resolver.resolveAccess(requestor, artifact, {
        orgPrivacyPolicy: {
          agentContentAccess: 'features_only',
          redactionLevel: 'standard',
          globalKillSwitch: false,
          agentKillSwitch: false,
          teamKillSwitches: {},
        } as OrgPrivacyPolicy,
      });
      expect(result.redactionLevel).toBe('aggressive');
    });
  });

  // -----------------------------------------------------------------------
  // Group policy overrides
  // -----------------------------------------------------------------------

  describe('resolveAccess — group policy overrides', () => {
    it('should allow access through group policy when tier denies but group allows', () => {
      const requestor = makeRequestor({
        teamIds: ['team-001'],
      });
      const artifact = makeArtifact({
        accessTier: 'confidential',
        teamIds: ['team-001'],
      });
      const groupPolicy = makeGroupPolicy({
        groupId: 'team-001',
        piiRedactionLevel: 'standard',
      });
      const result = resolver.resolveAccess(requestor, artifact, {
        groupPolicies: [groupPolicy],
      });
      // Group policy should override confidential denial since requestor is in group
      expect(result.outcome).toBe('REDACTED');
      expect(result.reason).toContain('Group policy');
    });

    it('should apply group redaction level to user access', () => {
      const requestor = makeRequestor({ teamIds: ['team-001'] });
      const artifact = makeArtifact({
        accessTier: 'team',
        teamIds: ['team-001'],
      });
      const groupPolicy = makeGroupPolicy({
        groupId: 'team-001',
        piiRedactionLevel: 'aggressive',
      });
      const result = resolver.resolveAccess(requestor, artifact, {
        groupPolicies: [groupPolicy],
      });
      // Group redaction should be escalated
      expect(result.redactionLevel).toBe('aggressive');
    });

    it('should not apply group policy for non-matching groups', () => {
      const requestor = makeRequestor({ teamIds: ['team-001'] });
      const artifact = makeArtifact({
        accessTier: 'team',
        teamIds: ['team-001'],
      });
      const groupPolicy = makeGroupPolicy({
        groupId: 'team-other',
        piiRedactionLevel: 'aggressive',
      });
      const result = resolver.resolveAccess(requestor, artifact, {
        groupPolicies: [groupPolicy],
      });
      // group-other does not match artifact team-001
      expect(result.redactionLevel).toBe('standard');
    });
  });
});
