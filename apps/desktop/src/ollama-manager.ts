// =============================================================================
// OllamaManager — Manages bundled Ollama binary lifecycle
//
// Spawns the Ollama server from the app's bundled binary, manages its lifecycle,
// pulls models on first launch with progress reporting, and cleans up on quit.
// Users never need to install Ollama separately — everything is in the .app.
// =============================================================================

import { spawn, type ChildProcess } from 'child_process';
import { join, resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { Ollama } from 'ollama';

// ---- Configuration ---------------------------------------------------------

const OLLAMA_PORT = 11435; // Use a different port than system Ollama (11434)
const OLLAMA_HOST = `http://127.0.0.1:${OLLAMA_PORT}`;
const DEFAULT_MODEL = 'qwen3:14b';
const HEALTH_CHECK_INTERVAL = 500;  // ms
const HEALTH_CHECK_TIMEOUT = 30000; // ms
const MODELS_DIR = resolve(homedir(), '.lurk', 'models');

// ---- Types -----------------------------------------------------------------

export type SetupPhase =
  | 'starting'     // Spawning Ollama server
  | 'checking'     // Checking for model
  | 'downloading'  // Pulling model (first launch)
  | 'ready'        // Model available, fully operational
  | 'error';       // Something went wrong

export interface SetupStatus {
  phase: SetupPhase;
  message: string;
  progress?: number;       // 0-100 for download phase
  downloadedBytes?: number;
  totalBytes?: number;
  model?: string;
  error?: string;
}

export type StatusCallback = (status: SetupStatus) => void;

// ---- OllamaManager --------------------------------------------------------

export class OllamaManager {
  private process: ChildProcess | null = null;
  private client: Ollama;
  private model: string;
  private binaryPath: string = '';
  private running = false;
  private statusCallback: StatusCallback | null = null;
  private currentStatus: SetupStatus = { phase: 'starting', message: 'Initializing...' };

  constructor(model?: string) {
    this.model = model ?? DEFAULT_MODEL;
    this.client = new Ollama({ host: OLLAMA_HOST });
  }

  /** Register a callback for setup status updates (used by IPC to push to UI). */
  onStatus(callback: StatusCallback): void {
    this.statusCallback = callback;
  }

  /** Get current setup status. */
  getStatus(): SetupStatus {
    return { ...this.currentStatus };
  }

  /** Get the Ollama client (for use by Analyst). */
  getClient(): Ollama {
    return this.client;
  }

  /** Get the host URL. */
  getHost(): string {
    return OLLAMA_HOST;
  }

  /** Get the resolved model name. */
  getModel(): string {
    return this.model;
  }

  isRunning(): boolean {
    return this.running;
  }

  /** Start the managed Ollama server and ensure the model is available. */
  async start(): Promise<boolean> {
    try {
      // 1. Find the bundled binary
      this.binaryPath = this.findBinary();
      if (!this.binaryPath) {
        this.setStatus({ phase: 'error', message: 'Ollama binary not found in app bundle' });
        return false;
      }
      console.log(`[OllamaManager] Binary: ${this.binaryPath}`);

      // 2. Ensure models directory exists
      mkdirSync(MODELS_DIR, { recursive: true });

      // 3. Check if system Ollama is already running on our port
      const alreadyRunning = await this.healthCheck();
      if (alreadyRunning) {
        console.log('[OllamaManager] Ollama already running, reusing existing instance');
        this.running = true;
      } else {
        // 4. Spawn the bundled Ollama server
        this.setStatus({ phase: 'starting', message: 'Starting AI engine...' });
        await this.spawnServer();
      }

      // 5. Check if model is available, pull if needed
      this.setStatus({ phase: 'checking', message: 'Checking AI model...' });
      const hasModel = await this.checkModel();
      if (!hasModel) {
        await this.pullModel();
      }

      this.setStatus({ phase: 'ready', message: 'AI engine ready', model: this.model });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[OllamaManager] Failed to start: ${message}`);
      this.setStatus({ phase: 'error', message: `Failed to start AI engine: ${message}`, error: message });
      return false;
    }
  }

  /** Stop the managed Ollama server. */
  async stop(): Promise<void> {
    if (this.process) {
      console.log('[OllamaManager] Stopping Ollama server...');
      this.process.kill('SIGTERM');

      // Give it 5s to shut down gracefully, then force kill
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.process) {
            this.process.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        this.process!.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this.process = null;
      this.running = false;
      console.log('[OllamaManager] Ollama server stopped');
    }
  }

  // ---- Private: Binary Discovery --------------------------------------------

  private findBinary(): string {
    // Production: inside the .app bundle resources
    const prodPath = join(process.resourcesPath ?? '', 'bin', 'ollama');
    if (existsSync(prodPath)) return prodPath;

    // Development: in the resources directory relative to source
    const devPath = join(__dirname, '..', '..', 'resources', 'bin', 'ollama');
    if (existsSync(devPath)) return devPath;

    // Fallback: check if system Ollama is available
    const brewPath = '/opt/homebrew/bin/ollama';
    if (existsSync(brewPath)) return brewPath;

    const usrPath = '/usr/local/bin/ollama';
    if (existsSync(usrPath)) return usrPath;

    return '';
  }

  // ---- Private: Server Lifecycle --------------------------------------------

  private async spawnServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        OLLAMA_HOST: `127.0.0.1:${OLLAMA_PORT}`,
        OLLAMA_MODELS: MODELS_DIR,
        OLLAMA_NOPRUNE: '1',           // Don't auto-prune models
        OLLAMA_KEEP_ALIVE: '10m',      // Keep model loaded for 10 min
      };

      this.process = spawn(this.binaryPath, ['serve'], {
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });

      this.process.stdout?.on('data', (data: Buffer) => {
        const line = data.toString().trim();
        if (line) console.log(`[Ollama] ${line}`);
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        const line = data.toString().trim();
        if (line) console.log(`[Ollama] ${line}`);
      });

      this.process.on('error', (err) => {
        console.error('[OllamaManager] Failed to spawn Ollama:', err);
        reject(err);
      });

      this.process.on('exit', (code) => {
        if (this.running) {
          console.warn(`[OllamaManager] Ollama exited unexpectedly (code ${code})`);
          this.running = false;
        }
      });

      // Wait for health check
      this.waitForHealthy()
        .then(() => {
          this.running = true;
          console.log(`[OllamaManager] Server ready on port ${OLLAMA_PORT}`);
          resolve();
        })
        .catch(reject);
    });
  }

  private async waitForHealthy(): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < HEALTH_CHECK_TIMEOUT) {
      if (await this.healthCheck()) return;
      await new Promise((r) => setTimeout(r, HEALTH_CHECK_INTERVAL));
    }
    throw new Error(`Ollama server did not become healthy within ${HEALTH_CHECK_TIMEOUT}ms`);
  }

  private async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${OLLAMA_HOST}/api/tags`);
      return res.ok;
    } catch {
      return false;
    }
  }

  // ---- Private: Model Management --------------------------------------------

  private async checkModel(): Promise<boolean> {
    try {
      const list = await this.client.list();
      const modelBase = this.model.split(':')[0];
      return list.models.some((m) => m.name.startsWith(modelBase));
    } catch {
      return false;
    }
  }

  private async pullModel(): Promise<void> {
    console.log(`[OllamaManager] Pulling model ${this.model}...`);
    this.setStatus({
      phase: 'downloading',
      message: `Downloading AI model (${this.model})...`,
      progress: 0,
      model: this.model,
    });

    const stream = await this.client.pull({ model: this.model, stream: true });

    let lastProgress = 0;
    for await (const event of stream) {
      if (event.total && event.completed) {
        const progress = Math.round((event.completed / event.total) * 100);
        if (progress !== lastProgress) {
          lastProgress = progress;
          this.setStatus({
            phase: 'downloading',
            message: event.status || `Downloading ${this.model}...`,
            progress,
            downloadedBytes: event.completed,
            totalBytes: event.total,
            model: this.model,
          });
        }
      } else if (event.status) {
        this.setStatus({
          phase: 'downloading',
          message: event.status,
          progress: lastProgress,
          model: this.model,
        });
      }
    }

    console.log(`[OllamaManager] Model ${this.model} ready`);
  }

  // ---- Private: Status Updates ----------------------------------------------

  private setStatus(status: SetupStatus): void {
    this.currentStatus = status;
    this.statusCallback?.(status);
  }
}
