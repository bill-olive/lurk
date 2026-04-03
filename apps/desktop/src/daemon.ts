// =============================================================================
// LurkDaemon — Core daemon logic (importable, no auto-start)
//
// Used by both the Electron main process and standalone CLI mode.
// =============================================================================

import { Watcher } from './watcher';
import { Ledger } from './ledger';
import { Server } from './server';
import { NativeHost } from './native-host';
import { Syncer } from './syncer';
import { Differ } from './differ';
import { Analyst } from './analyst';
import { resolve } from 'path';
import { homedir } from 'os';

// ---- Configuration ---------------------------------------------------------

export interface DaemonConfig {
  watchDirs: string[];
  extensions: string[];
  excludePatterns: string[];
  dbPath: string;
  port: number;
  apiEndpoint: string;
  debounceMs: number;
}

const DEFAULT_CONFIG: DaemonConfig = {
  watchDirs: [
    resolve(homedir(), 'Desktop'),
  ],
  extensions: ['.md', '.txt', '.docx', '.pdf', '.xlsx', '.csv', '.json', '.html', '.rtf'],
  excludePatterns: [
    '**/node_modules/**',
    '**/.git/**',
    '**/.DS_Store',
    '**/*.tmp',
    '**/*.swp',
    '**/~$*',
    '**/.Trash/**',
    '**/Library/**',
    '**/.cache/**',
    '**/.npm/**',
    '**/.nvm/**',
    '**/.claude/**',
  ],
  dbPath: resolve(homedir(), '.lurk', 'ledger.db'),
  port: 3847,
  apiEndpoint: 'http://localhost:8080/v1',
  debounceMs: 5000,
};

// ---- LurkDaemon ------------------------------------------------------------

export class LurkDaemon {
  private config: DaemonConfig;
  private ledger!: Ledger;
  private watcher!: Watcher;
  private differ!: Differ;
  private syncer!: Syncer;
  private server!: Server;
  private nativeHost!: NativeHost;
  private analyst!: Analyst;

  constructor(config?: Partial<DaemonConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async start(): Promise<void> {
    console.log('[Lurk Daemon] Starting...');

    this.ledger = new Ledger(this.config.dbPath);
    this.ledger.initialize();
    console.log(`[Ledger] Database at ${this.config.dbPath}`);

    // Load saved watched dirs (or use defaults)
    const savedDirs = this.ledger.getWatchedDirs();
    const watchDirs = savedDirs.length > 0 ? savedDirs : this.config.watchDirs;

    this.differ = new Differ();
    this.syncer = new Syncer(this.ledger, this.config.apiEndpoint);

    this.watcher = new Watcher(
      watchDirs,
      this.config.extensions,
      this.config.excludePatterns,
      this.config.debounceMs,
      this.ledger,
      this.differ,
    );
    await this.watcher.start();
    console.log(`[Watcher] Monitoring ${watchDirs.length} directories`);

    this.server = new Server(this.config.port, this.ledger, this.watcher);
    await this.server.start();
    console.log(`[Server] http://localhost:${this.config.port}`);

    this.nativeHost = new NativeHost(this.ledger);
    this.nativeHost.start();

    this.analyst = new Analyst(this.ledger);
    await this.analyst.start();

    // Provide analyst to watcher so it can enqueue analysis after commits
    this.watcher.setAnalyst(this.analyst);

    this.syncer.startPeriodicSync(60_000);
    console.log('[Lurk Daemon] All systems running');
  }

  async shutdown(): Promise<void> {
    console.log('[Lurk Daemon] Shutting down...');
    this.analyst?.stop();
    this.syncer?.stop();
    this.nativeHost?.stop();
    if (this.server) await this.server.stop();
    if (this.watcher) await this.watcher.stop();
    this.ledger?.close();
    console.log('[Lurk Daemon] Stopped');
  }

  getPort(): number {
    return this.config.port;
  }

  addWatchDir(dir: string): string[] {
    this.watcher.addDir(dir);
    const dirs = this.watcher.getWatchedDirs();
    this.ledger.setWatchedDirs(dirs);
    return dirs;
  }

  removeWatchDir(dir: string): string[] {
    this.watcher.removeDir(dir);
    const dirs = this.watcher.getWatchedDirs();
    this.ledger.setWatchedDirs(dirs);
    return dirs;
  }

  getWatchedDirs(): string[] {
    return this.watcher.getWatchedDirs();
  }
}
