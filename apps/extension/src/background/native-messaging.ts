// ---------------------------------------------------------------------------
// Native Messaging — Connect to com.lurk.native_host (Mac app)
// ---------------------------------------------------------------------------

// ---- Types -----------------------------------------------------------------

export interface NativeMessage {
  type: string;
  payload: unknown;
  timestamp: number;
  id: string;
}

export interface PolicyUpdate {
  type: 'policy_update';
  payload: {
    redactionLevel: string;
    localOnly: boolean;
    captureEnabled: boolean;
    allowedDomains: string[];
    blockedDomains: string[];
    yoloConfig: unknown;
  };
}

export interface CapturePayload {
  type: 'artifact_capture';
  payload: {
    artifactType: string;
    title: string;
    sourceUrl: string;
    sourceApp: string;
    contentHash: string;
    rawContent: string;
    metadata: Record<string, unknown>;
    capturedAt: number;
  };
}

export type NativeHostStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

type MessageHandler = (message: NativeMessage) => void;
type StatusHandler = (status: NativeHostStatus) => void;

// ---- Constants -------------------------------------------------------------

const NATIVE_HOST_NAME = 'com.lurk.native_host';
const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;
const HEARTBEAT_INTERVAL_MS = 30000;

// ---- Native Messaging Manager ----------------------------------------------

class NativeMessaging {
  private port: chrome.runtime.Port | null = null;
  private status: NativeHostStatus = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private statusHandlers: StatusHandler[] = [];
  private pendingResponses: Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }> = new Map();

  connect(): void {
    if (this.status === 'connected' || this.status === 'connecting') return;

    this.setStatus('connecting');
    console.log('[Lurk Native] Connecting to native host...');

    try {
      this.port = chrome.runtime.connectNative(NATIVE_HOST_NAME);

      this.port.onMessage.addListener(this.handleMessage.bind(this));
      this.port.onDisconnect.addListener(this.handleDisconnect.bind(this));

      // Send handshake
      this.sendRaw({
        type: 'handshake',
        payload: {
          extensionVersion: chrome.runtime.getManifest().version,
          extensionId: chrome.runtime.id,
        },
        timestamp: Date.now(),
        id: this.generateId(),
      });

      this.setStatus('connected');
      this.reconnectAttempts = 0;
      this.startHeartbeat();

      console.log('[Lurk Native] Connected to native host');
    } catch (error) {
      console.error('[Lurk Native] Connection failed:', error);
      this.setStatus('error');
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.clearReconnect();

    if (this.port) {
      this.port.disconnect();
      this.port = null;
    }

    this.setStatus('disconnected');
    this.clearPendingResponses();
    console.log('[Lurk Native] Disconnected from native host');
  }

  isConnected(): boolean {
    return this.status === 'connected';
  }

  getStatus(): NativeHostStatus {
    return this.status;
  }

  // Send a raw capture to the Mac app for processing
  sendCapture(capture: CapturePayload['payload']): void {
    this.send({
      type: 'artifact_capture',
      payload: capture,
      timestamp: Date.now(),
      id: this.generateId(),
    });
  }

  // Send a message and await a response
  async sendAndWait<T>(type: string, payload: unknown, timeoutMs = 10000): Promise<T> {
    const id = this.generateId();

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingResponses.delete(id);
        reject(new Error(`Native message timed out: ${type}`));
      }, timeoutMs);

      this.pendingResponses.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      });

      this.send({ type, payload, timestamp: Date.now(), id });
    });
  }

  // Register handler for a specific message type
  onMessage(type: string, handler: MessageHandler): () => void {
    const handlers = this.messageHandlers.get(type) ?? [];
    handlers.push(handler);
    this.messageHandlers.set(type, handlers);

    return () => {
      const current = this.messageHandlers.get(type) ?? [];
      this.messageHandlers.set(
        type,
        current.filter((h) => h !== handler)
      );
    };
  }

  // Register handler for status changes
  onStatusChange(handler: StatusHandler): () => void {
    this.statusHandlers.push(handler);
    return () => {
      this.statusHandlers = this.statusHandlers.filter((h) => h !== handler);
    };
  }

  // ---- Private ---------------------------------------------------------------

  private send(message: NativeMessage): void {
    if (!this.port || this.status !== 'connected') {
      console.warn('[Lurk Native] Cannot send message, not connected');
      return;
    }

    try {
      this.sendRaw(message);
    } catch (error) {
      console.error('[Lurk Native] Send failed:', error);
      this.handleDisconnect();
    }
  }

  private sendRaw(message: NativeMessage): void {
    this.port?.postMessage(message);
  }

  private handleMessage(message: NativeMessage): void {
    console.log('[Lurk Native] Received:', message.type);

    // Check if this is a response to a pending request
    if (message.id && this.pendingResponses.has(message.id)) {
      const pending = this.pendingResponses.get(message.id)!;
      clearTimeout(pending.timeout);
      this.pendingResponses.delete(message.id);

      if (message.type === 'error') {
        pending.reject(new Error(String(message.payload)));
      } else {
        pending.resolve(message.payload);
      }
      return;
    }

    // Route to registered handlers
    const handlers = this.messageHandlers.get(message.type) ?? [];
    handlers.forEach((handler) => {
      try {
        handler(message);
      } catch (error) {
        console.error(`[Lurk Native] Handler error for ${message.type}:`, error);
      }
    });

    // Handle well-known message types
    switch (message.type) {
      case 'heartbeat_ack':
        // Host is alive
        break;

      case 'policy_update':
        // Broadcast policy update to content scripts
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach((tab) => {
            if (tab.id) {
              chrome.tabs.sendMessage(tab.id, {
                type: 'LURK_POLICY_UPDATE',
                payload: message.payload,
              }).catch(() => {
                // Tab might not have content script
              });
            }
          });
        });
        break;

      case 'auth_required':
        // Mac app needs auth token
        this.handleAuthRequest();
        break;
    }
  }

  private handleDisconnect(): void {
    const error = chrome.runtime.lastError;
    console.warn('[Lurk Native] Disconnected:', error?.message ?? 'unknown reason');

    this.port = null;
    this.stopHeartbeat();
    this.setStatus('disconnected');
    this.clearPendingResponses();
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('[Lurk Native] Max reconnect attempts reached, giving up');
      this.setStatus('error');
      return;
    }

    const delay = RECONNECT_DELAY_MS * Math.pow(1.5, this.reconnectAttempts);
    this.reconnectAttempts++;

    console.log(`[Lurk Native] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send({
        type: 'heartbeat',
        payload: { timestamp: Date.now() },
        timestamp: Date.now(),
        id: this.generateId(),
      });
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private setStatus(status: NativeHostStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.statusHandlers.forEach((h) => h(status));
  }

  private clearPendingResponses(): void {
    this.pendingResponses.forEach((pending) => {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Disconnected'));
    });
    this.pendingResponses.clear();
  }

  private async handleAuthRequest(): Promise<void> {
    try {
      const { auth: authManager } = await import('../lib/auth');
      const token = await authManager.getToken();
      if (token) {
        this.send({
          type: 'auth_token',
          payload: { token },
          timestamp: Date.now(),
          id: this.generateId(),
        });
      }
    } catch (error) {
      console.error('[Lurk Native] Failed to handle auth request:', error);
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}

export const nativeMessaging = new NativeMessaging();
