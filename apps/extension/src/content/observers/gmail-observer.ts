// ---------------------------------------------------------------------------
// Gmail Observer — Captures email composition and reading
// ---------------------------------------------------------------------------

import { BaseObserver } from './base-observer';

export class GmailObserver extends BaseObserver {
  private currentView: 'inbox' | 'reading' | 'composing' | 'unknown' = 'unknown';

  constructor() {
    super({
      debounceMs: 2000,
      minCaptureIntervalMs: 10000,
      observeSelectors: [],
      ignoreSelectors: [
        'script', 'style', 'noscript', 'svg', 'iframe',
        '.Kj-JD', // Tooltips
        '.T-I', // Toolbar buttons
      ],
      observeBody: true,
    });
  }

  get name(): string {
    return 'gmail';
  }

  get sourceApp(): string {
    return 'chrome:gmail';
  }

  shouldActivate(): boolean {
    return window.location.hostname === 'mail.google.com';
  }

  extractTitle(): string {
    if (this.currentView === 'composing') {
      const subjectInput = document.querySelector<HTMLInputElement>('input[name="subjectbox"]');
      return subjectInput?.value
        ? `Draft: ${subjectInput.value}`
        : 'Draft: (No Subject)';
    }

    if (this.currentView === 'reading') {
      // Email subject is in h2 within the message view
      const subjectEl = document.querySelector('h2.hP');
      return subjectEl?.textContent?.trim() ?? 'Email';
    }

    return 'Gmail';
  }

  extractContent(): string {
    this.detectView();

    if (this.currentView === 'composing') {
      return this.extractCompositionContent();
    }

    if (this.currentView === 'reading') {
      return this.extractEmailContent();
    }

    // Not in a view we capture
    return '';
  }

  getArtifactType(): string {
    if (this.currentView === 'composing') {
      return 'comm:email_sent';
    }
    return 'comm:email_received';
  }

  extractMetadata(): Record<string, unknown> {
    const metadata: Record<string, unknown> = {
      view: this.currentView,
    };

    if (this.currentView === 'composing') {
      // Extract recipients
      const toField = document.querySelectorAll('.afH .afV .agb span[email]');
      metadata.recipients = Array.from(toField).map((el) => el.getAttribute('email')).filter(Boolean);

      const ccField = document.querySelectorAll('.aCP .afV .agb span[email]');
      metadata.ccRecipients = Array.from(ccField).map((el) => el.getAttribute('email')).filter(Boolean);

      const subjectInput = document.querySelector<HTMLInputElement>('input[name="subjectbox"]');
      metadata.subject = subjectInput?.value ?? '';
    }

    if (this.currentView === 'reading') {
      // Sender
      const senderEl = document.querySelector('.gD');
      metadata.sender = senderEl?.getAttribute('email') ?? senderEl?.textContent?.trim() ?? '';
      metadata.senderName = senderEl?.getAttribute('name') ?? '';

      // Subject
      const subjectEl = document.querySelector('h2.hP');
      metadata.subject = subjectEl?.textContent?.trim() ?? '';

      // Date
      const dateEl = document.querySelector('.g3');
      metadata.date = dateEl?.getAttribute('title') ?? dateEl?.textContent?.trim() ?? '';

      // Thread message count
      const messages = document.querySelectorAll('.kv');
      metadata.threadMessages = messages.length;

      // Labels
      const labels = document.querySelectorAll('.ar .at');
      metadata.labels = Array.from(labels).map((el) => el.textContent?.trim()).filter(Boolean);
    }

    return metadata;
  }

  // ---- Private helpers ------------------------------------------------------

  private detectView(): void {
    // Check for compose window
    const composeView = document.querySelector('.M9 .Am');
    if (composeView) {
      this.currentView = 'composing';
      return;
    }

    // Check for email reading view (conversation view)
    const emailView = document.querySelector('.nH .aHU');
    if (emailView) {
      this.currentView = 'reading';
      return;
    }

    // Also check for single-message reading view
    const messageView = document.querySelector('div[role="main"] .kv');
    if (messageView) {
      this.currentView = 'reading';
      return;
    }

    this.currentView = 'unknown';
  }

  private extractCompositionContent(): string {
    const composeBody = document.querySelector<HTMLElement>('.M9 .Am .editable');
    if (!composeBody) return '';

    const subject = document.querySelector<HTMLInputElement>('input[name="subjectbox"]')?.value ?? '';
    const body = composeBody.innerText ?? '';

    return `Subject: ${subject}\n\n${body}`;
  }

  private extractEmailContent(): string {
    const parts: string[] = [];

    // Subject
    const subjectEl = document.querySelector('h2.hP');
    if (subjectEl?.textContent) {
      parts.push(`Subject: ${subjectEl.textContent.trim()}`);
    }

    // Get all messages in the thread
    const messageContainers = document.querySelectorAll('.kv');
    messageContainers.forEach((container, idx) => {
      const sender = container.querySelector('.gD');
      const senderText = sender?.getAttribute('name') ?? sender?.textContent?.trim() ?? 'Unknown';

      const dateEl = container.querySelector('.g3');
      const dateText = dateEl?.getAttribute('title') ?? dateEl?.textContent?.trim() ?? '';

      // Message body
      const bodyEl = container.querySelector('.a3s');
      const bodyText = bodyEl ? this.extractVisibleText(bodyEl) : '';

      if (bodyText) {
        parts.push(`--- Message ${idx + 1} from ${senderText} (${dateText}) ---`);
        parts.push(bodyText);
      }
    });

    return parts.join('\n\n');
  }
}
