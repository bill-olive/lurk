/**
 * Lurk Notification Service -- Express application.
 *
 * Routes:
 *   POST /v1/notify/send   - Send a notification
 *   POST /v1/notify/digest - Generate and send a digest
 *   GET  /health           - Health check
 */

import express, { type Request, type Response, type NextFunction } from "express";
import {
  NotificationRouter,
  type NotificationPayload,
  type UserPreferences,
  type OrgPolicy,
  type DigestPayload,
} from "./router.js";

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json({ limit: "1mb" }));

const router = new NotificationRouter();

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

interface SendRequest {
  payload: NotificationPayload;
  preferences: UserPreferences;
  policy: OrgPolicy;
}

interface DigestRequest {
  digest: DigestPayload;
  preferences: UserPreferences;
  policy: OrgPolicy;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.post("/v1/notify/send", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { payload, preferences, policy } = req.body as SendRequest;

    if (!payload?.id || !payload?.userId || !payload?.title) {
      res.status(400).json({
        error: "Missing required fields: payload.id, payload.userId, payload.title",
      });
      return;
    }

    if (!preferences?.userId) {
      res.status(400).json({ error: "Missing required field: preferences.userId" });
      return;
    }

    if (!policy?.orgId) {
      res.status(400).json({ error: "Missing required field: policy.orgId" });
      return;
    }

    const result = await router.route(payload, preferences, policy);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.post("/v1/notify/digest", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { digest, preferences, policy } = req.body as DigestRequest;

    if (!digest?.userId || !digest?.notifications) {
      res.status(400).json({
        error: "Missing required fields: digest.userId, digest.notifications",
      });
      return;
    }

    if (!preferences?.userId) {
      res.status(400).json({ error: "Missing required field: preferences.userId" });
      return;
    }

    if (!policy?.orgId) {
      res.status(400).json({ error: "Missing required field: policy.orgId" });
      return;
    }

    const result = await router.sendDigest(digest, preferences, policy);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    service: "notification-service",
    status: "ok",
    version: "0.1.0",
  });
});

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(`[notification-service] Unhandled error: ${err.message}`, err.stack);
  res.status(500).json({
    error: "Internal server error",
    message: process.env["NODE_ENV"] === "production" ? undefined : err.message,
  });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env["PORT"] ?? "8080", 10);

app.listen(PORT, () => {
  console.log(`[notification-service] Listening on port ${PORT}`);
});

export { app };
