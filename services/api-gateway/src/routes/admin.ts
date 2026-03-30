import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { v4 as uuid } from 'uuid';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { validate, validateBody, validateQuery } from '../middleware/validation.js';
import { adminLimiter } from '../middleware/rate-limit.js';
import { collections } from '../lib/firestore.js';
import { publishAuditEvent } from '../lib/pubsub.js';

const router = Router();

// Apply admin auth and rate limiting to all routes
router.use(requireAuth, requireAdmin, adminLimiter);

// ---------------------------------------------------------------------------
// Shared schemas
// ---------------------------------------------------------------------------

const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
});

const IdParamsSchema = z.object({
  id: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Helper: CRUD factory for admin resources
// ---------------------------------------------------------------------------

function buildCrudRouter<TCreate extends z.ZodTypeAny, TUpdate extends z.ZodTypeAny>(config: {
  basePath: string;
  collectionFn: () => FirebaseFirestore.CollectionReference;
  createSchema: TCreate;
  updateSchema: TUpdate;
  resourceType: string;
  orgScoped?: boolean;
  beforeCreate?: (data: z.infer<TCreate>, req: Request) => Record<string, unknown>;
  beforeUpdate?: (data: z.infer<TUpdate>, req: Request) => Record<string, unknown>;
}): Router {
  const sub = Router();
  const { collectionFn, createSchema, updateSchema, resourceType, orgScoped = true, beforeCreate, beforeUpdate } = config;

  // LIST
  sub.get(
    '/',
    validateQuery(PaginationQuerySchema),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const user = req.user!;
        const { limit, cursor } = req.query as unknown as z.infer<typeof PaginationQuerySchema>;

        let query = orgScoped
          ? collectionFn().where('orgId', '==', user.orgId)
          : collectionFn();

        query = query.limit(limit! + 1);

        if (cursor) {
          const cursorDoc = await collectionFn().doc(cursor).get();
          if (cursorDoc.exists) {
            query = query.startAfter(cursorDoc);
          }
        }

        const snapshot = await query.get();
        const docs = snapshot.docs;
        const hasMore = docs.length > limit!;
        const resultDocs = hasMore ? docs.slice(0, limit!) : docs;
        const nextCursor = hasMore && resultDocs.length > 0 ? resultDocs[resultDocs.length - 1].id : undefined;

        res.json({
          items: resultDocs.map((d) => ({ id: d.id, ...d.data() })),
          cursor: nextCursor,
          hasMore,
        });
      } catch (err) {
        console.error(`Error listing ${resourceType}:`, err);
        res.status(500).json({ error: `Failed to list ${resourceType}` });
      }
    },
  );

  // GET by ID
  sub.get(
    '/:id',
    validate({ params: IdParamsSchema }),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const user = req.user!;
        const { id } = req.params;

        const doc = await collectionFn().doc(id).get();
        if (!doc.exists) {
          res.status(404).json({ error: `${resourceType} not found` });
          return;
        }

        const data = doc.data()!;
        if (orgScoped && (data as Record<string, unknown>).orgId !== user.orgId) {
          res.status(404).json({ error: `${resourceType} not found` });
          return;
        }

        res.json({ id: doc.id, ...data });
      } catch (err) {
        console.error(`Error fetching ${resourceType}:`, err);
        res.status(500).json({ error: `Failed to fetch ${resourceType}` });
      }
    },
  );

  // CREATE
  sub.post(
    '/',
    validateBody(createSchema),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const user = req.user!;
        const id = uuid();
        const now = FieldValue.serverTimestamp();

        let data = beforeCreate ? beforeCreate(req.body, req) : { ...req.body };
        if (orgScoped) {
          data = { ...data, orgId: user.orgId };
        }
        data = { ...data, createdAt: now, updatedAt: now };

        await collectionFn().doc(id).set(data);

        await publishAuditEvent({
          orgId: user.orgId,
          actorId: user.uid,
          actorType: 'user',
          action: `admin.${resourceType}.create`,
          targetRef: id,
          targetType: resourceType,
        });

        res.status(201).json({ id, ...data });
      } catch (err) {
        console.error(`Error creating ${resourceType}:`, err);
        res.status(500).json({ error: `Failed to create ${resourceType}` });
      }
    },
  );

  // UPDATE
  sub.put(
    '/:id',
    validate({ params: IdParamsSchema, body: updateSchema }),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const user = req.user!;
        const { id } = req.params;

        const docRef = collectionFn().doc(id);
        const existing = await docRef.get();
        if (!existing.exists) {
          res.status(404).json({ error: `${resourceType} not found` });
          return;
        }

        const existingData = existing.data()!;
        if (orgScoped && (existingData as Record<string, unknown>).orgId !== user.orgId) {
          res.status(404).json({ error: `${resourceType} not found` });
          return;
        }

        let updateData = beforeUpdate ? beforeUpdate(req.body, req) : { ...req.body };
        updateData = { ...updateData, updatedAt: FieldValue.serverTimestamp() };

        await docRef.update(updateData);

        await publishAuditEvent({
          orgId: user.orgId,
          actorId: user.uid,
          actorType: 'user',
          action: `admin.${resourceType}.update`,
          targetRef: id,
          targetType: resourceType,
        });

        res.json({ id, ...existingData, ...updateData });
      } catch (err) {
        console.error(`Error updating ${resourceType}:`, err);
        res.status(500).json({ error: `Failed to update ${resourceType}` });
      }
    },
  );

  // DELETE
  sub.delete(
    '/:id',
    validate({ params: IdParamsSchema }),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const user = req.user!;
        const { id } = req.params;

        const docRef = collectionFn().doc(id);
        const existing = await docRef.get();
        if (!existing.exists) {
          res.status(404).json({ error: `${resourceType} not found` });
          return;
        }

        const existingData = existing.data()!;
        if (orgScoped && (existingData as Record<string, unknown>).orgId !== user.orgId) {
          res.status(404).json({ error: `${resourceType} not found` });
          return;
        }

        await docRef.delete();

        await publishAuditEvent({
          orgId: user.orgId,
          actorId: user.uid,
          actorType: 'user',
          action: `admin.${resourceType}.delete`,
          targetRef: id,
          targetType: resourceType,
        });

        res.json({ id, deleted: true });
      } catch (err) {
        console.error(`Error deleting ${resourceType}:`, err);
        res.status(500).json({ error: `Failed to delete ${resourceType}` });
      }
    },
  );

  return sub;
}

// ===========================================================================
// /v1/admin/org
// ===========================================================================

const OrgUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  domain: z.string().optional(),
  privacyPolicy: z.string().optional(),
  featureFlags: z.record(z.boolean()).optional(),
  killSwitches: z.record(z.boolean()).optional(),
  connectorDefaults: z.record(z.unknown()).optional(),
  billingConfig: z.record(z.unknown()).optional(),
});

router.get('/org', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const doc = await collections.organizations().doc(user.orgId).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    console.error('Error fetching org:', err);
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

router.put(
  '/org',
  validateBody(OrgUpdateSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const orgRef = collections.organizations().doc(user.orgId);
      const doc = await orgRef.get();

      if (!doc.exists) {
        res.status(404).json({ error: 'Organization not found' });
        return;
      }

      const updateData = { ...req.body, updatedAt: FieldValue.serverTimestamp() };
      await orgRef.update(updateData);

      await publishAuditEvent({
        orgId: user.orgId,
        actorId: user.uid,
        actorType: 'user',
        action: 'admin.org.update',
        targetRef: user.orgId,
        targetType: 'organization',
        metadata: { fields: Object.keys(req.body) },
      });

      res.json({ id: user.orgId, ...doc.data(), ...updateData });
    } catch (err) {
      console.error('Error updating org:', err);
      res.status(500).json({ error: 'Failed to update organization' });
    }
  },
);

// ===========================================================================
// /v1/admin/teams
// ===========================================================================

const TeamCreateSchema = z.object({
  name: z.string().min(1).max(200),
  members: z.array(z.string()).optional().default([]),
  admins: z.array(z.string()).optional().default([]),
  groupPolicy: z.string().optional().default(''),
  agentIds: z.array(z.string()).optional().default([]),
  projectScopes: z.array(z.string()).optional().default([]),
});

const TeamUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  members: z.array(z.string()).optional(),
  admins: z.array(z.string()).optional(),
  groupPolicy: z.string().optional(),
  agentIds: z.array(z.string()).optional(),
  projectScopes: z.array(z.string()).optional(),
});

router.use('/teams', buildCrudRouter({
  basePath: '/teams',
  collectionFn: () => collections.teams(),
  createSchema: TeamCreateSchema,
  updateSchema: TeamUpdateSchema,
  resourceType: 'team',
}));

// ===========================================================================
// /v1/admin/agents
// ===========================================================================

const AgentCreateSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.string().min(1),
  description: z.string().max(2000).optional().default(''),
  ownerId: z.string().min(1),
  ownerType: z.string().optional().default('user'),
  templateId: z.string().optional(),
  customPrompts: z.array(z.string()).optional().default([]),
  readScope: z.record(z.unknown()).optional().default({}),
  writeScope: z.record(z.unknown()).optional().default({}),
  actionBudget: z.record(z.unknown()).optional().default({}),
  triggers: z.array(z.record(z.unknown())).optional().default([]),
  capabilities: z.array(z.string()).optional().default([]),
  modelConfig: z.record(z.unknown()).optional().default({}),
  status: z.enum(['active', 'paused', 'disabled']).optional().default('active'),
});

const AgentUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  customPrompts: z.array(z.string()).optional(),
  readScope: z.record(z.unknown()).optional(),
  writeScope: z.record(z.unknown()).optional(),
  actionBudget: z.record(z.unknown()).optional(),
  triggers: z.array(z.record(z.unknown())).optional(),
  capabilities: z.array(z.string()).optional(),
  modelConfig: z.record(z.unknown()).optional(),
  status: z.enum(['active', 'paused', 'disabled']).optional(),
});

router.use('/agents', buildCrudRouter({
  basePath: '/agents',
  collectionFn: () => collections.agents(),
  createSchema: AgentCreateSchema,
  updateSchema: AgentUpdateSchema,
  resourceType: 'agent',
  beforeCreate: (data) => ({
    ...data,
    lastRunAt: null,
    totalActions: 0,
    acceptanceRate: 0,
  }),
}));

// ===========================================================================
// /v1/admin/agent-marketplace
// ===========================================================================

const TemplateCreateSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.string().min(1),
  description: z.string().max(2000),
  defaultModel: z.string().min(1),
  defaultTriggers: z.array(z.record(z.unknown())).optional().default([]),
  defaultCapabilities: z.array(z.string()).optional().default([]),
  defaultScope: z.record(z.unknown()).optional().default({}),
  customizablePrompts: z.array(z.string()).optional().default([]),
  category: z.string().min(1),
  isBuiltIn: z.boolean().optional().default(false),
});

const TemplateUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  defaultModel: z.string().optional(),
  defaultTriggers: z.array(z.record(z.unknown())).optional(),
  defaultCapabilities: z.array(z.string()).optional(),
  defaultScope: z.record(z.unknown()).optional(),
  customizablePrompts: z.array(z.string()).optional(),
  category: z.string().optional(),
});

router.use('/agent-marketplace', buildCrudRouter({
  basePath: '/agent-marketplace',
  collectionFn: () => collections.agentTemplates(),
  createSchema: TemplateCreateSchema,
  updateSchema: TemplateUpdateSchema,
  resourceType: 'agentTemplate',
  orgScoped: false,
  beforeCreate: (data, req) => ({
    ...data,
    createdBy: req.user!.uid,
  }),
}));

// ===========================================================================
// /v1/admin/agent-builder
// ===========================================================================

// Agent builder creates agents from templates with customizations
const AgentBuilderSchema = z.object({
  templateId: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  ownerId: z.string().min(1),
  ownerType: z.enum(['user', 'team', 'org']).optional().default('user'),
  customPrompts: z.array(z.string()).optional().default([]),
  readScope: z.record(z.unknown()).optional(),
  writeScope: z.record(z.unknown()).optional(),
  triggers: z.array(z.record(z.unknown())).optional(),
  capabilities: z.array(z.string()).optional(),
});

router.post(
  '/agent-builder',
  validateBody(AgentBuilderSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const body = req.body;

      // Load template
      const templateDoc = await collections.agentTemplates().doc(body.templateId).get();
      if (!templateDoc.exists) {
        res.status(404).json({ error: 'Agent template not found' });
        return;
      }

      const template = templateDoc.data()!;
      const agentId = uuid();
      const now = FieldValue.serverTimestamp();

      // Merge template defaults with customizations
      const agentData = {
        orgId: user.orgId,
        name: body.name,
        type: template.type,
        description: body.description || template.description,
        ownerId: body.ownerId,
        ownerType: body.ownerType,
        templateId: body.templateId,
        customPrompts: body.customPrompts.length > 0 ? body.customPrompts : template.customizablePrompts,
        readScope: body.readScope ?? template.defaultScope,
        writeScope: body.writeScope ?? {},
        actionBudget: {},
        triggers: body.triggers ?? template.defaultTriggers,
        capabilities: body.capabilities ?? template.defaultCapabilities,
        modelConfig: { model: template.defaultModel },
        status: 'active' as const,
        lastRunAt: null,
        totalActions: 0,
        acceptanceRate: 0,
        createdAt: now,
      };

      await collections.agents().doc(agentId).set(agentData);

      await publishAuditEvent({
        orgId: user.orgId,
        actorId: user.uid,
        actorType: 'user',
        action: 'admin.agent-builder.create',
        targetRef: agentId,
        targetType: 'agent',
        metadata: { templateId: body.templateId },
      });

      res.status(201).json({ id: agentId, ...agentData });
    } catch (err) {
      console.error('Error building agent:', err);
      res.status(500).json({ error: 'Failed to build agent from template' });
    }
  },
);

// ===========================================================================
// /v1/admin/policies
// ===========================================================================

const PolicyCreateSchema = z.object({
  type: z.enum(['privacy', 'agent', 'group', 'retention', 'compliance', 'yolo']),
  version: z.string().min(1),
  rules: z.array(
    z.object({
      id: z.string().optional(),
      condition: z.record(z.unknown()),
      action: z.string(),
      priority: z.number().int(),
    }),
  ).min(1),
  defaultAction: z.string().min(1),
  enabled: z.boolean().optional().default(true),
  groupOverrides: z.array(z.record(z.unknown())).optional().default([]),
});

const PolicyUpdateSchema = z.object({
  version: z.string().optional(),
  rules: z.array(
    z.object({
      id: z.string().optional(),
      condition: z.record(z.unknown()),
      action: z.string(),
      priority: z.number().int(),
    }),
  ).optional(),
  defaultAction: z.string().optional(),
  enabled: z.boolean().optional(),
  groupOverrides: z.array(z.record(z.unknown())).optional(),
});

router.use('/policies', buildCrudRouter({
  basePath: '/policies',
  collectionFn: () => collections.policies(),
  createSchema: PolicyCreateSchema,
  updateSchema: PolicyUpdateSchema,
  resourceType: 'policy',
  beforeCreate: (data, req) => ({
    ...data,
    createdBy: req.user!.uid,
    rules: data.rules.map((rule: { id?: string; condition: unknown; action: string; priority: number }) => ({
      ...rule,
      id: rule.id || uuid(),
    })),
  }),
}));

// ===========================================================================
// /v1/admin/connectors
// ===========================================================================

const ConnectorCreateSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['slack', 'google_drive', 'notion', 'gmail', 'calendar', 'github', 'figma', 'crm', 'jira', 'confluence', 'asana', 'linear']),
  config: z.record(z.unknown()),
  credentials: z.record(z.unknown()).optional().default({}),
  enabled: z.boolean().optional().default(true),
  syncSchedule: z.string().optional(),
});

const ConnectorUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  config: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional(),
  syncSchedule: z.string().optional(),
});

// Connectors stored as subcollection-like docs in a dedicated collection
const connectorsCollection = () => collections.organizations().firestore.collection('connectors');

router.use('/connectors', buildCrudRouter({
  basePath: '/connectors',
  collectionFn: connectorsCollection,
  createSchema: ConnectorCreateSchema,
  updateSchema: ConnectorUpdateSchema,
  resourceType: 'connector',
}));

// ===========================================================================
// /v1/admin/audit
// ===========================================================================

const AuditQuerySchema = z.object({
  actorId: z.string().optional(),
  actorType: z.enum(['user', 'agent', 'system']).optional(),
  action: z.string().optional(),
  targetType: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  cursor: z.string().optional(),
});

router.get(
  '/audit',
  validateQuery(AuditQuerySchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { actorId, actorType, action, targetType, from, to, limit, cursor } =
        req.query as unknown as z.infer<typeof AuditQuerySchema>;

      let query = collections.audits()
        .where('orgId', '==', user.orgId);

      if (actorId) query = query.where('actorId', '==', actorId);
      if (actorType) query = query.where('actorType', '==', actorType);
      if (action) query = query.where('action', '==', action);
      if (targetType) query = query.where('targetType', '==', targetType);
      if (from) query = query.where('createdAt', '>=', new Date(from));
      if (to) query = query.where('createdAt', '<=', new Date(to));

      query = query.orderBy('createdAt', 'desc').limit(limit! + 1);

      if (cursor) {
        const cursorDoc = await collections.audits().doc(cursor).get();
        if (cursorDoc.exists) query = query.startAfter(cursorDoc);
      }

      const snapshot = await query.get();
      const docs = snapshot.docs;
      const hasMore = docs.length > limit!;
      const resultDocs = hasMore ? docs.slice(0, limit!) : docs;
      const nextCursor = hasMore && resultDocs.length > 0 ? resultDocs[resultDocs.length - 1].id : undefined;

      res.json({
        audits: resultDocs.map((d) => ({ id: d.id, ...d.data() })),
        cursor: nextCursor,
        hasMore,
      });
    } catch (err) {
      console.error('Error fetching audit log:', err);
      res.status(500).json({ error: 'Failed to fetch audit log' });
    }
  },
);

// ===========================================================================
// /v1/admin/artifacts — admin artifact management
// ===========================================================================

const AdminArtifactUpdateSchema = z.object({
  accessTier: z.string().optional(),
  sensitivity: z.enum(['public', 'internal', 'confidential', 'restricted']).optional(),
  ownerIds: z.array(z.string()).optional(),
  teamIds: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  aclOverrides: z.array(
    z.object({
      principalId: z.string(),
      principalType: z.enum(['user', 'team', 'agent']),
      permission: z.enum(['read', 'write', 'none']),
    }),
  ).optional(),
});

// List all org artifacts (admin view)
router.get(
  '/artifacts',
  validateQuery(PaginationQuerySchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { limit, cursor } = req.query as unknown as z.infer<typeof PaginationQuerySchema>;

      let query = collections.artifacts()
        .where('orgId', '==', user.orgId)
        .orderBy('committedAt', 'desc')
        .limit(limit! + 1);

      if (cursor) {
        const cursorDoc = await collections.artifacts().doc(cursor).get();
        if (cursorDoc.exists) query = query.startAfter(cursorDoc);
      }

      const snapshot = await query.get();
      const docs = snapshot.docs;
      const hasMore = docs.length > limit!;
      const resultDocs = hasMore ? docs.slice(0, limit!) : docs;
      const nextCursor = hasMore && resultDocs.length > 0 ? resultDocs[resultDocs.length - 1].id : undefined;

      res.json({
        artifacts: resultDocs.map((d) => ({ id: d.id, ...d.data() })),
        cursor: nextCursor,
        hasMore,
      });
    } catch (err) {
      console.error('Error listing admin artifacts:', err);
      res.status(500).json({ error: 'Failed to list artifacts' });
    }
  },
);

// Update artifact metadata (admin)
router.put(
  '/artifacts/:id',
  validate({ params: IdParamsSchema, body: AdminArtifactUpdateSchema }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;

      const docRef = collections.artifacts().doc(id);
      const doc = await docRef.get();
      if (!doc.exists) {
        res.status(404).json({ error: 'Artifact not found' });
        return;
      }

      const artifact = doc.data()!;
      if (artifact.orgId !== user.orgId) {
        res.status(404).json({ error: 'Artifact not found' });
        return;
      }

      await docRef.update({ ...req.body, updatedAt: FieldValue.serverTimestamp() });

      await publishAuditEvent({
        orgId: user.orgId,
        actorId: user.uid,
        actorType: 'user',
        action: 'admin.artifact.update',
        targetRef: id,
        targetType: 'artifact',
        metadata: { fields: Object.keys(req.body) },
      });

      res.json({ id, ...artifact, ...req.body });
    } catch (err) {
      console.error('Error updating artifact:', err);
      res.status(500).json({ error: 'Failed to update artifact' });
    }
  },
);

// ===========================================================================
// /v1/admin/users
// ===========================================================================

const UserUpdateSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  roles: z.array(z.string()).optional(),
  teams: z.array(z.string()).optional(),
  accessTier: z.string().optional(),
  agentPreferences: z.record(z.unknown()).optional(),
  notificationPreferences: z.record(z.unknown()).optional(),
});

router.get(
  '/users',
  validateQuery(PaginationQuerySchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { limit, cursor } = req.query as unknown as z.infer<typeof PaginationQuerySchema>;

      let query = collections.users()
        .where('orgId', '==', user.orgId)
        .limit(limit! + 1);

      if (cursor) {
        const cursorDoc = await collections.users().doc(cursor).get();
        if (cursorDoc.exists) query = query.startAfter(cursorDoc);
      }

      const snapshot = await query.get();
      const docs = snapshot.docs;
      const hasMore = docs.length > limit!;
      const resultDocs = hasMore ? docs.slice(0, limit!) : docs;
      const nextCursor = hasMore && resultDocs.length > 0 ? resultDocs[resultDocs.length - 1].id : undefined;

      res.json({
        users: resultDocs.map((d) => ({ id: d.id, ...d.data() })),
        cursor: nextCursor,
        hasMore,
      });
    } catch (err) {
      console.error('Error listing users:', err);
      res.status(500).json({ error: 'Failed to list users' });
    }
  },
);

router.get(
  '/users/:id',
  validate({ params: IdParamsSchema }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;

      const doc = await collections.users().doc(id).get();
      if (!doc.exists) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const userData = doc.data()!;
      if (userData.orgId !== user.orgId) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({ id: doc.id, ...userData });
    } catch (err) {
      console.error('Error fetching user:', err);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  },
);

router.put(
  '/users/:id',
  validate({ params: IdParamsSchema, body: UserUpdateSchema }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;

      const docRef = collections.users().doc(id);
      const doc = await docRef.get();
      if (!doc.exists) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const userData = doc.data()!;
      if (userData.orgId !== user.orgId) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      await docRef.update(req.body);

      await publishAuditEvent({
        orgId: user.orgId,
        actorId: user.uid,
        actorType: 'user',
        action: 'admin.user.update',
        targetRef: id,
        targetType: 'user',
        metadata: { fields: Object.keys(req.body) },
      });

      res.json({ id, ...userData, ...req.body });
    } catch (err) {
      console.error('Error updating user:', err);
      res.status(500).json({ error: 'Failed to update user' });
    }
  },
);

// ===========================================================================
// /v1/admin/federation
// ===========================================================================

const FederationCreateSchema = z.object({
  orgBId: z.string().min(1),
  sharedScope: z.record(z.unknown()),
  redactionLevel: z.enum(['full', 'partial', 'none']).optional().default('partial'),
  expirationDate: z.string(),
});

const FederationUpdateSchema = z.object({
  sharedScope: z.record(z.unknown()).optional(),
  redactionLevel: z.enum(['full', 'partial', 'none']).optional(),
  expirationDate: z.string().optional(),
  status: z.enum(['pending', 'active', 'expired', 'revoked']).optional(),
});

router.use('/federation', buildCrudRouter({
  basePath: '/federation',
  collectionFn: () => collections.federations(),
  createSchema: FederationCreateSchema,
  updateSchema: FederationUpdateSchema,
  resourceType: 'federation',
  orgScoped: false,
  beforeCreate: (data, req) => ({
    orgAId: req.user!.orgId,
    orgBId: data.orgBId,
    sharedScope: data.sharedScope,
    redactionLevel: data.redactionLevel,
    expirationDate: new Date(data.expirationDate),
    status: 'pending',
    approvedByA: true,
    approvedByB: false,
  }),
}));

// ===========================================================================
// /v1/admin/migration — migration management (admin view)
// ===========================================================================

router.get(
  '/migration',
  validateQuery(PaginationQuerySchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { limit, cursor } = req.query as unknown as z.infer<typeof PaginationQuerySchema>;

      let query = collections.migrations()
        .where('orgId', '==', user.orgId)
        .orderBy('createdAt', 'desc')
        .limit(limit! + 1);

      if (cursor) {
        const cursorDoc = await collections.migrations().doc(cursor).get();
        if (cursorDoc.exists) query = query.startAfter(cursorDoc);
      }

      const snapshot = await query.get();
      const docs = snapshot.docs;
      const hasMore = docs.length > limit!;
      const resultDocs = hasMore ? docs.slice(0, limit!) : docs;
      const nextCursor = hasMore && resultDocs.length > 0 ? resultDocs[resultDocs.length - 1].id : undefined;

      res.json({
        migrations: resultDocs.map((d) => ({ id: d.id, ...d.data() })),
        cursor: nextCursor,
        hasMore,
      });
    } catch (err) {
      console.error('Error listing migrations:', err);
      res.status(500).json({ error: 'Failed to list migrations' });
    }
  },
);

// ===========================================================================
// /v1/admin/customer-health
// ===========================================================================

router.get(
  '/customer-health',
  validateQuery(
    PaginationQuerySchema.extend({
      alertLevel: z.enum(['green', 'yellow', 'red']).optional(),
      trend: z.enum(['improving', 'stable', 'declining']).optional(),
    }),
  ),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { limit, cursor, alertLevel, trend } = req.query as Record<string, unknown>;

      let query = collections.customerHealth()
        .where('orgId', '==', user.orgId);

      if (alertLevel) query = query.where('alertLevel', '==', alertLevel);
      if (trend) query = query.where('trend', '==', trend);

      query = query.orderBy('lastUpdatedAt', 'desc').limit(((limit as number) ?? 20) + 1);

      if (cursor) {
        const cursorDoc = await collections.customerHealth().doc(cursor as string).get();
        if (cursorDoc.exists) query = query.startAfter(cursorDoc);
      }

      const snapshot = await query.get();
      const docs = snapshot.docs;
      const lim = (limit as number) ?? 20;
      const hasMore = docs.length > lim;
      const resultDocs = hasMore ? docs.slice(0, lim) : docs;
      const nextCursor = hasMore && resultDocs.length > 0 ? resultDocs[resultDocs.length - 1].id : undefined;

      res.json({
        customers: resultDocs.map((d) => ({ id: d.id, ...d.data() })),
        cursor: nextCursor,
        hasMore,
      });
    } catch (err) {
      console.error('Error listing customer health:', err);
      res.status(500).json({ error: 'Failed to list customer health data' });
    }
  },
);

router.get(
  '/customer-health/:id',
  validate({ params: IdParamsSchema }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;

      const doc = await collections.customerHealth().doc(id).get();
      if (!doc.exists) {
        res.status(404).json({ error: 'Customer health record not found' });
        return;
      }

      const data = doc.data()!;
      if (data.orgId !== user.orgId) {
        res.status(404).json({ error: 'Customer health record not found' });
        return;
      }

      res.json({ id: doc.id, ...data });
    } catch (err) {
      console.error('Error fetching customer health:', err);
      res.status(500).json({ error: 'Failed to fetch customer health record' });
    }
  },
);

// ===========================================================================
// /v1/admin/analytics
// ===========================================================================

router.get('/analytics', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;

    // Aggregate statistics across the org
    const [
      artifactCount,
      userCount,
      teamCount,
      agentCount,
      prCount,
      openPRCount,
    ] = await Promise.all([
      collections.artifacts().where('orgId', '==', user.orgId).count().get(),
      collections.users().where('orgId', '==', user.orgId).count().get(),
      collections.teams().where('orgId', '==', user.orgId).count().get(),
      collections.agents().where('orgId', '==', user.orgId).count().get(),
      collections.pullRequests().where('orgId', '==', user.orgId).count().get(),
      collections.pullRequests().where('orgId', '==', user.orgId).where('status', '==', 'open').count().get(),
    ]);

    // Recent activity: last 7 days of commits
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentCommits = await collections.commits()
      .where('ledgerId', '>=', '') // Use a range query trick combined with timestamp
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();

    // Agent acceptance rate
    const mergedPRs = await collections.pullRequests()
      .where('orgId', '==', user.orgId)
      .where('status', '==', 'merged')
      .count()
      .get();

    const rejectedPRs = await collections.pullRequests()
      .where('orgId', '==', user.orgId)
      .where('status', '==', 'rejected')
      .count()
      .get();

    const totalReviewed = mergedPRs.data().count + rejectedPRs.data().count;
    const acceptanceRate = totalReviewed > 0 ? mergedPRs.data().count / totalReviewed : 0;

    res.json({
      orgId: user.orgId,
      totals: {
        artifacts: artifactCount.data().count,
        users: userCount.data().count,
        teams: teamCount.data().count,
        agents: agentCount.data().count,
        pullRequests: prCount.data().count,
        openPullRequests: openPRCount.data().count,
      },
      agentMetrics: {
        totalPRsReviewed: totalReviewed,
        acceptanceRate: Math.round(acceptanceRate * 100),
        mergedCount: mergedPRs.data().count,
        rejectedCount: rejectedPRs.data().count,
      },
      recentActivity: {
        commitsLast7Days: recentCommits.docs.length,
      },
    });
  } catch (err) {
    console.error('Error fetching analytics:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// ===========================================================================
// /v1/admin/kill-switches
// ===========================================================================

const KillSwitchUpdateSchema = z.object({
  switches: z.record(z.boolean()),
});

router.get('/kill-switches', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const orgDoc = await collections.organizations().doc(user.orgId).get();
    if (!orgDoc.exists) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    const org = orgDoc.data()!;
    res.json({
      orgId: user.orgId,
      killSwitches: org.killSwitches ?? {},
    });
  } catch (err) {
    console.error('Error fetching kill switches:', err);
    res.status(500).json({ error: 'Failed to fetch kill switches' });
  }
});

router.put(
  '/kill-switches',
  validateBody(KillSwitchUpdateSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { switches } = req.body;

      const orgRef = collections.organizations().doc(user.orgId);
      const orgDoc = await orgRef.get();

      if (!orgDoc.exists) {
        res.status(404).json({ error: 'Organization not found' });
        return;
      }

      // Merge kill switches
      const existingSwitches = orgDoc.data()!.killSwitches ?? {};
      const updatedSwitches = { ...existingSwitches, ...switches };

      await orgRef.update({
        killSwitches: updatedSwitches,
        updatedAt: FieldValue.serverTimestamp(),
      });

      await publishAuditEvent({
        orgId: user.orgId,
        actorId: user.uid,
        actorType: 'user',
        action: 'admin.kill-switches.update',
        targetRef: user.orgId,
        targetType: 'organization',
        metadata: { switches },
      });

      res.json({
        orgId: user.orgId,
        killSwitches: updatedSwitches,
      });
    } catch (err) {
      console.error('Error updating kill switches:', err);
      res.status(500).json({ error: 'Failed to update kill switches' });
    }
  },
);

export default router;
