// ---------------------------------------------------------------------------
// API Request/Response Types (PRD Section 15)
// ---------------------------------------------------------------------------

import type { Artifact, ArtifactType, Timestamp } from './artifact';
import type { CommitEntry, Branch, SyncState, SyncResult, MergeStrategy, MergeResult } from './ledger';
import type { Fork } from './fork';
import type { PullRequest, ReviewAction, Diff } from './pull-request';
import type { Agent, AgentType, ScopeConfig } from './agent';
import type { CustomerHealthSignal } from './customer-health';
import type { MigrationPlan, MigrationBatch, MigrationReport, MigrationPlatform, MigrationMode, MigrationScope } from './migration';
import type { Notification, NotificationPreferences } from './notification';

// ============================================================================
// Common
// ============================================================================

/** Standard paginated list response. */
export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  nextCursor: string | null;
  hasMore: boolean;
}

/** Standard error response. */
export interface ApiError {
  code: string;
  message: string;
  details: Record<string, unknown> | null;
}

/** Standard API envelope. */
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError };

// ============================================================================
// 15.1 Client -> Cloud APIs
// ============================================================================

// ---- Artifact Operations ---------------------------------------------------

/** POST /v1/artifacts/commit */
export interface CommitArtifactRequest {
  ledgerId: string;
  artifact: Omit<Artifact, 'id' | 'commitHash' | 'committedAt' | 'version'>;
  message: string;
  branchId: string | null;
}

export interface CommitArtifactResponse {
  artifact: Artifact;
  commit: CommitEntry;
}

/** POST /v1/artifacts/sync */
export interface SyncArtifactsRequest {
  ledgerId: string;
  commits: CommitEntry[];
  /** Local head before sync. */
  localHead: string;
}

export interface SyncArtifactsResponse {
  syncResult: SyncResult;
  /** Commits from the cloud that the client needs. */
  incomingCommits: CommitEntry[];
}

/** GET /v1/artifacts/:id */
export interface GetArtifactResponse {
  artifact: Artifact;
}

/** GET /v1/artifacts/:id/diff */
export interface GetArtifactDiffRequest {
  fromVersion: number;
  toVersion: number;
}

export interface GetArtifactDiffResponse {
  diff: Diff;
}

/** GET /v1/artifacts/:id/history */
export interface GetArtifactHistoryRequest {
  cursor: string | null;
  limit: number;
}

export type GetArtifactHistoryResponse = PaginatedResponse<CommitEntry>;

/** GET /v1/artifacts/search */
export interface SearchArtifactsRequest {
  query: string;
  types: ArtifactType[] | null;
  teamIds: string[] | null;
  authorIds: string[] | null;
  customerFacing: boolean | null;
  tags: string[] | null;
  fromDate: Timestamp | null;
  toDate: Timestamp | null;
  cursor: string | null;
  limit: number;
}

export type SearchArtifactsResponse = PaginatedResponse<Artifact>;

// ---- PR Operations ---------------------------------------------------------

/** GET /v1/prs/inbox */
export interface GetPRInboxRequest {
  status: string | null;
  cursor: string | null;
  limit: number;
}

export type GetPRInboxResponse = PaginatedResponse<PullRequest>;

/** GET /v1/prs/:id */
export interface GetPRDetailResponse {
  pullRequest: PullRequest;
  fork: Fork;
  sourceArtifact: Artifact;
  targetArtifact: Artifact;
}

/** POST /v1/prs/:id/review */
export interface ReviewPRRequest {
  action: ReviewAction;
  comment: string | null;
}

export interface ReviewPRResponse {
  pullRequest: PullRequest;
  /** If merged, the resulting merge commit. */
  mergeCommit: CommitEntry | null;
}

// ---- Ledger Operations -----------------------------------------------------

/** GET /v1/ledger/:id/log */
export interface GetLedgerLogRequest {
  branchId: string | null;
  cursor: string | null;
  limit: number;
}

export type GetLedgerLogResponse = PaginatedResponse<CommitEntry>;

/** GET /v1/ledger/:id/branches */
export interface GetLedgerBranchesResponse {
  branches: Branch[];
}

/** POST /v1/ledger/:id/sync */
export interface SyncLedgerRequest {
  localHead: string;
  pendingCommits: CommitEntry[];
}

export interface SyncLedgerResponse {
  syncResult: SyncResult;
  incomingCommits: CommitEntry[];
}

/** GET /v1/ledger/:id/status */
export interface GetLedgerStatusResponse {
  syncState: SyncState;
}

// ---- Policy ----------------------------------------------------------------

/** GET /v1/policy/bundle */
export interface GetPolicyBundleResponse {
  /** Serialized policy bundle for the requesting user's org. */
  policies: Record<string, unknown>;
  version: string;
  updatedAt: Timestamp;
}

// ---- Feedback --------------------------------------------------------------

/** POST /v1/feedback */
export interface SubmitFeedbackRequest {
  targetId: string;
  targetType: 'pr' | 'agent' | 'artifact' | 'migration';
  reason: string;
  comment: string;
}

export interface SubmitFeedbackResponse {
  feedbackId: string;
}

// ---- Meeting ---------------------------------------------------------------

/** POST /v1/meetings/transcript */
export interface SubmitTranscriptRequest {
  ledgerId: string;
  /** Redacted transcript text. */
  transcript: string;
  /** Meeting metadata. */
  meetingPlatform: string;
  durationSeconds: number;
  speakerCount: number;
  participants: string[];
  calendarEventId: string | null;
  capturedAt: Timestamp;
}

export interface SubmitTranscriptResponse {
  /** The created transcript artifact. */
  transcriptArtifact: Artifact;
  /** The created summary artifact (if auto-summary is enabled). */
  summaryArtifact: Artifact | null;
}

/** GET /v1/meetings/:id/summary */
export interface GetMeetingSummaryResponse {
  summary: Artifact;
  /** Related PRs opened by agents from this meeting. */
  relatedPRs: PullRequest[];
}

// ---- Notifications ---------------------------------------------------------

/** GET /v1/notifications */
export interface GetNotificationsRequest {
  cursor: string | null;
  limit: number;
  unreadOnly: boolean;
}

export type GetNotificationsResponse = PaginatedResponse<Notification>;

/** POST /v1/notifications/:id/read */
export interface MarkNotificationReadResponse {
  notification: Notification;
}

/** GET /v1/notifications/preferences */
export type GetNotificationPreferencesResponse = NotificationPreferences;

/** PUT /v1/notifications/preferences */
export type UpdateNotificationPreferencesRequest = NotificationPreferences;
export type UpdateNotificationPreferencesResponse = NotificationPreferences;

// ============================================================================
// 15.2 Agent -> Cloud APIs (service-authenticated)
// ============================================================================

/** POST /v1/agent/fork */
export interface AgentForkRequest {
  agentId: string;
  sourceLedgerId: string;
  sourceArtifactId: string;
  targetLedgerId: string;
  reason: string;
  confidence: number;
}

export interface AgentForkResponse {
  fork: Fork;
}

/** POST /v1/agent/commit */
export interface AgentCommitRequest {
  agentId: string;
  forkId: string;
  artifactUpdates: Partial<Artifact>;
  message: string;
}

export interface AgentCommitResponse {
  commit: CommitEntry;
  artifact: Artifact;
}

/** POST /v1/agent/pr/open */
export interface AgentOpenPRRequest {
  agentId: string;
  forkId: string;
  title: string;
  description: string;
  justification: string;
  confidence: number;
  sourceRefs: Array<{ artifactId: string; ledgerId: string; relevance: string }>;
}

export interface AgentOpenPRResponse {
  pullRequest: PullRequest;
}

/** POST /v1/agent/synthesize */
export interface AgentSynthesizeRequest {
  agentId: string;
  /** Target ledger for the meta artifact. */
  targetLedgerId: string;
  /** The type of meta artifact to create. */
  artifactType: 'meta:synthesis' | 'meta:status' | 'meta:conflict' | 'meta:recommendation' | 'meta:analytics_report' | 'meta:calendar_review';
  title: string;
  content: string;
  /** Artifacts that informed this synthesis. */
  sourceArtifactIds: string[];
  tags: string[];
}

export interface AgentSynthesizeResponse {
  artifact: Artifact;
  commit: CommitEntry;
}

/** GET /v1/agent/scope */
export interface AgentGetScopeRequest {
  agentId: string;
}

export interface AgentGetScopeResponse {
  readableArtifactIds: string[];
  writableArtifactIds: string[];
  scope: ScopeConfig;
}

/** POST /v1/agent/customer-health */
export interface AgentSubmitHealthScoreRequest {
  agentId: string;
  healthSignal: CustomerHealthSignal;
}

export interface AgentSubmitHealthScoreResponse {
  /** The created meta:customer_health artifact. */
  artifact: Artifact;
  /** Whether alerts were sent. */
  alertsSent: boolean;
}

/** POST /v1/agent/calendar-review */
export interface AgentSubmitCalendarReviewRequest {
  agentId: string;
  userId: string;
  recommendations: CalendarRecommendation[];
}

export interface CalendarRecommendation {
  calendarEventId: string;
  eventTitle: string;
  recommendation: 'cancel' | 'shorten' | 'keep';
  reason: string;
  confidence: number;
}

export interface AgentSubmitCalendarReviewResponse {
  artifact: Artifact;
}

/** POST /v1/agent/analytics-report */
export interface AgentSubmitAnalyticsReportRequest {
  agentId: string;
  targetLedgerId: string;
  /** Org-wide dashboard data. */
  orgMetrics: OrgAnalyticsMetrics;
  /** Team-level breakdowns. */
  teamBreakdowns: TeamAnalyticsBreakdown[];
  /** Specific recommendations. */
  recommendations: string[];
}

export interface OrgAnalyticsMetrics {
  totalArtifacts: number;
  qualityDistribution: Record<string, number>;
  stalenessHeatmap: Record<string, number>;
  coverageGapCount: number;
}

export interface TeamAnalyticsBreakdown {
  teamId: string;
  teamName: string;
  artifactCount: number;
  averageQuality: number;
  staleArtifactCount: number;
  coverageGaps: string[];
}

export interface AgentSubmitAnalyticsReportResponse {
  artifact: Artifact;
}

// ============================================================================
// 15.3 Migration APIs
// ============================================================================

/** POST /v1/migration/plan */
export interface CreateMigrationPlanRequest {
  sourcePlatform: MigrationPlatform;
  mode: MigrationMode;
  scope: MigrationScope;
  piiRedactionLevel: 'aggressive' | 'standard';
  targetLedgerMapping: Record<string, string>;
}

export interface CreateMigrationPlanResponse {
  plan: MigrationPlan;
}

/** GET /v1/migration/plan/:id */
export interface GetMigrationPlanResponse {
  plan: MigrationPlan;
}

/** POST /v1/migration/plan/:id/approve */
export interface ApproveMigrationPlanResponse {
  plan: MigrationPlan;
}

/** POST /v1/migration/execute */
export interface ExecuteMigrationRequest {
  planId: string;
}

export interface ExecuteMigrationResponse {
  batch: MigrationBatch;
}

/** GET /v1/migration/status/:id */
export interface GetMigrationStatusResponse {
  batch: MigrationBatch;
}

/** POST /v1/migration/rollback/:id */
export interface RollbackMigrationResponse {
  batch: MigrationBatch;
  /** Number of artifacts rolled back. */
  artifactsRolledBack: number;
}

/** GET /v1/migration/report/:id */
export interface GetMigrationReportResponse {
  report: MigrationReport;
}

// ============================================================================
// 15.4 Admin APIs
// ============================================================================

/**
 * Admin API types are generic CRUD wrappers.
 * Each admin resource uses the same pattern.
 */

/** Generic admin list request. */
export interface AdminListRequest {
  cursor: string | null;
  limit: number;
  filters: Record<string, unknown>;
}

/** Admin org operations: /v1/admin/org */
export interface AdminGetOrgResponse {
  org: import('./organization').Organization;
}

export interface AdminUpdateOrgRequest {
  updates: Partial<import('./organization').Organization>;
}

/** Admin team operations: /v1/admin/teams */
export type AdminListTeamsResponse = PaginatedResponse<import('./organization').Team>;

export interface AdminCreateTeamRequest {
  name: string;
  members: string[];
  admins: string[];
  projectScopes: string[];
}

export interface AdminUpdateTeamRequest {
  teamId: string;
  updates: Partial<import('./organization').Team>;
}

/** Admin agent operations: /v1/admin/agents */
export type AdminListAgentsResponse = PaginatedResponse<Agent>;

export interface AdminCreateAgentRequest {
  name: string;
  type: AgentType;
  description: string;
  ownerId: string;
  ownerType: 'user' | 'team' | 'org';
  readScope: ScopeConfig;
  writeScope: ScopeConfig;
  templateId: string | null;
}

export interface AdminUpdateAgentRequest {
  agentId: string;
  updates: Partial<Agent>;
}

/** Admin user operations: /v1/admin/users */
export type AdminListUsersResponse = PaginatedResponse<import('./organization').User>;

export interface AdminCreateUserRequest {
  email: string;
  displayName: string;
  teams: string[];
  roles: import('./access-control').Role[];
  platform: import('./organization').UserPlatform;
}

export interface AdminUpdateUserRequest {
  userId: string;
  updates: Partial<import('./organization').User>;
}

/** Admin policy operations: /v1/admin/policies */
export interface AdminPolicy {
  id: string;
  orgId: string;
  type: string;
  version: string;
  rules: Record<string, unknown>[];
  defaultAction: string;
  enabled: boolean;
  groupOverrides: Record<string, unknown>[];
  createdBy: string;
  createdAt: Timestamp;
}

export type AdminListPoliciesResponse = PaginatedResponse<AdminPolicy>;

/** Admin audit operations: /v1/admin/audit */
export type AdminListAuditResponse = PaginatedResponse<import('./audit').AuditEntry>;

export interface AdminAuditExportRequest {
  fromDate: Timestamp;
  toDate: Timestamp;
  actorType: string | null;
  action: string | null;
  format: 'json' | 'csv';
}

/** Admin kill switch operations: /v1/admin/kill-switches */
export interface AdminKillSwitchesResponse {
  switches: Record<string, boolean>;
}

export interface AdminToggleKillSwitchRequest {
  switchKey: string;
  enabled: boolean;
  reason: string;
}

/** Admin federation operations: /v1/admin/federation */
export type AdminListFederationsResponse = PaginatedResponse<import('./federation').FederationAgreement>;

/** Admin customer health operations: /v1/admin/customer-health */
export type AdminListCustomerHealthResponse = PaginatedResponse<CustomerHealthSignal>;

/** Admin migration operations: /v1/admin/migration */
export type AdminListMigrationsResponse = PaginatedResponse<MigrationPlan>;

/** Admin connector operations: /v1/admin/connectors */
export type AdminListConnectorsResponse = PaginatedResponse<import('./notification').NotificationConnector>;
