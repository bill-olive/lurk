/**
 * APNs push notification connector via Firebase Cloud Messaging (FCM).
 *
 * Uses firebase-admin to send push notifications to iOS/Android devices.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PushPayload {
  /** FCM device token(s) */
  tokens: string[];
  /** Notification title */
  title: string;
  /** Notification body */
  body: string;
  /** Badge count (iOS) */
  badge?: number;
  /** Sound name */
  sound?: string;
  /** Deep-link URL */
  actionUrl?: string;
  /** Category for actionable notifications (iOS) */
  category?: string;
  /** Thread identifier for grouping (iOS) */
  threadId?: string;
  /** Additional data payload */
  data?: Record<string, string>;
  /** Priority: "normal" | "high" */
  priority?: "normal" | "high";
  /** TTL in seconds */
  ttlSeconds?: number;
}

export interface PushResult {
  success: boolean;
  successCount: number;
  failureCount: number;
  /** Tokens that should be removed (unregistered devices) */
  invalidTokens: string[];
  error?: string;
}

// ---------------------------------------------------------------------------
// Connector
// ---------------------------------------------------------------------------

export class APNsConnector {
  private messaging: FirebaseMessaging | null = null;

  constructor(messagingInstance?: FirebaseMessaging) {
    this.messaging = messagingInstance ?? null;
  }

  /**
   * Lazy-initialise Firebase Cloud Messaging.
   */
  private getMessaging(): FirebaseMessaging {
    if (this.messaging) return this.messaging;

    try {
      const admin = require("firebase-admin");
      if (!admin.apps.length) {
        admin.initializeApp();
      }
      this.messaging = admin.messaging() as FirebaseMessaging;
      return this.messaging;
    } catch {
      throw new Error(
        "Firebase Messaging not available. Initialise firebase-admin before using APNsConnector."
      );
    }
  }

  /**
   * Send push notifications to one or more device tokens.
   */
  async send(payload: PushPayload): Promise<PushResult> {
    if (payload.tokens.length === 0) {
      return {
        success: true,
        successCount: 0,
        failureCount: 0,
        invalidTokens: [],
      };
    }

    const messaging = this.getMessaging();

    const message: MulticastMessage = {
      tokens: payload.tokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        ...(payload.data ?? {}),
        ...(payload.actionUrl ? { actionUrl: payload.actionUrl } : {}),
      },
      android: {
        priority: payload.priority === "high" ? "high" : "normal",
        ttl: (payload.ttlSeconds ?? 3600) * 1000,
        notification: {
          sound: payload.sound ?? "default",
          channelId: payload.category ?? "default",
        },
      },
      apns: {
        headers: {
          "apns-priority": payload.priority === "high" ? "10" : "5",
          ...(payload.ttlSeconds !== undefined
            ? {
                "apns-expiration": String(
                  Math.floor(Date.now() / 1000) + payload.ttlSeconds
                ),
              }
            : {}),
        },
        payload: {
          aps: {
            alert: {
              title: payload.title,
              body: payload.body,
            },
            badge: payload.badge,
            sound: payload.sound ?? "default",
            "thread-id": payload.threadId,
            category: payload.category,
          },
        },
      },
    };

    try {
      const response = await messaging.sendEachForMulticast(message);

      const invalidTokens: string[] = [];
      response.responses.forEach(
        (resp: SendResponse, idx: number) => {
          if (!resp.success && resp.error) {
            const code = resp.error.code;
            if (
              code === "messaging/registration-token-not-registered" ||
              code === "messaging/invalid-registration-token"
            ) {
              const token = payload.tokens[idx];
              if (token) {
                invalidTokens.push(token);
              }
            }
          }
        }
      );

      console.log(
        `[APNsConnector] Sent to ${response.successCount}/${payload.tokens.length} devices`
      );

      return {
        success: response.failureCount === 0,
        successCount: response.successCount,
        failureCount: response.failureCount,
        invalidTokens,
      };
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      console.error(`[APNsConnector] Failed to send push: ${errMessage}`);
      return {
        success: false,
        successCount: 0,
        failureCount: payload.tokens.length,
        invalidTokens: [],
        error: errMessage,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Firebase type stubs (to avoid importing the full SDK at compile time)
// ---------------------------------------------------------------------------

interface FirebaseMessaging {
  sendEachForMulticast(message: MulticastMessage): Promise<BatchResponse>;
}

interface MulticastMessage {
  tokens: string[];
  notification?: { title?: string; body?: string };
  data?: Record<string, string>;
  android?: Record<string, unknown>;
  apns?: Record<string, unknown>;
}

interface SendResponse {
  success: boolean;
  messageId?: string;
  error?: { code: string; message: string };
}

interface BatchResponse {
  responses: SendResponse[];
  successCount: number;
  failureCount: number;
}
