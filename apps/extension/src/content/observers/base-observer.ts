// ---------------------------------------------------------------------------
// BaseObserver — Abstract base class for DOM observers
// ---------------------------------------------------------------------------

export interface CapturedArtifact {
  artifactType: string;
  title: string;
  sourceUrl: string;
  sourceApp: string;
  content: string;
  metadata: Record<string, unknown>;
}

export interface ObserverConfig {
  /** How long to debounce before capturing (ms). */
  debounceMs: number;
  /** Minimum interval between captures (ms). */
  minCaptureIntervalMs: number;
  /** CSS selectors to observe for mutations. */
  observeSelectors: string[];
  /** CSS selectors to ignore in content extraction. */
  ignoreSelectors: string[];
  /** Whether to observe the entire document body. */
  observeBody: boolean;
}

const DEFAULT_CONFIG: ObserverConfig = {
  debounceMs: 2000,
  minCaptureIntervalMs: 10000,
  observeSelectors: [],
  ignoreSelectors: ['script', 'style', 'noscript', 'svg', 'iframe'],
  observeBody: true,
};

export abstract class BaseObserver {
  protected config: ObserverConfig;
  protected observer: MutationObserver | null = null;
  protected debounceTimer: ReturnType<typeof setTimeout> | null = null;
  protected lastCaptureTime = 0;
  protected lastContentHash = '';
  protected isActive = false;

  constructor(config?: Partial<ObserverConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ---- Abstract methods (subclasses must implement) -------------------------

  /** Unique name for this observer (e.g., 'gdocs', 'gmail'). */
  abstract get name(): string;

  /** Source app identifier (e.g., 'chrome:gdocs'). */
  abstract get sourceApp(): string;

  /** Check if this observer should activate on the current page. */
  abstract shouldActivate(): boolean;

  /** Extract the page title for the artifact. */
  abstract extractTitle(): string;

  /** Extract the main content from the page. */
  abstract extractContent(): string;

  /** Get the artifact type string (e.g., 'document:gdoc'). */
  abstract getArtifactType(): string;

  /** Extract type-specific metadata from the page. */
  abstract extractMetadata(): Record<string, unknown>;

  // ---- Public API -----------------------------------------------------------

  start(): void {
    if (this.isActive) return;

    if (!this.shouldActivate()) {
      console.log(`[Lurk ${this.name}] Not activating on this page`);
      return;
    }

    console.log(`[Lurk ${this.name}] Starting observer`);
    this.isActive = true;

    // Initial capture after a short delay to let the page settle
    setTimeout(() => {
      this.captureIfChanged();
    }, 1000);

    // Set up MutationObserver
    this.observer = new MutationObserver(this.handleMutations.bind(this));

    if (this.config.observeBody) {
      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: false,
      });
    }

    // Also observe specific selectors if provided
    for (const selector of this.config.observeSelectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        this.observer!.observe(el, {
          childList: true,
          subtree: true,
          characterData: true,
        });
      });
    }

    // Listen for URL changes (SPA navigation)
    this.setupNavigationListener();
  }

  stop(): void {
    if (!this.isActive) return;

    console.log(`[Lurk ${this.name}] Stopping observer`);
    this.isActive = false;

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /** Force an immediate capture regardless of debounce. */
  forceCapture(): void {
    this.captureIfChanged();
  }

  // ---- Protected helpers ----------------------------------------------------

  /** Simple hash for change detection (not cryptographic). */
  protected quickHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /** Extract visible text from an element, filtering out ignored selectors. */
  protected extractVisibleText(root: Element): string {
    const clone = root.cloneNode(true) as Element;

    // Remove ignored elements
    for (const selector of this.config.ignoreSelectors) {
      clone.querySelectorAll(selector).forEach((el) => el.remove());
    }

    // Get inner text, normalizing whitespace
    const text = clone.textContent ?? '';
    return text.replace(/\s+/g, ' ').trim();
  }

  /** Extract text content from elements matching a selector. */
  protected extractFromSelector(selector: string): string {
    const elements = document.querySelectorAll(selector);
    return Array.from(elements)
      .map((el) => this.extractVisibleText(el))
      .filter(Boolean)
      .join('\n\n');
  }

  /** Get the current page URL, cleaning tracking params. */
  protected getCleanUrl(): string {
    const url = new URL(window.location.href);
    // Remove common tracking parameters
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'fbclid', 'gclid'];
    trackingParams.forEach((p) => url.searchParams.delete(p));
    return url.toString();
  }

  /** Wait for an element to appear in the DOM. */
  protected waitForElement(selector: string, timeoutMs = 10000): Promise<Element | null> {
    const existing = document.querySelector(selector);
    if (existing) return Promise.resolve(existing);

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeoutMs);

      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          observer.disconnect();
          clearTimeout(timeout);
          resolve(el);
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  // ---- Private --------------------------------------------------------------

  private handleMutations(_mutations: MutationRecord[]): void {
    if (!this.isActive) return;

    // Debounce: restart the timer on every mutation batch
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.captureIfChanged();
    }, this.config.debounceMs);
  }

  private captureIfChanged(): void {
    if (!this.isActive) return;

    // Enforce minimum interval
    const now = Date.now();
    if (now - this.lastCaptureTime < this.config.minCaptureIntervalMs) return;

    try {
      const content = this.extractContent();
      if (!content || content.length < 10) return;

      const hash = this.quickHash(content);
      if (hash === this.lastContentHash) return;

      this.lastContentHash = hash;
      this.lastCaptureTime = now;

      const artifact: CapturedArtifact = {
        artifactType: this.getArtifactType(),
        title: this.extractTitle(),
        sourceUrl: this.getCleanUrl(),
        sourceApp: this.sourceApp,
        content,
        metadata: this.extractMetadata(),
      };

      this.sendCapture(artifact);
    } catch (error) {
      console.error(`[Lurk ${this.name}] Capture failed:`, error);
    }
  }

  private sendCapture(artifact: CapturedArtifact): void {
    chrome.runtime.sendMessage({
      type: 'LURK_CAPTURE',
      payload: artifact,
    }).catch((err) => {
      console.warn(`[Lurk ${this.name}] Failed to send capture:`, err);
    });

    console.log(`[Lurk ${this.name}] Captured: "${artifact.title}" (${artifact.content.length} chars)`);
  }

  private setupNavigationListener(): void {
    // Listen for SPA-style navigation via History API
    let lastUrl = window.location.href;

    const checkUrl = () => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        this.lastContentHash = ''; // Reset hash so next capture goes through
        console.log(`[Lurk ${this.name}] Navigation detected: ${currentUrl}`);

        // Delay capture to let new page content load
        setTimeout(() => {
          if (this.shouldActivate()) {
            this.captureIfChanged();
          } else {
            this.stop();
          }
        }, 2000);
      }
    };

    // Interval-based check for URL changes (works for all SPA routing methods)
    setInterval(checkUrl, 1000);
  }
}
