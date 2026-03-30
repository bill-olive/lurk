import { PubSub, type Topic } from '@google-cloud/pubsub';

// ---------------------------------------------------------------------------
// Pub/Sub publisher for async events
// ---------------------------------------------------------------------------

const PROJECT_ID = process.env.GCP_PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT ?? '';

let _pubsub: PubSub | null = null;

function pubsub(): PubSub {
  if (!_pubsub) {
    _pubsub = new PubSub({ projectId: PROJECT_ID || undefined });
  }
  return _pubsub;
}

// Topic name constants
export const Topics = {
  ARTIFACT_COMMITTED: 'lurk.artifact.committed',
  ARTIFACT_SYNCED: 'lurk.artifact.synced',
  ARTIFACT_DELETED: 'lurk.artifact.deleted',
  PR_OPENED: 'lurk.pr.opened',
  PR_REVIEWED: 'lurk.pr.reviewed',
  PR_MERGED: 'lurk.pr.merged',
  PR_AUTO_MERGED: 'lurk.pr.auto-merged',
  AGENT_FORK_CREATED: 'lurk.agent.fork-created',
  AGENT_COMMIT: 'lurk.agent.commit',
  AGENT_SYNTHESIZED: 'lurk.agent.synthesized',
  MIGRATION_PLAN_CREATED: 'lurk.migration.plan-created',
  MIGRATION_APPROVED: 'lurk.migration.approved',
  MIGRATION_STARTED: 'lurk.migration.started',
  MIGRATION_COMPLETED: 'lurk.migration.completed',
  MIGRATION_ROLLED_BACK: 'lurk.migration.rolled-back',
  NOTIFICATION_SEND: 'lurk.notification.send',
  AUDIT_EVENT: 'lurk.audit.event',
  MEETING_TRANSCRIPT: 'lurk.meeting.transcript',
  FEEDBACK_SUBMITTED: 'lurk.feedback.submitted',
  CUSTOMER_HEALTH_UPDATED: 'lurk.customer-health.updated',
  CALENDAR_REVIEW: 'lurk.calendar-review',
  ANALYTICS_REPORT: 'lurk.analytics-report',
} as const;

export type TopicName = (typeof Topics)[keyof typeof Topics];

const topicCache = new Map<string, Topic>();

function getTopic(name: string): Topic {
  let topic = topicCache.get(name);
  if (!topic) {
    topic = pubsub().topic(name);
    topicCache.set(name, topic);
  }
  return topic;
}

export interface EventEnvelope {
  eventId: string;
  eventType: TopicName;
  timestamp: string;
  source: string;
  orgId: string;
  data: Record<string, unknown>;
}

/**
 * Publish an event to a Pub/Sub topic.
 */
export async function publishEvent(
  topicName: TopicName,
  payload: Omit<EventEnvelope, 'eventId' | 'eventType' | 'timestamp' | 'source'>,
): Promise<string> {
  const { v4: uuid } = await import('uuid');

  const envelope: EventEnvelope = {
    eventId: uuid(),
    eventType: topicName,
    timestamp: new Date().toISOString(),
    source: 'api-gateway',
    orgId: payload.orgId,
    data: payload.data,
  };

  const topic = getTopic(topicName);
  const messageId = await topic.publishMessage({
    json: envelope,
    attributes: {
      eventType: topicName,
      orgId: payload.orgId,
    },
  });

  return messageId;
}

/**
 * Publish an audit event.
 */
export async function publishAuditEvent(params: {
  orgId: string;
  actorId: string;
  actorType: 'user' | 'agent' | 'system';
  action: string;
  targetRef: string;
  targetType: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  return publishEvent(Topics.AUDIT_EVENT, {
    orgId: params.orgId,
    data: {
      actorId: params.actorId,
      actorType: params.actorType,
      action: params.action,
      targetRef: params.targetRef,
      targetType: params.targetType,
      metadata: params.metadata ?? {},
    },
  });
}

/**
 * Publish a notification request.
 */
export async function publishNotification(params: {
  orgId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  sourceRef: string;
  channel?: string;
}): Promise<string> {
  return publishEvent(Topics.NOTIFICATION_SEND, {
    orgId: params.orgId,
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      sourceRef: params.sourceRef,
      channel: params.channel ?? 'push',
    },
  });
}
