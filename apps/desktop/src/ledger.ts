// =============================================================================
// Ledger — SQLite-backed local artifact store
//
// Stores file versions, diffs, sync queue, and voice training samples.
// Uses better-sqlite3 for synchronous, fast operations on macOS.
// =============================================================================

import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

// ---- Types -----------------------------------------------------------------

export interface ArtifactRecord {
  id: string;
  file_path: string;
  file_name: string;
  extension: string;
  content_hash: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
}

export interface CommitRecord {
  id: string;
  artifact_id: string;
  content_hash: string;
  previous_hash: string | null;
  diff: string | null;
  diff_stats: string | null; // JSON: { added: number, removed: number, changed: number }
  content_snapshot: string | null;
  committed_at: string;
}

export interface SyncQueueItem {
  id: number;
  artifact_id: string;
  commit_id: string;
  action: 'create' | 'update' | 'delete';
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  attempts: number;
  last_attempt: string | null;
  error: string | null;
  created_at: string;
}

export interface VoiceSample {
  id: number;
  artifact_id: string;
  content: string;
  source_type: string;
  extracted_at: string;
  sent_for_training: boolean;
}

// ---- Ledger Class ----------------------------------------------------------

export class Ledger {
  private db!: Database.Database;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  initialize(): void {
    mkdirSync(dirname(this.dbPath), { recursive: true });
    this.db = new Database(this.dbPath);

    // Enable WAL mode for better concurrent read performance
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.createTables();
  }

  private createTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS artifacts (
        id TEXT PRIMARY KEY,
        file_path TEXT UNIQUE NOT NULL,
        file_name TEXT NOT NULL,
        extension TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS commits (
        id TEXT PRIMARY KEY,
        artifact_id TEXT NOT NULL REFERENCES artifacts(id),
        content_hash TEXT NOT NULL,
        previous_hash TEXT,
        diff TEXT,
        diff_stats TEXT,
        content_snapshot TEXT,
        committed_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        artifact_id TEXT NOT NULL REFERENCES artifacts(id),
        commit_id TEXT NOT NULL,
        action TEXT NOT NULL CHECK(action IN ('create', 'update', 'delete')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'syncing', 'synced', 'failed')),
        attempts INTEGER NOT NULL DEFAULT 0,
        last_attempt TEXT,
        error TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS voice_samples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        artifact_id TEXT NOT NULL REFERENCES artifacts(id),
        content TEXT NOT NULL,
        source_type TEXT NOT NULL,
        extracted_at TEXT NOT NULL DEFAULT (datetime('now')),
        sent_for_training INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_artifacts_path ON artifacts(file_path);
      CREATE INDEX IF NOT EXISTS idx_commits_artifact ON commits(artifact_id);
      CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_queue(status);
      CREATE INDEX IF NOT EXISTS idx_voice_unsent ON voice_samples(sent_for_training) WHERE sent_for_training = 0;
    `);
  }

  // ---- Artifact CRUD -------------------------------------------------------

  getArtifactByPath(filePath: string): ArtifactRecord | undefined {
    return this.db.prepare('SELECT * FROM artifacts WHERE file_path = ?').get(filePath) as ArtifactRecord | undefined;
  }

  getArtifact(id: string): ArtifactRecord | undefined {
    return this.db.prepare('SELECT * FROM artifacts WHERE id = ?').get(id) as ArtifactRecord | undefined;
  }

  upsertArtifact(artifact: Omit<ArtifactRecord, 'created_at' | 'updated_at'>): void {
    this.db.prepare(`
      INSERT INTO artifacts (id, file_path, file_name, extension, content_hash, size_bytes)
      VALUES (@id, @file_path, @file_name, @extension, @content_hash, @size_bytes)
      ON CONFLICT(file_path) DO UPDATE SET
        content_hash = @content_hash,
        size_bytes = @size_bytes,
        updated_at = datetime('now')
    `).run(artifact);
  }

  listArtifacts(limit = 100, offset = 0): ArtifactRecord[] {
    return this.db.prepare('SELECT * FROM artifacts ORDER BY updated_at DESC LIMIT ? OFFSET ?').all(limit, offset) as ArtifactRecord[];
  }

  getArtifactCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM artifacts').get() as { count: number };
    return row.count;
  }

  // ---- Commit CRUD ---------------------------------------------------------

  insertCommit(commit: Omit<CommitRecord, 'committed_at'>): void {
    this.db.prepare(`
      INSERT INTO commits (id, artifact_id, content_hash, previous_hash, diff, diff_stats, content_snapshot)
      VALUES (@id, @artifact_id, @content_hash, @previous_hash, @diff, @diff_stats, @content_snapshot)
    `).run(commit);
  }

  getCommitsForArtifact(artifactId: string, limit = 50): CommitRecord[] {
    return this.db.prepare(
      'SELECT * FROM commits WHERE artifact_id = ? ORDER BY committed_at DESC LIMIT ?'
    ).all(artifactId, limit) as CommitRecord[];
  }

  getLatestCommit(artifactId: string): CommitRecord | undefined {
    return this.db.prepare(
      'SELECT * FROM commits WHERE artifact_id = ? ORDER BY committed_at DESC LIMIT 1'
    ).get(artifactId) as CommitRecord | undefined;
  }

  // ---- Sync Queue ----------------------------------------------------------

  enqueueSync(artifactId: string, commitId: string, action: SyncQueueItem['action']): void {
    this.db.prepare(`
      INSERT INTO sync_queue (artifact_id, commit_id, action)
      VALUES (?, ?, ?)
    `).run(artifactId, commitId, action);
  }

  getPendingSyncItems(limit = 50): SyncQueueItem[] {
    return this.db.prepare(
      "SELECT * FROM sync_queue WHERE status IN ('pending', 'failed') AND attempts < 5 ORDER BY created_at ASC LIMIT ?"
    ).all(limit) as SyncQueueItem[];
  }

  updateSyncStatus(id: number, status: SyncQueueItem['status'], error?: string): void {
    this.db.prepare(`
      UPDATE sync_queue SET status = ?, attempts = attempts + 1, last_attempt = datetime('now'), error = ?
      WHERE id = ?
    `).run(status, error ?? null, id);
  }

  getSyncStats(): { pending: number; synced: number; failed: number } {
    const rows = this.db.prepare(
      "SELECT status, COUNT(*) as count FROM sync_queue GROUP BY status"
    ).all() as { status: string; count: number }[];
    const stats = { pending: 0, synced: 0, failed: 0 };
    for (const row of rows) {
      if (row.status in stats) {
        stats[row.status as keyof typeof stats] = row.count;
      }
    }
    return stats;
  }

  // ---- Voice Samples -------------------------------------------------------

  insertVoiceSample(artifactId: string, content: string, sourceType: string): void {
    this.db.prepare(`
      INSERT INTO voice_samples (artifact_id, content, source_type)
      VALUES (?, ?, ?)
    `).run(artifactId, content, sourceType);
  }

  getUnsentVoiceSamples(limit = 100): VoiceSample[] {
    return this.db.prepare(
      'SELECT * FROM voice_samples WHERE sent_for_training = 0 ORDER BY extracted_at ASC LIMIT ?'
    ).all(limit) as VoiceSample[];
  }

  markVoiceSamplesSent(ids: number[]): void {
    const placeholders = ids.map(() => '?').join(',');
    this.db.prepare(
      `UPDATE voice_samples SET sent_for_training = 1 WHERE id IN (${placeholders})`
    ).run(...ids);
  }

  // ---- Config (key-value store) --------------------------------------------

  getConfig(key: string): string | undefined {
    const row = this.db.prepare('SELECT value FROM config WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value;
  }

  setConfig(key: string, value: string): void {
    this.db.prepare('INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?').run(key, value, value);
  }

  getWatchedDirs(): string[] {
    const raw = this.getConfig('watched_dirs');
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  }

  setWatchedDirs(dirs: string[]): void {
    this.setConfig('watched_dirs', JSON.stringify(dirs));
  }

  // ---- Lifecycle -----------------------------------------------------------

  close(): void {
    this.db.close();
  }
}
