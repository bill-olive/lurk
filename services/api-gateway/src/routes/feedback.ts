import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { v4 as uuid } from 'uuid';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { writeLimiter } from '../middleware/rate-limit.js';
import { collections } from '../lib/firestore.js';
import { publishEvent, publishAuditEvent, Topics } from '../lib/pubsub.js';

const router = Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const FeedbackBodySchema = z.object({
  targetId: z.string().min(1),
  targetType: z.enum(['agent', 'pr', 'artifact']),
  reason: z.enum([
    'incorrect',
    'unhelpful',
    'privacy_concern',
    'too_aggressive',
    'too_conservative',
    'wrong_context',
    'good',
    'excellent',
    'other',
  ]),
  comment: z.string().max(2000).optional().default(''),
});

// ---------------------------------------------------------------------------
// POST /v1/feedback — submit feedback on agent/PR
// ---------------------------------------------------------------------------

router.post(
  '/',
  requireAuth,
  writeLimiter,
  validateBody(FeedbackBodySchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { targetId, targetType, reason, comment } = req.body;

      // Verify target exists and user has access
      let targetExists = false;
      let targetOrgId: string | null = null;

      switch (targetType) {
        case 'agent': {
          const agentDoc = await collections.agents().doc(targetId).get();
          if (agentDoc.exists) {
            targetExists = true;
            targetOrgId = agentDoc.data()!.orgId;
          }
          break;
        }
        case 'pr': {
          const prDoc = await collections.pullRequests().doc(targetId).get();
          if (prDoc.exists) {
            targetExists = true;
            targetOrgId = prDoc.data()!.orgId;
          }
          break;
        }
        case 'artifact': {
          const artifactDoc = await collections.artifacts().doc(targetId).get();
          if (artifactDoc.exists) {
            targetExists = true;
            targetOrgId = artifactDoc.data()!.orgId;
          }
          break;
        }
      }

      if (!targetExists) {
        res.status(404).json({ error: `${targetType} not found` });
        return;
      }

      if (targetOrgId !== user.orgId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const feedbackId = uuid();
      const now = FieldValue.serverTimestamp();

      const feedbackData = {
        orgId: user.orgId,
        userId: user.uid,
        targetId,
        targetType,
        reason,
        comment,
        status: 'open' as const,
        resolution: null,
        resolvedBy: null,
        createdAt: now,
        updatedAt: now,
      };

      await collections.feedback().doc(feedbackId).set(feedbackData);

      // Publish events
      await Promise.all([
        publishEvent(Topics.FEEDBACK_SUBMITTED, {
          orgId: user.orgId,
          data: {
            feedbackId,
            targetId,
            targetType,
            reason,
            userId: user.uid,
          },
        }),
        publishAuditEvent({
          orgId: user.orgId,
          actorId: user.uid,
          actorType: 'user',
          action: 'feedback.submit',
          targetRef: targetId,
          targetType,
          metadata: { feedbackId, reason },
        }),
      ]);

      // If feedback is negative, consider pausing agent or flagging PR
      const isNegative = ['incorrect', 'unhelpful', 'privacy_concern', 'too_aggressive', 'wrong_context'].includes(reason);

      if (isNegative && targetType === 'agent') {
        // Check how many negative feedbacks this agent has received recently
        const recentNegative = await collections.feedback()
          .where('targetId', '==', targetId)
          .where('targetType', '==', 'agent')
          .where('reason', 'in', ['incorrect', 'unhelpful', 'privacy_concern', 'too_aggressive', 'wrong_context'])
          .orderBy('createdAt', 'desc')
          .limit(10)
          .get();

        // If >= 5 negative feedbacks, flag the agent for review
        if (recentNegative.docs.length >= 5) {
          await collections.agents().doc(targetId).update({
            status: 'paused',
          });

          // Notify org admins
          const admins = await collections.users()
            .where('orgId', '==', user.orgId)
            .where('roles', 'array-contains', 'admin')
            .limit(5)
            .get();

          for (const admin of admins.docs) {
            await publishAuditEvent({
              orgId: user.orgId,
              actorId: 'system',
              actorType: 'system',
              action: 'agent.auto-paused',
              targetRef: targetId,
              targetType: 'agent',
              metadata: {
                reason: 'Excessive negative feedback',
                negativeFeedbackCount: recentNegative.docs.length,
              },
            });
          }
        }
      }

      res.status(201).json({
        feedbackId,
        targetId,
        targetType,
        reason,
        status: 'open',
      });
    } catch (err) {
      console.error('Error submitting feedback:', err);
      res.status(500).json({ error: 'Failed to submit feedback' });
    }
  },
);

export default router;
