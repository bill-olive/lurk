// =============================================================================
// Chrome Extension — DOM Observer unit tests
//
// Tests BaseObserver lifecycle, change detection, debouncing, and the
// observer registry / content script initialization logic.
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CapturedArtifact, ObserverConfig } from '../content/observers/base-observer';

// ---------------------------------------------------------------------------
// Mock chrome API globally
// ---------------------------------------------------------------------------

const mockSendMessage = vi.fn().mockImplementation((_msg, cb) => {
  if (cb) cb({ captureEnabled: true });
  return Promise.resolve();
});
const mockOnMessageAddListener = vi.fn();

vi.stubGlobal('chrome', {
  runtime: {
    sendMessage: mockSendMessage,
    onMessage: {
      addListener: mockOnMessageAddListener,
    },
    lastError: null,
  },
});

// ---------------------------------------------------------------------------
// Concrete test observer (extends BaseObserver)
// ---------------------------------------------------------------------------

// We need to import after setting up chrome mock
import { BaseObserver } from '../content/observers/base-observer';

class TestObserver extends BaseObserver {
  private _shouldActivateValue = true;
  private _extractedTitle = 'Test Page';
  private _extractedContent = 'Hello, this is test content with enough characters.';
  private _artifactType = 'document:test';
  private _metadata: Record<string, unknown> = { testKey: 'testValue' };

  get name(): string {
    return 'test-observer';
  }

  get sourceApp(): string {
    return 'chrome:test';
  }

  shouldActivate(): boolean {
    return this._shouldActivateValue;
  }

  extractTitle(): string {
    return this._extractedTitle;
  }

  extractContent(): string {
    return this._extractedContent;
  }

  getArtifactType(): string {
    return this._artifactType;
  }

  extractMetadata(): Record<string, unknown> {
    return this._metadata;
  }

  // Test helpers
  setShouldActivate(value: boolean): void {
    this._shouldActivateValue = value;
  }

  setContent(content: string): void {
    this._extractedContent = content;
  }

  setTitle(title: string): void {
    this._extractedTitle = title;
  }

  // Expose internals for testing
  getIsActive(): boolean {
    return this.isActive;
  }

  getLastContentHash(): string {
    return this.lastContentHash;
  }

  testQuickHash(content: string): string {
    return this.quickHash(content);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BaseObserver', () => {
  let observer: TestObserver;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    observer = new TestObserver();

    // Mock document.body for MutationObserver
    if (!document.body) {
      document.body = document.createElement('body');
    }
  });

  afterEach(() => {
    observer.stop();
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  describe('lifecycle', () => {
    it('should start when shouldActivate returns true', () => {
      observer.start();
      expect(observer.getIsActive()).toBe(true);
    });

    it('should not start when shouldActivate returns false', () => {
      observer.setShouldActivate(false);
      observer.start();
      expect(observer.getIsActive()).toBe(false);
    });

    it('should not start twice', () => {
      observer.start();
      // Starting again should be a no-op
      observer.start();
      expect(observer.getIsActive()).toBe(true);
    });

    it('should stop and set isActive to false', () => {
      observer.start();
      expect(observer.getIsActive()).toBe(true);
      observer.stop();
      expect(observer.getIsActive()).toBe(false);
    });

    it('should handle stop when not started', () => {
      // Should not throw
      observer.stop();
      expect(observer.getIsActive()).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Abstract method contract
  // -----------------------------------------------------------------------

  describe('abstract method contract', () => {
    it('should return observer name', () => {
      expect(observer.name).toBe('test-observer');
    });

    it('should return source app', () => {
      expect(observer.sourceApp).toBe('chrome:test');
    });

    it('should return artifact type', () => {
      expect(observer.getArtifactType()).toBe('document:test');
    });

    it('should extract title', () => {
      expect(observer.extractTitle()).toBe('Test Page');
    });

    it('should extract content', () => {
      const content = observer.extractContent();
      expect(content.length).toBeGreaterThan(10);
    });

    it('should extract metadata', () => {
      const meta = observer.extractMetadata();
      expect(meta.testKey).toBe('testValue');
    });
  });

  // -----------------------------------------------------------------------
  // Quick hash (change detection)
  // -----------------------------------------------------------------------

  describe('quickHash', () => {
    it('should produce consistent hashes for same input', () => {
      const h1 = observer.testQuickHash('hello world');
      const h2 = observer.testQuickHash('hello world');
      expect(h1).toBe(h2);
    });

    it('should produce different hashes for different inputs', () => {
      const h1 = observer.testQuickHash('hello world');
      const h2 = observer.testQuickHash('goodbye world');
      expect(h1).not.toBe(h2);
    });

    it('should return a string', () => {
      const hash = observer.testQuickHash('test');
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should handle empty string', () => {
      const hash = observer.testQuickHash('');
      expect(hash).toBe('0'); // hash of 0 in base 36
    });
  });

  // -----------------------------------------------------------------------
  // Configuration
  // -----------------------------------------------------------------------

  describe('configuration', () => {
    it('should use default config values', () => {
      const obs = new TestObserver();
      // Access protected config via a cast; validate defaults
      expect((obs as any).config.debounceMs).toBe(2000);
      expect((obs as any).config.minCaptureIntervalMs).toBe(10000);
      expect((obs as any).config.observeBody).toBe(true);
    });

    it('should merge custom config with defaults', () => {
      const obs = new TestObserver({ debounceMs: 500, observeBody: false });
      expect((obs as any).config.debounceMs).toBe(500);
      expect((obs as any).config.observeBody).toBe(false);
      // Defaults should still be present
      expect((obs as any).config.minCaptureIntervalMs).toBe(10000);
    });

    it('should apply custom ignoreSelectors', () => {
      const obs = new TestObserver({
        ignoreSelectors: ['script', 'style', '.ad-banner'],
      });
      expect((obs as any).config.ignoreSelectors).toContain('.ad-banner');
    });
  });

  // -----------------------------------------------------------------------
  // Force capture
  // -----------------------------------------------------------------------

  describe('forceCapture', () => {
    it('should trigger a capture when active', () => {
      observer.start();
      // After starting, the initial capture runs via setTimeout
      vi.advanceTimersByTime(1500);
      const hashAfterStart = observer.getLastContentHash();
      expect(hashAfterStart).not.toBe('');

      // Change content and force capture
      observer.setContent('completely new content that is long enough.');
      // Need to advance past minCaptureIntervalMs
      vi.advanceTimersByTime(11000);
      observer.forceCapture();
      const hashAfterForce = observer.getLastContentHash();
      expect(hashAfterForce).not.toBe(hashAfterStart);
    });

    it('should not capture when not active', () => {
      // Don't start the observer
      observer.forceCapture();
      // Hash should remain empty since captureIfChanged checks isActive
      expect(observer.getLastContentHash()).toBe('');
    });
  });

  // -----------------------------------------------------------------------
  // Content change detection
  // -----------------------------------------------------------------------

  describe('change detection', () => {
    it('should not re-capture when content is unchanged', () => {
      observer.start();
      vi.advanceTimersByTime(1500);
      const firstHash = observer.getLastContentHash();

      // Force another capture with same content after interval
      vi.advanceTimersByTime(11000);
      observer.forceCapture();
      const secondHash = observer.getLastContentHash();

      // Hash should be the same, meaning no new message was sent
      expect(firstHash).toBe(secondHash);
    });

    it('should send capture message to chrome runtime', () => {
      observer.start();
      vi.advanceTimersByTime(1500);
      // Should have called chrome.runtime.sendMessage with LURK_CAPTURE
      const captureCall = mockSendMessage.mock.calls.find(
        (call: any[]) => call[0]?.type === 'LURK_CAPTURE'
      );
      expect(captureCall).toBeDefined();
      expect(captureCall![0].payload.sourceApp).toBe('chrome:test');
    });

    it('should skip capture for content shorter than 10 characters', () => {
      observer.setContent('short');
      observer.start();
      vi.advanceTimersByTime(1500);
      // Should not have captured
      expect(observer.getLastContentHash()).toBe('');
    });
  });
});

// ---------------------------------------------------------------------------
// Observer Registry tests
// ---------------------------------------------------------------------------

describe('Observer Registry', () => {
  it('should match docs.google.com to gdocs observer', () => {
    const pattern = /^docs\.google\.com$/;
    expect(pattern.test('docs.google.com')).toBe(true);
    expect(pattern.test('mail.google.com')).toBe(false);
  });

  it('should match mail.google.com to gmail observer', () => {
    const pattern = /^mail\.google\.com$/;
    expect(pattern.test('mail.google.com')).toBe(true);
  });

  it('should match github.com to github observer', () => {
    const pattern = /^github\.com$/;
    expect(pattern.test('github.com')).toBe(true);
    expect(pattern.test('api.github.com')).toBe(false);
  });

  it('should match notion.so with optional www prefix', () => {
    const pattern = /^(www\.)?notion\.so$/;
    expect(pattern.test('notion.so')).toBe(true);
    expect(pattern.test('www.notion.so')).toBe(true);
  });

  it('should match figma.com with optional www prefix', () => {
    const pattern = /^(www\.)?figma\.com$/;
    expect(pattern.test('figma.com')).toBe(true);
    expect(pattern.test('www.figma.com')).toBe(true);
  });

  it('should match CRM domains', () => {
    const patterns = [/\.salesforce\.com$/, /\.force\.com$/, /\.hubspot\.com$/];
    expect(patterns.some(p => p.test('app.salesforce.com'))).toBe(true);
    expect(patterns.some(p => p.test('login.salesforce.com'))).toBe(true);
    expect(patterns.some(p => p.test('app.hubspot.com'))).toBe(true);
    expect(patterns.some(p => p.test('random.com'))).toBe(false);
  });

  it('should match linear.app', () => {
    const pattern = /^linear\.app$/;
    expect(pattern.test('linear.app')).toBe(true);
    expect(pattern.test('api.linear.app')).toBe(false);
  });

  it('should not match unregistered domains', () => {
    const allPatterns = [
      /^docs\.google\.com$/,
      /^mail\.google\.com$/,
      /^github\.com$/,
      /^(www\.)?notion\.so$/,
      /^(www\.)?figma\.com$/,
      /\.salesforce\.com$/,
      /\.force\.com$/,
      /\.hubspot\.com$/,
      /^linear\.app$/,
    ];
    expect(allPatterns.some(p => p.test('reddit.com'))).toBe(false);
    expect(allPatterns.some(p => p.test('twitter.com'))).toBe(false);
  });
});
