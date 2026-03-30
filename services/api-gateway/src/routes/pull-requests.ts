import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth } from '../middleware/auth.js';
import { validate, validateQuery } from '../middleware/validation.js';
import { defaultLimiter, writeLimiter } from '../middleware/rate-limit.js';
import { collections, type PullRequest, type YoloConfig } from '../lib/firestore.js';
import { publishEvent, publishAuditEvent, publishNotification, Topics } from '../lib/pubsub.js';

const router = Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const InboxQuerySchema = z.object({
  status: z.enum(['open', 'approved', 'rejected', 'merged', 'closed']).optional().default('open'),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  cursor: z.string().optional(),
});

const PRParamsSchema = z.object({
  id: z.string().min(1),
});

const ReviewBodySchema = z.object({
  action: z.enum(['approve', 'reject', 'request_changes', 'comment']),
  comment: z.string().max(5000).optional().default(''),
});

// ---------------------------------------------------------------------------
// GET /v1/prs/inbox — pending PRs for current user
// ---------------------------------------------------------------------------

router.get(
  '/inbox',
  requireAuth,
  defaultLimiter,
  validateQuery(InboxQuerySchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { status, limit, cursor } = req.query as unknown as z.infer<typeof InboxQuerySchema>;

      // PRs targeting ledgers the user owns or artifacts they own
      // First, find the user's ledger
      const ledgerDoc = await collections.ledgers().doc(user.ledgerId).get();

      // Get PRs targeting user's ledger
      let query = collections.pullRequests()
        .where('targetLedgerId', '==', user.ledgerId)
        .where('status', '==', status)
        .orderBy('createdAt', 'desc')
        .limit(limit! + 1);

      if (cursor) {
        const cursorDoc = await collections.pullRequests().doc(cursor).get();
        if (cursorDoc.exists) {
          query = query.startAfter(cursorDoc);
        }
      }

      const snapshot = await query.get();
      const docs = snapshot.docs;

      const hasMore = docs.length > limit!;
      const resultDocs = hasMore ? docs.slice(0, limit!) : docs;

      // Enrich PRs with source artifact info
      const prs = await Promise.all(
        resultDocs.map(async (doc) => {
          const pr = doc.data();
          let sourceArtifact = null;

          try {
            const artifactDoc = await collections.artifacts().doc(pr.sourceArtifactId).get();
            if (artifactDoc.exists) {
              sourceArtifact = { id: artifactDoc.id, title: artifactDoc.data()!.title, type: artifactDoc.data()!.type };
            }
          } catch {
            // Artifact may have been deleted
          }

          return {
            id: doc.id,
            ...pr,
            sourceArtifact,
          };
        }),
      );

      const nextCursor = hasMore && resultDocs.length > 0 ? resultDocs[resultDocs.length - 1].id : undefined;

      res.json({
        pullRequests: prs,
        cursor: nextCursor,
        hasMore,
      });
    } catch (err) {
      console.error('Error fetching PR inbox:', err);
      res.status(500).json({ error: 'Failed to fetch PR inbox' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /v1/prs/:id — PR detail with diff
// ---------------------------------------------------------------------------

router.get(
  '/:id',
  requireAuth,
  defaultLimiter,
  validate({ params: PRParamsSchema }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;

      const doc = await collections.pullRequests().doc(id).get();
      if (!doc.exists) {
        res.status(404).json({ error: 'Pull request not found' });
        return;
      }

      const pr = doc.data()!;

      // Org check
      if (pr.orgId !== user.orgId) {
        res.status(404).json({ error: 'Pull request not found' });
        return;
      }

      // Fetch related data
      const [forkDoc, sourceArtifactDoc, targetArtifactDoc, agentDoc] = await Promise.all([
        pr.forkId ? collections.forks().doc(pr.forkId).get() : null,
        collections.artifacts().doc(pr.sourceArtifactId).get(),
        collections.artifacts().doc(pr.targetArtifactId).get(),
        pr.agentId ? collections.agents().doc(pr.agentId).get() : null,
      ]);

      res.json({
        id: doc.id,
        ...pr,
        fork: forkDoc?.exists ? { id: forkDoc.id, ...forkDoc.data() } : null,
        sourceArtifact: sourceArtifactDoc.exists ? { id: sourceArtifactDoc.id, ...sourceArtifactDoc.data() } : null,
        targetArtifact: targetArtifactDoc.exists ? { id: targetArtifactDoc.id, ...targetArtifactDoc.data() } : null,
        agent: agentDoc?.exists ? { id: agentDoc.id, name: agentDoc.data()!.name, type: agentDoc.data()!.type } : null,
      });
    } catch (err) {
      console.error('Error fetching PR:', err);
      res.status(500).json({ error: 'Failed to fetch pull request' });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /v1/prs/:id/review — submit review action
// ---------------------------------------------------------------------------

router.post(
  '/:id/review',
  requireAuth,
  writeLimiter,
  validate({ params: PRParamsSchema, body: ReviewBodySchema }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;
      const { action, comment } = req.body;

      const prRef = collections.pullRequests().doc(id);
      const prDoc = await prRef.get();
      if (!prDoc.exists) {
        res.status(404).json({ error: 'Pull request not found' });
        return;
      }

      const pr = prDoc.data()!;

      // Org check
      if (pr.orgId !== user.orgId) {
        res.status(404).json({ error: 'Pull request not found' });
        return;
      }

      // Can only review open PRs
      if (pr.status !== 'open') {
        res.status(400).json({ error: `Cannot review a PR with status: ${pr.status}` });
        return;
      }

      // Verify the reviewer has access to the target artifact
      const targetDoc = await collections.artifacts().doc(pr.targetArtifactId).get();
      if (!targetDoc.exists) {
        res.status(400).json({ error: 'Target artifact no longer exists' });
        return;
      }

      const target = targetDoc.data()!;
      const isOwner =
        target.authorId === user.uid ||
        target.ownerIds.includes(user.uid) ||
        user.roles.includes('admin') ||
        user.roles.includes('org_admin');

      if (!isOwner && action !== 'comment') {
        res.status(403).json({ error: 'Only artifact owners can approve or reject PRs' });
        return;
      }

      const now = FieldValue.serverTimestamp();

      // Determine new status based on action
      let newStatus: PullRequest['status'] = pr.status;
      switch (action) {
        case 'approve':
          newStatus = 'approved';
          break;
        case 'reject':
          newStatus = 'rejected';
          break;
        case 'request_changes':
          // PR stays open but review is recorded
          newStatus = 'open';
          break;
        case 'comment':
          newStatus = 'open';
          break;
      }

      // Update PR
      const updateData: Record<string, unknown> = {
        status: newStatus,
        reviewerId: user.uid,
        reviewAction: action,
        reviewComment: comment,
        reviewedAt: now,
      };

      // If approved, merge the artifact changes
      if (action === 'approve') {
        updateData.mergedAt = now;
        updateData.status = 'merged';

        // Update target artifact with source content
        const sourceDoc = await collections.artifacts().doc(pr.sourceArtifactId).get();
        if (sourceDoc.exists) {
          const source = sourceDoc.data()!;
          await collections.artifacts().doc(pr.targetArtifactId).update({
            version: FieldValue.increment(1),
            contentHash: source.contentHash,
            committedAt: now,
          });
        }

        // Update fork status
        if (pr.forkId) {
          await collections.forks().doc(pr.forkId).update({
            status: 'merged',
            updatedAt: now,
          });
        }
      }

      if (action === 'reject') {
        updateData.closedAt = now;

        // Update fork status
        if (pr.forkId) {
          await collections.forks().doc(pr.forkId).update({
            status: 'closed',
            updatedAt: now,
          });
        }
      }

      await prRef.update(updateData);

      // Publish events
      const eventPromises: Promise<string>[] = [
        publishEvent(Topics.PR_REVIEWED, {
          orgId: user.orgId,
          data: {
            prId: id,
            reviewerId: user.uid,
            action,
            comment,
            newStatus: updateData.status ?? newStatus,
          },
        }),
        publishAuditEvent({
          orgId: user.orgId,
          actorId: user.uid,
          actorType: 'user',
          action: `pr.${action}`,
          targetRef: id,
          targetType: 'pullRequest',
          metadata: { comment },
        }),
      ];

      if (action === 'approve') {
        eventPromises.push(
          publishEvent(Topics.PR_MERGED, {
            orgId: user.orgId,
            data: {
              prId: id,
              sourceArtifactId: pr.sourceArtifactId,
              targetArtifactId: pr.targetArtifactId,
              agentId: pr.agentId,
            },
          }),
        );
      }

      // Notify the agent/author about the review
      if (pr.agentId) {
        eventPromises.push(
          publishNotification({
            orgId: user.orgId,
            userId: pr.agentId,
            type: `pr_${action}`,
            title: `PR ${action}: ${pr.title}`,
            body: comment || `Your PR was ${action === 'approve' ? 'approved and merged' : action === 'reject' ? 'rejected' : 'reviewed'}`,
            sourceRef: id,
          }),
        );
      }

      await Promise.all(eventPromises);

      // ---------- YOLO auto-merge check ----------
      // After a successful review, check if there are other eligible PRs
      // that can be auto-merged based on the user's YOLO config.
      let autoMergedCount = 0;
      if (action === 'approve') {
        autoMergedCount = await checkAndAutoMergePRs(user.uid, user.orgId, user.ledgerId);
      }

      res.json({
        id,
        status: updateData.status ?? newStatus,
        action,
        reviewerId: user.uid,
        autoMergedCount,
      });
    } catch (err) {
      console.error('Error reviewing PR:', err);
      res.status(500).json({ error: 'Failed to submit review' });
    }
  },
);

// ---------------------------------------------------------------------------
// YOLO auto-merge logic
// ---------------------------------------------------------------------------

async function checkAndAutoMergePRs(userId: string, orgId: string, ledgerId: string): Promise<number> {
  try {
    // Load user's YOLO config
    const userDoc = await collections.users().doc(userId).get();
    if (!userDoc.exists) return 0;

    const userData = userDoc.data()!;
    const yolo: YoloConfig | undefined = userData.yoloConfig;

    if (!yolo?.enabled) return 0;

    // Get open PRs targeting this user's ledger
    const openPRs = await collections.pullRequests()
      .where('targetLedgerId', '==', ledgerId)
      .where('status', '==', 'open')
      .where('autoMergeEligible', '==', true)
      .limit(yolo.dailyAutoMergeCap || 50)
      .get();

    if (openPRs.empty) return 0;

    let merged = 0;

    for (const prDoc of openPRs.docs) {
      const pr = prDoc.data();

      // Check YOLO criteria
      if (!isYoloEligible(pr, yolo)) continue;

      // Check confidence threshold
      if (pr.confidence < yolo.minConfidence) continue;

      // Check agent type is allowed
      if (yolo.allowedAgentTypes.length > 0 && !yolo.allowedAgentTypes.includes(pr.agentType)) continue;

      // Check specific agent IDs
      if (yolo.allowedAgentIds && yolo.allowedAgentIds.length > 0 && !yolo.allowedAgentIds.includes(pr.agentId)) continue;

      // Check target artifact sensitivity
      const targetDoc = await collections.artifacts().doc(pr.targetArtifactId).get();
      if (!targetDoc.exists) continue;

      const target = targetDoc.data()!;

      // Sensitivity check
      const sensitivityLevels = ['public', 'internal', 'confidential', 'restricted'];
      const maxLevel = sensitivityLevels.indexOf(yolo.maxSensitivity || 'internal');
      const artifactLevel = sensitivityLevels.indexOf(target.sensitivity);
      if (artifactLevel > maxLevel) continue;

      // Exclude customer-facing if configured
      if (yolo.excludeCustomerFacing && target.customerFacing) continue;

      // Exclude by tags
      if (yolo.excludeTags.length > 0 && target.tags.some((tag: string) => yolo.excludeTags.includes(tag))) continue;

      // All checks passed — auto-merge
      const now = FieldValue.serverTimestamp();
      const batch = collections.pullRequests().firestore.batch();

      batch.update(prDoc.ref, {
        status: 'merged',
        reviewerId: userId,
        reviewAction: 'approve',
        reviewComment: 'Auto-merged via YOLO mode',
        reviewedAt: now,
        autoMergedAt: now,
        mergedAt: now,
      });

      // Update target artifact
      const sourceDoc = await collections.artifacts().doc(pr.sourceArtifactId).get();
      if (sourceDoc.exists) {
        const source = sourceDoc.data()!;
        batch.update(collections.artifacts().doc(pr.targetArtifactId), {
          version: FieldValue.increment(1),
          contentHash: source.contentHash,
          committedAt: now,
        });
      }

      // Update fork
      if (pr.forkId) {
        batch.update(collections.forks().doc(pr.forkId), {
          status: 'merged',
          updatedAt: now,
        });
      }

      await batch.commit();

      // Publish auto-merge event
      await publishEvent(Topics.PR_AUTO_MERGED, {
        orgId,
        data: {
          prId: prDoc.id,
          userId,
          agentId: pr.agentId,
          sourceArtifactId: pr.sourceArtifactId,
          targetArtifactId: pr.targetArtifactId,
        },
      });

      merged++;
    }

    return merged;
  } catch (err) {
    console.error('Error in YOLO auto-merge check:', err);
    return 0;
  }
}

function isYoloEligible(pr: PullRequest, yolo: YoloConfig): boolean {
  // Check diff size (heuristic: count newlines in diff string)
  if (yolo.maxDiffSize > 0 && pr.diff) {
    const diffLines = pr.diff.split('\n').length;
    if (diffLines > yolo.maxDiffSize) return false;
  }

  // Check if second agent approval is required
  if (yolo.requireSecondAgent) {
    // This would require a more complex check in production
    // For now, we skip if requireSecondAgent is true and only one agent proposed
    return false;
  }

  return true;
}

export default router;
