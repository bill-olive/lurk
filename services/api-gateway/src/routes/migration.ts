import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { v4 as uuid } from 'uuid';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { migrationLimiter } from '../middleware/rate-limit.js';
import { collections } from '../lib/firestore.js';
import { publishEvent, publishAuditEvent, Topics } from '../lib/pubsub.js';

const router = Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const CreatePlanSchema = z.object({
  sourcePlatform: z.enum(['slack', 'google_drive', 'notion', 'email', 'confluence', 'jira', 'asana', 'linear']),
  mode: z.enum(['full', 'incremental', 'selective']),
  scope: z.object({
    channels: z.array(z.string()).optional(),
    folders: z.array(z.string()).optional(),
    workspaces: z.array(z.string()).optional(),
    dateRange: z.object({
      from: z.string().optional(),
      to: z.string().optional(),
    }).optional(),
    includeAttachments: z.boolean().optional().default(true),
    includeThreads: z.boolean().optional().default(true),
    excludePatterns: z.array(z.string()).optional().default([]),
  }),
  options: z.object({
    deduplication: z.boolean().optional().default(true),
    piiScrub: z.boolean().optional().default(true),
    preserveTimestamps: z.boolean().optional().default(true),
    batchSize: z.number().int().min(10).max(1000).optional().default(100),
    maxConcurrency: z.number().int().min(1).max(10).optional().default(3),
  }).optional().default({}),
});

const PlanParamsSchema = z.object({
  id: z.string().min(1),
});

const ApproveBodySchema = z.object({
  comment: z.string().max(1000).optional().default(''),
});

const ExecuteBodySchema = z.object({
  planId: z.string().min(1),
  dryRun: z.boolean().optional().default(false),
  startFromBatch: z.number().int().min(0).optional().default(0),
});

const StatusParamsSchema = z.object({
  id: z.string().min(1),
});

const RollbackBodySchema = z.object({
  reason: z.string().min(1).max(1000),
  rollbackTo: z.string().optional(), // specific batch to rollback to
});

// ---------------------------------------------------------------------------
// POST /v1/migration/plan — create migration plan
// ---------------------------------------------------------------------------

router.post(
  '/plan',
  requireAuth,
  requireRole('admin', 'org_admin'),
  migrationLimiter,
  validate({ body: CreatePlanSchema }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const body = req.body;

      const migrationId = uuid();
      const now = FieldValue.serverTimestamp();

      // Estimate scope size based on platform
      const estimatedArtifacts = estimateMigrationSize(body.sourcePlatform, body.scope);

      const plan = {
        phases: [
          {
            name: 'discovery',
            description: 'Crawl source platform to enumerate content',
            estimatedDuration: `${Math.ceil(estimatedArtifacts / 1000)} minutes`,
            status: 'pending',
          },
          {
            name: 'extraction',
            description: 'Extract and transform content into artifacts',
            estimatedDuration: `${Math.ceil(estimatedArtifacts / 100)} minutes`,
            status: 'pending',
          },
          {
            name: 'loading',
            description: 'Load artifacts into Lurk ledgers',
            estimatedDuration: `${Math.ceil(estimatedArtifacts / 500)} minutes`,
            status: 'pending',
          },
          {
            name: 'verification',
            description: 'Verify migrated content integrity',
            estimatedDuration: `${Math.ceil(estimatedArtifacts / 2000)} minutes`,
            status: 'pending',
          },
        ],
        estimatedArtifacts,
        estimatedBatches: Math.ceil(estimatedArtifacts / (body.options?.batchSize ?? 100)),
        sourcePlatform: body.sourcePlatform,
        options: body.options,
      };

      const migrationData = {
        orgId: user.orgId,
        sourcePlatform: body.sourcePlatform,
        mode: body.mode,
        scope: body.scope,
        status: 'planned' as const,
        plan,
        approvedBy: null,
        executionLog: [],
        artifactsImported: 0,
        errors: [],
        report: null,
        createdBy: user.uid,
        createdAt: now,
        completedAt: null,
      };

      await collections.migrations().doc(migrationId).set(migrationData);

      await Promise.all([
        publishEvent(Topics.MIGRATION_PLAN_CREATED, {
          orgId: user.orgId,
          data: {
            migrationId,
            sourcePlatform: body.sourcePlatform,
            mode: body.mode,
            estimatedArtifacts,
            createdBy: user.uid,
          },
        }),
        publishAuditEvent({
          orgId: user.orgId,
          actorId: user.uid,
          actorType: 'user',
          action: 'migration.plan.create',
          targetRef: migrationId,
          targetType: 'migration',
          metadata: { sourcePlatform: body.sourcePlatform, mode: body.mode },
        }),
      ]);

      res.status(201).json({
        migrationId,
        status: 'planned',
        plan,
      });
    } catch (err) {
      console.error('Error creating migration plan:', err);
      res.status(500).json({ error: 'Failed to create migration plan' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /v1/migration/plan/:id — get plan status
// ---------------------------------------------------------------------------

router.get(
  '/plan/:id',
  requireAuth,
  requireRole('admin', 'org_admin'),
  validate({ params: PlanParamsSchema }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;

      const doc = await collections.migrations().doc(id).get();
      if (!doc.exists) {
        res.status(404).json({ error: 'Migration plan not found' });
        return;
      }

      const migration = doc.data()!;
      if (migration.orgId !== user.orgId) {
        res.status(404).json({ error: 'Migration plan not found' });
        return;
      }

      res.json({
        id: doc.id,
        ...migration,
      });
    } catch (err) {
      console.error('Error fetching migration plan:', err);
      res.status(500).json({ error: 'Failed to fetch migration plan' });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /v1/migration/plan/:id/approve — approve plan
// ---------------------------------------------------------------------------

router.post(
  '/plan/:id/approve',
  requireAuth,
  requireRole('admin', 'org_admin'),
  migrationLimiter,
  validate({ params: PlanParamsSchema, body: ApproveBodySchema }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;
      const { comment } = req.body;

      const migrationRef = collections.migrations().doc(id);
      const doc = await migrationRef.get();

      if (!doc.exists) {
        res.status(404).json({ error: 'Migration plan not found' });
        return;
      }

      const migration = doc.data()!;
      if (migration.orgId !== user.orgId) {
        res.status(404).json({ error: 'Migration plan not found' });
        return;
      }

      if (migration.status !== 'planned' && migration.status !== 'draft') {
        res.status(400).json({ error: `Cannot approve migration with status: ${migration.status}` });
        return;
      }

      // Approver cannot be the creator
      if (migration.createdBy === user.uid) {
        res.status(400).json({ error: 'Migration creator cannot approve their own plan. A different admin must approve.' });
        return;
      }

      await migrationRef.update({
        status: 'approved',
        approvedBy: user.uid,
        executionLog: FieldValue.arrayUnion({
          timestamp: new Date().toISOString(),
          action: 'approved',
          actorId: user.uid,
          comment,
        }),
      });

      await Promise.all([
        publishEvent(Topics.MIGRATION_APPROVED, {
          orgId: user.orgId,
          data: {
            migrationId: id,
            approvedBy: user.uid,
            sourcePlatform: migration.sourcePlatform,
          },
        }),
        publishAuditEvent({
          orgId: user.orgId,
          actorId: user.uid,
          actorType: 'user',
          action: 'migration.plan.approve',
          targetRef: id,
          targetType: 'migration',
          metadata: { comment },
        }),
      ]);

      res.json({
        id,
        status: 'approved',
        approvedBy: user.uid,
      });
    } catch (err) {
      console.error('Error approving migration plan:', err);
      res.status(500).json({ error: 'Failed to approve migration plan' });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /v1/migration/execute — start execution
// ---------------------------------------------------------------------------

router.post(
  '/execute',
  requireAuth,
  requireRole('admin', 'org_admin'),
  migrationLimiter,
  validate({ body: ExecuteBodySchema }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { planId, dryRun, startFromBatch } = req.body;

      const migrationRef = collections.migrations().doc(planId);
      const doc = await migrationRef.get();

      if (!doc.exists) {
        res.status(404).json({ error: 'Migration plan not found' });
        return;
      }

      const migration = doc.data()!;
      if (migration.orgId !== user.orgId) {
        res.status(404).json({ error: 'Migration plan not found' });
        return;
      }

      if (migration.status !== 'approved') {
        res.status(400).json({ error: `Cannot execute migration with status: ${migration.status}. Must be approved first.` });
        return;
      }

      // Check no other migration is currently running for this org
      const runningMigrations = await collections.migrations()
        .where('orgId', '==', user.orgId)
        .where('status', '==', 'running')
        .limit(1)
        .get();

      if (!runningMigrations.empty) {
        res.status(409).json({ error: 'Another migration is already running for this organization' });
        return;
      }

      const newStatus = dryRun ? 'approved' : 'running';

      await migrationRef.update({
        status: newStatus,
        executionLog: FieldValue.arrayUnion({
          timestamp: new Date().toISOString(),
          action: dryRun ? 'dry_run_started' : 'execution_started',
          actorId: user.uid,
          startFromBatch,
          dryRun,
        }),
      });

      // Publish migration start event — the migration-service will pick this up
      await Promise.all([
        publishEvent(Topics.MIGRATION_STARTED, {
          orgId: user.orgId,
          data: {
            migrationId: planId,
            sourcePlatform: migration.sourcePlatform,
            mode: migration.mode,
            scope: migration.scope,
            dryRun,
            startFromBatch,
            startedBy: user.uid,
          },
        }),
        publishAuditEvent({
          orgId: user.orgId,
          actorId: user.uid,
          actorType: 'user',
          action: dryRun ? 'migration.dry_run' : 'migration.execute',
          targetRef: planId,
          targetType: 'migration',
          metadata: { dryRun, startFromBatch },
        }),
      ]);

      res.json({
        migrationId: planId,
        status: newStatus,
        dryRun,
        message: dryRun
          ? 'Dry run started. No data will be modified.'
          : 'Migration execution started. Monitor status at GET /v1/migration/status/:id',
      });
    } catch (err) {
      console.error('Error starting migration:', err);
      res.status(500).json({ error: 'Failed to start migration execution' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /v1/migration/status/:id — batch status
// ---------------------------------------------------------------------------

router.get(
  '/status/:id',
  requireAuth,
  requireRole('admin', 'org_admin'),
  validate({ params: StatusParamsSchema }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;

      const doc = await collections.migrations().doc(id).get();
      if (!doc.exists) {
        res.status(404).json({ error: 'Migration not found' });
        return;
      }

      const migration = doc.data()!;
      if (migration.orgId !== user.orgId) {
        res.status(404).json({ error: 'Migration not found' });
        return;
      }

      // Compute progress
      const plan = migration.plan as Record<string, unknown>;
      const estimatedTotal = (plan?.estimatedArtifacts as number) || 0;
      const imported = migration.artifactsImported || 0;
      const progress = estimatedTotal > 0 ? Math.min(100, Math.round((imported / estimatedTotal) * 100)) : 0;

      // Determine phase
      const phases = (plan?.phases as Array<{ name: string; status: string }>) || [];
      const currentPhase = phases.find((p) => p.status === 'running') || phases.find((p) => p.status === 'pending');

      res.json({
        id: doc.id,
        status: migration.status,
        sourcePlatform: migration.sourcePlatform,
        mode: migration.mode,
        progress,
        artifactsImported: imported,
        estimatedTotal,
        currentPhase: currentPhase?.name ?? (migration.status === 'completed' ? 'done' : 'unknown'),
        phases,
        errors: migration.errors.slice(-20), // Last 20 errors
        errorCount: migration.errors.length,
        executionLog: migration.executionLog.slice(-10), // Last 10 log entries
        createdAt: migration.createdAt,
        completedAt: migration.completedAt,
      });
    } catch (err) {
      console.error('Error fetching migration status:', err);
      res.status(500).json({ error: 'Failed to fetch migration status' });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /v1/migration/rollback/:id — rollback batch
// ---------------------------------------------------------------------------

router.post(
  '/rollback/:id',
  requireAuth,
  requireRole('admin', 'org_admin'),
  migrationLimiter,
  validate({ params: StatusParamsSchema, body: RollbackBodySchema }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;
      const { reason, rollbackTo } = req.body;

      const migrationRef = collections.migrations().doc(id);
      const doc = await migrationRef.get();

      if (!doc.exists) {
        res.status(404).json({ error: 'Migration not found' });
        return;
      }

      const migration = doc.data()!;
      if (migration.orgId !== user.orgId) {
        res.status(404).json({ error: 'Migration not found' });
        return;
      }

      if (migration.status !== 'running' && migration.status !== 'completed' && migration.status !== 'failed') {
        res.status(400).json({ error: `Cannot rollback migration with status: ${migration.status}` });
        return;
      }

      await migrationRef.update({
        status: 'rolled_back',
        executionLog: FieldValue.arrayUnion({
          timestamp: new Date().toISOString(),
          action: 'rollback_started',
          actorId: user.uid,
          reason,
          rollbackTo,
        }),
      });

      // Publish rollback event — migration-service handles the actual rollback
      await Promise.all([
        publishEvent(Topics.MIGRATION_ROLLED_BACK, {
          orgId: user.orgId,
          data: {
            migrationId: id,
            reason,
            rollbackTo,
            rolledBackBy: user.uid,
            artifactsToRollback: migration.artifactsImported,
          },
        }),
        publishAuditEvent({
          orgId: user.orgId,
          actorId: user.uid,
          actorType: 'user',
          action: 'migration.rollback',
          targetRef: id,
          targetType: 'migration',
          metadata: { reason, rollbackTo },
        }),
      ]);

      res.json({
        id,
        status: 'rolled_back',
        reason,
        message: 'Rollback initiated. Imported artifacts will be removed.',
      });
    } catch (err) {
      console.error('Error rolling back migration:', err);
      res.status(500).json({ error: 'Failed to rollback migration' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /v1/migration/report/:id — get report
// ---------------------------------------------------------------------------

router.get(
  '/report/:id',
  requireAuth,
  requireRole('admin', 'org_admin'),
  validate({ params: StatusParamsSchema }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;

      const doc = await collections.migrations().doc(id).get();
      if (!doc.exists) {
        res.status(404).json({ error: 'Migration not found' });
        return;
      }

      const migration = doc.data()!;
      if (migration.orgId !== user.orgId) {
        res.status(404).json({ error: 'Migration not found' });
        return;
      }

      if (!migration.report && migration.status !== 'completed') {
        // Generate an interim report
        const plan = migration.plan as Record<string, unknown>;

        const report = {
          migrationId: id,
          sourcePlatform: migration.sourcePlatform,
          mode: migration.mode,
          status: migration.status,
          summary: {
            totalArtifactsImported: migration.artifactsImported,
            estimatedTotal: (plan?.estimatedArtifacts as number) || 0,
            errorCount: migration.errors.length,
            startedAt: migration.executionLog.find(
              (e: Record<string, unknown>) => e.action === 'execution_started',
            )?.timestamp ?? null,
            completedAt: migration.completedAt,
          },
          errors: migration.errors.slice(-50),
          executionLog: migration.executionLog,
          createdBy: migration.createdBy,
          createdAt: migration.createdAt,
        };

        res.json(report);
        return;
      }

      res.json({
        migrationId: id,
        ...migration.report,
        status: migration.status,
        createdAt: migration.createdAt,
        completedAt: migration.completedAt,
      });
    } catch (err) {
      console.error('Error fetching migration report:', err);
      res.status(500).json({ error: 'Failed to fetch migration report' });
    }
  },
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function estimateMigrationSize(
  platform: string,
  scope: Record<string, unknown>,
): number {
  // Rough heuristic estimates based on platform and scope
  const baseEstimates: Record<string, number> = {
    slack: 5000,
    google_drive: 2000,
    notion: 3000,
    email: 10000,
    confluence: 4000,
    jira: 3000,
    asana: 2000,
    linear: 1500,
  };

  let estimate = baseEstimates[platform] ?? 2000;

  // Adjust based on scope
  const channels = scope.channels as string[] | undefined;
  if (channels?.length) {
    estimate = Math.round(estimate * (channels.length / 10)); // Assume avg org has ~10 relevant channels
  }

  const folders = scope.folders as string[] | undefined;
  if (folders?.length) {
    estimate = Math.round(estimate * (folders.length / 5));
  }

  return Math.max(estimate, 100); // Minimum 100
}

export default router;
