import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth } from '../middleware/auth.js';
import { validate, validateQuery, validateBody } from '../middleware/validation.js';
import { defaultLimiter } from '../middleware/rate-limit.js';
import { collections } from '../lib/firestore.js';
import { publishAuditEvent } from '../lib/pubsub.js';

const router = Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const ListNotificationsSchema = z.object({
  status: z.enum(['unread', 'read', 'dismissed', 'all']).optional().default('all'),
  type: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  cursor: z.string().optional(),
});

const NotificationParamsSchema = z.object({
  id: z.string().min(1),
});

const PreferencesUpdateSchema = z.object({
  email: z.object({
    enabled: z.boolean(),
    digest: z.enum(['realtime', 'hourly', 'daily', 'weekly']).optional().default('daily'),
    types: z.array(z.string()).optional(),
  }).optional(),
  push: z.object({
    enabled: z.boolean(),
    types: z.array(z.string()).optional(),
    quietHours: z.object({
      enabled: z.boolean(),
      start: z.string().optional(), // "22:00"
      end: z.string().optional(),   // "08:00"
      timezone: z.string().optional(),
    }).optional(),
  }).optional(),
  inApp: z.object({
    enabled: z.boolean(),
    types: z.array(z.string()).optional(),
  }).optional(),
  voice: z.object({
    enabled: z.boolean(),
    types: z.array(z.string()).optional(),
  }).optional(),
});

// ---------------------------------------------------------------------------
// GET /v1/notifications — get notifications
// ---------------------------------------------------------------------------

router.get(
  '/',
  requireAuth,
  defaultLimiter,
  validateQuery(ListNotificationsSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { status, type, limit, cursor } = req.query as unknown as z.infer<typeof ListNotificationsSchema>;

      let query = collections.notifications()
        .where('userId', '==', user.uid)
        .where('orgId', '==', user.orgId);

      if (status !== 'all') {
        query = query.where('status', '==', status);
      }

      if (type) {
        query = query.where('type', '==', type);
      }

      query = query.orderBy('sentAt', 'desc').limit(limit! + 1);

      if (cursor) {
        const cursorDoc = await collections.notifications().doc(cursor).get();
        if (cursorDoc.exists) {
          query = query.startAfter(cursorDoc);
        }
      }

      const snapshot = await query.get();
      const docs = snapshot.docs;

      const hasMore = docs.length > limit!;
      const resultDocs = hasMore ? docs.slice(0, limit!) : docs;
      const nextCursor = hasMore && resultDocs.length > 0 ? resultDocs[resultDocs.length - 1].id : undefined;

      // Count unread
      const unreadCount = await collections.notifications()
        .where('userId', '==', user.uid)
        .where('orgId', '==', user.orgId)
        .where('status', '==', 'unread')
        .count()
        .get();

      res.json({
        notifications: resultDocs.map((d) => ({ id: d.id, ...d.data() })),
        unreadCount: unreadCount.data().count,
        cursor: nextCursor,
        hasMore,
      });
    } catch (err) {
      console.error('Error fetching notifications:', err);
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /v1/notifications/:id/read — mark as read
// ---------------------------------------------------------------------------

router.post(
  '/:id/read',
  requireAuth,
  defaultLimiter,
  validate({ params: NotificationParamsSchema }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;

      const docRef = collections.notifications().doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        res.status(404).json({ error: 'Notification not found' });
        return;
      }

      const notification = doc.data()!;
      if (notification.userId !== user.uid) {
        res.status(404).json({ error: 'Notification not found' });
        return;
      }

      if (notification.status === 'read') {
        res.json({ id, status: 'read', readAt: notification.readAt });
        return;
      }

      const now = FieldValue.serverTimestamp();
      await docRef.update({
        status: 'read',
        readAt: now,
      });

      res.json({
        id,
        status: 'read',
      });
    } catch (err) {
      console.error('Error marking notification read:', err);
      res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /v1/notifications/preferences — get notification preferences
// ---------------------------------------------------------------------------

router.get(
  '/preferences',
  requireAuth,
  defaultLimiter,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;

      const userDoc = await collections.users().doc(user.uid).get();
      if (!userDoc.exists) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const userData = userDoc.data()!;
      const defaultPreferences = {
        email: { enabled: true, digest: 'daily', types: [] },
        push: { enabled: true, types: [], quietHours: { enabled: false } },
        inApp: { enabled: true, types: [] },
        voice: { enabled: false, types: [] },
      };

      res.json({
        userId: user.uid,
        preferences: userData.notificationPreferences ?? defaultPreferences,
      });
    } catch (err) {
      console.error('Error fetching notification preferences:', err);
      res.status(500).json({ error: 'Failed to fetch notification preferences' });
    }
  },
);

// ---------------------------------------------------------------------------
// PUT /v1/notifications/preferences — update preferences
// ---------------------------------------------------------------------------

router.put(
  '/preferences',
  requireAuth,
  defaultLimiter,
  validateBody(PreferencesUpdateSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;

      const userRef = collections.users().doc(user.uid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const existingPrefs = userDoc.data()!.notificationPreferences ?? {};
      const updatedPrefs = { ...existingPrefs, ...req.body };

      await userRef.update({
        notificationPreferences: updatedPrefs,
      });

      await publishAuditEvent({
        orgId: user.orgId,
        actorId: user.uid,
        actorType: 'user',
        action: 'notification.preferences.update',
        targetRef: user.uid,
        targetType: 'user',
        metadata: { fields: Object.keys(req.body) },
      });

      res.json({
        userId: user.uid,
        preferences: updatedPrefs,
      });
    } catch (err) {
      console.error('Error updating notification preferences:', err);
      res.status(500).json({ error: 'Failed to update notification preferences' });
    }
  },
);

export default router;
