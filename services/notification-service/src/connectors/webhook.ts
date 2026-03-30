/**
 * Generic webhook connector.
 *
 * Delivers notification payloads to arbitrary HTTPS endpoints
 * with configurable retries, HMAC signing, and timeout.
 */

import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WebhookPayload {
  /** Target URL (must be HTTPS in production) */
  url: string;
  /** HTTP method (default POST) */
  method?: "POST" | "PUT";
  /** JSON payload */
  body: Record<string, unknown>;
  /** Additional headers */
  headers?: Record<string, string>;
  /** HMAC secret for signing the payload */
  signingSecret?: string;
}

export interface WebhookResult {
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  error?: string;
  attempts: number;
}

export interface WebhookConnectorConfig {
  /** Maximum retry attempts (default 3) */
  maxRetries: number;
  /** Base delay between retries in ms (exponential backoff) */
  retryDelayMs: number;
  /** Request timeout in ms */
  timeoutMs: number;
  /** Default signing secret (can be overridden per-payload) */
  defaultSigningSecret?: string;
}

// ---------------------------------------------------------------------------
// Connector
// ---------------------------------------------------------------------------

export class WebhookConnector {
  private readonly config: WebhookConnectorConfig;

  constructor(config?: Partial<WebhookConnectorConfig>) {
    this.config = {
      maxRetries: config?.maxRetries ?? 3,
      retryDelayMs: config?.retryDelayMs ?? 1000,
      timeoutMs: config?.timeoutMs ?? 10_000,
      defaultSigningSecret: config?.defaultSigningSecret ?? process.env["WEBHOOK_SIGNING_SECRET"],
    };
  }

  /**
   * Deliver a webhook payload with retries.
   */
  async send(payload: WebhookPayload): Promise<WebhookResult> {
    const method = payload.method ?? "POST";
    const bodyStr = JSON.stringify(payload.body);
    const signingSecret =
      payload.signingSecret ?? this.config.defaultSigningSecret;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "Lurk-Notification-Service/0.1.0",
      ...(payload.headers ?? {}),
    };

    // HMAC signature
    if (signingSecret) {
      const signature = crypto
        .createHmac("sha256", signingSecret)
        .update(bodyStr)
        .digest("hex");
      headers["X-Lurk-Signature"] = `sha256=${signature}`;
      headers["X-Lurk-Timestamp"] = new Date().toISOString();
    }

    let lastError: string | undefined;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          this.config.timeoutMs
        );

        const response = await fetch(payload.url, {
          method,
          headers,
          body: bodyStr,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        const responseBody = await response.text();

        if (response.ok) {
          console.log(
            `[WebhookConnector] Delivered to ${payload.url} (${response.status}) on attempt ${attempt}`
          );
          return {
            success: true,
            statusCode: response.status,
            responseBody,
            attempts: attempt,
          };
        }

        // Non-retryable client errors (4xx except 429)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          console.error(
            `[WebhookConnector] Non-retryable error ${response.status} from ${payload.url}`
          );
          return {
            success: false,
            statusCode: response.status,
            responseBody,
            error: `HTTP ${response.status}`,
            attempts: attempt,
          };
        }

        lastError = `HTTP ${response.status}: ${responseBody.slice(0, 200)}`;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }

      // Exponential backoff before retry
      if (attempt < this.config.maxRetries) {
        const delay = this.config.retryDelayMs * Math.pow(2, attempt - 1);
        console.warn(
          `[WebhookConnector] Attempt ${attempt} failed for ${payload.url}, retrying in ${delay}ms`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    console.error(
      `[WebhookConnector] All ${this.config.maxRetries} attempts failed for ${payload.url}: ${lastError}`
    );
    return {
      success: false,
      error: lastError,
      attempts: this.config.maxRetries,
    };
  }

  /**
   * Send webhooks to multiple targets.
   */
  async sendBatch(payloads: WebhookPayload[]): Promise<WebhookResult[]> {
    return Promise.all(payloads.map((p) => this.send(p)));
  }
}
