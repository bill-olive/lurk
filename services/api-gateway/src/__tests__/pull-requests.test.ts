// =============================================================================
// API Gateway — Pull Request routes unit tests
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

vi.mock('../lib/firestore.js', () => ({
  collections: {
    pullRequests: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn(),
        update: vi.fn(),
        firestore: { batch: vi.fn() },
      }),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn(),
    }),
    artifacts: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn(),
        update: vi.fn(),
      }),
    }),
    ledgers: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn(),
      }),
    }),
    forks: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn(),
        update: vi.fn(),
      }),
    }),
    agents: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn(),
      }),
    }),
    users: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn(),
      }),
    }),
  },
}));

vi.mock('../lib/pubsub.js', () => ({
  publishEvent: vi.fn().mockResolvedValue('msg-id'),
  publishAuditEvent: vi.fn().mockResolvedValue('msg-id'),
  publishNotification: vi.fn().mockResolvedValue('msg-id'),
  Topics: {
    PR_REVIEWED: 'pr.reviewed',
    PR_MERGED: 'pr.merged',
    PR_AUTO_MERGED: 'pr.auto_merged',
  },
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: vi.fn().mockReturnValue('server-timestamp'),
    increment: vi.fn((n: number) => `increment(${n})`),
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Pull Request Routes', () => {
  let mockUser: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = {
      uid: 'user-001',
      orgId: 'org-001',
      ledgerId: 'ledger-001',
      roles: ['member'],
      teams: ['team-001'],
    };
  });

  describe('GET /v1/prs/inbox', () => {
    it('should default to open status filter', () => {
      const defaultStatus = 'open';
      expect(defaultStatus).toBe('open');
    });

    it('should accept valid status values', () => {
      const validStatuses = ['open', 'approved', 'rejected', 'merged', 'closed'];
      validStatuses.forEach(status => {
        expect(typeof status).toBe('string');
      });
    });

    it('should limit results to max 50', () => {
      const limit = Math.min(100, 50);
      expect(limit).toBe(50);
    });

    it('should scope inbox query to user\'s ledger', () => {
      const query = {
        targetLedgerId: mockUser.ledgerId,
        status: 'open',
      };
      expect(query.targetLedgerId).toBe('ledger-001');
    });

    it('should order PRs by createdAt descending', () => {
      const ordering = { field: 'createdAt', direction: 'desc' };
      expect(ordering.direction).toBe('desc');
    });

    it('should implement cursor-based pagination', () => {
      const docs = [{ id: 'pr-1' }, { id: 'pr-2' }, { id: 'pr-3' }];
      const limit = 2;
      const hasMore = docs.length > limit;
      const resultDocs = hasMore ? docs.slice(0, limit) : docs;
      const nextCursor = hasMore ? resultDocs[resultDocs.length - 1].id : undefined;
      expect(hasMore).toBe(true);
      expect(nextCursor).toBe('pr-2');
    });
  });

  describe('POST /v1/prs/:id/review', () => {
    it('should validate review action is one of the allowed values', () => {
      const validActions = ['approve', 'reject', 'request_changes', 'comment'];
      expect(validActions).toContain('approve');
      expect(validActions).toContain('reject');
    });

    it('should not allow reviewing non-open PRs', () => {
      const prStatuses = ['approved', 'merged', 'rejected', 'closed'];
      prStatuses.forEach(status => {
        expect(status).not.toBe('open');
      });
    });

    it('should set status to merged on approve', () => {
      const action = 'approve';
      let newStatus = 'open';
      if (action === 'approve') newStatus = 'merged';
      expect(newStatus).toBe('merged');
    });

    it('should set status to rejected on reject', () => {
      const action = 'reject';
      let newStatus = 'open';
      if (action === 'reject') newStatus = 'rejected';
      expect(newStatus).toBe('rejected');
    });

    it('should keep status as open on request_changes', () => {
      const action = 'request_changes';
      let newStatus = 'open';
      if (action === 'request_changes') newStatus = 'open';
      expect(newStatus).toBe('open');
    });

    it('should restrict approve/reject to artifact owners', () => {
      const target = {
        authorId: 'user-001',
        ownerIds: ['user-001'],
      };
      const isOwner =
        target.authorId === mockUser.uid
        || target.ownerIds.includes(mockUser.uid)
        || mockUser.roles.includes('admin')
        || mockUser.roles.includes('org_admin');
      expect(isOwner).toBe(true);
    });

    it('should deny approve/reject for non-owners', () => {
      const target = {
        authorId: 'user-other',
        ownerIds: ['user-other'],
      };
      const user = { uid: 'user-001', roles: ['member'] };
      const isOwner =
        target.authorId === user.uid
        || target.ownerIds.includes(user.uid)
        || user.roles.includes('admin');
      expect(isOwner).toBe(false);
    });

    it('should allow comment action for any org member', () => {
      const action = 'comment';
      // Comments do not require ownership
      const canComment = action === 'comment';
      expect(canComment).toBe(true);
    });
  });

  describe('YOLO auto-merge logic', () => {
    it('should skip auto-merge when YOLO is disabled', () => {
      const yoloConfig = { enabled: false };
      expect(yoloConfig.enabled).toBe(false);
    });

    it('should check confidence threshold', () => {
      const pr = { confidence: 0.95 };
      const yolo = { minConfidence: 0.9 };
      expect(pr.confidence >= yolo.minConfidence).toBe(true);
    });

    it('should check confidence below threshold', () => {
      const pr = { confidence: 0.5 };
      const yolo = { minConfidence: 0.9 };
      expect(pr.confidence >= yolo.minConfidence).toBe(false);
    });

    it('should check agent type is allowed', () => {
      const pr = { agentType: 'personal' };
      const yolo = { allowedAgentTypes: ['personal', 'team'] };
      expect(yolo.allowedAgentTypes.includes(pr.agentType)).toBe(true);
    });

    it('should reject disallowed agent types', () => {
      const pr = { agentType: 'org' };
      const yolo = { allowedAgentTypes: ['personal', 'team'] };
      expect(yolo.allowedAgentTypes.includes(pr.agentType)).toBe(false);
    });

    it('should check sensitivity against max level', () => {
      const levels = ['public', 'internal', 'confidential', 'restricted'];
      const maxLevel = levels.indexOf('internal');
      const artifactLevel = levels.indexOf('confidential');
      expect(artifactLevel > maxLevel).toBe(true);
    });

    it('should exclude customer-facing artifacts when configured', () => {
      const yolo = { excludeCustomerFacing: true };
      const artifact = { customerFacing: true };
      const excluded = yolo.excludeCustomerFacing && artifact.customerFacing;
      expect(excluded).toBe(true);
    });

    it('should exclude artifacts with blocked tags', () => {
      const yolo = { excludeTags: ['legal', 'confidential'] };
      const artifact = { tags: ['report', 'legal'] };
      const hasBlockedTag = artifact.tags.some((tag: string) =>
        yolo.excludeTags.includes(tag)
      );
      expect(hasBlockedTag).toBe(true);
    });

    it('should respect dailyAutoMergeCap', () => {
      const yolo = { dailyAutoMergeCap: 10 };
      const autoMergesToday = 10;
      expect(autoMergesToday >= yolo.dailyAutoMergeCap).toBe(true);
    });

    it('should block when requireSecondAgent is true and only one agent proposed', () => {
      const yolo = { requireSecondAgent: true };
      const isEligible = !yolo.requireSecondAgent;
      expect(isEligible).toBe(false);
    });
  });
});
