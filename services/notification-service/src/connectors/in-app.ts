/**
 * In-app notification connector.
 *
 * Writes notification documents to Firestore so the client can
 * subscribe to real-time updates via onSnapshot.
 */

import type { Firestore } from "firebase-admin/firestore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InAppNotification {
  notificationId: string;
  userId: string;
  orgId: string;
  title: string;
  body: string;
  /** Deep-link URL within the Lurk app */
  actionUrl?: string;
  /** Notification category for client-side grouping */
  category: string;
  /** Priority: low | normal | high | urgent */
  priority: "low" | "normal" | "high" | "urgent";
  /** ISO timestamp */
  createdAt: string;
  read: boolean;
  dismissed: boolean;
  metadata?: Record<string, unknown>;
}

export interface InAppResult {
  success: boolean;
  documentId?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Connector
// ---------------------------------------------------------------------------

export class InAppConnector {
  private db: Firestore | null = null;
  private readonly collectionName = "notifications";

  constructor(firestore?: Firestore) {
    this.db = firestore ?? null;
  }

  /**
   * Lazy-initialise the Firestore client.
   * In production, firebase-admin is initialised at app startup.
   */
  private getDb(): Firestore {
    if (this.db) return this.db;

    // Attempt lazy init via firebase-admin default app
    try {
      // Dynamic import avoided in favour of require-style for sync init.
      // In the real service, admin.initializeApp() is called in index.ts.
      const admin = require("firebase-admin");
      if (!admin.apps.length) {
        admin.initializeApp();
      }
      this.db = admin.firestore() as Firestore;
      return this.db;
    } catch {
      throw new Error(
        "Firestore not available. Initialise firebase-admin before using InAppConnector."
      );
    }
  }

  /**
   * Send an in-app notification by writing to Firestore.
   */
  async send(notification: InAppNotification): Promise<InAppResult> {
    try {
      const db = this.getDb();
      const docRef = db
        .collection(this.collectionName)
        .doc(notification.notificationId);

      await docRef.set({
        ...notification,
        createdAt: notification.createdAt || new Date().toISOString(),
        read: false,
        dismissed: false,
      });

      return {
        success: true,
        documentId: notification.notificationId,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[InAppConnector] Failed to write notification: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * Send a batch of in-app notifications.
   */
  async sendBatch(notifications: InAppNotification[]): Promise<InAppResult[]> {
    const db = this.getDb();
    const batch = db.batch();
    const results: InAppResult[] = [];

    for (const notification of notifications) {
      const docRef = db
        .collection(this.collectionName)
        .doc(notification.notificationId);

      batch.set(docRef, {
        ...notification,
        createdAt: notification.createdAt || new Date().toISOString(),
        read: false,
        dismissed: false,
      });

      results.push({
        success: true,
        documentId: notification.notificationId,
      });
    }

    try {
      await batch.commit();
      return results;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[InAppConnector] Batch write failed: ${message}`);
      return notifications.map((n) => ({
        success: false,
        documentId: n.notificationId,
        error: message,
      }));
    }
  }

  /**
   * Mark a notification as read.
   */
  async markRead(notificationId: string): Promise<void> {
    const db = this.getDb();
    await db.collection(this.collectionName).doc(notificationId).update({
      read: true,
      readAt: new Date().toISOString(),
    });
  }

  /**
   * Dismiss a notification.
   */
  async dismiss(notificationId: string): Promise<void> {
    const db = this.getDb();
    await db.collection(this.collectionName).doc(notificationId).update({
      dismissed: true,
      dismissedAt: new Date().toISOString(),
    });
  }
}
