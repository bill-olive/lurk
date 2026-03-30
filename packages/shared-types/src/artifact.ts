// ---------------------------------------------------------------------------
// Artifact — the single first-class object in Lurk (PRD Section 4.1)
// ---------------------------------------------------------------------------

import type { AccessTier, ACLOverride } from './access-control';
import type { CustomerHealthSignal } from './customer-health';

/** ISO-8601 timestamp string. */
export type Timestamp = string;

// ---- Artifact Type Taxonomy ------------------------------------------------

export type ArtifactType =
  // Documents
  | 'document:gdoc'
  | 'document:notion'
  | 'document:markdown'
  | 'document:pdf'
  | 'document:word'
  | 'document:note'
  | 'document:wiki'
  // Code
  | 'code:commit'
  | 'code:pr'
  | 'code:file'
  | 'code:snippet'
  | 'code:review'
  // Communication (customer-facing only by default)
  | 'comm:email_sent'
  | 'comm:email_received'
  | 'comm:call_recording'
  | 'comm:call_transcript'
  | 'comm:call_summary'
  | 'comm:chat_thread'
  // Data
  | 'data:spreadsheet'
  | 'data:csv'
  | 'data:dashboard'
  | 'data:report'
  | 'data:crm_record'
  | 'data:issue_tracker'
  // Design
  | 'design:figma'
  | 'design:sketch'
  | 'design:screenshot'
  // Meta (agent-generated)
  | 'meta:synthesis'
  | 'meta:status'
  | 'meta:conflict'
  | 'meta:recommendation'
  | 'meta:customer_health'
  | 'meta:analytics_report'
  | 'meta:calendar_review'
  // Migration (from other platforms)
  | 'migration:slack_message'
  | 'migration:slack_file'
  | 'migration:drive_file'
  | 'migration:notion_page'
  | 'migration:email_archive'
  | 'migration:jira_issue';

// ---- Capture Method --------------------------------------------------------

export type CaptureMethod =
  | 'chrome_dom'
  | 'chrome_api'
  | 'mac_audio'
  | 'mac_filesystem'
  | 'mac_ide'
  | 'ios_voice'
  | 'ios_photo'
  | 'migration_import'
  | 'api_ingest'
  | 'agent_generated';

// ---- Sensitivity -----------------------------------------------------------

export type SensitivityLevel =
  | 'public'
  | 'internal'
  | 'confidential'
  | 'restricted';

// ---- Supporting types ------------------------------------------------------

/** Privacy-preserving extracted features (topic vectors, entity counts, etc.). */
export interface FeatureBundle {
  topicVectors: number[];
  entityCounts: Record<string, number>;
  keyPhrases: string[];
  language: string;
  wordCount: number;
  sectionHeaders: string[];
  customFeatures: Record<string, unknown>;
}

/** Structural metadata about an artifact. */
export interface ArtifactMetadata {
  pageCount?: number;
  durationSeconds?: number;
  speakerCount?: number;
  sheetCount?: number;
  slideCount?: number;
  participants?: string[];
  calendarEventId?: string;
  meetingPlatform?: string;
  customFields: Record<string, unknown>;
}

/** Customer reference embedded in an artifact. */
export interface CustomerRef {
  customerId: string;
  customerName: string;
  context: string;
  detectedAt: Timestamp;
}

/** Reference to a fork origin. */
export interface ForkRef {
  forkId: string;
  upstreamArtifactId: string;
  upstreamVersion: number;
  upstreamLedgerId: string;
}

/** Reference to a merge destination. */
export interface MergeRef {
  prId: string;
  targetArtifactId: string;
  targetLedgerId: string;
  mergedAt: Timestamp;
}

/** Agent-discovered relationship between artifacts. */
export interface RelationRef {
  artifactId: string;
  ledgerId: string;
  relationType: RelationType;
  confidence: number;
  discoveredBy: string;
  discoveredAt: Timestamp;
}

export type RelationType =
  | 'references'
  | 'contradicts'
  | 'supersedes'
  | 'derived_from'
  | 'related_to'
  | 'parent_of'
  | 'child_of'
  | 'duplicate_of';

// ---- Artifact (main type) --------------------------------------------------

export interface Artifact {
  /** UUID v7 (time-sortable). */
  id: string;
  /** Which ledger owns this artifact. */
  ledgerId: string;
  /** Organization scope. */
  orgId: string;

  // -- Identity --
  type: ArtifactType;
  title: string;
  /** Original URL if browser-captured. */
  sourceUrl: string | null;
  /** e.g. 'chrome:gdocs', 'mac:zoom_transcript', 'ios:voice_memo'. */
  sourceApp: string;
  /** e.g. 'text/plain', 'audio/webm', 'application/json'. */
  mimeType: string;
  captureMethod: CaptureMethod;

  // -- Content (privacy-layered) --
  /** SHA-256 of raw content (never stored centrally). */
  contentHash: string;
  /** PII-scrubbed version (stored centrally if policy allows). */
  redactedContent: string | null;
  featureBundle: FeatureBundle;
  metadata: ArtifactMetadata;

  // -- Classification --
  tags: string[];
  customerFacing: boolean;
  customerRefs: CustomerRef[];
  sensitivity: SensitivityLevel;

  // -- Customer health (for customer-facing artifacts) --
  customerHealth: CustomerHealthSignal | null;

  // -- Ownership --
  authorId: string;
  ownerIds: string[];
  teamIds: string[];

  // -- Versioning (Lurk ledger semantics) --
  /** Monotonically increasing version number. */
  version: number;
  /** null for initial commit. */
  parentVersion: number | null;
  /** Lurk commit hash (SHA-256 of version content + metadata). */
  commitHash: string;
  /** Auto-generated or agent-provided. */
  commitMessage: string;
  /** null = main branch. */
  branchId: string | null;

  // -- Timestamps --
  capturedAt: Timestamp;
  modifiedAt: Timestamp;
  committedAt: Timestamp;

  // -- Access control --
  accessTier: AccessTier;
  aclOverrides: ACLOverride[];

  // -- Lineage --
  forkedFrom: ForkRef | null;
  mergedInto: MergeRef | null;
  relatedArtifacts: RelationRef[];

  // -- Analytics --
  /** Agent-assessed quality (0.0 - 1.0). */
  qualityScore: number | null;
  /** How stale is this artifact (0.0 - 1.0). */
  stalenessScore: number | null;
  /** What is missing from this artifact. */
  coverageGaps: string[] | null;
}
