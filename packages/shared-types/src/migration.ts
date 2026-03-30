// ---------------------------------------------------------------------------
// Migration System (PRD Section 7)
// ---------------------------------------------------------------------------

import type { ArtifactType, Timestamp } from './artifact';
import type { AccessTier } from './access-control';

// ---- Migration Source Platforms --------------------------------------------

export type MigrationPlatform =
  | 'slack'
  | 'google_drive'
  | 'notion'
  | 'gmail'
  | 'jira'
  | 'linear'
  | 'github'
  | 'confluence';

// ---- Migration Mode --------------------------------------------------------

export type MigrationMode =
  | 'api_import'
  | 'agentic_crawl'
  | 'file_upload';

// ---- Migration Status ------------------------------------------------------

export type MigrationStatus =
  | 'planning'
  | 'awaiting_approval'
  | 'approved'
  | 'authenticating'
  | 'extracting'
  | 'classifying'
  | 'redacting'
  | 'mapping'
  | 'previewing'
  | 'committing'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'rolled_back'
  | 'cancelled';

// ---- Migration Source Config -----------------------------------------------

export interface MigrationSource {
  platform: MigrationPlatform;
  method: string;
  /** Types of data that can be imported. */
  artifactTypes: string[];
  /** Authentication method. */
  authMethod: 'oauth2' | 'api_token' | 'session_cookies' | 'file_upload';
  /** Rate limit description. */
  rateLimit: string;
  /** Whether full history can be imported. */
  historicalImport: boolean;
}

// ---- Crawl Strategy --------------------------------------------------------

export type CrawlStrategy =
  | 'channel_by_channel'
  | 'folder_tree'
  | 'workspace_tree'
  | 'agent_navigated';

// ---- Capture Depth ---------------------------------------------------------

export type CaptureDepth =
  | 'last_30d'
  | 'last_90d'
  | 'last_year'
  | 'full_history';

// ---- Migration Scope -------------------------------------------------------

export interface MigrationScope {
  /** Specific channels, folders, or teams to import. */
  includeIds: string[];
  /** Items to exclude. */
  excludeIds: string[];
  /** How far back to import. */
  captureDepth: CaptureDepth;
  /** Artifact types to include. */
  artifactTypeFilter: ArtifactType[];
  /** Maximum items to import. */
  maxItems: number | null;
}

// ---- Migration Plan --------------------------------------------------------

export interface MigrationPlan {
  id: string;
  orgId: string;
  sourcePlatform: MigrationPlatform;
  mode: MigrationMode;
  scope: MigrationScope;

  /** Estimated number of artifacts. */
  estimatedArtifactCount: number;
  /** Estimated duration in minutes. */
  estimatedDurationMinutes: number;
  /** Estimated storage impact in bytes. */
  estimatedStorageBytes: number;

  /** PII policy for this migration. */
  piiRedactionLevel: 'aggressive' | 'standard';
  /** Target ledger mapping. */
  targetLedgerMapping: Record<string, string>;

  status: MigrationStatus;
  createdBy: string;
  approvedBy: string | null;
  createdAt: Timestamp;
  approvedAt: Timestamp | null;
}

// ---- Migration Batch -------------------------------------------------------

export interface MigrationBatch {
  id: string;
  migrationPlanId: string;
  orgId: string;

  /** Current batch status. */
  status: MigrationStatus;

  /** Total items in this batch. */
  totalItems: number;
  /** Items processed so far. */
  processedItems: number;
  /** Items successfully imported. */
  importedItems: number;
  /** Items that failed. */
  failedItems: number;
  /** Items skipped (duplicate, filtered, etc.). */
  skippedItems: number;

  /** Errors encountered. */
  errors: MigrationError[];

  /** Execution log entries. */
  executionLog: MigrationLogEntry[];

  startedAt: Timestamp;
  completedAt: Timestamp | null;
}

export interface MigrationError {
  itemId: string;
  itemType: string;
  error: string;
  retryable: boolean;
  timestamp: Timestamp;
}

export interface MigrationLogEntry {
  phase: string;
  message: string;
  itemCount: number;
  timestamp: Timestamp;
}

// ---- Migration Report ------------------------------------------------------

export interface MigrationReport {
  migrationPlanId: string;
  batchIds: string[];

  /** Total artifacts imported. */
  totalArtifactsImported: number;
  /** Breakdown by type. */
  artifactsByType: Record<string, number>;
  /** Total relationships mapped. */
  relationshipsMapped: number;
  /** Total PII entities redacted. */
  piiEntitiesRedacted: number;
  /** Total duplicates detected. */
  duplicatesDetected: number;

  /** Verification results. */
  verification: MigrationVerification;

  generatedAt: Timestamp;
}

export interface MigrationVerification {
  sourceItemCount: number;
  importedArtifactCount: number;
  /** Whether all relationship links resolve. */
  relationshipIntegrity: boolean;
  /** Sample quality check pass rate. */
  sampleQualityPassRate: number;
  passed: boolean;
  issues: string[];
}

// ---- Slack-Specific Migration Config (PRD Section 7.3) ---------------------

export interface SlackChannelMapping {
  slackChannelId: string;
  slackChannelName: string;
  channelType: 'public' | 'private' | 'dm' | 'group_dm';
  /** Target team ID in Lurk. */
  targetTeamId: string;
  /** Access tier for imported artifacts. */
  accessTier: AccessTier;
  /** Original members (mapped to Lurk user IDs). */
  memberIds: string[];
}

export interface SlackMigrationConfig {
  /** Channel mappings. */
  channelMappings: SlackChannelMapping[];

  /** User ID mapping (Slack user ID -> Lurk user ID). */
  userIdMapping: Record<string, string>;

  /** Message grouping strategy. */
  messageGrouping: 'by_thread' | 'by_day' | 'by_topic';

  /** Intelligence features. */
  intelligence: SlackMigrationIntelligence;

  /** Crawl strategy (for agentic mode). */
  crawlStrategy: CrawlStrategy;

  /** Capture depth. */
  captureDepth: CaptureDepth;
}

export interface SlackMigrationIntelligence {
  /** Identify and merge duplicate discussions. */
  deduplication: boolean;
  /** Group related messages into coherent artifact clusters. */
  topicClustering: boolean;
  /** Find decisions buried in threads. */
  decisionExtraction: boolean;
  /** Find action items. */
  actionItemExtraction: boolean;
  /** Identify tribal knowledge. */
  knowledgeExtraction: boolean;
  /** Tag all customer-referenced content. */
  customerMentionTagging: boolean;
}

// ---- Agentic Crawl Safety Config -------------------------------------------

export interface AgenticCrawlSafety {
  maxPagesPerSession: number;
  maxSessionDuration: string;
  requireUserApproval: boolean;
  previewBeforeCommit: boolean;
  rollbackCapability: boolean;
}

// ---- Supported File Upload Formats -----------------------------------------

export type FileUploadFormat =
  | 'slack_export.zip'
  | 'google_takeout.zip'
  | 'notion_export.zip'
  | 'mbox'
  | 'csv'
  | 'json';
