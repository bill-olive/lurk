import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { v4 as uuid } from 'uuid';
import { requireAuth } from '../middleware/auth.js';
import { validate, validateBody } from '../middleware/validation.js';
import { writeLimiter, defaultLimiter } from '../middleware/rate-limit.js';
import { collections } from '../lib/firestore.js';
import { uploadArtifactContent, generateDownloadUrl } from '../lib/storage.js';
import { publishEvent, publishAuditEvent, Topics } from '../lib/pubsub.js';

const router = Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const TranscriptBodySchema = z.object({
  meetingTitle: z.string().min(1).max(500),
  meetingPlatform: z.enum(['zoom', 'google_meet', 'teams', 'facetime', 'webex', 'other']),
  startedAt: z.string(),
  endedAt: z.string(),
  participants: z.array(
    z.object({
      name: z.string(),
      email: z.string().email().optional(),
      role: z.string().optional(),
    }),
  ).optional().default([]),
  transcript: z.string().min(1),
  language: z.string().optional().default('en'),
  audioUrl: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional().default({}),
});

const MeetingParamsSchema = z.object({
  id: z.string().min(1),
});

// ---------------------------------------------------------------------------
// POST /v1/meetings/transcript — submit meeting transcript
// ---------------------------------------------------------------------------

router.post(
  '/transcript',
  requireAuth,
  writeLimiter,
  validateBody(TranscriptBodySchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const body = req.body;

      const ledgerId = user.ledgerId;
      if (!ledgerId) {
        res.status(400).json({ error: 'User has no ledger assigned' });
        return;
      }

      const artifactId = uuid();
      const commitHash = uuid();
      const now = FieldValue.serverTimestamp();

      // Build the transcript content as a structured document
      const transcriptContent = JSON.stringify({
        meetingTitle: body.meetingTitle,
        platform: body.meetingPlatform,
        startedAt: body.startedAt,
        endedAt: body.endedAt,
        participants: body.participants,
        language: body.language,
        transcript: body.transcript,
        metadata: body.metadata,
      }, null, 2);

      // Upload to GCS
      const { contentHash } = await uploadArtifactContent(
        user.orgId,
        artifactId,
        1,
        Buffer.from(transcriptContent, 'utf-8'),
        'application/json',
      );

      // Calculate meeting duration
      const startTime = new Date(body.startedAt).getTime();
      const endTime = new Date(body.endedAt).getTime();
      const durationMinutes = Math.round((endTime - startTime) / 60000);

      // Create artifact
      const artifactData = {
        ledgerId,
        orgId: user.orgId,
        type: 'meeting_transcript',
        title: body.meetingTitle,
        sourceUrl: body.audioUrl ?? '',
        sourceApp: body.meetingPlatform,
        captureMethod: 'system_audio',
        contentHash,
        featureBundle: {},
        metadata: {
          ...body.metadata,
          platform: body.meetingPlatform,
          startedAt: body.startedAt,
          endedAt: body.endedAt,
          durationMinutes,
          participantCount: body.participants.length,
          language: body.language,
        },
        tags: ['meeting', 'transcript', body.meetingPlatform],
        customerFacing: false,
        customerRefs: [],
        sensitivity: 'internal' as const,
        authorId: user.uid,
        ownerIds: [user.uid],
        teamIds: [],
        version: 1,
        parentVersion: null,
        commitHash,
        branchId: 'main',
        accessTier: user.accessTier,
        aclOverrides: [],
        relatedArtifacts: [],
        capturedAt: now,
        committedAt: now,
      };

      const commitData = {
        ledgerId,
        artifactId,
        version: 1,
        parentHash: null,
        message: `Meeting transcript: ${body.meetingTitle}`,
        authorId: user.uid,
        authorType: 'user' as const,
        timestamp: now,
        signature: '',
        policyVersion: '',
      };

      const batch = collections.artifacts().firestore.batch();
      batch.set(collections.artifacts().doc(artifactId), artifactData);
      batch.set(collections.commits().doc(commitHash), commitData);
      batch.update(collections.ledgers().doc(ledgerId), {
        artifactCount: FieldValue.increment(1),
        lastCommitAt: now,
      });
      await batch.commit();

      // Publish events
      await Promise.all([
        publishEvent(Topics.MEETING_TRANSCRIPT, {
          orgId: user.orgId,
          data: {
            artifactId,
            meetingTitle: body.meetingTitle,
            platform: body.meetingPlatform,
            durationMinutes,
            participantCount: body.participants.length,
            userId: user.uid,
          },
        }),
        publishAuditEvent({
          orgId: user.orgId,
          actorId: user.uid,
          actorType: 'user',
          action: 'meeting.transcript.submit',
          targetRef: artifactId,
          targetType: 'artifact',
          metadata: { platform: body.meetingPlatform, durationMinutes },
        }),
      ]);

      res.status(201).json({
        artifactId,
        commitHash,
        meetingTitle: body.meetingTitle,
        durationMinutes,
      });
    } catch (err) {
      console.error('Error submitting transcript:', err);
      res.status(500).json({ error: 'Failed to submit meeting transcript' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /v1/meetings/:id/summary — get meeting summary artifact
// ---------------------------------------------------------------------------

router.get(
  '/:id/summary',
  requireAuth,
  defaultLimiter,
  validate({ params: MeetingParamsSchema }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;

      // The meeting ID is the artifact ID of the transcript
      const transcriptDoc = await collections.artifacts().doc(id).get();
      if (!transcriptDoc.exists) {
        res.status(404).json({ error: 'Meeting transcript not found' });
        return;
      }

      const transcript = transcriptDoc.data()!;
      if (transcript.orgId !== user.orgId) {
        res.status(404).json({ error: 'Meeting transcript not found' });
        return;
      }

      if (transcript.type !== 'meeting_transcript') {
        res.status(400).json({ error: 'Artifact is not a meeting transcript' });
        return;
      }

      // Look for a summary artifact that references this transcript
      const summarySnapshot = await collections.artifacts()
        .where('orgId', '==', user.orgId)
        .where('type', '==', 'meeting_summary')
        .where('relatedArtifacts', 'array-contains', id)
        .limit(1)
        .get();

      if (summarySnapshot.empty) {
        // No summary yet — return the transcript metadata with a pending status
        // An agent will create the summary asynchronously after the transcript event
        res.json({
          meetingId: id,
          status: 'pending',
          message: 'Meeting summary is being generated. Check back shortly.',
          transcript: {
            id,
            title: transcript.title,
            metadata: transcript.metadata,
          },
        });
        return;
      }

      const summaryDoc = summarySnapshot.docs[0];
      const summary = summaryDoc.data()!;

      // Generate download URL for the summary content
      let downloadUrl: string | undefined;
      if (summary.contentHash) {
        try {
          downloadUrl = await generateDownloadUrl(summary.orgId, summaryDoc.id, summary.version);
        } catch {
          // Content may not exist in GCS
        }
      }

      res.json({
        meetingId: id,
        status: 'ready',
        summary: {
          id: summaryDoc.id,
          title: summary.title,
          metadata: summary.metadata,
          downloadUrl,
          createdAt: summary.committedAt,
        },
        transcript: {
          id,
          title: transcript.title,
          metadata: transcript.metadata,
        },
      });
    } catch (err) {
      console.error('Error fetching meeting summary:', err);
      res.status(500).json({ error: 'Failed to fetch meeting summary' });
    }
  },
);

export default router;
