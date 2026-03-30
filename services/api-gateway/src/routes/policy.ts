import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { defaultLimiter } from '../middleware/rate-limit.js';
import { collections } from '../lib/firestore.js';

const router = Router();

// ---------------------------------------------------------------------------
// GET /v1/policy/bundle — current policy bundle for authenticated user
// ---------------------------------------------------------------------------

router.get(
  '/bundle',
  requireAuth,
  defaultLimiter,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;

      // Load org-level policies
      const policiesSnapshot = await collections.policies()
        .where('orgId', '==', user.orgId)
        .where('enabled', '==', true)
        .get();

      const policies = policiesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Load org configuration for feature flags and kill switches
      const orgDoc = await collections.organizations().doc(user.orgId).get();
      let featureFlags: Record<string, boolean> = {};
      let killSwitches: Record<string, boolean> = {};

      if (orgDoc.exists) {
        const org = orgDoc.data()!;
        featureFlags = org.featureFlags ?? {};
        killSwitches = org.killSwitches ?? {};
      }

      // Load user-specific group overrides based on team membership
      const userTeamIds = user.teams;
      const groupOverrides: Record<string, unknown>[] = [];

      for (const policy of policies) {
        if (policy.groupOverrides && policy.groupOverrides.length > 0) {
          for (const override of policy.groupOverrides) {
            const overrideObj = override as Record<string, unknown>;
            const targetGroups = overrideObj.groups as string[] | undefined;
            if (targetGroups && targetGroups.some((g) => userTeamIds.includes(g))) {
              groupOverrides.push({
                policyId: policy.id,
                policyType: policy.type,
                ...overrideObj,
              });
            }
          }
        }
      }

      // Build the policy bundle
      const bundle = {
        orgId: user.orgId,
        userId: user.uid,
        generatedAt: new Date().toISOString(),
        policies: policies.map((p) => ({
          id: p.id,
          type: p.type,
          version: p.version,
          rules: p.rules,
          defaultAction: p.defaultAction,
        })),
        groupOverrides,
        featureFlags,
        killSwitches,
        userConfig: {
          accessTier: user.accessTier,
          roles: user.roles,
          teams: user.teams,
        },
      };

      // Set cache headers — policy bundles can be cached for a short period
      res.set('Cache-Control', 'private, max-age=300'); // 5 minutes
      res.json(bundle);
    } catch (err) {
      console.error('Error fetching policy bundle:', err);
      res.status(500).json({ error: 'Failed to fetch policy bundle' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /v1/policy/client-config — public client config for extension bootstrap
// ---------------------------------------------------------------------------
// Returns non-secret configuration the Chrome extension needs at startup.
// The Firebase client API key is a *public* project identifier, not a secret.
// See: https://firebase.google.com/docs/projects/api-keys

router.get(
  '/client-config',
  defaultLimiter,
  async (_req: Request, res: Response): Promise<void> => {
    res.set('Cache-Control', 'public, max-age=3600'); // 1 hour
    res.json({
      firebase: {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
        authDomain: process.env.FIREBASE_AUTH_DOMAIN ?? 'lurk-a692c.firebaseapp.com',
        projectId: process.env.GCP_PROJECT_ID ?? 'lurk-a692c',
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET ?? 'lurk-a692c.firebasestorage.app',
      },
      api: {
        version: 'v1',
      },
    });
  },
);

export default router;
