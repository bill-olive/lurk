// ---------------------------------------------------------------------------
// Voice Profile — Digital Twin / Writing Style Model (Phase 1A)
// ---------------------------------------------------------------------------
//
// Captures how a user writes, reasons, and communicates so that agents can
// act in their voice. The profile feeds into the AutonomyScore which drives
// the YOLO engine's progressive trust system.
// ---------------------------------------------------------------------------

import type { Timestamp, ArtifactType } from './artifact';

// ---- Style Dimensions (quantitative + qualitative) ------------------------

export interface StyleDimensions {
  // Quantitative metrics (derived from writing samples)
  averageSentenceLength: number;
  vocabularyComplexity: number;        // 0.0 (simple) – 1.0 (complex)
  formalityLevel: number;              // 0.0 (casual) – 1.0 (formal)
  technicalDepth: number;              // 0.0 (layperson) – 1.0 (deep expert)
  concisenessScore: number;            // 0.0 (verbose) – 1.0 (terse)
  emotionalExpressiveness: number;     // 0.0 (dry/factual) – 1.0 (emotionally rich)

  // Qualitative patterns
  toneDescriptors: string[];           // e.g. ["direct", "empathetic", "data-driven"]
  communicationPatterns: string[];     // e.g. ["leads with context", "uses bullet points"]
  signaturePhrases: string[];          // phrases uniquely theirs
  avoidedPatterns: string[];           // things they never do
  openingPatterns: string[];           // how they start emails/docs
  closingPatterns: string[];           // how they end emails/docs

  // Domain knowledge map
  domainVocabulary: Record<string, string[]>; // domain -> terms they use
  audienceAdaptation: Record<string, string>; // audience -> style notes

  // Decision-making patterns (for reasoning agents)
  reasoningStyle: ReasoningStyle;
  prioritizationSignals: string[];     // what they optimize for in decisions
}

export type ReasoningStyle =
  | 'analytical'      // data-first, evidence-based
  | 'intuitive'       // pattern-matching, gut-driven
  | 'collaborative'   // consensus-seeking, inclusive
  | 'directive'       // decisive, top-down
  | 'systematic'      // process-oriented, methodical
  | 'creative';       // divergent, experimental

// ---- Style Exemplars (representative writing snippets) --------------------

export interface StyleExemplar {
  id: string;
  content: string;
  source: ArtifactType;
  artifactId: string;
  extractedAt: Timestamp;
  /** User-confirmed as representative of their voice. */
  confirmed: boolean;
  /** Optional audience context (e.g. "team standup", "client email"). */
  audience?: string;
}

// ---- Voice Corrections (user feedback loop) -------------------------------

export interface VoiceCorrection {
  id: string;
  /** The agent-generated text that was wrong. */
  agentOutput: string;
  /** What the user actually wanted. */
  userCorrection: string;
  /** Which dimension(s) the correction addresses. */
  dimensions: (keyof StyleDimensions)[];
  /** Context: what artifact/task triggered the agent output. */
  context: string;
  createdAt: Timestamp;
  /** Whether this correction has been incorporated into the profile. */
  applied: boolean;
}

// ---- Voice Profile (the complete digital twin) ----------------------------

export interface VoiceProfile {
  userId: string;
  orgId: string;

  /** Extracted style dimensions. */
  styleDimensions: StyleDimensions;

  /** Representative writing snippets. */
  exemplars: StyleExemplar[];

  /** Generated system prompt text for agent injection. */
  systemPromptFragment: string;

  /** How well Lurk knows this user (0.0 – 1.0). */
  confidence: number;

  /** User corrections that refine the profile. */
  corrections: VoiceCorrection[];

  /** Which artifact types were used to build this profile. */
  trainingSources: ArtifactType[];

  /** Number of artifacts analyzed. */
  sampleCount: number;

  /** When the profile was first created. */
  createdAt: Timestamp;

  /** When the profile was last updated. */
  updatedAt: Timestamp;

  /** Version counter (increments on each refinement). */
  version: number;
}

// ---- Autonomy Score (drives YOLO tier assignment) -------------------------

export type AutonomyTier = 'supervised' | 'assisted' | 'autonomous' | 'yolo';

export interface AutonomyScore {
  /** Voice profile confidence (0.0 – 1.0). Weight: 0.3. */
  voiceProfileConfidence: number;

  /** Historical PR acceptance rate (0.0 – 1.0). Weight: 0.3. */
  historicalAcceptanceRate: number;

  /** Familiarity with the specific artifact (0.0 – 1.0). Weight: 0.2. */
  artifactFamiliarity: number;

  /** Domain expertise level (0.0 – 1.0). Weight: 0.2. */
  domainExpertise: number;

  /** Weighted composite: 0.3*voice + 0.3*acceptance + 0.2*familiarity + 0.2*domain. */
  compositeScore: number;

  /** Derived tier based on composite thresholds. */
  tier: AutonomyTier;

  /** Explanation of how the tier was determined. */
  reasoning: string;
}

/** Compute composite score and tier from raw components. */
export function computeAutonomyScore(
  voiceProfileConfidence: number,
  historicalAcceptanceRate: number,
  artifactFamiliarity: number,
  domainExpertise: number,
): AutonomyScore {
  const compositeScore =
    voiceProfileConfidence * 0.3 +
    historicalAcceptanceRate * 0.3 +
    artifactFamiliarity * 0.2 +
    domainExpertise * 0.2;

  let tier: AutonomyTier;
  let reasoning: string;

  if (compositeScore >= 0.8) {
    tier = 'yolo';
    reasoning = `Composite ${compositeScore.toFixed(2)} ≥ 0.80 — full autonomous operation with auto-merge`;
  } else if (compositeScore >= 0.6) {
    tier = 'autonomous';
    reasoning = `Composite ${compositeScore.toFixed(2)} ≥ 0.60 — agent acts independently, human reviews async`;
  } else if (compositeScore >= 0.4) {
    tier = 'assisted';
    reasoning = `Composite ${compositeScore.toFixed(2)} ≥ 0.40 — agent drafts, human approves before action`;
  } else {
    tier = 'supervised';
    reasoning = `Composite ${compositeScore.toFixed(2)} < 0.40 — human drives, agent suggests`;
  }

  return {
    voiceProfileConfidence,
    historicalAcceptanceRate,
    artifactFamiliarity,
    domainExpertise,
    compositeScore,
    tier,
    reasoning,
  };
}

// ---- Trust Ledger (tracks agent trust over time) --------------------------

export type TrustAction =
  | 'accepted'        // User accepted agent PR as-is
  | 'accepted_edited' // User accepted with minor edits
  | 'rejected'        // User rejected agent PR
  | 'corrected'       // User corrected agent voice/style
  | 'rolled_back'     // Auto-merged PR was rolled back
  | 'auto_merged';    // PR auto-merged under YOLO

export interface TrustEvent {
  id: string;
  userId: string;
  agentId: string;
  action: TrustAction;
  /** PR or artifact this event relates to. */
  referenceId: string;
  referenceType: 'pull_request' | 'artifact';
  /** Agent's confidence at time of action. */
  agentConfidence: number;
  /** Impact on trust score (-1.0 to +1.0). */
  trustDelta: number;
  /** Running trust score after this event. */
  runningTrustScore: number;
  timestamp: Timestamp;
  metadata?: Record<string, unknown>;
}

/** Trust delta weights for each action type. */
export const TRUST_DELTAS: Record<TrustAction, number> = {
  accepted: 0.05,
  accepted_edited: 0.02,
  rejected: -0.08,
  corrected: -0.03,
  rolled_back: -0.20,
  auto_merged: 0.01,
};

// ---- Ghost Writer Preview -------------------------------------------------

export interface GhostPreview {
  artifactId: string;
  /** The speculative improvement diff. */
  suggestedContent: string;
  /** Diff hunks showing what would change. */
  diffHunks: GhostDiffHunk[];
  /** Confidence that the user would accept this. */
  confidence: number;
  /** Voice profile version used. */
  voiceProfileVersion: number;
  /** Cache TTL in seconds. */
  cacheTtl: number;
  generatedAt: Timestamp;
}

export interface GhostDiffHunk {
  startLine: number;
  endLine: number;
  original: string;
  suggested: string;
  rationale: string;
}

// ---- Drift Detection ------------------------------------------------------

export interface StyleDrift {
  userId: string;
  /** Which dimensions have drifted. */
  driftedDimensions: {
    dimension: keyof StyleDimensions;
    previousValue: unknown;
    currentValue: unknown;
    magnitude: number; // 0.0 – 1.0
  }[];
  /** Overall drift magnitude. */
  overallDrift: number;
  detectedAt: Timestamp;
  /** Whether the user has acknowledged and the profile was updated. */
  acknowledged: boolean;
}
