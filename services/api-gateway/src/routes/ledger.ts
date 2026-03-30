import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth } from '../middleware/auth.js';
import { validate, validateQuery } from '../middleware/validation.js';
import { defaultLimiter, writeLimiter } from '../middleware/rate-limit.js';
import { collections } from '../lib/firestore.js';
import { publishEvent, publishAuditEvent, Topics } from '../lib/pubsub.js';

const router = Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const LedgerParamsSchema = z.object({
  id: z.string().min(1),
});

const LogQuerySchema = z.object({
  branch: z.string().optional().default('main'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

const SyncBodySchema = z.object({
  localHead: z.string().min(1),
  localCommits: z.array(
    z.object({
      commitHash: z.string().min(1),
      artifactId: z.string().min(1),
      version: z.number().int().min(1),
      parentHash: z.string().nullable(),
      message: z.string(),
      timestamp: z.string(),
    }),
  ).optional().default([]),
  strategy: z.enum(['theirs', 'ours', 'manual']).optional().default('theirs'),
});

// ---------------------------------------------------------------------------
// GET /v1/ledger/:id/log — commit log
// ---------------------------------------------------------------------------

router.get(
  '/:id/log',
  requireAuth,
  defaultLimiter,
  validate({ params: LedgerParamsSchema, query: LogQuerySchema }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;
      const { branch, limit, cursor, from, to } = req.query as unknown as z.infer<typeof LogQuerySchema>;

      // Verify ledger access
      const ledgerDoc = await collections.ledgers().doc(id).get();
      if (!ledgerDoc.exists) {
        res.status(404).json({ error: 'Ledger not found' });
        return;
      }

      const ledger = ledgerDoc.data()!;
      if (ledger.orgId !== user.orgId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      // Only ledger owner or admins can view
      const canView =
        ledger.userId === user.uid ||
        user.roles.includes('admin') ||
        user.roles.includes('org_admin');

      if (!canView) {
        res.status(403).json({ error: 'Access denied to this ledger' });
        return;
      }

      // Query commits
      let query = collections.commits()
        .where('ledgerId', '==', id)
        .orderBy('timestamp', 'desc')
        .limit(limit! + 1);

      if (from) {
        query = query.where('timestamp', '>=', new Date(from));
      }
      if (to) {
        query = query.where('timestamp', '<=', new Date(to));
      }

      if (cursor) {
        const cursorDoc = await collections.commits().doc(cursor).get();
        if (cursorDoc.exists) {
          query = query.startAfter(cursorDoc);
        }
      }

      const snapshot = await query.get();
      const docs = snapshot.docs;

      const hasMore = docs.length > limit!;
      const resultDocs = hasMore ? docs.slice(0, limit!) : docs;

      const commits = resultDocs.map((doc) => ({
        commitHash: doc.id,
        ...doc.data(),
      }));

      const nextCursor = hasMore && resultDocs.length > 0 ? resultDocs[resultDocs.length - 1].id : undefined;

      res.json({
        ledgerId: id,
        branch,
        head: ledger.head,
        commits,
        cursor: nextCursor,
        hasMore,
      });
    } catch (err) {
      console.error('Error fetching commit log:', err);
      res.status(500).json({ error: 'Failed to fetch commit log' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /v1/ledger/:id/branches — active branches
// ---------------------------------------------------------------------------

router.get(
  '/:id/branches',
  requireAuth,
  defaultLimiter,
  validate({ params: LedgerParamsSchema }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;

      const ledgerDoc = await collections.ledgers().doc(id).get();
      if (!ledgerDoc.exists) {
        res.status(404).json({ error: 'Ledger not found' });
        return;
      }

      const ledger = ledgerDoc.data()!;
      if (ledger.orgId !== user.orgId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const canView =
        ledger.userId === user.uid ||
        user.roles.includes('admin') ||
        user.roles.includes('org_admin');

      if (!canView) {
        res.status(403).json({ error: 'Access denied to this ledger' });
        return;
      }

      // Branches are stored as an array on the ledger doc
      const branches = ledger.branches || [];

      // Enrich with commit counts for each branch
      const enrichedBranches = await Promise.all(
        branches.map(async (branch: { id: string; name: string; head: string; createdAt: FirebaseFirestore.Timestamp }) => {
          // Count open forks on this branch
          const forksSnapshot = await collections.forks()
            .where('forkBranchId', '==', branch.id)
            .where('status', '==', 'open')
            .count()
            .get();

          return {
            ...branch,
            openForks: forksSnapshot.data().count,
          };
        }),
      );

      // Always include main if not present
      const hasMain = enrichedBranches.some((b: { name: string }) => b.name === 'main');
      if (!hasMain) {
        enrichedBranches.unshift({
          id: 'main',
          name: 'main',
          head: ledger.head,
          createdAt: ledger.createdAt,
          openForks: 0,
        });
      }

      res.json({
        ledgerId: id,
        branches: enrichedBranches,
      });
    } catch (err) {
      console.error('Error fetching branches:', err);
      res.status(500).json({ error: 'Failed to fetch branches' });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /v1/ledger/:id/sync — sync local <-> cloud
// ---------------------------------------------------------------------------

router.post(
  '/:id/sync',
  requireAuth,
  writeLimiter,
  validate({ params: LedgerParamsSchema, body: SyncBodySchema }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;
      const { localHead, localCommits, strategy } = req.body;

      const ledgerRef = collections.ledgers().doc(id);
      const ledgerDoc = await ledgerRef.get();
      if (!ledgerDoc.exists) {
        res.status(404).json({ error: 'Ledger not found' });
        return;
      }

      const ledger = ledgerDoc.data()!;

      // Only owner can sync
      if (ledger.userId !== user.uid) {
        res.status(403).json({ error: 'Only the ledger owner can sync' });
        return;
      }

      const cloudHead = ledger.head;

      // Determine sync action
      if (cloudHead === localHead) {
        // Already in sync
        res.json({
          ledgerId: id,
          status: 'up_to_date',
          head: cloudHead,
          newCommits: 0,
        });
        return;
      }

      // Check if local is ahead (local has commits cloud doesn't)
      if (localCommits.length > 0) {
        // Apply local commits to cloud
        const batch = collections.commits().firestore.batch();
        let newHead = cloudHead;

        for (const commit of localCommits) {
          // Check if commit already exists
          const existing = await collections.commits().doc(commit.commitHash).get();
          if (existing.exists) continue;

          batch.set(collections.commits().doc(commit.commitHash), {
            ledgerId: id,
            artifactId: commit.artifactId,
            version: commit.version,
            parentHash: commit.parentHash,
            message: commit.message,
            authorId: user.uid,
            authorType: 'user' as const,
            timestamp: new Date(commit.timestamp),
            signature: '',
            policyVersion: '',
          });

          newHead = commit.commitHash;
        }

        // Update ledger head
        batch.update(ledgerRef, {
          head: newHead,
          lastCommitAt: FieldValue.serverTimestamp(),
          'syncState.status': 'synced',
          'syncState.lastSyncAt': FieldValue.serverTimestamp(),
          'syncState.pendingChanges': 0,
        });

        await batch.commit();

        // Publish event
        await publishEvent(Topics.ARTIFACT_SYNCED, {
          orgId: user.orgId,
          data: { ledgerId: id, userId: user.uid, commitsApplied: localCommits.length, head: newHead },
        });

        res.json({
          ledgerId: id,
          status: 'synced',
          head: newHead,
          newCommits: localCommits.length,
          strategy,
        });
        return;
      }

      // Cloud is ahead — return commits the client is missing
      const missingCommits = await collections.commits()
        .where('ledgerId', '==', id)
        .orderBy('timestamp', 'desc')
        .limit(100)
        .get();

      // Find commits after localHead
      const cloudCommits = missingCommits.docs.map((doc) => ({
        commitHash: doc.id,
        ...doc.data(),
      }));

      // Simple approach: return all recent commits and let client reconcile
      await ledgerRef.update({
        'syncState.status': 'synced',
        'syncState.lastSyncAt': FieldValue.serverTimestamp(),
      });

      res.json({
        ledgerId: id,
        status: 'cloud_ahead',
        head: cloudHead,
        cloudCommits,
        newCommits: cloudCommits.length,
      });
    } catch (err) {
      console.error('Error syncing ledger:', err);
      res.status(500).json({ error: 'Failed to sync ledger' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /v1/ledger/:id/status — sync status
// ---------------------------------------------------------------------------

router.get(
  '/:id/status',
  requireAuth,
  defaultLimiter,
  validate({ params: LedgerParamsSchema }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;

      const ledgerDoc = await collections.ledgers().doc(id).get();
      if (!ledgerDoc.exists) {
        res.status(404).json({ error: 'Ledger not found' });
        return;
      }

      const ledger = ledgerDoc.data()!;
      if (ledger.orgId !== user.orgId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const canView =
        ledger.userId === user.uid ||
        user.roles.includes('admin') ||
        user.roles.includes('org_admin');

      if (!canView) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      // Count pending PRs targeting this ledger
      const pendingPRs = await collections.pullRequests()
        .where('targetLedgerId', '==', id)
        .where('status', '==', 'open')
        .count()
        .get();

      // Count open forks
      const openForks = await collections.forks()
        .where('upstreamLedgerId', '==', id)
        .where('status', '==', 'open')
        .count()
        .get();

      res.json({
        ledgerId: id,
        head: ledger.head,
        artifactCount: ledger.artifactCount,
        lastCommitAt: ledger.lastCommitAt,
        syncState: ledger.syncState,
        branches: (ledger.branches || []).length,
        pendingPRs: pendingPRs.data().count,
        openForks: openForks.data().count,
        yoloEnabled: ledger.yoloConfig?.enabled ?? false,
      });
    } catch (err) {
      console.error('Error fetching ledger status:', err);
      res.status(500).json({ error: 'Failed to fetch ledger status' });
    }
  },
);

export default router;
