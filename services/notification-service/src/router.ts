/**
 * NotificationRouter -- PRD Section 12.2
 *
 * Routes notifications to the correct connector based on:
 *   - User preferences (per-category channel selections)
 *   - Org policy (mandatory channels, blocked channels)
 *   - Quiet hours enforcement
 *   - Payload redaction per sensitivity policy
 *
 * Supported channels: in_app, apns, email, webhook, slack_webhook
 */

import { InAppConnector, type InAppNotification } from "./connectors/in-app.js";
import { EmailConnector, type EmailPayload } from "./connectors/email.js";
import { WebhookConnector, type WebhookPayload } from "./connectors/webhook.js";
import { APNsConnector, type PushPayload } from "./connectors/apns.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationChannel =
  | "in_app"
  | "apns"
  | "email"
  | "webhook"
  | "slack_webhook";

export interface NotificationPayload {
  /** Unique notification ID */
  id: string;
  /** Target user ID */
  userId: string;
  /** Organisation ID */
  orgId: string;
  /** Notification title */
  title: string;
  /** Notification body */
  body: string;
  /** Category (e.g., "mention", "pr_update", "migration_complete") */
  category: string;
  /** Priority */
  priority: "low" | "normal" | "high" | "urgent";
  /** Deep-link URL */
  actionUrl?: string;
  /** Whether this notification is mandatory (bypasses quiet hours) */
  mandatory?: boolean;
  /** Sensitivity level for redaction */
  sensitivity?: "public" | "internal" | "confidential" | "restricted";
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface UserPreferences {
  userId: string;
  /** Channels the user wants per category. null = all defaults */
  channels: Partial<Record<string, NotificationChannel[]>>;
  /** Default channels when no category-specific config exists */
  defaultChannels: NotificationChannel[];
  /** Quiet hours config */
  quietHours?: {
    enabled: boolean;
    /** Start time in HH:mm (user's local time) */
    start: string;
    /** End time in HH:mm */
    end: string;
    /** User's timezone (IANA) */
    timezone: string;
  };
  /** Email address for email channel */
  email?: string;
  /** FCM device tokens for push */
  deviceTokens?: string[];
  /** Webhook URL */
  webhookUrl?: string;
  /** Slack webhook URL */
  slackWebhookUrl?: string;
}

export interface OrgPolicy {
  orgId: string;
  /** Channels that MUST be used regardless of user prefs */
  mandatoryChannels: NotificationChannel[];
  /** Channels that are NOT allowed */
  blockedChannels: NotificationChannel[];
  /** Categories that bypass quiet hours */
  urgentCategories: string[];
  /** Redaction policy: strip body for certain sensitivity levels */
  redactAbove?: "internal" | "confidential" | "restricted";
}

export interface RoutingResult {
  notificationId: string;
  channelsAttempted: NotificationChannel[];
  results: Record<NotificationChannel, { success: boolean; error?: string }>;
}

export interface DigestPayload {
  userId: string;
  orgId: string;
  notifications: NotificationPayload[];
  /** Digest type */
  type: "daily" | "weekly";
}

export interface DigestResult {
  success: boolean;
  notificationCount: number;
  channelUsed: NotificationChannel;
  error?: string;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export class NotificationRouter {
  private readonly inApp: InAppConnector;
  private readonly email: EmailConnector;
  private readonly webhook: WebhookConnector;
  private readonly apns: APNsConnector;

  constructor(deps?: {
    inApp?: InAppConnector;
    email?: EmailConnector;
    webhook?: WebhookConnector;
    apns?: APNsConnector;
  }) {
    this.inApp = deps?.inApp ?? new InAppConnector();
    this.email = deps?.email ?? new EmailConnector();
    this.webhook = deps?.webhook ?? new WebhookConnector();
    this.apns = deps?.apns ?? new APNsConnector();
  }

  /**
   * Route a notification to the appropriate channels.
   */
  async route(
    payload: NotificationPayload,
    preferences: UserPreferences,
    policy: OrgPolicy
  ): Promise<RoutingResult> {
    // 1. Determine target channels
    let channels = this.resolveChannels(payload, preferences, policy);

    // 2. Enforce quiet hours (unless mandatory or urgent)
    if (!payload.mandatory && !policy.urgentCategories.includes(payload.category)) {
      if (this.isQuietHours(preferences)) {
        // During quiet hours, only deliver in_app (silent)
        channels = channels.filter((c) => c === "in_app");
        if (channels.length === 0) {
          channels = ["in_app"];
        }
      }
    }

    // 3. Redact payload per policy
    const redactedPayload = this.redactPayload(payload, policy);

    // 4. Deliver to each channel
    const results: Record<
      NotificationChannel,
      { success: boolean; error?: string }
    > = {} as any;

    const deliveryPromises = channels.map(async (channel) => {
      try {
        const result = await this.deliverToChannel(
          channel,
          redactedPayload,
          preferences
        );
        results[channel] = result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results[channel] = { success: false, error: message };
      }
    });

    await Promise.allSettled(deliveryPromises);

    return {
      notificationId: payload.id,
      channelsAttempted: channels,
      results,
    };
  }

  /**
   * Generate and send a digest (daily/weekly summary).
   */
  async sendDigest(
    digest: DigestPayload,
    preferences: UserPreferences,
    policy: OrgPolicy
  ): Promise<DigestResult> {
    if (digest.notifications.length === 0) {
      return {
        success: true,
        notificationCount: 0,
        channelUsed: "email",
      };
    }

    // Build digest content
    const title = `Your ${digest.type} Lurk digest`;
    const lines = digest.notifications.map(
      (n, i) => `${i + 1}. [${n.category}] ${n.title}: ${n.body}`
    );
    const body = `${title}\n\n${lines.join("\n")}`;
    const html = this.buildDigestHtml(digest);

    // Prefer email for digests, fall back to in_app
    const channel: NotificationChannel =
      preferences.email && !policy.blockedChannels.includes("email")
        ? "email"
        : "in_app";

    try {
      if (channel === "email" && preferences.email) {
        const result = await this.email.send({
          to: preferences.email,
          subject: title,
          text: body,
          html,
        });
        return {
          success: result.success,
          notificationCount: digest.notifications.length,
          channelUsed: "email",
          error: result.error,
        };
      }

      // Fallback: in_app
      const result = await this.inApp.send({
        notificationId: `digest_${digest.userId}_${Date.now()}`,
        userId: digest.userId,
        orgId: digest.orgId,
        title,
        body: body.slice(0, 500),
        category: "digest",
        priority: "low",
        createdAt: new Date().toISOString(),
        read: false,
        dismissed: false,
      });

      return {
        success: result.success,
        notificationCount: digest.notifications.length,
        channelUsed: "in_app",
        error: result.error,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        notificationCount: digest.notifications.length,
        channelUsed: channel,
        error: message,
      };
    }
  }

  // ------------------------------------------------------------------
  // Channel resolution
  // ------------------------------------------------------------------

  private resolveChannels(
    payload: NotificationPayload,
    preferences: UserPreferences,
    policy: OrgPolicy
  ): NotificationChannel[] {
    // Start with user's category-specific preference or defaults
    const userChannels =
      preferences.channels[payload.category] ?? preferences.defaultChannels;

    // Merge mandatory channels from org policy
    const channelSet = new Set<NotificationChannel>(userChannels);
    for (const ch of policy.mandatoryChannels) {
      channelSet.add(ch);
    }

    // Remove blocked channels
    for (const ch of policy.blockedChannels) {
      channelSet.delete(ch);
    }

    // Urgent notifications always include in_app + apns
    if (payload.priority === "urgent" || payload.mandatory) {
      channelSet.add("in_app");
      if (preferences.deviceTokens?.length) {
        channelSet.add("apns");
      }
    }

    return Array.from(channelSet);
  }

  // ------------------------------------------------------------------
  // Quiet hours
  // ------------------------------------------------------------------

  private isQuietHours(preferences: UserPreferences): boolean {
    const qh = preferences.quietHours;
    if (!qh?.enabled) return false;

    try {
      const now = new Date();
      const userTime = new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: qh.timezone,
      }).format(now);

      const currentMinutes = this.timeToMinutes(userTime);
      const startMinutes = this.timeToMinutes(qh.start);
      const endMinutes = this.timeToMinutes(qh.end);

      // Handle overnight quiet hours (e.g., 22:00 - 07:00)
      if (startMinutes > endMinutes) {
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
      }

      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } catch {
      return false;
    }
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(":").map(Number);
    return (hours ?? 0) * 60 + (minutes ?? 0);
  }

  // ------------------------------------------------------------------
  // Payload redaction
  // ------------------------------------------------------------------

  private redactPayload(
    payload: NotificationPayload,
    policy: OrgPolicy
  ): NotificationPayload {
    if (!policy.redactAbove) return payload;

    const sensitivityOrder = ["public", "internal", "confidential", "restricted"];
    const payloadLevel = payload.sensitivity ?? "internal";
    const threshold = policy.redactAbove;

    const payloadIdx = sensitivityOrder.indexOf(payloadLevel);
    const thresholdIdx = sensitivityOrder.indexOf(threshold);

    if (payloadIdx >= thresholdIdx) {
      // Redact the body -- keep title and category for routing
      return {
        ...payload,
        body: "[Content redacted per organization policy]",
        metadata: undefined,
      };
    }

    return payload;
  }

  // ------------------------------------------------------------------
  // Channel delivery
  // ------------------------------------------------------------------

  private async deliverToChannel(
    channel: NotificationChannel,
    payload: NotificationPayload,
    preferences: UserPreferences
  ): Promise<{ success: boolean; error?: string }> {
    switch (channel) {
      case "in_app":
        return this.deliverInApp(payload);
      case "apns":
        return this.deliverAPNs(payload, preferences);
      case "email":
        return this.deliverEmail(payload, preferences);
      case "webhook":
        return this.deliverWebhook(payload, preferences);
      case "slack_webhook":
        return this.deliverSlackWebhook(payload, preferences);
      default:
        return { success: false, error: `Unknown channel: ${channel}` };
    }
  }

  private async deliverInApp(
    payload: NotificationPayload
  ): Promise<{ success: boolean; error?: string }> {
    const notification: InAppNotification = {
      notificationId: payload.id,
      userId: payload.userId,
      orgId: payload.orgId,
      title: payload.title,
      body: payload.body,
      actionUrl: payload.actionUrl,
      category: payload.category,
      priority: payload.priority,
      createdAt: new Date().toISOString(),
      read: false,
      dismissed: false,
      metadata: payload.metadata,
    };
    const result = await this.inApp.send(notification);
    return { success: result.success, error: result.error };
  }

  private async deliverAPNs(
    payload: NotificationPayload,
    preferences: UserPreferences
  ): Promise<{ success: boolean; error?: string }> {
    const tokens = preferences.deviceTokens ?? [];
    if (tokens.length === 0) {
      return { success: false, error: "No device tokens configured" };
    }

    const pushPayload: PushPayload = {
      tokens,
      title: payload.title,
      body: payload.body,
      priority: payload.priority === "urgent" || payload.priority === "high" ? "high" : "normal",
      category: payload.category,
      actionUrl: payload.actionUrl,
      data: {
        notificationId: payload.id,
        category: payload.category,
      },
    };

    const result = await this.apns.send(pushPayload);
    return {
      success: result.success,
      error: result.error,
    };
  }

  private async deliverEmail(
    payload: NotificationPayload,
    preferences: UserPreferences
  ): Promise<{ success: boolean; error?: string }> {
    if (!preferences.email) {
      return { success: false, error: "No email address configured" };
    }

    const emailPayload: EmailPayload = {
      to: preferences.email,
      subject: `[Lurk] ${payload.title}`,
      text: `${payload.title}\n\n${payload.body}${payload.actionUrl ? `\n\nView: ${payload.actionUrl}` : ""}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px;">
          <h2 style="margin-bottom: 8px;">${this.escapeHtml(payload.title)}</h2>
          <p style="color: #374151; line-height: 1.6;">${this.escapeHtml(payload.body)}</p>
          ${payload.actionUrl ? `<a href="${payload.actionUrl}" style="display: inline-block; margin-top: 16px; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">View in Lurk</a>` : ""}
        </div>
      `,
    };

    const result = await this.email.send(emailPayload);
    return { success: result.success, error: result.error };
  }

  private async deliverWebhook(
    payload: NotificationPayload,
    preferences: UserPreferences
  ): Promise<{ success: boolean; error?: string }> {
    if (!preferences.webhookUrl) {
      return { success: false, error: "No webhook URL configured" };
    }

    const webhookPayload: WebhookPayload = {
      url: preferences.webhookUrl,
      body: {
        event: "notification",
        notification: {
          id: payload.id,
          title: payload.title,
          body: payload.body,
          category: payload.category,
          priority: payload.priority,
          actionUrl: payload.actionUrl,
          timestamp: new Date().toISOString(),
        },
      },
    };

    const result = await this.webhook.send(webhookPayload);
    return { success: result.success, error: result.error };
  }

  private async deliverSlackWebhook(
    payload: NotificationPayload,
    preferences: UserPreferences
  ): Promise<{ success: boolean; error?: string }> {
    if (!preferences.slackWebhookUrl) {
      return { success: false, error: "No Slack webhook URL configured" };
    }

    const webhookPayload: WebhookPayload = {
      url: preferences.slackWebhookUrl,
      body: {
        text: `*${payload.title}*\n${payload.body}`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*${payload.title}*\n${payload.body}`,
            },
          },
          ...(payload.actionUrl
            ? [
                {
                  type: "actions",
                  elements: [
                    {
                      type: "button",
                      text: { type: "plain_text", text: "View in Lurk" },
                      url: payload.actionUrl,
                    },
                  ],
                },
              ]
            : []),
        ],
      },
    };

    const result = await this.webhook.send(webhookPayload);
    return { success: result.success, error: result.error };
  }

  // ------------------------------------------------------------------
  // Digest HTML builder
  // ------------------------------------------------------------------

  private buildDigestHtml(digest: DigestPayload): string {
    const rows = digest.notifications
      .map(
        (n) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">
          <span style="display: inline-block; padding: 2px 8px; background: #dbeafe; color: #1e40af; border-radius: 4px; font-size: 12px;">${this.escapeHtml(n.category)}</span>
        </td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">
          <strong>${this.escapeHtml(n.title)}</strong><br/>
          <span style="color: #6b7280; font-size: 14px;">${this.escapeHtml(n.body.slice(0, 150))}</span>
        </td>
      </tr>
    `
      )
      .join("");

    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px;">
        <h2>Your ${digest.type} Lurk digest</h2>
        <p style="color: #6b7280;">${digest.notifications.length} notifications</p>
        <table style="width: 100%; border-collapse: collapse;">${rows}</table>
      </div>
    `;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}
