// ---------------------------------------------------------------------------
// Content Script Entry Point — Initializes the correct observer by domain
// ---------------------------------------------------------------------------

import { BaseObserver } from './observers/base-observer';
import { GDocsObserver } from './observers/gdocs-observer';
import { GmailObserver } from './observers/gmail-observer';
import { GitHubObserver } from './observers/github-observer';
import { NotionObserver } from './observers/notion-observer';
import { FigmaObserver } from './observers/figma-observer';
import { CRMObserver } from './observers/crm-observer';
import { LinearObserver } from './observers/linear-observer';

// ---- Observer Registry ------------------------------------------------------

interface ObserverEntry {
  hostPatterns: RegExp[];
  factory: () => BaseObserver;
}

const OBSERVER_REGISTRY: ObserverEntry[] = [
  {
    hostPatterns: [/^docs\.google\.com$/],
    factory: () => new GDocsObserver(),
  },
  {
    hostPatterns: [/^mail\.google\.com$/],
    factory: () => new GmailObserver(),
  },
  {
    hostPatterns: [/^github\.com$/],
    factory: () => new GitHubObserver(),
  },
  {
    hostPatterns: [/^(www\.)?notion\.so$/],
    factory: () => new NotionObserver(),
  },
  {
    hostPatterns: [/^(www\.)?figma\.com$/],
    factory: () => new FigmaObserver(),
  },
  {
    hostPatterns: [/\.salesforce\.com$/, /\.force\.com$/, /\.hubspot\.com$/],
    factory: () => new CRMObserver(),
  },
  {
    hostPatterns: [/^linear\.app$/],
    factory: () => new LinearObserver(),
  },
];

// ---- State -----------------------------------------------------------------

let activeObserver: BaseObserver | null = null;
let captureEnabled = true;

// ---- Initialization --------------------------------------------------------

function initialize(): void {
  const hostname = window.location.hostname;
  console.log(`[Lurk Content] Initializing on ${hostname}`);

  // Find matching observer
  for (const entry of OBSERVER_REGISTRY) {
    const matches = entry.hostPatterns.some((pattern) => pattern.test(hostname));
    if (matches) {
      activeObserver = entry.factory();
      console.log(`[Lurk Content] Using observer: ${activeObserver.name}`);
      break;
    }
  }

  if (!activeObserver) {
    console.log(`[Lurk Content] No observer registered for ${hostname}`);
    return;
  }

  // Check if capture is enabled before starting
  chrome.runtime.sendMessage({ type: 'LURK_GET_STATE' }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn('[Lurk Content] Failed to get state:', chrome.runtime.lastError.message);
      // Start anyway - background might not be ready yet
      startObserver();
      return;
    }

    if (response && typeof response.captureEnabled === 'boolean') {
      captureEnabled = response.captureEnabled;
    }

    if (captureEnabled) {
      startObserver();
    } else {
      console.log('[Lurk Content] Capture is disabled');
    }
  });

  // Listen for messages from background
  chrome.runtime.onMessage.addListener(handleBackgroundMessage);
}

function startObserver(): void {
  if (!activeObserver) return;

  try {
    activeObserver.start();
  } catch (error) {
    console.error('[Lurk Content] Failed to start observer:', error);
  }
}

function stopObserver(): void {
  if (!activeObserver) return;

  try {
    activeObserver.stop();
  } catch (error) {
    console.error('[Lurk Content] Failed to stop observer:', error);
  }
}

// ---- Message Handling ------------------------------------------------------

function handleBackgroundMessage(
  message: { type: string; payload?: unknown },
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void
): boolean {
  switch (message.type) {
    case 'LURK_STATE_UPDATE': {
      const state = message.payload as { captureEnabled: boolean };
      const wasEnabled = captureEnabled;
      captureEnabled = state.captureEnabled;

      if (captureEnabled && !wasEnabled) {
        startObserver();
      } else if (!captureEnabled && wasEnabled) {
        stopObserver();
      }

      sendResponse({ ok: true });
      break;
    }

    case 'LURK_POLICY_UPDATE': {
      // Policy update from native host via background
      console.log('[Lurk Content] Policy update received');
      // Could update observer behavior based on policy
      sendResponse({ ok: true });
      break;
    }

    case 'LURK_FORCE_CAPTURE': {
      if (activeObserver && captureEnabled) {
        activeObserver.forceCapture();
      }
      sendResponse({ ok: true });
      break;
    }

    case 'LURK_GET_OBSERVER_STATUS': {
      sendResponse({
        observer: activeObserver?.name ?? null,
        active: activeObserver !== null,
        captureEnabled,
        url: window.location.href,
      });
      break;
    }

    default:
      sendResponse({ error: `Unknown message type: ${message.type}` });
  }

  return true; // Keep channel open
}

// ---- Cleanup ---------------------------------------------------------------

window.addEventListener('beforeunload', () => {
  stopObserver();
});

// ---- Start -----------------------------------------------------------------

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
