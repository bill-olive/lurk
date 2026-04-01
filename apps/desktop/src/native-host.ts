// =============================================================================
// NativeHost — Chrome Native Messaging host (com.lurk.native_host)
//
// Implements the stdio-based JSON protocol that the Chrome extension's
// NativeMessaging class (apps/extension/src/background/native-messaging.ts)
// already speaks. Handles handshake, artifact_capture, heartbeat messages
// and sends policy_update, badge_update responses.
// =============================================================================

import { Ledger } from './ledger';

// ---- Types (mirror extension protocol) -------------------------------------

interface NativeMessage {
  type: string;
  payload: unknown;
  timestamp: number;
  id: string;
}

// ---- NativeHost Class ------------------------------------------------------

export class NativeHost {
  private running = false;
  private buffer = Buffer.alloc(0);

  constructor(private ledger: Ledger) {}

  start(): void {
    if (this.running) return;
    this.running = true;

    // Chrome native messaging uses stdin/stdout with length-prefixed JSON
    process.stdin.on('data', (chunk: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.processBuffer();
    });

    process.stdin.on('end', () => {
      this.running = false;
    });
  }

  stop(): void {
    this.running = false;
  }

  // ---- Message Processing --------------------------------------------------

  private processBuffer(): void {
    // Chrome native messaging: 4-byte little-endian length prefix + JSON
    while (this.buffer.length >= 4) {
      const messageLength = this.buffer.readUInt32LE(0);

      if (this.buffer.length < 4 + messageLength) {
        break; // Wait for more data
      }

      const messageData = this.buffer.subarray(4, 4 + messageLength).toString('utf-8');
      this.buffer = this.buffer.subarray(4 + messageLength);

      try {
        const message: NativeMessage = JSON.parse(messageData);
        this.handleMessage(message);
      } catch (err) {
        console.error('[NativeHost] Failed to parse message:', err);
      }
    }
  }

  private handleMessage(message: NativeMessage): void {
    switch (message.type) {
      case 'handshake':
        this.handleHandshake(message);
        break;

      case 'heartbeat':
        this.send({
          type: 'heartbeat_ack',
          payload: { uptime: process.uptime() },
          timestamp: Date.now(),
          id: message.id,
        });
        break;

      case 'artifact_capture':
        this.handleCapture(message);
        break;

      default:
        console.log(`[NativeHost] Unknown message type: ${message.type}`);
    }
  }

  private handleHandshake(message: NativeMessage): void {
    const payload = message.payload as { extensionVersion?: string; extensionId?: string };
    console.log(`[NativeHost] Handshake from extension v${payload.extensionVersion ?? 'unknown'}`);

    this.send({
      type: 'handshake_ack',
      payload: {
        daemonVersion: '0.1.0',
        artifactCount: this.ledger.getArtifactCount(),
        syncStatus: this.ledger.getSyncStats(),
      },
      timestamp: Date.now(),
      id: message.id,
    });
  }

  private handleCapture(message: NativeMessage): void {
    const payload = message.payload as {
      artifactType: string;
      title: string;
      sourceUrl: string;
      sourceApp: string;
      contentHash: string;
      rawContent: string;
      metadata: Record<string, unknown>;
      capturedAt: number;
    };

    console.log(`[NativeHost] Captured: ${payload.title} from ${payload.sourceApp}`);

    // Store in ledger (extension captures are treated as artifacts from browser)
    const artifactId = `ext-${payload.contentHash.slice(0, 12)}`;
    this.ledger.upsertArtifact({
      id: artifactId,
      file_path: `browser://${payload.sourceUrl}`,
      file_name: payload.title,
      extension: '.web',
      content_hash: payload.contentHash,
      size_bytes: payload.rawContent.length,
    });

    // Extract voice sample if content is substantial
    if (payload.rawContent.length >= 100) {
      this.ledger.insertVoiceSample(artifactId, payload.rawContent.slice(0, 2000), payload.artifactType);
    }

    // Acknowledge
    this.send({
      type: 'capture_ack',
      payload: { artifactId, stored: true },
      timestamp: Date.now(),
      id: message.id,
    });
  }

  // ---- Send ----------------------------------------------------------------

  private send(message: NativeMessage): void {
    const json = JSON.stringify(message);
    const header = Buffer.alloc(4);
    header.writeUInt32LE(Buffer.byteLength(json, 'utf-8'), 0);

    try {
      process.stdout.write(header);
      process.stdout.write(json);
    } catch (err) {
      console.error('[NativeHost] Failed to send message:', err);
    }
  }
}
