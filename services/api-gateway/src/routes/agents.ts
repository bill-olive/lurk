import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { v4 as uuid } from 'uuid';
import { requireAuth, requireServiceAccount } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { agentLimiter } from '../middleware/rate-limit.js';
import { collections } from '../lib/firestore.js';
import { uploadArtifactContent } from '../lib/storage.js';
import { publishEvent, publishAuditEvent, publishNotification, Topics } from '../lib/pubsub.js';

const router = Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const ForkBodySchema = z.object({
  upstreamArtifactId: z.string().min(1),
  reason: z.string().min(1).max(1000),
  confidence: z.number().min(0).max(1),
  branchName: z.string().optional(),
});

const AgentCommitBodySchema = z.object({
  forkId: z.string().min(1),
  artifactId: z.string().min(1),
  content: z.string().optional(),
  contentBase64: z.string().optional(),
  message: z.string().min(1).max(500),
  version: z.number().int().min(1),
});

const OpenPRBodySchema = z.object({
  forkId: z.string().min(1),
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional().default(''),
  diff: z.string(),
  changeSummary: z.string().max(2000).optional().default(''),
  confidence: z.number().min(0).max(1),
  justification: z.string().max(2000).optional().default(''),
  sourceRefs: z.array(z.string()).optional().default([]),
  voiceNarrationUrl: z.string().url().optional(),
  category: z.string().optional(),
});

const SynthesizeBodySchema = z.object({
  title: z.string().min(1).max(500),
  type: z.string().min(1),
  content: z.string(),
  sourceArtifactIds: z.array(z.string()).min(1),
  targetLedgerId: z.string().min(1),
  tags: z.array(z.string()).optional().default([]),
  metadata: z.record(z.unknown()).optional().default({}),
  teamIds: z.array(z.string()).optional().default([]),
});

const ScopeQuerySchema = z.object({
  types: z.string().optional(),  // comma-separated artifact types
  teamIds: z.string().optional(), // comma-separated team IDs
  sensitivity: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

const CustomerHealthBodySchema = z.object({
  customerId: z.string().min(1),
  customerName: z.string().min(1),
  healthScore: z.number().min(0).max(100),
  trend: z.enum(['improving', 'stable', 'declining']),
  signals: z.array(z.record(z.unknown())).optional().default([]),
  recommendations: z.array(z.string()).optional().default([]),
  alertLevel: z.enum(['green', 'yellow', 'red']),
});

const CalendarReviewBodySchema = z.object({
  userId: z.string().min(1),
  recommendations: z.array(
    z.object({
      eventId: z.string().optional(),
      action: z.enum(['cancel', 'shorten', 'reschedule', 'convert_to_async', 'keep']),
      reason: z.string(),
      estimatedTimeSaved: z.number().optional(), // minutes
      confidence: z.number().min(0).max(1),
    }),
  ).min(1),
  summary: z.string().max(2000),
  periodStart: z.string(),
  periodEnd: z.string(),
});

const AnalyticsReportBodySchema = z.object({
  reportType: z.string().min(1),
  period: z.object({
    start: z.string(),
    end: z.string(),
  }),
  metrics: z.record(z.unknown()),
  insights: z.array(z.string()).optional().default([]),
  recommendations: z.array(z.string()).optional().default([]),
  targetLedgerId: z.string().optional(),
  teamIds: z.array(z.string()).optional().default([]),
});

// ---------------------------------------------------------------------------
// POST /v1/agent/fork — create fork
// ---------------------------------------------------------------------------

router.post(
  '/fork',
  requireAuth,
  requireServiceAccount,
  agentLimiter,
  validate({ body: ForkBodySchema }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const agent = req.user!;
      const { upstreamArtifactId, reason, confidence, branchName } = req.body;

      // Verify upstream artifact exists and agent has read access
      const upstreamDoc = await collections.artifacts().doc(upstreamArtifactId).get();
      if (!upstreamDoc.exists) {
        res.status(404).json({ error: 'Upstream artifact not found' });
        return;
      }

      const upstream = upstreamDoc.data()!;
      if (upstream.orgId !== agent.orgId) {
        res.status(403).json({ error: 'Artifact is not in the agent\'s organization' });
        return;
      }

      // Create fork IDs
      const forkId = uuid();
      const forkBranchId = branchName || `agent/${agent.uid}/${forkId.slice(0, 8)}`;
      const forkArtifactId = uuid();
      const now = FieldValue.serverTimestamp();

      // Create the forked artifact (copy of upstream)
      const forkArtifactData = {
        ...upstream,
        forkedFrom: upstreamArtifactId,
        authorId: agent.uid,
        ownerIds: [agent.uid],
        branchId: forkBranchId,
        version: upstream.version,
        parentVersion: upstream.version,
        capturedAt: now,
        committedAt: now,
      };

      // Create the fork record
      const forkData = {
        orgId: agent.orgId,
        upstreamArtifactId,
        upstreamVersion: upstream.version,
        upstreamLedgerId: upstream.ledgerId,
        forkLedgerId: upstream.ledgerId, // Fork lives in the same ledger for simplicity
        forkBranchId,
        artifactId: forkArtifactId,
        agentId: agent.uid,
        agentType: 'agent',
        reason,
        confidence,
        status: 'open' as const,
        createdAt: now,
        updatedAt: now,
      };

      // Write both in a batch
      const batch = collections.artifacts().firestore.batch();
      batch.set(collections.artifacts().doc(forkArtifactId), forkArtifactData);
      batch.set(collections.forks().doc(forkId), forkData);

      // Add branch to ledger if it doesn't exist
      const ledgerRef = collections.ledgers().doc(upstream.ledgerId);
      batch.update(ledgerRef, {
        branches: FieldValue.arrayUnion({
          id: forkBranchId,
          name: forkBranchId,
          head: '',
          createdAt: new Date().toISOString(),
        }),
      });

      await batch.commit();

      // Publish events
      await Promise.all([
        publishEvent(Topics.AGENT_FORK_CREATED, {
          orgId: agent.orgId,
          data: {
            forkId,
            agentId: agent.uid,
            upstreamArtifactId,
            forkArtifactId,
            reason,
            confidence,
          },
        }),
        publishAuditEvent({
          orgId: agent.orgId,
          actorId: agent.uid,
          actorType: 'agent',
          action: 'agent.fork',
          targetRef: upstreamArtifactId,
          targetType: 'artifact',
          metadata: { forkId, reason, confidence },
        }),
      ]);

      res.status(201).json({
        forkId,
        forkArtifactId,
        forkBranchId,
        upstreamArtifactId,
        upstreamVersion: upstream.version,
      });
    } catch (err) {
      console.error('Error creating fork:', err);
      res.status(500).json({ error: 'Failed to create fork' });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /v1/agent/commit — commit to fork
// ---------------------------------------------------------------------------

router.post(
  '/commit',
  requireAuth,
  requireServiceAccount,
  agentLimiter,
  validate({ body: AgentCommitBodySchema }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const agent = req.user!;
      const { forkId, artifactId, content, contentBase64, message, version } = req.body;

      // Verify fork exists and belongs to this agent
      const forkDoc = await collections.forks().doc(forkId).get();
      if (!forkDoc.exists) {
        res.status(404).json({ error: 'Fork not found' });
        return;
      }

      const fork = forkDoc.data()!;
      if (fork.agentId !== agent.uid) {
        res.status(403).json({ error: 'Fork does not belong to this agent' });
        return;
      }

      if (fork.status !== 'open') {
        res.status(400).json({ error: `Cannot commit to a fork with status: ${fork.status}` });
        return;
      }

      // Upload content
      let contentHash = '';
      if (content || contentBase64) {
        const contentBuffer = contentBase64
          ? Buffer.from(contentBase64, 'base64')
          : Buffer.from(content!, 'utf-8');
        const result = await uploadArtifactContent(agent.orgId, artifactId, version, contentBuffer);
        contentHash = result.contentHash;
      }

      const commitHash = uuid();
      const now = FieldValue.serverTimestamp();

      // Write commit and update artifact
      const batch = collections.artifacts().firestore.batch();

      batch.update(collections.artifacts().doc(artifactId), {
        contentHash,
        version,
        commitHash,
        committedAt: now,
      });

      batch.set(collections.commits().doc(commitHash), {
        ledgerId: fork.forkLedgerId,
        artifactId,
        version,
        parentHash: fork.upstreamVersion ? String(fork.upstreamVersion) : null,
        message,
        authorId: agent.uid,
        authorType: 'agent' as const,
        timestamp: now,
        signature: '',
        policyVersion: '',
      });

      batch.update(collections.forks().doc(forkId), {
        updatedAt: now,
      });

      await batch.commit();

      // Publish events
      await Promise.all([
        publishEvent(Topics.AGENT_COMMIT, {
          orgId: agent.orgId,
          data: { forkId, artifactId, commitHash, agentId: agent.uid, version, message },
        }),
        publishAuditEvent({
          orgId: agent.orgId,
          actorId: agent.uid,
          actorType: 'agent',
          action: 'agent.commit',
          targetRef: artifactId,
          targetType: 'artifact',
          metadata: { forkId, commitHash, version },
        }),
      ]);

      res.status(201).json({
        commitHash,
        artifactId,
        forkId,
        version,
      });
    } catch (err) {
      console.error('Error committing to fork:', err);
      res.status(500).json({ error: 'Failed to commit to fork' });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /v1/agent/pr/open — open PR
// ---------------------------------------------------------------------------

router.post(
  '/pr/open',
  requireAuth,
  requireServiceAccount,
  agentLimiter,
  validate({ body: OpenPRBodySchema }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const agent = req.user!;
      const body = req.body;

      // Verify fork exists
      const forkDoc = await collections.forks().doc(body.forkId).get();
      if (!forkDoc.exists) {
        res.status(404).json({ error: 'Fork not found' });
        return;
      }

      const fork = forkDoc.data()!;
      if (fork.agentId !== agent.uid) {
        res.status(403).json({ error: 'Fork does not belong to this agent' });
        return;
      }

      if (fork.status !== 'open') {
        res.status(400).json({ error: `Cannot open PR for fork with status: ${fork.status}` });
        return;
      }

      // Check YOLO eligibility
      const targetLedgerDoc = await collections.ledgers().doc(fork.upstreamLedgerId).get();
      let autoMergeEligible = false;

      if (targetLedgerDoc.exists) {
        const targetLedger = targetLedgerDoc.data()!;
        const yolo = targetLedger.yoloConfig;

        if (yolo?.enabled) {
          // Check basic YOLO criteria
          const meetsConfidence = body.confidence >= (yolo.minConfidence ?? 0.8);
          const meetsDiffSize = !yolo.maxDiffSize || body.diff.split('\n').length <= yolo.maxDiffSize;
          const agentTypeAllowed = !yolo.allowedAgentTypes?.length || yolo.allowedAgentTypes.includes('agent');
          const agentIdAllowed = !yolo.allowedAgentIds?.length || yolo.allowedAgentIds.includes(agent.uid);
          const categoryAllowed = !body.category || !yolo.allowedCategories?.length || yolo.allowedCategories.includes(body.category);

          autoMergeEligible = meetsConfidence && meetsDiffSize && agentTypeAllowed && agentIdAllowed && categoryAllowed;
        }
      }

      const prId = uuid();
      const now = FieldValue.serverTimestamp();

      const prData = {
        orgId: agent.orgId,
        forkId: body.forkId,
        sourceArtifactId: fork.artifactId,
        targetArtifactId: fork.upstreamArtifactId,
        targetLedgerId: fork.upstreamLedgerId,
        title: body.title,
        description: body.description,
        diff: body.diff,
        changeSummary: body.changeSummary,
        voiceNarrationUrl: body.voiceNarrationUrl ?? null,
        agentId: agent.uid,
        agentType: 'agent',
        confidence: body.confidence,
        justification: body.justification,
        sourceRefs: body.sourceRefs,
        status: 'open' as const,
        reviewerId: null,
        reviewAction: null,
        reviewComment: null,
        reviewedAt: null,
        autoMergeEligible,
        autoMergedAt: null,
        createdAt: now,
        mergedAt: null,
        closedAt: null,
      };

      await collections.pullRequests().doc(prId).set(prData);

      // Publish events
      const eventPromises: Promise<string>[] = [
        publishEvent(Topics.PR_OPENED, {
          orgId: agent.orgId,
          data: {
            prId,
            forkId: body.forkId,
            agentId: agent.uid,
            sourceArtifactId: fork.artifactId,
            targetArtifactId: fork.upstreamArtifactId,
            confidence: body.confidence,
            autoMergeEligible,
          },
        }),
        publishAuditEvent({
          orgId: agent.orgId,
          actorId: agent.uid,
          actorType: 'agent',
          action: 'agent.pr.open',
          targetRef: prId,
          targetType: 'pullRequest',
          metadata: { forkId: body.forkId, confidence: body.confidence },
        }),
      ];

      // Notify target artifact owner
      const targetArtifactDoc = await collections.artifacts().doc(fork.upstreamArtifactId).get();
      if (targetArtifactDoc.exists) {
        const targetArtifact = targetArtifactDoc.data()!;
        eventPromises.push(
          publishNotification({
            orgId: agent.orgId,
            userId: targetArtifact.authorId,
            type: autoMergeEligible ? 'pr_auto_merge_eligible' : 'pr_opened',
            title: `New PR: ${body.title}`,
            body: body.changeSummary || body.description || 'An agent has proposed changes to your artifact.',
            sourceRef: prId,
          }),
        );
      }

      await Promise.all(eventPromises);

      // If YOLO auto-merge is eligible and the target ledger allows it,
      // attempt immediate auto-merge
      let autoMerged = false;
      if (autoMergeEligible && targetLedgerDoc.exists) {
        const targetLedger = targetLedgerDoc.data()!;
        // Check additional artifact-level constraints
        if (targetArtifactDoc.exists) {
          const targetArtifact = targetArtifactDoc.data()!;
          const yolo = targetLedger.yoloConfig;

          const sensitivityLevels = ['public', 'internal', 'confidential', 'restricted'];
          const maxLevel = sensitivityLevels.indexOf(yolo?.maxSensitivity ?? 'internal');
          const artifactLevel = sensitivityLevels.indexOf(targetArtifact.sensitivity);
          const sensitivityOk = artifactLevel <= maxLevel;

          const customerFacingOk = !yolo?.excludeCustomerFacing || !targetArtifact.customerFacing;
          const tagsOk = !yolo?.excludeTags?.length || !targetArtifact.tags.some((t: string) => yolo.excludeTags.includes(t));

          if (sensitivityOk && customerFacingOk && tagsOk) {
            // Auto-merge
            const mergeNow = FieldValue.serverTimestamp();
            const batch = collections.pullRequests().firestore.batch();

            batch.update(collections.pullRequests().doc(prId), {
              status: 'merged',
              autoMergedAt: mergeNow,
              mergedAt: mergeNow,
              reviewAction: 'approve',
              reviewComment: 'Auto-merged via YOLO mode',
            });

            // Update target artifact
            batch.update(collections.artifacts().doc(fork.upstreamArtifactId), {
              version: FieldValue.increment(1),
              committedAt: mergeNow,
            });

            batch.update(collections.forks().doc(body.forkId), {
              status: 'merged',
              updatedAt: mergeNow,
            });

            await batch.commit();
            autoMerged = true;

            await publishEvent(Topics.PR_AUTO_MERGED, {
              orgId: agent.orgId,
              data: { prId, agentId: agent.uid, forkId: body.forkId },
            });
          }
        }
      }

      res.status(201).json({
        prId,
        forkId: body.forkId,
        status: autoMerged ? 'merged' : 'open',
        autoMergeEligible,
        autoMerged,
      });
    } catch (err) {
      console.error('Error opening PR:', err);
      res.status(500).json({ error: 'Failed to open PR' });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /v1/agent/synthesize — create meta artifact
// ---------------------------------------------------------------------------

router.post(
  '/synthesize',
  requireAuth,
  requireServiceAccount,
  agentLimiter,
  validate({ body: SynthesizeBodySchema }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const agent = req.user!;
      const { title, type, content, sourceArtifactIds, targetLedgerId, tags, metadata, teamIds } = req.body;

      // Verify target ledger
      const ledgerDoc = await collections.ledgers().doc(targetLedgerId).get();
      if (!ledgerDoc.exists) {
        res.status(404).json({ error: 'Target ledger not found' });
        return;
      }

      const ledger = ledgerDoc.data()!;
      if (ledger.orgId !== agent.orgId) {
        res.status(403).json({ error: 'Ledger is not in the agent\'s organization' });
        return;
      }

      // Verify all source artifacts exist
      const sourceArtifacts = await Promise.all(
        sourceArtifactIds.map((id: string) => collections.artifacts().doc(id).get()),
      );

      const missingIds = sourceArtifactIds.filter(
        (_: string, i: number) => !sourceArtifacts[i].exists,
      );

      if (missingIds.length > 0) {
        res.status(400).json({ error: `Source artifacts not found: ${missingIds.join(', ')}` });
        return;
      }

      // Create synthesized artifact
      const artifactId = uuid();
      const commitHash = uuid();
      const version = 1;
      const now = FieldValue.serverTimestamp();

      // Upload content
      const { contentHash } = await uploadArtifactContent(
        agent.orgId,
        artifactId,
        version,
        Buffer.from(content, 'utf-8'),
        'text/plain',
      );

      const artifactData = {
        ledgerId: targetLedgerId,
        orgId: agent.orgId,
        type,
        title,
        sourceUrl: '',
        sourceApp: 'lurk-agent',
        captureMethod: 'synthesis',
        contentHash,
        featureBundle: {},
        metadata: {
          ...metadata,
          synthesizedFrom: sourceArtifactIds,
          synthesizedBy: agent.uid,
        },
        tags,
        customerFacing: false,
        customerRefs: [],
        sensitivity: 'internal' as const,
        authorId: agent.uid,
        ownerIds: [agent.uid, ledger.userId],
        teamIds,
        version,
        parentVersion: null,
        commitHash,
        branchId: 'main',
        accessTier: 'standard',
        aclOverrides: [],
        relatedArtifacts: sourceArtifactIds,
        capturedAt: now,
        committedAt: now,
      };

      const commitData = {
        ledgerId: targetLedgerId,
        artifactId,
        version,
        parentHash: ledger.head || null,
        message: `Synthesized: ${title}`,
        authorId: agent.uid,
        authorType: 'agent' as const,
        timestamp: now,
        signature: '',
        policyVersion: '',
      };

      const batch = collections.artifacts().firestore.batch();
      batch.set(collections.artifacts().doc(artifactId), artifactData);
      batch.set(collections.commits().doc(commitHash), commitData);
      batch.update(collections.ledgers().doc(targetLedgerId), {
        head: commitHash,
        artifactCount: FieldValue.increment(1),
        lastCommitAt: now,
      });
      await batch.commit();

      await Promise.all([
        publishEvent(Topics.AGENT_SYNTHESIZED, {
          orgId: agent.orgId,
          data: {
            artifactId,
            agentId: agent.uid,
            sourceArtifactIds,
            targetLedgerId,
            type,
            title,
          },
        }),
        publishAuditEvent({
          orgId: agent.orgId,
          actorId: agent.uid,
          actorType: 'agent',
          action: 'agent.synthesize',
          targetRef: artifactId,
          targetType: 'artifact',
          metadata: { sourceArtifactIds },
        }),
      ]);

      res.status(201).json({
        artifactId,
        commitHash,
        version,
        ledgerId: targetLedgerId,
      });
    } catch (err) {
      console.error('Error synthesizing artifact:', err);
      res.status(500).json({ error: 'Failed to synthesize artifact' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /v1/agent/scope — resolve accessible artifacts
// ---------------------------------------------------------------------------

router.get(
  '/scope',
  requireAuth,
  requireServiceAccount,
  agentLimiter,
  validate({ query: ScopeQuerySchema }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const agent = req.user!;
      const { types, teamIds, sensitivity, limit } = req.query as unknown as z.infer<typeof ScopeQuerySchema>;

      // Load agent config to determine read scope
      const agentDoc = await collections.agents().doc(agent.uid).get();
      if (!agentDoc.exists) {
        res.status(404).json({ error: 'Agent configuration not found' });
        return;
      }

      const agentConfig = agentDoc.data()!;
      const readScope = agentConfig.readScope || {};

      // Build query based on agent's read scope and filters
      let query = collections.artifacts()
        .where('orgId', '==', agent.orgId);

      if (types) {
        const typeList = types.split(',').map((t: string) => t.trim());
        if (typeList.length === 1) {
          query = query.where('type', '==', typeList[0]);
        }
        // For multiple types, we filter client-side
      }

      if (teamIds) {
        const teamList = teamIds.split(',').map((t: string) => t.trim());
        if (teamList.length === 1) {
          query = query.where('teamIds', 'array-contains', teamList[0]);
        }
      }

      if (sensitivity) {
        query = query.where('sensitivity', '==', sensitivity);
      }

      query = query.orderBy('committedAt', 'desc').limit(limit!);

      const snapshot = await query.get();

      // Apply additional scope filters
      const typeList = types ? types.split(',').map((t: string) => t.trim()) : [];
      const teamList = teamIds ? teamIds.split(',').map((t: string) => t.trim()) : [];

      const artifacts = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((artifact) => {
          // Filter by types if multiple
          if (typeList.length > 1 && !typeList.includes(artifact.type)) return false;
          // Filter by teams if multiple
          if (teamList.length > 1 && !artifact.teamIds.some((tid: string) => teamList.includes(tid))) return false;
          // Check agent's read scope restrictions
          if (readScope.excludeTypes && (readScope.excludeTypes as string[]).includes(artifact.type)) return false;
          if (readScope.maxSensitivity) {
            const levels = ['public', 'internal', 'confidential', 'restricted'];
            const maxIdx = levels.indexOf(readScope.maxSensitivity as string);
            const artIdx = levels.indexOf(artifact.sensitivity);
            if (artIdx > maxIdx) return false;
          }
          return true;
        });

      res.json({
        agentId: agent.uid,
        artifacts: artifacts.map((a) => ({
          id: a.id,
          type: a.type,
          title: a.title,
          authorId: a.authorId,
          teamIds: a.teamIds,
          sensitivity: a.sensitivity,
          version: a.version,
          committedAt: a.committedAt,
          tags: a.tags,
        })),
        count: artifacts.length,
      });
    } catch (err) {
      console.error('Error resolving agent scope:', err);
      res.status(500).json({ error: 'Failed to resolve agent scope' });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /v1/agent/customer-health — submit customer health score
// ---------------------------------------------------------------------------

router.post(
  '/customer-health',
  requireAuth,
  requireServiceAccount,
  agentLimiter,
  validate({ body: CustomerHealthBodySchema }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const agent = req.user!;
      const body = req.body;
      const now = FieldValue.serverTimestamp();

      const healthId = body.customerId;

      const healthData = {
        orgId: agent.orgId,
        customerId: body.customerId,
        customerName: body.customerName,
        healthScore: body.healthScore,
        trend: body.trend,
        signals: body.signals,
        recommendations: body.recommendations,
        alertLevel: body.alertLevel,
        lastUpdatedAt: now,
        agentId: agent.uid,
      };

      await collections.customerHealth().doc(healthId).set(healthData, { merge: true });

      await Promise.all([
        publishEvent(Topics.CUSTOMER_HEALTH_UPDATED, {
          orgId: agent.orgId,
          data: {
            customerId: body.customerId,
            healthScore: body.healthScore,
            trend: body.trend,
            alertLevel: body.alertLevel,
            agentId: agent.uid,
          },
        }),
        publishAuditEvent({
          orgId: agent.orgId,
          actorId: agent.uid,
          actorType: 'agent',
          action: 'customer-health.update',
          targetRef: healthId,
          targetType: 'customerHealth',
          metadata: { healthScore: body.healthScore, alertLevel: body.alertLevel },
        }),
      ]);

      // Trigger notification if alert level is red
      if (body.alertLevel === 'red') {
        // Notify org admins
        const admins = await collections.users()
          .where('orgId', '==', agent.orgId)
          .where('roles', 'array-contains', 'admin')
          .limit(10)
          .get();

        await Promise.all(
          admins.docs.map((admin) =>
            publishNotification({
              orgId: agent.orgId,
              userId: admin.id,
              type: 'customer_health_alert',
              title: `Customer Health Alert: ${body.customerName}`,
              body: `Health score dropped to ${body.healthScore}. Trend: ${body.trend}. ${body.recommendations[0] || ''}`,
              sourceRef: healthId,
            }),
          ),
        );
      }

      res.status(200).json({
        customerId: body.customerId,
        healthScore: body.healthScore,
        alertLevel: body.alertLevel,
      });
    } catch (err) {
      console.error('Error submitting customer health:', err);
      res.status(500).json({ error: 'Failed to submit customer health score' });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /v1/agent/calendar-review — submit calendar recommendations
// ---------------------------------------------------------------------------

router.post(
  '/calendar-review',
  requireAuth,
  requireServiceAccount,
  agentLimiter,
  validate({ body: CalendarReviewBodySchema }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const agent = req.user!;
      const body = req.body;

      // Create an artifact for the calendar review
      const artifactId = uuid();
      const commitHash = uuid();
      const now = FieldValue.serverTimestamp();

      // Get user's ledger
      const userDoc = await collections.users().doc(body.userId).get();
      if (!userDoc.exists) {
        res.status(404).json({ error: 'Target user not found' });
        return;
      }

      const userData = userDoc.data()!;
      if (userData.orgId !== agent.orgId) {
        res.status(403).json({ error: 'User is not in the agent\'s organization' });
        return;
      }

      const ledgerId = userData.ledgerId;

      const content = JSON.stringify({
        type: 'calendar_review',
        userId: body.userId,
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
        summary: body.summary,
        recommendations: body.recommendations,
        generatedBy: agent.uid,
        generatedAt: new Date().toISOString(),
      }, null, 2);

      const { contentHash } = await uploadArtifactContent(
        agent.orgId,
        artifactId,
        1,
        Buffer.from(content, 'utf-8'),
        'application/json',
      );

      const totalTimeSaved = body.recommendations.reduce(
        (sum: number, r: { estimatedTimeSaved?: number }) => sum + (r.estimatedTimeSaved || 0),
        0,
      );

      const batch = collections.artifacts().firestore.batch();

      batch.set(collections.artifacts().doc(artifactId), {
        ledgerId,
        orgId: agent.orgId,
        type: 'calendar_review',
        title: `Calendar Review: ${body.periodStart} to ${body.periodEnd}`,
        sourceUrl: '',
        sourceApp: 'lurk-agent',
        captureMethod: 'agent',
        contentHash,
        featureBundle: {},
        metadata: {
          userId: body.userId,
          periodStart: body.periodStart,
          periodEnd: body.periodEnd,
          totalRecommendations: body.recommendations.length,
          estimatedTimeSaved: totalTimeSaved,
        },
        tags: ['calendar-review', 'agent-generated'],
        customerFacing: false,
        customerRefs: [],
        sensitivity: 'internal',
        authorId: agent.uid,
        ownerIds: [agent.uid, body.userId],
        teamIds: [],
        version: 1,
        parentVersion: null,
        commitHash,
        branchId: 'main',
        accessTier: 'standard',
        aclOverrides: [],
        relatedArtifacts: [],
        capturedAt: now,
        committedAt: now,
      });

      batch.set(collections.commits().doc(commitHash), {
        ledgerId,
        artifactId,
        version: 1,
        parentHash: null,
        message: `Calendar review for ${body.periodStart} to ${body.periodEnd}`,
        authorId: agent.uid,
        authorType: 'agent' as const,
        timestamp: now,
        signature: '',
        policyVersion: '',
      });

      await batch.commit();

      // Publish events
      await Promise.all([
        publishEvent(Topics.CALENDAR_REVIEW, {
          orgId: agent.orgId,
          data: {
            artifactId,
            userId: body.userId,
            agentId: agent.uid,
            recommendations: body.recommendations.length,
            estimatedTimeSaved: totalTimeSaved,
          },
        }),
        publishNotification({
          orgId: agent.orgId,
          userId: body.userId,
          type: 'calendar_review',
          title: 'Calendar Review Available',
          body: `${body.recommendations.length} recommendations. Est. ${totalTimeSaved} min saved. ${body.summary.slice(0, 100)}`,
          sourceRef: artifactId,
        }),
      ]);

      res.status(201).json({
        artifactId,
        recommendations: body.recommendations.length,
        estimatedTimeSaved: totalTimeSaved,
      });
    } catch (err) {
      console.error('Error submitting calendar review:', err);
      res.status(500).json({ error: 'Failed to submit calendar review' });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /v1/agent/analytics-report — submit analytics report
// ---------------------------------------------------------------------------

router.post(
  '/analytics-report',
  requireAuth,
  requireServiceAccount,
  agentLimiter,
  validate({ body: AnalyticsReportBodySchema }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const agent = req.user!;
      const body = req.body;

      // Determine target ledger
      let targetLedgerId = body.targetLedgerId;
      if (!targetLedgerId) {
        // Find org's default analytics ledger or use agent's owner's ledger
        const agentDoc = await collections.agents().doc(agent.uid).get();
        if (agentDoc.exists) {
          const agentConfig = agentDoc.data()!;
          const ownerDoc = await collections.users().doc(agentConfig.ownerId).get();
          if (ownerDoc.exists) {
            targetLedgerId = ownerDoc.data()!.ledgerId;
          }
        }
      }

      if (!targetLedgerId) {
        res.status(400).json({ error: 'No target ledger specified and could not resolve one' });
        return;
      }

      const artifactId = uuid();
      const commitHash = uuid();
      const now = FieldValue.serverTimestamp();

      const content = JSON.stringify({
        reportType: body.reportType,
        period: body.period,
        metrics: body.metrics,
        insights: body.insights,
        recommendations: body.recommendations,
        generatedBy: agent.uid,
        generatedAt: new Date().toISOString(),
      }, null, 2);

      const { contentHash } = await uploadArtifactContent(
        agent.orgId,
        artifactId,
        1,
        Buffer.from(content, 'utf-8'),
        'application/json',
      );

      const batch = collections.artifacts().firestore.batch();

      batch.set(collections.artifacts().doc(artifactId), {
        ledgerId: targetLedgerId,
        orgId: agent.orgId,
        type: 'analytics_report',
        title: `${body.reportType} Report: ${body.period.start} to ${body.period.end}`,
        sourceUrl: '',
        sourceApp: 'lurk-agent',
        captureMethod: 'agent',
        contentHash,
        featureBundle: {},
        metadata: {
          reportType: body.reportType,
          period: body.period,
          metricsCount: Object.keys(body.metrics).length,
          insightsCount: body.insights.length,
        },
        tags: ['analytics', 'report', 'agent-generated', body.reportType],
        customerFacing: false,
        customerRefs: [],
        sensitivity: 'internal',
        authorId: agent.uid,
        ownerIds: [agent.uid],
        teamIds: body.teamIds,
        version: 1,
        parentVersion: null,
        commitHash,
        branchId: 'main',
        accessTier: 'standard',
        aclOverrides: [],
        relatedArtifacts: [],
        capturedAt: now,
        committedAt: now,
      });

      batch.set(collections.commits().doc(commitHash), {
        ledgerId: targetLedgerId,
        artifactId,
        version: 1,
        parentHash: null,
        message: `Analytics report: ${body.reportType}`,
        authorId: agent.uid,
        authorType: 'agent' as const,
        timestamp: now,
        signature: '',
        policyVersion: '',
      });

      batch.update(collections.ledgers().doc(targetLedgerId), {
        artifactCount: FieldValue.increment(1),
        lastCommitAt: now,
      });

      await batch.commit();

      await Promise.all([
        publishEvent(Topics.ANALYTICS_REPORT, {
          orgId: agent.orgId,
          data: {
            artifactId,
            reportType: body.reportType,
            period: body.period,
            agentId: agent.uid,
            teamIds: body.teamIds,
          },
        }),
        publishAuditEvent({
          orgId: agent.orgId,
          actorId: agent.uid,
          actorType: 'agent',
          action: 'agent.analytics-report',
          targetRef: artifactId,
          targetType: 'artifact',
          metadata: { reportType: body.reportType },
        }),
      ]);

      res.status(201).json({
        artifactId,
        commitHash,
        reportType: body.reportType,
        ledgerId: targetLedgerId,
      });
    } catch (err) {
      console.error('Error submitting analytics report:', err);
      res.status(500).json({ error: 'Failed to submit analytics report' });
    }
  },
);

export default router;
