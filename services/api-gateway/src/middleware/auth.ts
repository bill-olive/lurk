import type { Request, Response, NextFunction } from 'express';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { collections } from '../lib/firestore.js';

// ---------------------------------------------------------------------------
// Authenticated user shape attached to req.user
// ---------------------------------------------------------------------------

export interface AuthenticatedUser {
  uid: string;
  email: string;
  orgId: string;
  roles: string[];
  teams: string[];
  ledgerId: string;
  accessTier: string;
  isServiceAccount: boolean;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

// Service account header for agent-to-API calls
const SERVICE_ACCOUNT_HEADER = 'x-lurk-service-account';
const SERVICE_ACCOUNT_SECRET = process.env.SERVICE_ACCOUNT_SECRET ?? '';

// ---------------------------------------------------------------------------
// Main auth middleware
// ---------------------------------------------------------------------------

/**
 * Firebase Auth middleware.
 *
 * - Extracts Bearer token from Authorization header
 * - Verifies with Firebase Admin
 * - Loads user profile from Firestore to attach orgId, roles, teams
 * - Supports service account auth for agent-to-API calls via
 *   X-Lurk-Service-Account header + shared secret
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // ---------- Service account path ----------
    const serviceToken = req.headers[SERVICE_ACCOUNT_HEADER] as string | undefined;
    if (serviceToken) {
      if (!SERVICE_ACCOUNT_SECRET || serviceToken !== SERVICE_ACCOUNT_SECRET) {
        res.status(401).json({ error: 'Invalid service account credentials' });
        return;
      }

      // Service accounts pass agent identity in headers
      const agentId = req.headers['x-lurk-agent-id'] as string;
      const orgId = req.headers['x-lurk-org-id'] as string;

      if (!agentId || !orgId) {
        res.status(400).json({ error: 'Service account requests require x-lurk-agent-id and x-lurk-org-id headers' });
        return;
      }

      // Verify agent exists and is active
      const agentDoc = await collections.agents().doc(agentId).get();
      if (!agentDoc.exists) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }

      const agent = agentDoc.data()!;
      if (agent.orgId !== orgId) {
        res.status(403).json({ error: 'Agent org mismatch' });
        return;
      }

      if (agent.status !== 'active') {
        res.status(403).json({ error: 'Agent is not active' });
        return;
      }

      req.user = {
        uid: agentId,
        email: `agent-${agentId}@lurk.internal`,
        orgId,
        roles: ['agent'],
        teams: [],
        ledgerId: '',
        accessTier: 'agent',
        isServiceAccount: true,
      };

      next();
      return;
    }

    // ---------- Bearer token path ----------
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header. Expected: Bearer <token>' });
      return;
    }

    const token = authHeader.slice(7);
    let decoded: DecodedIdToken;

    try {
      decoded = await getAuth().verifyIdToken(token);
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    // Load user profile from Firestore
    const userDoc = await collections.users().doc(decoded.uid).get();
    if (!userDoc.exists) {
      res.status(403).json({ error: 'User profile not found. Please complete onboarding.' });
      return;
    }

    const userData = userDoc.data()!;

    req.user = {
      uid: decoded.uid,
      email: decoded.email ?? userData.email,
      orgId: userData.orgId,
      roles: userData.roles ?? [],
      teams: userData.teams ?? [],
      ledgerId: userData.ledgerId,
      accessTier: userData.accessTier ?? 'standard',
      isServiceAccount: false,
    };

    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

// ---------------------------------------------------------------------------
// Role-based access helpers
// ---------------------------------------------------------------------------

/**
 * Middleware factory: require one of the specified roles.
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const hasRole = roles.some((role) => req.user!.roles.includes(role));
    if (!hasRole) {
      res.status(403).json({ error: `Requires one of roles: ${roles.join(', ')}` });
      return;
    }

    next();
  };
}

/**
 * Middleware: require admin role.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireRole('admin', 'org_admin')(req, res, next);
}

/**
 * Middleware: require the request to come from a service account (agent).
 */
export function requireServiceAccount(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.isServiceAccount) {
    res.status(403).json({ error: 'This endpoint requires service account authentication' });
    return;
  }
  next();
}

/**
 * Verify that the authenticated user belongs to the specified org.
 */
export function requireOrgMatch(orgIdParam: string = 'orgId') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const targetOrgId = req.params[orgIdParam] ?? req.body?.orgId;
    if (targetOrgId && req.user?.orgId !== targetOrgId && !req.user?.roles.includes('super_admin')) {
      res.status(403).json({ error: 'Access denied: org mismatch' });
      return;
    }
    next();
  };
}
