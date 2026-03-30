// ---------------------------------------------------------------------------
// Standalone Mode — IndexedDB-based local ledger when Mac app is not installed
// ---------------------------------------------------------------------------

import { storage, type StoredArtifact, type PrivacyRecord } from '../lib/storage';
import { api, type ArtifactCapture } from '../lib/api';

// ---- Types -----------------------------------------------------------------

export interface PIIDetectionResult {
  hasPII: boolean;
  types: string[];
  locations: Array<{
    type: string;
    start: number;
    end: number;
    text: string;
  }>;
  redactedContent: string;
}

export interface StandaloneConfig {
  localOnly: boolean;
  cloudSyncEnabled: boolean;
  piiDetectionEnabled: boolean;
  autoRedact: boolean;
  syncIntervalMs: number;
}

// ---- Constants -------------------------------------------------------------

const DEFAULT_CONFIG: StandaloneConfig = {
  localOnly: false,
  cloudSyncEnabled: true,
  piiDetectionEnabled: true,
  autoRedact: true,
  syncIntervalMs: 60000, // 1 minute
};

// ---- PII Detection (placeholder for WASM module) ---------------------------

// In production, this will be replaced by a WASM module compiled from Rust
// that performs on-device PII detection without sending data to the cloud.

const PII_PATTERNS: Array<{ type: string; pattern: RegExp }> = [
  { type: 'email', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { type: 'phone', pattern: /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g },
  { type: 'ssn', pattern: /\b\d{3}-?\d{2}-?\d{4}\b/g },
  { type: 'credit_card', pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g },
  { type: 'ip_address', pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
  { type: 'address', pattern: /\b\d{1,5}\s+(?:[A-Z][a-z]+\s*){1,4}(?:St|Ave|Blvd|Dr|Ln|Rd|Way|Ct|Pl|Cir)\b/gi },
  { type: 'date_of_birth', pattern: /\b(?:DOB|Date of Birth|Born)[:\s]+\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/gi },
];

function detectPII(content: string): PIIDetectionResult {
  const locations: PIIDetectionResult['locations'] = [];
  const types = new Set<string>();

  for (const { type, pattern } of PII_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(content)) !== null) {
      types.add(type);
      locations.push({
        type,
        start: match.index,
        end: match.index + match[0].length,
        text: match[0],
      });
    }
  }

  // Sort locations by start position (descending for replacement)
  locations.sort((a, b) => b.start - a.start);

  // Create redacted content
  let redacted = content;
  for (const loc of locations) {
    const placeholder = `[${loc.type.toUpperCase()}_REDACTED]`;
    redacted = redacted.slice(0, loc.start) + placeholder + redacted.slice(loc.end);
  }

  return {
    hasPII: locations.length > 0,
    types: Array.from(types),
    locations,
    redactedContent: redacted,
  };
}

// ---- Content Hashing -------------------------------------------------------

async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---- Feature Extraction (lightweight, on-device) ---------------------------

function extractFeatures(content: string): ArtifactCapture['featureBundle'] {
  const words = content.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Extract key phrases (simple: most common 2-3 word sequences)
  const phrases = new Map<string, number>();
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`.toLowerCase();
    phrases.set(bigram, (phrases.get(bigram) ?? 0) + 1);
  }

  const keyPhrases = Array.from(phrases.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([phrase]) => phrase);

  // Extract section headers (lines that look like headings)
  const lines = content.split('\n');
  const sectionHeaders = lines
    .filter((line) => {
      const trimmed = line.trim();
      return (
        trimmed.length > 0 &&
        trimmed.length < 100 &&
        (trimmed.startsWith('#') ||
          /^[A-Z][A-Za-z\s]{2,50}$/.test(trimmed) ||
          /^\d+\.\s/.test(trimmed))
      );
    })
    .slice(0, 20);

  // Entity counts (rough heuristic)
  const entityCounts: Record<string, number> = {
    sentences: (content.match(/[.!?]+/g) ?? []).length,
    paragraphs: (content.match(/\n\n/g) ?? []).length + 1,
    links: (content.match(/https?:\/\/[^\s]+/g) ?? []).length,
    mentions: (content.match(/@[a-zA-Z0-9_]+/g) ?? []).length,
  };

  // Detect language (simple heuristic based on common words)
  const language = 'en'; // Placeholder; production uses WASM language detector

  return {
    topicVectors: [], // Placeholder for WASM-based topic embedding
    entityCounts,
    keyPhrases,
    language,
    wordCount,
    sectionHeaders,
  };
}

// ---- Standalone Mode Manager -----------------------------------------------

class StandaloneMode {
  private config: StandaloneConfig = DEFAULT_CONFIG;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private syncInProgress = false;

  async initialize(): Promise<void> {
    const saved = await storage.getSetting<StandaloneConfig>('standalone_config');
    if (saved) {
      this.config = { ...DEFAULT_CONFIG, ...saved };
    }

    storage.setStandaloneMode(true);

    if (this.config.cloudSyncEnabled && !this.config.localOnly) {
      this.startSync();
    }

    console.log('[Lurk Standalone] Initialized with config:', this.config);
  }

  async processCapture(rawCapture: {
    type: string;
    title: string;
    sourceUrl: string;
    sourceApp: string;
    content: string;
    metadata: Record<string, unknown>;
  }): Promise<{ artifactId: string; piiDetected: boolean }> {
    const capturedAt = Date.now();

    // Step 1: PII detection (on-device)
    let piiResult: PIIDetectionResult = {
      hasPII: false,
      types: [],
      locations: [],
      redactedContent: rawCapture.content,
    };

    if (this.config.piiDetectionEnabled) {
      piiResult = detectPII(rawCapture.content);
      if (piiResult.hasPII) {
        console.log('[Lurk Standalone] PII detected:', piiResult.types);
      }
    }

    // Step 2: Hash content
    const contentHash = await hashContent(rawCapture.content);

    // Step 3: Extract features
    const features = extractFeatures(rawCapture.content);

    // Step 4: Generate artifact ID (UUID v7 approximation)
    const artifactId = generateTimeBasedId();

    // Step 5: Store locally
    const artifact: StoredArtifact = {
      id: artifactId,
      type: rawCapture.type,
      title: rawCapture.title,
      sourceUrl: rawCapture.sourceUrl,
      sourceApp: rawCapture.sourceApp,
      contentHash,
      redactedContent: this.config.autoRedact ? piiResult.redactedContent : rawCapture.content,
      capturedAt,
      modifiedAt: capturedAt,
      sensitivity: piiResult.hasPII ? 'confidential' : 'internal',
      tags: [],
      metadata: {
        ...rawCapture.metadata,
        featureBundle: features,
        piiTypes: piiResult.types,
      },
    };

    await storage.storeArtifact(artifact);

    // Step 6: Record privacy action
    const privacyRecord: PrivacyRecord = {
      id: generateTimeBasedId(),
      artifactId,
      destination: this.config.localOnly ? 'local_only' : 'cloud',
      dataType: rawCapture.type,
      redacted: this.config.autoRedact && piiResult.hasPII,
      piiDetected: piiResult.types,
      timestamp: capturedAt,
    };

    await storage.storePrivacyRecord(privacyRecord);

    // Step 7: Cloud sync if enabled (non-blocking)
    if (this.config.cloudSyncEnabled && !this.config.localOnly) {
      this.syncArtifactToCloud(artifact, features).catch((err) => {
        console.warn('[Lurk Standalone] Cloud sync failed:', err);
      });
    }

    return { artifactId, piiDetected: piiResult.hasPII };
  }

  async updateConfig(updates: Partial<StandaloneConfig>): Promise<void> {
    this.config = { ...this.config, ...updates };
    await storage.setSetting('standalone_config', this.config);

    if (this.config.cloudSyncEnabled && !this.config.localOnly) {
      this.startSync();
    } else {
      this.stopSync();
    }
  }

  getConfig(): StandaloneConfig {
    return { ...this.config };
  }

  // ---- Private ---------------------------------------------------------------

  private async syncArtifactToCloud(
    artifact: StoredArtifact,
    features: ArtifactCapture['featureBundle']
  ): Promise<void> {
    const capture: ArtifactCapture = {
      type: artifact.type,
      title: artifact.title,
      sourceUrl: artifact.sourceUrl,
      sourceApp: artifact.sourceApp,
      mimeType: 'text/plain',
      captureMethod: 'chrome_dom',
      contentHash: artifact.contentHash,
      redactedContent: artifact.redactedContent,
      featureBundle: features,
      metadata: artifact.metadata,
      tags: artifact.tags,
      customerFacing: false,
      sensitivity: artifact.sensitivity,
    };

    const result = await api.captureArtifact(capture);
    if (result.error) {
      throw new Error(`Cloud sync failed: ${result.error.message}`);
    }
  }

  private startSync(): void {
    this.stopSync();
    this.syncTimer = setInterval(() => {
      this.syncPending().catch((err) => {
        console.warn('[Lurk Standalone] Periodic sync failed:', err);
      });
    }, this.config.syncIntervalMs);
  }

  private stopSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  private async syncPending(): Promise<void> {
    if (this.syncInProgress) return;
    this.syncInProgress = true;

    try {
      // Sync any artifacts that failed to sync earlier
      // In production this would track sync status per artifact
      console.log('[Lurk Standalone] Periodic sync check completed');
    } finally {
      this.syncInProgress = false;
    }
  }
}

// ---- Helpers ---------------------------------------------------------------

function generateTimeBasedId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `${timestamp}-${random}`;
}

// ---- Export ----------------------------------------------------------------

export const standalone = new StandaloneMode();
export { detectPII, hashContent, extractFeatures };
