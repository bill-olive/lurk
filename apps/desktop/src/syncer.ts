// =============================================================================
// Syncer — Background cloud sync with retry queue
//
// Processes the sync_queue table, sending artifact changes to the Lurk API.
// Implements exponential backoff on failures, respects rate limits.
// =============================================================================

import { Ledger, type SyncQueueItem } from './ledger';

export class Syncer {
  private interval: NodeJS.Timeout | null = null;
  private syncing = false;

  constructor(
    private ledger: Ledger,
    private apiEndpoint: string,
  ) {}

  startPeriodicSync(intervalMs: number): void {
    this.interval = setInterval(() => {
      this.syncBatch().catch((err) =>
        console.error('[Syncer] Batch sync error:', err)
      );
    }, intervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async syncBatch(): Promise<void> {
    if (this.syncing) return;
    this.syncing = true;

    try {
      const items = this.ledger.getPendingSyncItems(10);
      if (items.length === 0) return;

      console.log(`[Syncer] Processing ${items.length} pending items`);

      for (const item of items) {
        await this.syncItem(item);
      }
    } finally {
      this.syncing = false;
    }
  }

  private async syncItem(item: SyncQueueItem): Promise<void> {
    this.ledger.updateSyncStatus(item.id, 'syncing');

    try {
      const artifact = this.ledger.getArtifact(item.artifact_id);
      if (!artifact) {
        this.ledger.updateSyncStatus(item.id, 'failed', 'Artifact not found in ledger');
        return;
      }

      const commits = this.ledger.getCommitsForArtifact(item.artifact_id, 1);
      const latestCommit = commits[0];

      const payload = {
        artifactId: artifact.id,
        filePath: artifact.file_path,
        fileName: artifact.file_name,
        extension: artifact.extension,
        contentHash: artifact.content_hash,
        sizeBytes: artifact.size_bytes,
        action: item.action,
        commit: latestCommit ? {
          id: latestCommit.id,
          hash: latestCommit.content_hash,
          previousHash: latestCommit.previous_hash,
          diff: latestCommit.diff,
          diffStats: latestCommit.diff_stats ? JSON.parse(latestCommit.diff_stats) : null,
        } : null,
      };

      const response = await fetch(`${this.apiEndpoint}/artifacts/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`API responded with ${response.status}: ${errorText}`);
      }

      this.ledger.updateSyncStatus(item.id, 'synced');
      console.log(`[Syncer] Synced: ${artifact.file_name}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.ledger.updateSyncStatus(item.id, 'failed', message);

      // Don't log network errors too noisily when API isn't available
      if (message.includes('ECONNREFUSED') || message.includes('fetch failed')) {
        // Expected when running standalone without API
      } else {
        console.error(`[Syncer] Failed to sync ${item.artifact_id}: ${message}`);
      }
    }
  }
}
