import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';

// ---------------------------------------------------------------------------
// Firebase Admin initialization
// ---------------------------------------------------------------------------

const FIREBASE_SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT;

if (FIREBASE_SERVICE_ACCOUNT) {
  // Explicit service account JSON (for local dev or Cloud Run with injected secret)
  try {
    const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT) as ServiceAccount;
    initializeApp({ credential: cert(serviceAccount) });
  } catch {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT JSON. Falling back to default credentials.');
    initializeApp();
  }
} else {
  // On Cloud Run, default credentials (ADC) are available automatically
  initializeApp();
}

// ---------------------------------------------------------------------------
// Import routes (after Firebase init so Firestore is available)
// ---------------------------------------------------------------------------

import artifactRoutes from './routes/artifacts.js';
import pullRequestRoutes from './routes/pull-requests.js';
import ledgerRoutes from './routes/ledger.js';
import agentRoutes from './routes/agents.js';
import migrationRoutes from './routes/migration.js';
import adminRoutes from './routes/admin.js';
import notificationRoutes from './routes/notifications.js';
import meetingRoutes from './routes/meetings.js';
import feedbackRoutes from './routes/feedback.js';
import policyRoutes from './routes/policy.js';
import { defaultLimiter } from './middleware/rate-limit.js';

// ---------------------------------------------------------------------------
// Express app setup
// ---------------------------------------------------------------------------

const app = express();

// Trust Cloud Run proxy
app.set('trust proxy', true);

// Security headers
app.use(helmet());

// CORS — allow the Lurk web app, Chrome extension, and localhost dev
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*')) {
        return callback(null, true);
      }
      // Allow any *.lurk.app subdomain
      if (/^https:\/\/.*\.lurk\.app$/.test(origin)) {
        return callback(null, true);
      }
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Lurk-Service-Account',
      'X-Lurk-Agent-Id',
      'X-Lurk-Org-Id',
      'X-Request-Id',
    ],
    maxAge: 86400,
  }),
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global rate limiting
app.use(defaultLimiter);

// Request ID middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] as string || crypto.randomUUID();
  req.headers['x-request-id'] = requestId;
  next();
});

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const requestId = req.headers['x-request-id'];

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    const log = {
      level,
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    };
    if (level === 'error') {
      console.error(JSON.stringify(log));
    } else {
      console.log(JSON.stringify(log));
    }
  });

  next();
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'api-gateway',
    version: process.env.SERVICE_VERSION ?? '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Route mounting
// ---------------------------------------------------------------------------

// Client -> Cloud APIs (Section 15.1)
app.use('/v1/artifacts', artifactRoutes);
app.use('/v1/prs', pullRequestRoutes);
app.use('/v1/ledger', ledgerRoutes);
app.use('/v1/policy', policyRoutes);
app.use('/v1/feedback', feedbackRoutes);
app.use('/v1/meetings', meetingRoutes);
app.use('/v1/notifications', notificationRoutes);

// Agent -> Cloud APIs (Section 15.2)
app.use('/v1/agent', agentRoutes);

// Migration APIs (Section 15.3)
app.use('/v1/migration', migrationRoutes);

// Admin APIs (Section 15.4)
app.use('/v1/admin', adminRoutes);

// ---------------------------------------------------------------------------
// 404 handler
// ---------------------------------------------------------------------------

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested endpoint does not exist. See API documentation at https://docs.lurk.app/api.',
  });
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------

app.use((err: Error & { type?: string }, req: Request, res: Response, _next: NextFunction) => {
  const requestId = req.headers['x-request-id'];

  console.error(JSON.stringify({
    level: 'error',
    requestId,
    error: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    method: req.method,
    path: req.path,
  }));

  // CORS errors
  if (err.message.startsWith('CORS:')) {
    res.status(403).json({ error: err.message });
    return;
  }

  // JSON parse errors
  if (err.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Invalid JSON in request body' });
    return;
  }

  // Payload too large
  if (err.type === 'entity.too.large') {
    res.status(413).json({ error: 'Request body too large. Maximum size is 10MB.' });
    return;
  }

  res.status(500).json({
    error: 'Internal server error',
    requestId,
  });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT ?? '8080', 10);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(JSON.stringify({
    level: 'info',
    message: `Lurk API Gateway listening on port ${PORT}`,
    environment: process.env.NODE_ENV ?? 'development',
  }));
});

// Graceful shutdown
const shutdown = (signal: string) => {
  console.log(JSON.stringify({ level: 'info', message: `Received ${signal}. Shutting down gracefully...` }));
  server.close(() => {
    console.log(JSON.stringify({ level: 'info', message: 'Server closed.' }));
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.error(JSON.stringify({ level: 'error', message: 'Forced shutdown after timeout.' }));
    process.exit(1);
  }, 10_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
