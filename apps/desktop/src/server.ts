// =============================================================================
// Server — localhost:3847 HTTP + WebSocket for the desktop UI
//
// Serves a REST API for the Lurk desktop dashboard and a WebSocket for
// real-time file change notifications.
// =============================================================================

import express, { type Express, type Request, type Response } from 'express';
import { WebSocketServer, type WebSocket } from 'ws';
import { createServer, type Server as HttpServer } from 'http';
import { Ledger } from './ledger';
import { Watcher } from './watcher';

export class Server {
  private app: Express;
  private httpServer: HttpServer;
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();

  constructor(
    private port: number,
    private ledger: Ledger,
    private watcher: Watcher,
  ) {
    this.app = express();
    this.app.use(express.json());

    // CORS for localhost UI
    this.app.use((_req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      next();
    });

    this.httpServer = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.httpServer });

    this.setupRoutes();
    this.setupWebSocket();
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer.listen(this.port, () => resolve());
    });
  }

  async stop(): Promise<void> {
    for (const client of this.clients) {
      client.close();
    }
    this.wss.close();
    return new Promise((resolve) => {
      this.httpServer.close(() => resolve());
    });
  }

  /** Broadcast a message to all connected WebSocket clients. */
  broadcast(event: string, data: unknown): void {
    const message = JSON.stringify({ event, data, timestamp: Date.now() });
    for (const client of this.clients) {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    }
  }

  // ---- Routes --------------------------------------------------------------

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({ status: 'ok', version: '0.1.0' });
    });

    // Dashboard stats
    this.app.get('/api/stats', (_req: Request, res: Response) => {
      const watcherStats = this.watcher.getStats();
      const syncStats = this.ledger.getSyncStats();
      const artifactCount = this.ledger.getArtifactCount();

      res.json({
        artifacts: artifactCount,
        watchedDirs: watcherStats.watchedDirs,
        sync: syncStats,
        recentChanges: watcherStats.recentChanges.slice(0, 20),
      });
    });

    // List artifacts
    this.app.get('/api/artifacts', (req: Request, res: Response) => {
      const limit = parseInt(String(req.query['limit'] ?? '50')) || 50;
      const offset = parseInt(String(req.query['offset'] ?? '0')) || 0;
      const artifacts = this.ledger.listArtifacts(limit, offset);
      res.json({ artifacts, total: this.ledger.getArtifactCount() });
    });

    // Get artifact detail with commits
    this.app.get('/api/artifacts/:id', (req: Request, res: Response) => {
      const id = String(req.params['id']);
      const artifact = this.ledger.getArtifact(id);
      if (!artifact) {
        res.status(404).json({ error: 'Artifact not found' });
        return;
      }
      const commits = this.ledger.getCommitsForArtifact(artifact.id);
      res.json({ artifact, commits });
    });

    // Get artifact commits (version history)
    this.app.get('/api/artifacts/:id/commits', (req: Request, res: Response) => {
      const id = String(req.params['id']);
      const limit = parseInt(String(req.query['limit'] ?? '50')) || 50;
      const commits = this.ledger.getCommitsForArtifact(id, limit);
      res.json({ commits });
    });

    // Sync queue status
    this.app.get('/api/sync', (_req: Request, res: Response) => {
      const stats = this.ledger.getSyncStats();
      const pending = this.ledger.getPendingSyncItems(20);
      res.json({ stats, pending });
    });

    // Voice samples (unsent)
    this.app.get('/api/voice-samples', (req: Request, res: Response) => {
      const limit = parseInt(String(req.query['limit'] ?? '50')) || 50;
      const samples = this.ledger.getUnsentVoiceSamples(limit);
      res.json({ samples, count: samples.length });
    });

    // Mark voice samples as sent
    this.app.post('/api/voice-samples/mark-sent', (req: Request, res: Response) => {
      const { ids } = req.body as { ids: number[] };
      if (!Array.isArray(ids)) {
        res.status(400).json({ error: 'ids must be an array' });
        return;
      }
      this.ledger.markVoiceSamplesSent(ids);
      res.json({ marked: ids.length });
    });

    // ---- Watched directory management ----------------------------------------

    this.app.get('/api/watched-dirs', (_req: Request, res: Response) => {
      res.json({ dirs: this.watcher.getWatchedDirs() });
    });

    this.app.post('/api/watched-dirs', (req: Request, res: Response) => {
      const { dir } = req.body as { dir: string };
      if (!dir || typeof dir !== 'string') {
        res.status(400).json({ error: 'dir is required' });
        return;
      }
      this.watcher.addDir(dir);
      this.ledger.setWatchedDirs(this.watcher.getWatchedDirs());
      res.json({ dirs: this.watcher.getWatchedDirs() });
    });

    this.app.delete('/api/watched-dirs', (req: Request, res: Response) => {
      const { dir } = req.body as { dir: string };
      if (!dir || typeof dir !== 'string') {
        res.status(400).json({ error: 'dir is required' });
        return;
      }
      this.watcher.removeDir(dir);
      this.ledger.setWatchedDirs(this.watcher.getWatchedDirs());
      res.json({ dirs: this.watcher.getWatchedDirs() });
    });
  }

  // ---- WebSocket -----------------------------------------------------------

  private setupWebSocket(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);
      console.log(`[Server] WebSocket client connected (${this.clients.size} total)`);

      // Send initial state
      ws.send(JSON.stringify({
        event: 'connected',
        data: {
          artifacts: this.ledger.getArtifactCount(),
          sync: this.ledger.getSyncStats(),
        },
        timestamp: Date.now(),
      }));

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log(`[Server] WebSocket client disconnected (${this.clients.size} total)`);
      });

      ws.on('error', (err) => {
        console.error('[Server] WebSocket error:', err);
        this.clients.delete(ws);
      });
    });
  }
}
