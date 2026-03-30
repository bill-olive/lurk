// ---------------------------------------------------------------------------
// Privacy, PII, and Data Protection (PRD Section 8)
// ---------------------------------------------------------------------------

import type { ArtifactType } from './artifact';

// ---- PII Entity Types ------------------------------------------------------

export type PIIEntityType =
  // Regex-based detectors
  | 'EMAIL'
  | 'PHONE'
  | 'SSN'
  | 'CREDIT_CARD'
  | 'API_KEY'
  | 'TOKEN'
  | 'PASSWORD'
  | 'IP_ADDRESS'
  | 'URL'
  | 'ACCOUNT_ID'
  // NER-based detectors
  | 'PERSON'
  | 'ORGANIZATION'
  | 'ADDRESS'
  | 'DATE_OF_BIRTH'
  // Context-aware detectors
  | 'FINANCIAL_TERM'
  | 'HEALTH_TERM'
  | 'LEGAL_PRIVILEGED'
  | 'COMPENSATION';

// ---- Redaction Level -------------------------------------------------------

export type RedactionLevel =
  | 'aggressive'
  | 'standard'
  | 'minimal'
  | 'none';

// ---- PII Detection ---------------------------------------------------------

export interface PIIDetection {
  entityType: PIIEntityType;
  /** Start offset in the original text. */
  startOffset: number;
  /** End offset in the original text. */
  endOffset: number;
  /** Confidence score (0.0 - 1.0). */
  confidence: number;
  /** The detection method used. */
  detectorType: PIIDetectorType;
  /** Replacement token used (e.g. '[PERSON_1]'). */
  replacementToken: string;
}

export type PIIDetectorType =
  | 'regex'
  | 'ner'
  | 'context'
  | 'custom';

// ---- Redaction Result ------------------------------------------------------

export interface RedactionResult {
  /** The redacted text. */
  redactedText: string;
  /** All PII entities detected. */
  detections: PIIDetection[];
  /** Total entities redacted. */
  entityCount: number;
  /** The redaction level applied. */
  level: RedactionLevel;
  /** Whether server-side validation was performed. */
  serverValidated: boolean;
}

// ---- Policy Rule (for custom detectors) ------------------------------------

export interface PolicyRule {
  id: string;
  name: string;
  entityType: string;
  /** Regex pattern or keyword list. */
  pattern: string;
  patternType: 'regex' | 'keyword' | 'proximity';
  /** Keywords for proximity-based detection. */
  proximityKeywords: string[];
  /** Max distance in characters for proximity. */
  proximityDistance: number;
  enabled: boolean;
}

// ---- Agent Content Access --------------------------------------------------

export type AgentContentAccess =
  | 'features_only'
  | 'redacted'
  | 'full';

// ---- Max History Depth (Migration) -----------------------------------------

export type MaxHistoryDepth =
  | 'all'
  | '1y'
  | '90d'
  | '30d';

// ---- Data Region -----------------------------------------------------------

export type DataRegion = 'us' | 'eu' | 'ap';

// ---- Customer Data Policy --------------------------------------------------

export interface CustomerDataPolicy {
  requireCustomerConsent: boolean;
  retentionDays: number;
  allowCrossTeamSharing: boolean;
  piiFieldsToAlwaysRedact: string[];
}

// ---- Recording Policy ------------------------------------------------------

export interface RecordingPolicy {
  requireConsentBanner: boolean;
  transcriptRedaction: 'aggressive' | 'standard';
  /** How long raw audio is kept locally (hours). 0 = delete immediately after transcription. */
  audioRetentionHours: number;
  /** How long transcripts are kept (days). */
  retentionDays: number;
  allowAgentAccess: boolean;
}

// ---- Migration Policy ------------------------------------------------------

export interface MigrationPolicy {
  /** Allow Browserbase-based crawling. */
  allowAgenticCrawl: boolean;
  /** Admin must approve each migration batch. */
  requireAdminApproval: boolean;
  piiRedactionOnImport: 'aggressive' | 'standard';
  maxHistoryDepth: MaxHistoryDepth;
}

// ---- Org Privacy Policy ----------------------------------------------------

export interface OrgPrivacyPolicy {
  // -- Content controls --
  redactionLevel: RedactionLevel;
  allowRedactedContent: boolean;
  allowFeatureBundlesOnly: boolean;

  // -- Agent content access --
  agentContentAccess: AgentContentAccess;
  crossTeamVisibility: AgentContentAccess;

  // -- Customer data --
  customerDataPolicy: CustomerDataPolicy;

  // -- Meeting/recording --
  recordingPolicy: RecordingPolicy;

  // -- Migration --
  migrationPolicy: MigrationPolicy;

  // -- Kill switches --
  globalKillSwitch: boolean;
  teamKillSwitches: Record<string, boolean>;
  agentKillSwitch: boolean;
  /** Stop all capture, keep existing data. */
  captureKillSwitch: boolean;
  /** Stop meeting capture specifically. */
  meetingCaptureKill: boolean;
  /** Stop all migration activity. */
  migrationKill: boolean;

  // -- Data residency --
  dataRegion: DataRegion;
  crossRegionAllowed: boolean;
}
