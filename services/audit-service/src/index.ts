/**
 * Lurk Audit Service -- Express application.
 *
 * Routes:
 *   POST /v1/audit/log    - Log an audit event
 *   GET  /v1/audit/query  - Query audit events
 *   POST /v1/audit/export - Export to BigQuery
 *   GET  /health          - Health check
 */

import express, { type Request, type Response, type NextFunction } from "express";
import {
  AuditLogger,
  type LogEventInput,
  type AuditQueryParams,
} from "./logger.js";

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json({ limit: "512kb" }));

const auditLogger = new AuditLogger();

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * POST /v1/audit/log
 *
 * Log a single audit event. Accepts a batch via `events` array.
 */
app.post("/v1/audit/log", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as {
      event?: LogEventInput;
      events?: LogEventInput[];
    };

    // Batch mode
    if (body.events && Array.isArray(body.events)) {
      if (body.events.length === 0) {
        res.status(400).json({ error: "events array must not be empty" });
        return;
      }
      if (body.events.length > 500) {
        res.status(400).json({ error: "Maximum 500 events per batch" });
        return;
      }

      const validationError = validateEvents(body.events);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      const results = await auditLogger.logBatch(body.events);
      res.status(201).json({
        logged: results.length,
        eventIds: results.map((e) => e.eventId),
      });
      return;
    }

    // Single event mode
    const event = body.event;
    if (!event) {
      res.status(400).json({
        error: "Request must contain either 'event' or 'events' field",
      });
      return;
    }

    const validationError = validateEvent(event);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const result = await auditLogger.log(event);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/audit/query
 *
 * Query audit events with filters.
 */
app.get("/v1/audit/query", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params: AuditQueryParams = {
      orgId: req.query["orgId"] as string,
      actorUserId: req.query["actorUserId"] as string | undefined,
      action: req.query["action"] as string | undefined,
      targetType: req.query["targetType"] as string | undefined,
      targetId: req.query["targetId"] as string | undefined,
      result: req.query["result"] as "success" | "failure" | "denied" | undefined,
      startTime: req.query["startTime"] as string | undefined,
      endTime: req.query["endTime"] as string | undefined,
      limit: req.query["limit"] ? parseInt(req.query["limit"] as string, 10) : undefined,
      cursor: req.query["cursor"] as string | undefined,
    };

    if (!params.orgId) {
      res.status(400).json({ error: "orgId query parameter is required" });
      return;
    }

    const result = await auditLogger.query(params);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/audit/export
 *
 * Export audit events to BigQuery.
 */
app.post("/v1/audit/export", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId, startTime, endTime, datasetId, tableId } = req.body as {
      orgId: string;
      startTime: string;
      endTime: string;
      datasetId?: string;
      tableId?: string;
    };

    if (!orgId || !startTime || !endTime) {
      res.status(400).json({
        error: "Required fields: orgId, startTime, endTime",
      });
      return;
    }

    const result = await auditLogger.exportToBigQuery({
      orgId,
      startTime,
      endTime,
      datasetId,
      tableId,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /health
 */
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    service: "audit-service",
    status: "ok",
    version: "0.1.0",
  });
});

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(`[audit-service] Unhandled error: ${err.message}`, err.stack);
  res.status(500).json({
    error: "Internal server error",
    message: process.env["NODE_ENV"] === "production" ? undefined : err.message,
  });
});

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateEvent(event: LogEventInput): string | null {
  if (!event.actor?.userId) return "actor.userId is required";
  if (!event.actor?.orgId) return "actor.orgId is required";
  if (!event.action) return "action is required";
  if (!event.target?.type) return "target.type is required";
  if (!event.target?.id) return "target.id is required";
  if (!event.result) return "result is required";
  if (!["success", "failure", "denied"].includes(event.result)) {
    return "result must be 'success', 'failure', or 'denied'";
  }
  return null;
}

function validateEvents(events: LogEventInput[]): string | null {
  for (let i = 0; i < events.length; i++) {
    const event = events[i]!;
    const error = validateEvent(event);
    if (error) return `events[${i}]: ${error}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env["PORT"] ?? "8080", 10);

app.listen(PORT, () => {
  console.log(`[audit-service] Listening on port ${PORT}`);
});

export { app };
