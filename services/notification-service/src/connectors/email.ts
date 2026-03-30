/**
 * Email notification connector.
 *
 * Supports nodemailer (SMTP) and SendGrid as transports.
 */

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmailPayload {
  to: string;
  subject: string;
  /** Plain text body */
  text: string;
  /** HTML body (optional -- falls back to text) */
  html?: string;
  /** Reply-to address */
  replyTo?: string;
  /** Additional headers */
  headers?: Record<string, string>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailConnectorConfig {
  /** Transport: "smtp" | "sendgrid" */
  transport: "smtp" | "sendgrid";
  /** From address */
  from: string;
  /** SMTP config (when transport = "smtp") */
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  /** SendGrid API key (when transport = "sendgrid") */
  sendgridApiKey?: string;
}

// ---------------------------------------------------------------------------
// Connector
// ---------------------------------------------------------------------------

export class EmailConnector {
  private transporter: Transporter | null = null;
  private readonly config: EmailConnectorConfig;

  constructor(config?: Partial<EmailConnectorConfig>) {
    this.config = {
      transport: config?.transport ?? (process.env["EMAIL_TRANSPORT"] as "smtp" | "sendgrid") ?? "smtp",
      from: config?.from ?? process.env["EMAIL_FROM"] ?? "noreply@lurk.dev",
      smtp: config?.smtp ?? {
        host: process.env["SMTP_HOST"] ?? "localhost",
        port: parseInt(process.env["SMTP_PORT"] ?? "587", 10),
        secure: process.env["SMTP_SECURE"] === "true",
        auth: {
          user: process.env["SMTP_USER"] ?? "",
          pass: process.env["SMTP_PASS"] ?? "",
        },
      },
      sendgridApiKey: config?.sendgridApiKey ?? process.env["SENDGRID_API_KEY"],
    };
  }

  /**
   * Lazy-initialise the nodemailer transporter.
   */
  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;

    if (this.config.transport === "sendgrid") {
      // SendGrid via SMTP relay
      this.transporter = nodemailer.createTransport({
        host: "smtp.sendgrid.net",
        port: 587,
        secure: false,
        auth: {
          user: "apikey",
          pass: this.config.sendgridApiKey ?? "",
        },
      });
    } else {
      // Standard SMTP
      this.transporter = nodemailer.createTransport({
        host: this.config.smtp?.host,
        port: this.config.smtp?.port,
        secure: this.config.smtp?.secure,
        auth: this.config.smtp?.auth,
      });
    }

    return this.transporter;
  }

  /**
   * Send a single email.
   */
  async send(payload: EmailPayload): Promise<EmailResult> {
    try {
      const transporter = this.getTransporter();

      const info = await transporter.sendMail({
        from: this.config.from,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html ?? undefined,
        replyTo: payload.replyTo ?? undefined,
        headers: payload.headers ?? undefined,
      });

      console.log(`[EmailConnector] Sent to ${payload.to}: ${info.messageId}`);

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[EmailConnector] Failed to send to ${payload.to}: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * Send emails to multiple recipients.
   */
  async sendBatch(payloads: EmailPayload[]): Promise<EmailResult[]> {
    return Promise.all(payloads.map((p) => this.send(p)));
  }

  /**
   * Verify the transport connection (useful for health checks).
   */
  async verify(): Promise<boolean> {
    try {
      const transporter = this.getTransporter();
      await transporter.verify();
      return true;
    } catch {
      return false;
    }
  }
}
