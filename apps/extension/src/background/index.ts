// ---------------------------------------------------------------------------
// Background Service Worker — Main entry point for extension background logic
// ---------------------------------------------------------------------------

import { nativeMessaging, type NativeHostStatus } from './native-messaging';
import { standalone } from './standalone';
import { auth } from '../lib/auth';
import { api } from '../lib/api';
import { storage } from '../lib/storage';

// ---- Types -----------------------------------------------------------------

interface ContentMessage {
  type: string;
  payload: unknown;
}

interface CaptureMessage {
  type: 'LURK_CAPTURE';
  payload: {
    artifactType: string;
    title: string;
    sourceUrl: string;
    sourceApp: string;
    content: string;
    metadata: Record<string, unknown>;
  };
}

interface ExtensionState {
  nativeHostStatus: NativeHostStatus;
  standaloneMode: boolean;
  captureEnabled: boolean;
  pendingPRCount: number;
  authStatus: 'authenticated' | 'unauthenticated' | 'loading';
  meetingCaptureActive: boolean;
}

// ---- State -----------------------------------------------------------------

let extensionState: ExtensionState = {
  nativeHostStatus: 'disconnected',
  standaloneMode: false,
  captureEnabled: true,
  pendingPRCount: 0,
  authStatus: 'loading',
  meetingCaptureActive: false,
};

// ---- Initialization --------------------------------------------------------

async function initialize(): Promise<void> {
  console.log('[Lurk Background] Initializing...');

  // Initialize auth
  const authState = await auth.initialize();
  extensionState.authStatus = authState.isAuthenticated ? 'authenticated' : 'unauthenticated';

  // Listen for auth changes
  auth.onAuthStateChanged((state) => {
    extensionState.authStatus = state.isAuthenticated ? 'authenticated' : 'unauthenticated';
    broadcastState();
  });

  // Try connecting to native host
  nativeMessaging.connect();

  // Watch native host status
  nativeMessaging.onStatusChange((status) => {
    extensionState.nativeHostStatus = status;

    if (status === 'error' || status === 'disconnected') {
      // Fall back to standalone mode
      if (!extensionState.standaloneMode) {
        console.log('[Lurk Background] Native host unavailable, switching to standalone mode');
        extensionState.standaloneMode = true;
        standalone.initialize().catch((err) => {
          console.error('[Lurk Background] Standalone init failed:', err);
        });
      }
    } else if (status === 'connected') {
      extensionState.standaloneMode = false;
    }

    broadcastState();
    updateBadge();
  });

  // Register native message handlers
  nativeMessaging.onMessage('pr_created', (msg) => {
    const payload = msg.payload as { pr: unknown };
    handleNewPR(payload.pr);
  });

  nativeMessaging.onMessage('agent_action', (msg) => {
    const payload = msg.payload as {
      agentId: string;
      agentName: string;
      agentType: string;
      action: string;
      description: string;
      artifactId: string | null;
      artifactTitle: string | null;
    };
    handleAgentAction(payload);
  });

  nativeMessaging.onMessage('badge_update', (msg) => {
    const payload = msg.payload as { pendingPRs: number };
    extensionState.pendingPRCount = payload.pendingPRs;
    updateBadge();
  });

  // Load persisted state
  const savedCaptureEnabled = await storage.getSetting<boolean>('capture_enabled');
  if (savedCaptureEnabled !== null) {
    extensionState.captureEnabled = savedCaptureEnabled;
  }

  // Initial PR count fetch
  fetchPendingPRCount();

  // Periodic PR count refresh (every 2 minutes)
  setInterval(fetchPendingPRCount, 120000);

  console.log('[Lurk Background] Initialized successfully');
  updateBadge();
}

// ---- Message Handling ------------------------------------------------------

chrome.runtime.onMessage.addListener(
  (message: ContentMessage, sender, sendResponse) => {
    handleMessage(message, sender, sendResponse);
    return true; // Keep message channel open for async response
  }
);

async function handleMessage(
  message: ContentMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    switch (message.type) {
      case 'LURK_CAPTURE':
        await handleCapture(message as CaptureMessage, sender);
        sendResponse({ success: true });
        break;

      case 'LURK_GET_STATE':
        sendResponse(extensionState);
        break;

      case 'LURK_TOGGLE_CAPTURE':
        extensionState.captureEnabled = !extensionState.captureEnabled;
        await storage.setSetting('capture_enabled', extensionState.captureEnabled);
        broadcastState();
        sendResponse({ captureEnabled: extensionState.captureEnabled });
        break;

      case 'LURK_SIGN_IN':
        try {
          const user = await auth.signInWithGoogle();
          sendResponse({ success: true, user });
        } catch (err) {
          sendResponse({ success: false, error: String(err) });
        }
        break;

      case 'LURK_SIGN_OUT':
        await auth.signOut();
        sendResponse({ success: true });
        break;

      case 'LURK_REVIEW_PR': {
        const { prId, action, comment } = message.payload as {
          prId: string;
          action: 'approve' | 'reject';
          comment?: string;
        };
        const result = await api.reviewPR(prId, { action, comment });
        if (!result.error) {
          extensionState.pendingPRCount = Math.max(0, extensionState.pendingPRCount - 1);
          updateBadge();
        }
        sendResponse(result);
        break;
      }

      case 'LURK_TOGGLE_YOLO': {
        const { enabled } = message.payload as { enabled: boolean };
        const result = await api.toggleYolo({ enabled });
        sendResponse(result);
        break;
      }

      case 'LURK_TOGGLE_AGENT': {
        const { agentId, status } = message.payload as {
          agentId: string;
          status: 'active' | 'paused';
        };
        const result = await api.toggleAgent(agentId, { status });
        sendResponse(result);
        break;
      }

      case 'LURK_SET_LOCAL_ONLY': {
        const { enabled } = message.payload as { enabled: boolean };
        if (extensionState.standaloneMode) {
          await standalone.updateConfig({ localOnly: enabled });
        } else {
          await api.setLocalOnlyMode(enabled);
        }
        sendResponse({ success: true });
        break;
      }

      case 'LURK_GET_PRIVACY_STATS':
        if (extensionState.standaloneMode) {
          const stats = await storage.getPrivacyStats();
          sendResponse({ data: stats, error: null });
        } else {
          const result = await api.getPrivacyStats();
          sendResponse(result);
        }
        break;

      case 'LURK_OPEN_SIDEBAR':
        if (sender.tab?.id) {
          chrome.sidePanel.open({ tabId: sender.tab.id });
        }
        sendResponse({ success: true });
        break;

      case 'LURK_OPEN_ADMIN':
        chrome.tabs.create({ url: 'https://admin.lurk.dev' });
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ error: `Unknown message type: ${message.type}` });
    }
  } catch (error) {
    console.error('[Lurk Background] Message handler error:', error);
    sendResponse({ error: String(error) });
  }
}

// ---- Capture Processing ----------------------------------------------------

async function handleCapture(
  message: CaptureMessage,
  _sender: chrome.runtime.MessageSender
): Promise<void> {
  if (!extensionState.captureEnabled) return;

  const { payload } = message;

  if (extensionState.standaloneMode || !nativeMessaging.isConnected()) {
    // Process locally in standalone mode
    const result = await standalone.processCapture({
      type: payload.artifactType,
      title: payload.title,
      sourceUrl: payload.sourceUrl,
      sourceApp: payload.sourceApp,
      content: payload.content,
      metadata: payload.metadata,
    });

    console.log('[Lurk Background] Captured artifact (standalone):', result.artifactId);
  } else {
    // Send to Mac app via Native Messaging
    nativeMessaging.sendCapture({
      artifactType: payload.artifactType,
      title: payload.title,
      sourceUrl: payload.sourceUrl,
      sourceApp: payload.sourceApp,
      contentHash: '', // Mac app will compute
      rawContent: payload.content,
      metadata: payload.metadata,
      capturedAt: Date.now(),
    });

    console.log('[Lurk Background] Sent capture to native host:', payload.title);
  }
}

// ---- PR Handling -----------------------------------------------------------

async function handleNewPR(pr: unknown): Promise<void> {
  const prData = pr as {
    id: string;
    title: string;
    description: string;
    agentId: string;
    agentName: string;
    agentType: string;
    artifactId: string;
    artifactTitle: string;
    confidence: number;
    diff: unknown;
    changeSummary: string;
    autoMergeEligible: boolean;
  };

  await storage.storePR({
    id: prData.id,
    title: prData.title,
    description: prData.description,
    agentId: prData.agentId,
    agentName: prData.agentName,
    agentType: prData.agentType,
    artifactId: prData.artifactId,
    artifactTitle: prData.artifactTitle,
    confidence: prData.confidence,
    status: 'open',
    diff: prData.diff,
    changeSummary: prData.changeSummary,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    autoMergeEligible: prData.autoMergeEligible,
  });

  extensionState.pendingPRCount++;
  updateBadge();

  // Show notification
  chrome.notifications.create(prData.id, {
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title: `New PR: ${prData.title}`,
    message: `${prData.agentName} proposed changes to "${prData.artifactTitle}"`,
    priority: 1,
  });
}

// ---- Agent Action Handling -------------------------------------------------

async function handleAgentAction(action: {
  agentId: string;
  agentName: string;
  agentType: string;
  action: string;
  description: string;
  artifactId: string | null;
  artifactTitle: string | null;
}): Promise<void> {
  await storage.storeAgentAction({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    agentId: action.agentId,
    agentName: action.agentName,
    agentType: action.agentType,
    action: action.action,
    description: action.description,
    artifactId: action.artifactId,
    artifactTitle: action.artifactTitle,
    timestamp: Date.now(),
  });
}

// ---- Badge -----------------------------------------------------------------

function updateBadge(): void {
  const count = extensionState.pendingPRCount;

  if (count > 0) {
    chrome.action.setBadgeText({ text: String(count) });
    chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }

  // Update icon based on status
  const statusColor = getStatusColor();
  chrome.action.setBadgeBackgroundColor({ color: statusColor });
}

function getStatusColor(): string {
  if (!extensionState.captureEnabled) return '#6b7280'; // gray
  if (extensionState.nativeHostStatus === 'connected') return '#22c55e'; // green
  if (extensionState.standaloneMode) return '#eab308'; // yellow
  return '#ef4444'; // red
}

// ---- PR Count Fetch --------------------------------------------------------

async function fetchPendingPRCount(): Promise<void> {
  try {
    if (extensionState.standaloneMode) {
      const prs = await storage.getPendingPRs();
      extensionState.pendingPRCount = prs.length;
    } else {
      const result = await api.getPendingPRs();
      if (!result.error && result.data) {
        extensionState.pendingPRCount = result.data.total;
      }
    }
    updateBadge();
  } catch (error) {
    console.warn('[Lurk Background] Failed to fetch PR count:', error);
  }
}

// ---- State Broadcasting ----------------------------------------------------

function broadcastState(): void {
  chrome.runtime.sendMessage({
    type: 'LURK_STATE_UPDATE',
    payload: extensionState,
  }).catch(() => {
    // No listeners
  });
}

// ---- Side Panel Setup ------------------------------------------------------

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {
  // sidePanel API might not be available in all Chrome versions
});

// ---- Notification Click Handler --------------------------------------------

chrome.notifications.onClicked.addListener((notificationId) => {
  // Open sidebar to show the PR
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.sidePanel.open({ tabId: tabs[0].id });
    }
  });
  chrome.notifications.clear(notificationId);
});

// ---- Install Handler -------------------------------------------------------

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Lurk Background] Extension installed');
    // Open onboarding page
    chrome.tabs.create({ url: 'https://admin.lurk.dev/onboarding?source=extension' });
  }
});

// ---- Startup ---------------------------------------------------------------

initialize().catch((error) => {
  console.error('[Lurk Background] Failed to initialize:', error);
});
