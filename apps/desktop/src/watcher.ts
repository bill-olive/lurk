// =============================================================================
// Watcher — Filesystem monitor using chokidar (FSEvents on macOS)
//
// Watches configured directories for file changes, computes SHA-256 hashes,
// generates diffs against previous versions, and stores commits in the ledger.
// Also extracts voice training samples from text-based files.
// =============================================================================

import { watch, type FSWatcher } from 'chokidar';
import { readFile, stat } from 'fs/promises';
import { createHash } from 'crypto';
import { basename, extname, resolve } from 'path';
import { randomUUID } from 'crypto';
import { Ledger } from './ledger';
import { Differ } from './differ';

// ---- Types -----------------------------------------------------------------

export interface WatcherStats {
  watchedDirs: string[];
  totalFiles: number;
  recentChanges: { path: string; time: string }[];
}

// ---- Watcher Class ---------------------------------------------------------

export class Watcher {
  private fsWatcher: FSWatcher | null = null;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private stats: WatcherStats;
  private activeProcessing = 0;
  private readonly MAX_CONCURRENT = 10; // Limit concurrent file reads to avoid EMFILE
  private processingQueue: string[] = [];
  private lastEmfileWarning = 0;

  constructor(
    private watchDirs: string[],
    private extensions: string[],
    private excludePatterns: string[],
    private debounceMs: number,
    private ledger: Ledger,
    private differ: Differ,
  ) {
    this.stats = {
      watchedDirs: watchDirs,
      totalFiles: 0,
      recentChanges: [],
    };
  }

  async start(): Promise<void> {
    const globs = this.watchDirs.map((dir) => resolve(dir));

    this.fsWatcher = watch(globs, {
      ignored: this.excludePatterns,
      persistent: true,
      ignoreInitial: true, // Don't process existing files on startup (avoids EMFILE)
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 500,
      },
      depth: 3,
    });

    this.fsWatcher
      .on('add', (path) => this.handleChange(path))
      .on('change', (path) => this.handleChange(path))
      .on('unlink', (path) => this.handleDelete(path))
      .on('error', (err) => {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === 'EMFILE' || code === 'ENFILE') {
          const now = Date.now();
          if (now - this.lastEmfileWarning > 10000) {
            this.lastEmfileWarning = now;
            console.warn('[Watcher] Too many open files — some changes may be delayed. Consider watching fewer directories.');
          }
        } else {
          console.error('[Watcher] Error:', err);
        }
      });
  }

  async stop(): Promise<void> {
    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    if (this.fsWatcher) {
      await this.fsWatcher.close();
      this.fsWatcher = null;
    }
  }

  getStats(): WatcherStats {
    return { ...this.stats };
  }

  /** Add a directory to the watch list at runtime. */
  addDir(dir: string): void {
    if (this.watchDirs.includes(dir)) return;
    this.watchDirs.push(dir);
    this.stats.watchedDirs = [...this.watchDirs];
    try {
      this.fsWatcher?.add(dir);
      console.log(`[Watcher] Added: ${dir}`);
    } catch (err) {
      console.error(`[Watcher] Failed to watch ${dir}:`, err);
      // Still keep it in the list — it's persisted and will retry on restart
    }
  }

  /** Remove a directory from the watch list at runtime. */
  removeDir(dir: string): void {
    const idx = this.watchDirs.indexOf(dir);
    if (idx === -1) return;
    this.watchDirs.splice(idx, 1);
    this.stats.watchedDirs = [...this.watchDirs];
    this.fsWatcher?.unwatch(dir);
    console.log(`[Watcher] Removed: ${dir}`);
  }

  getWatchedDirs(): string[] {
    return [...this.watchDirs];
  }

  // ---- Private: Change Handling --------------------------------------------

  private handleChange(filePath: string): void {
    const ext = extname(filePath).toLowerCase();
    if (!this.extensions.includes(ext)) return;

    // Debounce: wait for writes to settle
    const existing = this.debounceTimers.get(filePath);
    if (existing) clearTimeout(existing);

    this.debounceTimers.set(
      filePath,
      setTimeout(() => {
        this.debounceTimers.delete(filePath);
        this.enqueueProcessing(filePath);
      }, this.debounceMs),
    );
  }

  /** Queue file processing to limit concurrent file reads and prevent EMFILE. */
  private enqueueProcessing(filePath: string): void {
    if (this.activeProcessing < this.MAX_CONCURRENT) {
      this.activeProcessing++;
      this.processChange(filePath)
        .catch((err) => {
          const code = (err as NodeJS.ErrnoException).code;
          if (code === 'EMFILE' || code === 'ENFILE') {
            // Re-queue with back-off (don't spam)
            if (this.processingQueue.length < 50) {
              this.processingQueue.push(filePath);
            }
          } else {
            console.error(`[Watcher] Error processing ${filePath}:`, err);
          }
        })
        .finally(() => {
          this.activeProcessing--;
          this.drainQueue();
        });
    } else {
      this.processingQueue.push(filePath);
    }
  }

  private drainQueue(): void {
    while (this.processingQueue.length > 0 && this.activeProcessing < this.MAX_CONCURRENT) {
      const next = this.processingQueue.shift()!;
      this.enqueueProcessing(next);
    }
  }

  private handleDelete(filePath: string): void {
    const ext = extname(filePath).toLowerCase();
    if (!this.extensions.includes(ext)) return;

    const artifact = this.ledger.getArtifactByPath(filePath);
    if (!artifact) return;

    const commitId = randomUUID();
    this.ledger.insertCommit({
      id: commitId,
      artifact_id: artifact.id,
      content_hash: 'deleted',
      previous_hash: artifact.content_hash,
      diff: null,
      diff_stats: JSON.stringify({ added: 0, removed: 0, changed: 0 }),
      content_snapshot: null,
    });

    this.ledger.enqueueSync(artifact.id, commitId, 'delete');
    console.log(`[Watcher] Deleted: ${filePath}`);
  }

  private async processChange(filePath: string): Promise<void> {
    try {
      const fileStat = await stat(filePath);
      const content = await readFile(filePath, 'utf-8');
      const hash = createHash('sha256').update(content).digest('hex');

      const existing = this.ledger.getArtifactByPath(filePath);

      // Skip if content hasn't changed
      if (existing && existing.content_hash === hash) return;

      const artifactId = existing?.id ?? randomUUID();
      const fileName = basename(filePath);
      const ext = extname(filePath).toLowerCase();

      // Upsert artifact
      this.ledger.upsertArtifact({
        id: artifactId,
        file_path: filePath,
        file_name: fileName,
        extension: ext,
        content_hash: hash,
        size_bytes: fileStat.size,
      });

      // Compute diff against previous version
      let diff: string | null = null;
      let diffStats: string | null = null;
      const previousCommit = this.ledger.getLatestCommit(artifactId);

      if (previousCommit?.content_snapshot) {
        const result = this.differ.computeDiff(previousCommit.content_snapshot, content);
        diff = result.patch;
        diffStats = JSON.stringify(result.stats);
      }

      // Create commit
      const commitId = randomUUID();
      this.ledger.insertCommit({
        id: commitId,
        artifact_id: artifactId,
        content_hash: hash,
        previous_hash: existing?.content_hash ?? null,
        diff,
        diff_stats: diffStats,
        content_snapshot: content,
      });

      // Enqueue for cloud sync
      const action = existing ? 'update' : 'create';
      this.ledger.enqueueSync(artifactId, commitId, action);

      // Extract voice sample from text content
      if (this.isTextContent(ext) && content.length >= 100) {
        this.extractVoiceSample(artifactId, content, ext);
      }

      // Update stats
      this.stats.totalFiles = this.ledger.getArtifactCount();
      this.stats.recentChanges.unshift({
        path: filePath,
        time: new Date().toISOString(),
      });
      if (this.stats.recentChanges.length > 50) {
        this.stats.recentChanges = this.stats.recentChanges.slice(0, 50);
      }

      const verb = existing ? 'Updated' : 'Tracked';
      console.log(`[Watcher] ${verb}: ${fileName} (${hash.slice(0, 8)})`);
    } catch (err) {
      console.error(`[Watcher] Failed to process ${filePath}:`, err);
    }
  }

  // ---- Private: Voice Sample Extraction ------------------------------------

  private isTextContent(ext: string): boolean {
    return ['.md', '.txt', '.html', '.rtf', '.json', '.csv'].includes(ext);
  }

  private extractVoiceSample(artifactId: string, content: string, ext: string): void {
    // Extract meaningful paragraphs (skip very short or code-heavy content)
    const paragraphs = content
      .split(/\n\s*\n/)
      .filter((p) => p.trim().length >= 50)
      .filter((p) => {
        // Skip code blocks and tables
        const lines = p.split('\n');
        const codeLines = lines.filter((l) => l.startsWith('  ') || l.startsWith('\t') || l.startsWith('|'));
        return codeLines.length / lines.length < 0.5;
      });

    // Take up to 3 representative paragraphs
    const samples = paragraphs.slice(0, 3);
    for (const sample of samples) {
      this.ledger.insertVoiceSample(artifactId, sample.trim(), ext);
    }
  }
}
