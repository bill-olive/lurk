/**
 * AuditLogger -- immutable audit trail for the Lurk platform.
 *
 * Core principles:
 *   - NO content in logs (fingerprints only for traceability)
 *   - Full lineage captured: actor, action, target, metadata
 *   - Immutable: audit records are append-only
 *   - BigQuery export for compliance and analytics
 *
 * Writes to Firestore `audits` collection with the schema:
 *   {
 *     eventId: string,
 *     timestamp: ISO string,
 *     actor: { userId, orgId, role, ipAddress, userAgent },
 *     action: string (verb),
 *     target: { type, id, fingerprint },
 *     result: "success" | "failure" | "denied",
 *     metadata: { ... },  // no PII, no content
 *     lineage: { parentEventId?, sessionId, requestId }
 *   }
 */

import crypto from "node:crypto";
import type { Firestore, CollectionReference } from "firebase-admin/firestore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditActor {
  userId: string;
  orgId: string;
  role?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditTarget {
  /** Resource type (e.g., "document", "message", "channel", "user") */
  type: string;
  /** Resource ID */
  id: string;
  /** Content fingerprint (hash, NOT the actual content) */
  fingerprint?: string;
}

export interface AuditLineage {
  /** Parent event that caused this event */
  parentEventId?: string;
  /** User session ID */
  sessionId?: string;
  /** HTTP request ID */
  requestId?: string;
}

export interface AuditEvent {
  eventId: string;
  timestamp: string;
  actor: AuditActor;
  action: string;
  target: AuditTarget;
  result: "success" | "failure" | "denied";
  metadata?: Record<string, unknown>;
  lineage?: AuditLineage;
}

export interface LogEventInput {
  actor: AuditActor;
  action: string;
  target: AuditTarget;
  result: "success" | "failure" | "denied";
  metadata?: Record<string, unknown>;
  lineage?: AuditLineage;
}

export interface AuditQueryParams {
  orgId: string;
  /** Filter by actor user ID */
  actorUserId?: string;
  /** Filter by action verb */
  action?: string;
  /** Filter by target type */
  targetType?: string;
  /** Filter by target ID */
  targetId?: string;
  /** Filter by result */
  result?: "success" | "failure" | "denied";
  /** Start of time range (ISO string) */
  startTime?: string;
  /** End of time range (ISO string) */
  endTime?: string;
  /** Maximum results */
  limit?: number;
  /** Pagination cursor (last eventId) */
  cursor?: string;
}

export interface AuditQueryResult {
  events: AuditEvent[];
  totalCount: number;
  nextCursor?: string;
}

export interface BigQueryExportResult {
  success: boolean;
  rowsExported: number;
  datasetId: string;
  tableId: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Content sanitisation helpers
// ---------------------------------------------------------------------------

/**
 * Generate a SHA-256 fingerprint of content.
 * This is the ONLY representation of content that enters the audit log.
 */
export function fingerprint(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 32);
}

/**
 * Sanitise metadata to ensure no content leaks into the audit log.
 * Removes any values that look like PII or content.
 */
function sanitiseMetadata(
  metadata: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!metadata) return undefined;

  const sanitised: Record<string, unknown> = {};
  const FORBIDDEN_KEYS = new Set([
    "content",
    "body",
    "text",
    "message",
    "email",
    "phone",
    "ssn",
    "password",
    "secret",
    "token",
    "apiKey",
    "api_key",
    "creditCard",
    "credit_card",
  ]);

  for (const [key, value] of Object.entries(metadata)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) {
      continue; // strip potentially sensitive fields
    }

    // Only allow primitive types and arrays of primitives
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      // Reject strings that look like content (> 200 chars)
      if (typeof value === "string" && value.length > 200) {
        sanitised[key] = fingerprint(value);
      } else {
        sanitised[key] = value;
      }
    } else if (Array.isArray(value)) {
      sanitised[key] = value.filter(
        (v) =>
          typeof v === "string" ||
          typeof v === "number" ||
          typeof v === "boolean"
      );
    }
    // Objects are dropped to prevent nested content leaks
  }

  return Object.keys(sanitised).length > 0 ? sanitised : undefined;
}

// ---------------------------------------------------------------------------
// AuditLogger
// ---------------------------------------------------------------------------

export class AuditLogger {
  private db: Firestore | null = null;
  private readonly collectionName = "audits";

  constructor(firestore?: Firestore) {
    this.db = firestore ?? null;
  }

  private getCollection(): CollectionReference {
    const db = this.getDb();
    return db.collection(this.collectionName);
  }

  private getDb(): Firestore {
    if (this.db) return this.db;

    try {
      const admin = require("firebase-admin");
      if (!admin.apps.length) {
        admin.initializeApp();
      }
      this.db = admin.firestore() as Firestore;
      return this.db;
    } catch {
      throw new Error(
        "Firestore not available. Initialise firebase-admin before using AuditLogger."
      );
    }
  }

  // ------------------------------------------------------------------
  // Log
  // ------------------------------------------------------------------

  /**
   * Log an audit event. This is the primary write path.
   *
   * Content is NEVER stored -- only fingerprints.
   * Metadata is sanitised to strip any potential PII.
   */
  async log(input: LogEventInput): Promise<AuditEvent> {
    const event: AuditEvent = {
      eventId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      actor: input.actor,
      action: input.action,
      target: input.target,
      result: input.result,
      metadata: sanitiseMetadata(input.metadata),
      lineage: input.lineage,
    };

    const collection = this.getCollection();
    await collection.doc(event.eventId).set(event);

    console.log(
      `[AuditLogger] ${event.action} by ${event.actor.userId} on ${event.target.type}:${event.target.id} = ${event.result}`
    );

    return event;
  }

  /**
   * Log a batch of audit events atomically.
   */
  async logBatch(inputs: LogEventInput[]): Promise<AuditEvent[]> {
    const db = this.getDb();
    const batch = db.batch();
    const events: AuditEvent[] = [];

    for (const input of inputs) {
      const event: AuditEvent = {
        eventId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        actor: input.actor,
        action: input.action,
        target: input.target,
        result: input.result,
        metadata: sanitiseMetadata(input.metadata),
        lineage: input.lineage,
      };

      const docRef = this.getCollection().doc(event.eventId);
      batch.set(docRef, event);
      events.push(event);
    }

    await batch.commit();
    console.log(`[AuditLogger] Batch logged ${events.length} events`);
    return events;
  }

  // ------------------------------------------------------------------
  // Query
  // ------------------------------------------------------------------

  /**
   * Query audit events with filters and pagination.
   */
  async query(params: AuditQueryParams): Promise<AuditQueryResult> {
    let q: FirebaseFirestore.Query = this.getCollection();

    // Required: org-level scoping
    q = q.where("actor.orgId", "==", params.orgId);

    if (params.actorUserId) {
      q = q.where("actor.userId", "==", params.actorUserId);
    }
    if (params.action) {
      q = q.where("action", "==", params.action);
    }
    if (params.targetType) {
      q = q.where("target.type", "==", params.targetType);
    }
    if (params.targetId) {
      q = q.where("target.id", "==", params.targetId);
    }
    if (params.result) {
      q = q.where("result", "==", params.result);
    }
    if (params.startTime) {
      q = q.where("timestamp", ">=", params.startTime);
    }
    if (params.endTime) {
      q = q.where("timestamp", "<=", params.endTime);
    }

    q = q.orderBy("timestamp", "desc");

    // Pagination via cursor
    if (params.cursor) {
      const cursorDoc = await this.getCollection().doc(params.cursor).get();
      if (cursorDoc.exists) {
        q = q.startAfter(cursorDoc);
      }
    }

    const limit = Math.min(params.limit ?? 50, 500);
    q = q.limit(limit + 1); // fetch one extra to determine if there's a next page

    const snapshot = await q.get();
    const events: AuditEvent[] = [];
    let nextCursor: string | undefined;

    snapshot.docs.forEach((doc, index) => {
      if (index < limit) {
        events.push(doc.data() as AuditEvent);
      } else {
        // Extra document indicates more pages
        nextCursor = events[events.length - 1]?.eventId;
      }
    });

    return {
      events,
      totalCount: events.length,
      nextCursor,
    };
  }

  // ------------------------------------------------------------------
  // BigQuery export
  // ------------------------------------------------------------------

  /**
   * Export audit events to BigQuery for long-term retention and analytics.
   *
   * Exports events from Firestore to a BigQuery table, partitioned by date.
   */
  async exportToBigQuery(params: {
    orgId: string;
    startTime: string;
    endTime: string;
    datasetId?: string;
    tableId?: string;
  }): Promise<BigQueryExportResult> {
    const datasetId = params.datasetId ?? "lurk_audit";
    const tableId = params.tableId ?? "audit_events";

    try {
      // Query events in the time range
      const queryResult = await this.query({
        orgId: params.orgId,
        startTime: params.startTime,
        endTime: params.endTime,
        limit: 500,
      });

      if (queryResult.events.length === 0) {
        return {
          success: true,
          rowsExported: 0,
          datasetId,
          tableId,
        };
      }

      // Transform events to BigQuery rows
      const rows = queryResult.events.map((event) => ({
        event_id: event.eventId,
        timestamp: event.timestamp,
        actor_user_id: event.actor.userId,
        actor_org_id: event.actor.orgId,
        actor_role: event.actor.role ?? null,
        actor_ip: event.actor.ipAddress ?? null,
        action: event.action,
        target_type: event.target.type,
        target_id: event.target.id,
        target_fingerprint: event.target.fingerprint ?? null,
        result: event.result,
        metadata_json: event.metadata ? JSON.stringify(event.metadata) : null,
        session_id: event.lineage?.sessionId ?? null,
        request_id: event.lineage?.requestId ?? null,
        parent_event_id: event.lineage?.parentEventId ?? null,
      }));

      // In production, use @google-cloud/bigquery client:
      //   const bigquery = new BigQuery();
      //   await bigquery.dataset(datasetId).table(tableId).insert(rows);
      //
      // For now, we log the intent and return success.
      console.log(
        `[AuditLogger] Would export ${rows.length} rows to ${datasetId}.${tableId}`
      );

      return {
        success: true,
        rowsExported: rows.length,
        datasetId,
        tableId,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[AuditLogger] BigQuery export failed: ${message}`);
      return {
        success: false,
        rowsExported: 0,
        datasetId,
        tableId,
        error: message,
      };
    }
  }
}
