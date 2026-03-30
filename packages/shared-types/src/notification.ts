// ---------------------------------------------------------------------------
// Notification and Connector System (PRD Section 12)
// ---------------------------------------------------------------------------

import type { Timestamp } from './artifact';
import type { AgentType } from './agent';

// ---- Notification Type -----------------------------------------------------

export type NotificationType =
  | 'pr_opened'
  | 'pr_auto_merged'
  | 'conflict_detected'
  | 'review_requested'
  | 'agent_error'
  | 'policy_violation'
  | 'customer_event'
  | 'customer_health_alert'
  | 'calendar_recommendation'
  | 'meeting_summary_ready'
  | 'migration_complete'
  | 'migration_error'
  | 'digest'
  | 'voice_summary';

// ---- Notification Channel --------------------------------------------------

export type NotificationChannel =
  | 'in_app'
  | 'apns'
  | 'email'
  | 'webhook'
  | 'slack';

// ---- Notification Connector ------------------------------------------------

export type ConnectorType =
  | 'lurk_sidebar_and_app'
  | 'apple_push'
  | 'email'
  | 'webhook'
  | 'slack_webhook';

export interface NotificationConnector {
  id: string;
  type: ConnectorType;
  channel: NotificationChannel;
  alwaysEnabled: boolean;
  requiresSetup: boolean;
  /** Connector-specific configuration. */
  config: Record<string, unknown>;
  enabled: boolean;
}

// ---- Voice Narration Config ------------------------------------------------

export interface VoiceNarrationConfig {
  engine: string;
  maxLength: number;
  voice: string;
  /** Which notification types trigger voice narration. */
  triggers: NotificationType[];
}

// ---- Notification Preferences (User) ---------------------------------------

export interface NotificationPreferences {
  /** Which channels the user wants to receive notifications on. */
  channels: NotificationChannel[];
  /** Digest schedule (e.g. 'daily_9am', 'twice_daily'). */
  digestSchedule: string;
  /** Only send urgent/action-required notifications. */
  urgentOnly: boolean;
  /** Agent types whose notifications are muted. */
  muteAgentTypes: AgentType[];
  /** Whether to receive audio summaries. */
  voiceNarrationEnabled: boolean;
}

// ---- Org Notification Policy -----------------------------------------------

export interface OrgNotificationPolicy {
  /** Notification types that cannot be muted. */
  mandatoryNotifications: NotificationType[];
  /** Max notifications per user per day. */
  maxNotificationsPerDay: number;
  /** Quiet hours configuration. */
  quietHours: QuietHours;
  /** Whether notification payloads should be redacted. */
  redactedPayloads: boolean;
}

export interface QuietHours {
  /** Start time (HH:MM format). */
  start: string;
  /** End time (HH:MM format). */
  end: string;
  /** 'user' for user's local timezone, or IANA timezone string. */
  timezone: string;
}

// ---- Notification ----------------------------------------------------------

export type NotificationStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';

export interface Notification {
  id: string;
  orgId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Reference to the source entity (artifactId, prId, agentId, etc.). */
  sourceRef: string;
  /** URL to voice narration audio file (if applicable). */
  voiceNarrationUrl: string | null;
  channel: NotificationChannel;
  status: NotificationStatus;
  sentAt: Timestamp;
  readAt: Timestamp | null;
}
