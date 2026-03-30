import rateLimit from 'express-rate-limit';

// ---------------------------------------------------------------------------
// Rate limiting middleware with tiered limits per route group
// ---------------------------------------------------------------------------

/**
 * Default rate limiter for general API requests.
 * 100 requests per minute per IP.
 */
export const defaultLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
  keyGenerator: (req) => req.user?.uid ?? req.ip ?? 'unknown',
});

/**
 * Strict rate limiter for write operations (commits, syncs).
 * 30 requests per minute per user.
 */
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many write operations. Please try again later.' },
  keyGenerator: (req) => req.user?.uid ?? req.ip ?? 'unknown',
});

/**
 * Rate limiter for search operations (more expensive).
 * 20 requests per minute per user.
 */
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many search requests. Please try again later.' },
  keyGenerator: (req) => req.user?.uid ?? req.ip ?? 'unknown',
});

/**
 * Rate limiter for agent operations (higher throughput needed).
 * 200 requests per minute per service account.
 */
export const agentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Agent rate limit exceeded.' },
  keyGenerator: (req) => req.user?.uid ?? req.ip ?? 'unknown',
});

/**
 * Rate limiter for migration operations (long-running, limited).
 * 5 requests per minute per user.
 */
export const migrationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many migration requests. Please try again later.' },
  keyGenerator: (req) => req.user?.uid ?? req.ip ?? 'unknown',
});

/**
 * Rate limiter for admin operations.
 * 60 requests per minute per user.
 */
export const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Admin rate limit exceeded.' },
  keyGenerator: (req) => req.user?.uid ?? req.ip ?? 'unknown',
});

/**
 * Rate limiter for auth-related endpoints.
 * 10 requests per minute per IP (brute-force protection).
 */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' },
});
