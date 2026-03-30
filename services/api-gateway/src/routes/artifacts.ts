import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { v4 as uuid } from 'uuid';
import { requireAuth } from '../middleware/auth.js';
import { validate, validateQuery } from '../middleware/validation.js';
import { writeLimiter, searchLimiter, defaultLimiter } from '../middleware/rate-limit.js';
import { collections } from '../lib/firestore.js';
import { uploadArtifactContent, downloadArtifactContent, generateDownloadUrl } from '../lib/storage.js';
import { publishEvent, publishAuditEvent, Topics } from '../lib/pubsub.js';

const router = Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const CommitArtifactSchema = z.object({
  title: z.string().min(1).max(500),
  type: z.string().min(1),
  content: z.string().optional(),
  contentBase64: z.string().optional(),
  sourceUrl: z.string().url().optional().default(''),
  sourceApp: z.string().optional().default(''),
  captureMethod: z.string().optional().default('api'),
  tags: z.array(z.string()).optional().default([]),
  customerFacing: z.boolean().optional().default(false),
  customerRefs: z.array(z.string()).optional().default([]),
  sensitivity: z.enum(['public', 'internal', 'confidential', 'restricted']).optional().default('internal'),
  metadata: z.record(z.unknown()).optional().default({}),
  branchId: z.string().optional().default('main'),
  parentVersion: z.number().int().optional().nullable().default(null),
  message: z.string().optional().default(''),
  teamIds: z.array(z.string()).optional().default([]),
  relatedArtifacts: z.array(z.string()).optional().default([]),
});

const BatchSyncSchema = z.object({
  artifacts: z.array(
    z.object({
      id: z.string().optional(),
      title: z.string().min(1).max(500),
      type: z.string().min(1),
      content: z.string().optional(),
      contentBase64: z.string().optional(),
      sourceUrl: z.string().url().optional().default(''),
      sourceApp: z.string().optional().default(''),
      captureMethod: z.string().optional().default('sync'),
      tags: z.array(z.string()).optional().default([]),
      customerFacing: z.boolean().optional().default(false),
      sensitivity: z.enum(['public', 'internal', 'confidential', 'restricted']).optional().default('internal'),
      metadata: z.record(z.unknown()).optional().default({}),
      version: z.number().int().optional().default(1),
      commitHash: z.string().optional(),
    }),
  ).min(1).max(100),
  ledgerId: z.string().optional(),
});

const GetArtifactParamsSchema = z.object({
  id: z.string().min(1),
});

const DiffQuerySchema = z.object({
  fromVersion: z.coerce.number().int().min(1),
  toVersion: z.coerce.number().int().min(1),
});

const HistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
});

const SearchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  type: z.string().optional(),
  tags: z.string().optional(), // comma-separated
  teamId: z.string().optional(),
  authorId: z.string().optional(),
  customerFacing: z.coerce.boolean().optional(),
  sensitivity: z.string().optional(),
  from: z.string().optional(), // ISO date
  to: z.string().optional(),   // ISO date
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  cursor: z.string().optional(),
});

// ---------------------------------------------------------------------------
// POST /v1/artifacts/commit — commit artifact to ledger
// ---------------------------------------------------------------------------

router.post(
  '/commit',
  requireAuth,
  writeLimiter,
  validate({ body: CommitArtifactSchema }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const body = req.body;

      // Resolve ledger
      const ledgerId = user.ledgerId;
      if (!ledgerId) {
        res.status(400).json({ error: 'User has no ledger assigned' });
        return;
      }

      const ledgerRef = collections.ledgers().doc(ledgerId);
      const ledgerDoc = await ledgerRef.get();
      if (!ledgerDoc.exists) {
        res.status(404).json({ error: 'Ledger not found' });
        return;
      }

      const ledger = ledgerDoc.data()!;
      if (ledger.orgId !== user.orgId) {
        res.status(403).json({ error: 'Ledger does not belong to your organization' });
        return;
      }

      // Create IDs
      const artifactId = uuid();
      const commitHash = uuid();
      const version = (body.parentVersion ?? 0) + 1;
      const now = FieldValue.serverTimestamp();

      // Upload content to GCS if provided
      let contentHash = '';
      if (body.content || body.contentBase64) {
        const contentBuffer = body.contentBase64
          ? Buffer.from(body.contentBase64, 'base64')
          : Buffer.from(body.content!, 'utf-8');
        const uploadResult = await uploadArtifactContent(user.orgId, artifactId, version, contentBuffer);
        contentHash = uploadResult.contentHash;
      }

      // Create artifact document
      const artifactData = {
        ledgerId,
        orgId: user.orgId,
        type: body.type,
        title: body.title,
        sourceUrl: body.sourceUrl,
        sourceApp: body.sourceApp,
        captureMethod: body.captureMethod,
        contentHash,
        featureBundle: {},
        metadata: body.metadata,
        tags: body.tags,
        customerFacing: body.customerFacing,
        customerRefs: body.customerRefs,
        sensitivity: body.sensitivity,
        authorId: user.uid,
        ownerIds: [user.uid],
        teamIds: body.teamIds,
        version,
        parentVersion: body.parentVersion,
        commitHash,
        branchId: body.branchId,
        accessTier: user.accessTier,
        aclOverrides: [],
        relatedArtifacts: body.relatedArtifacts,
        capturedAt: now,
        committedAt: now,
      };

      // Create commit document
      const commitData = {
        ledgerId,
        artifactId,
        version,
        parentHash: ledger.head || null,
        message: body.message || `Commit: ${body.title}`,
        authorId: user.uid,
        authorType: 'user' as const,
        timestamp: now,
        signature: '',
        policyVersion: '',
      };

      // Write in a batch
      const batch = collections.artifacts().firestore.batch();
      batch.set(collections.artifacts().doc(artifactId), artifactData);
      batch.set(collections.commits().doc(commitHash), commitData);
      batch.update(ledgerRef, {
        head: commitHash,
        artifactCount: FieldValue.increment(1),
        lastCommitAt: now,
      });
      await batch.commit();

      // Publish events
      await Promise.all([
        publishEvent(Topics.ARTIFACT_COMMITTED, {
          orgId: user.orgId,
          data: { artifactId, commitHash, ledgerId, authorId: user.uid, type: body.type, title: body.title },
        }),
        publishAuditEvent({
          orgId: user.orgId,
          actorId: user.uid,
          actorType: 'user',
          action: 'artifact.commit',
          targetRef: artifactId,
          targetType: 'artifact',
          metadata: { commitHash, version },
        }),
      ]);

      res.status(201).json({
        artifactId,
        commitHash,
        version,
        ledgerId,
      });
    } catch (err) {
      console.error('Error committing artifact:', err);
      res.status(500).json({ error: 'Failed to commit artifact' });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /v1/artifacts/sync — batch sync
// ---------------------------------------------------------------------------

router.post(
  '/sync',
  requireAuth,
  writeLimiter,
  validate({ body: BatchSyncSchema }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { artifacts } = req.body;
      const ledgerId = req.body.ledgerId || user.ledgerId;

      if (!ledgerId) {
        res.status(400).json({ error: 'No ledger specified' });
        return;
      }

      // Verify ledger ownership
      const ledgerDoc = await collections.ledgers().doc(ledgerId).get();
      if (!ledgerDoc.exists) {
        res.status(404).json({ error: 'Ledger not found' });
        return;
      }

      const ledger = ledgerDoc.data()!;
      if (ledger.orgId !== user.orgId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const results: Array<{ artifactId: string; commitHash: string; version: number; status: string }> = [];
      const errors: Array<{ index: number; error: string }> = [];

      // Process each artifact
      for (let i = 0; i < artifacts.length; i++) {
        try {
          const item = artifacts[i];
          const artifactId = item.id || uuid();
          const commitHash = item.commitHash || uuid();
          const version = item.version || 1;
          const now = FieldValue.serverTimestamp();

          // Upload content if provided
          let contentHash = '';
          if (item.content || item.contentBase64) {
            const contentBuffer = item.contentBase64
              ? Buffer.from(item.contentBase64, 'base64')
              : Buffer.from(item.content!, 'utf-8');
            const result = await uploadArtifactContent(user.orgId, artifactId, version, contentBuffer);
            contentHash = result.contentHash;
          }

          const batch = collections.artifacts().firestore.batch();

          batch.set(collections.artifacts().doc(artifactId), {
            ledgerId,
            orgId: user.orgId,
            type: item.type,
            title: item.title,
            sourceUrl: item.sourceUrl,
            sourceApp: item.sourceApp,
            captureMethod: item.captureMethod,
            contentHash,
            featureBundle: {},
            metadata: item.metadata,
            tags: item.tags,
            customerFacing: item.customerFacing,
            customerRefs: [],
            sensitivity: item.sensitivity,
            authorId: user.uid,
            ownerIds: [user.uid],
            teamIds: [],
            version,
            parentVersion: null,
            commitHash,
            branchId: 'main',
            accessTier: user.accessTier,
            aclOverrides: [],
            relatedArtifacts: [],
            capturedAt: now,
            committedAt: now,
          }, { merge: true });

          batch.set(collections.commits().doc(commitHash), {
            ledgerId,
            artifactId,
            version,
            parentHash: null,
            message: `Sync: ${item.title}`,
            authorId: user.uid,
            authorType: 'user' as const,
            timestamp: now,
            signature: '',
            policyVersion: '',
          });

          await batch.commit();

          results.push({ artifactId, commitHash, version, status: 'synced' });
        } catch (itemErr) {
          errors.push({ index: i, error: String(itemErr) });
        }
      }

      // Update ledger sync state
      await collections.ledgers().doc(ledgerId).update({
        artifactCount: FieldValue.increment(results.length),
        lastCommitAt: FieldValue.serverTimestamp(),
        'syncState.status': 'synced',
        'syncState.lastSyncAt': FieldValue.serverTimestamp(),
      });

      // Publish sync event
      await publishEvent(Topics.ARTIFACT_SYNCED, {
        orgId: user.orgId,
        data: { ledgerId, count: results.length, userId: user.uid },
      });

      res.status(200).json({
        synced: results.length,
        failed: errors.length,
        results,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (err) {
      console.error('Error syncing artifacts:', err);
      res.status(500).json({ error: 'Failed to sync artifacts' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /v1/artifacts/search — search artifacts
// ---------------------------------------------------------------------------

router.get(
  '/search',
  requireAuth,
  searchLimiter,
  validateQuery(SearchQuerySchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { q, type, tags, teamId, authorId, customerFacing, sensitivity, from, to, limit, cursor } = req.query as z.infer<typeof SearchQuerySchema>;

      // Build Firestore query scoped to user's org
      let query = collections.artifacts()
        .where('orgId', '==', user.orgId);

      if (type) {
        query = query.where('type', '==', type);
      }

      if (authorId) {
        query = query.where('authorId', '==', authorId);
      }

      if (teamId) {
        query = query.where('teamIds', 'array-contains', teamId);
      }

      if (customerFacing !== undefined) {
        query = query.where('customerFacing', '==', customerFacing);
      }

      if (sensitivity) {
        query = query.where('sensitivity', '==', sensitivity);
      }

      if (from) {
        query = query.where('committedAt', '>=', new Date(from));
      }

      if (to) {
        query = query.where('committedAt', '<=', new Date(to));
      }

      query = query.orderBy('committedAt', 'desc').limit(limit! + 1);

      if (cursor) {
        const cursorDoc = await collections.artifacts().doc(cursor).get();
        if (cursorDoc.exists) {
          query = query.startAfter(cursorDoc);
        }
      }

      const snapshot = await query.get();
      const docs = snapshot.docs;

      const hasMore = docs.length > limit!;
      const resultDocs = hasMore ? docs.slice(0, limit!) : docs;

      // Filter by text query (title match) and tags client-side
      // In production this would use a search index (Algolia, Typesense, etc.)
      const tagList = tags ? tags.split(',').map((t: string) => t.trim()) : [];

      const artifacts = resultDocs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((artifact) => {
          // Text filter on title
          if (q && !artifact.title.toLowerCase().includes(q.toLowerCase())) {
            return false;
          }
          // Tag filter
          if (tagList.length > 0 && !tagList.some((tag: string) => artifact.tags.includes(tag))) {
            return false;
          }
          return true;
        });

      // Access control: filter out artifacts the user cannot see
      const visibleArtifacts = artifacts.filter((artifact) => {
        // Org admin can see everything
        if (user.roles.includes('admin') || user.roles.includes('org_admin')) return true;
        // Author can always see
        if (artifact.authorId === user.uid) return true;
        // Owner can see
        if (artifact.ownerIds.includes(user.uid)) return true;
        // Team member can see team artifacts
        if (artifact.teamIds.some((tid: string) => user.teams.includes(tid))) return true;
        // Check ACL overrides
        const aclEntry = artifact.aclOverrides.find(
          (acl: { principalId: string; permission: string }) =>
            acl.principalId === user.uid || user.teams.some((tid: string) => acl.principalId === tid),
        );
        if (aclEntry && aclEntry.permission !== 'none') return true;
        // Public artifacts visible to all in org
        if (artifact.sensitivity === 'public') return true;
        return false;
      });

      const nextCursor = hasMore && resultDocs.length > 0 ? resultDocs[resultDocs.length - 1].id : undefined;

      res.json({
        artifacts: visibleArtifacts,
        cursor: nextCursor,
        hasMore,
      });
    } catch (err) {
      console.error('Error searching artifacts:', err);
      res.status(500).json({ error: 'Failed to search artifacts' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /v1/artifacts/:id — get artifact (access-controlled)
// ---------------------------------------------------------------------------

router.get(
  '/:id',
  requireAuth,
  defaultLimiter,
  validate({ params: GetArtifactParamsSchema }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;

      const doc = await collections.artifacts().doc(id).get();
      if (!doc.exists) {
        res.status(404).json({ error: 'Artifact not found' });
        return;
      }

      const artifact = doc.data()!;

      // Org check
      if (artifact.orgId !== user.orgId && !user.roles.includes('super_admin')) {
        res.status(404).json({ error: 'Artifact not found' });
        return;
      }

      // Access control
      const canAccess =
        user.roles.includes('admin') ||
        user.roles.includes('org_admin') ||
        artifact.authorId === user.uid ||
        artifact.ownerIds.includes(user.uid) ||
        artifact.teamIds.some((tid: string) => user.teams.includes(tid)) ||
        artifact.sensitivity === 'public' ||
        artifact.aclOverrides.some(
          (acl: { principalId: string; permission: string }) =>
            (acl.principalId === user.uid || user.teams.includes(acl.principalId)) && acl.permission !== 'none',
        );

      if (!canAccess) {
        res.status(403).json({ error: 'Access denied to this artifact' });
        return;
      }

      // Generate download URL if content exists
      let downloadUrl: string | undefined;
      if (artifact.contentHash) {
        try {
          downloadUrl = await generateDownloadUrl(artifact.orgId, id, artifact.version);
        } catch {
          // Content may not exist in GCS yet
        }
      }

      res.json({
        id: doc.id,
        ...artifact,
        downloadUrl,
      });
    } catch (err) {
      console.error('Error getting artifact:', err);
      res.status(500).json({ error: 'Failed to get artifact' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /v1/artifacts/:id/diff — diff between versions
// ---------------------------------------------------------------------------

router.get(
  '/:id/diff',
  requireAuth,
  defaultLimiter,
  validate({ params: GetArtifactParamsSchema, query: DiffQuerySchema }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;
      const { fromVersion, toVersion } = req.query as unknown as z.infer<typeof DiffQuerySchema>;

      // Verify artifact access
      const doc = await collections.artifacts().doc(id).get();
      if (!doc.exists) {
        res.status(404).json({ error: 'Artifact not found' });
        return;
      }

      const artifact = doc.data()!;
      if (artifact.orgId !== user.orgId) {
        res.status(404).json({ error: 'Artifact not found' });
        return;
      }

      // Download both versions
      let fromContent: string;
      let toContent: string;

      try {
        const fromBuffer = await downloadArtifactContent(artifact.orgId, id, fromVersion);
        fromContent = fromBuffer.toString('utf-8');
      } catch {
        res.status(404).json({ error: `Version ${fromVersion} not found` });
        return;
      }

      try {
        const toBuffer = await downloadArtifactContent(artifact.orgId, id, toVersion);
        toContent = toBuffer.toString('utf-8');
      } catch {
        res.status(404).json({ error: `Version ${toVersion} not found` });
        return;
      }

      // Compute simple line-based diff
      const fromLines = fromContent.split('\n');
      const toLines = toContent.split('\n');

      const additions: Array<{ line: number; content: string }> = [];
      const deletions: Array<{ line: number; content: string }> = [];

      const maxLen = Math.max(fromLines.length, toLines.length);
      for (let i = 0; i < maxLen; i++) {
        const fromLine = fromLines[i];
        const toLine = toLines[i];
        if (fromLine !== toLine) {
          if (fromLine !== undefined) {
            deletions.push({ line: i + 1, content: fromLine });
          }
          if (toLine !== undefined) {
            additions.push({ line: i + 1, content: toLine });
          }
        }
      }

      res.json({
        artifactId: id,
        fromVersion,
        toVersion,
        additions: additions.length,
        deletions: deletions.length,
        diff: { additions, deletions },
      });
    } catch (err) {
      console.error('Error computing diff:', err);
      res.status(500).json({ error: 'Failed to compute diff' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /v1/artifacts/:id/history — version history
// ---------------------------------------------------------------------------

router.get(
  '/:id/history',
  requireAuth,
  defaultLimiter,
  validate({ params: GetArtifactParamsSchema, query: HistoryQuerySchema }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;
      const { limit, cursor } = req.query as unknown as z.infer<typeof HistoryQuerySchema>;

      // Verify artifact access
      const doc = await collections.artifacts().doc(id).get();
      if (!doc.exists) {
        res.status(404).json({ error: 'Artifact not found' });
        return;
      }

      const artifact = doc.data()!;
      if (artifact.orgId !== user.orgId) {
        res.status(404).json({ error: 'Artifact not found' });
        return;
      }

      // Query commits for this artifact
      let query = collections.commits()
        .where('artifactId', '==', id)
        .orderBy('timestamp', 'desc')
        .limit(limit! + 1);

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

      const commits = resultDocs.map((d) => ({
        commitHash: d.id,
        ...d.data(),
      }));

      const nextCursor = hasMore && resultDocs.length > 0 ? resultDocs[resultDocs.length - 1].id : undefined;

      res.json({
        artifactId: id,
        commits,
        cursor: nextCursor,
        hasMore,
      });
    } catch (err) {
      console.error('Error getting history:', err);
      res.status(500).json({ error: 'Failed to get artifact history' });
    }
  },
);

export default router;
