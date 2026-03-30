import React, { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import {
  Inbox,
  Activity,
  BookOpen,
  Bot,
  Shield,
} from 'lucide-react';
import { InboxTab } from './tabs/InboxTab';
import { ActivityTab } from './tabs/ActivityTab';
import { LedgerTab } from './tabs/LedgerTab';
import { AgentsTab } from './tabs/AgentsTab';
import { PrivacyTab } from './tabs/PrivacyTab';

// ---- Types -----------------------------------------------------------------

type TabId = 'inbox' | 'activity' | 'ledger' | 'agents' | 'privacy';

interface TabConfig {
  id: TabId;
  label: string;
  icon: React.FC<{ size?: number; className?: string }>;
  badge?: number;
}

interface ExtensionState {
  nativeHostStatus: string;
  standaloneMode: boolean;
  captureEnabled: boolean;
  pendingPRCount: number;
  authStatus: string;
  meetingCaptureActive: boolean;
}

// ---- Component -------------------------------------------------------------

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('inbox');
  const [state, setState] = useState<ExtensionState>({
    nativeHostStatus: 'disconnected',
    standaloneMode: false,
    captureEnabled: true,
    pendingPRCount: 0,
    authStatus: 'loading',
    meetingCaptureActive: false,
  });

  const fetchState = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'LURK_GET_STATE' }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response && typeof response === 'object' && 'captureEnabled' in response) {
        setState(response as ExtensionState);
      }
    });
  }, []);

  useEffect(() => {
    fetchState();

    // Listen for state updates from background
    const handleMessage = (message: { type: string; payload?: unknown }) => {
      if (message.type === 'LURK_STATE_UPDATE' && message.payload) {
        setState(message.payload as ExtensionState);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [fetchState]);

  const tabs: TabConfig[] = [
    { id: 'inbox', label: 'Inbox', icon: Inbox, badge: state.pendingPRCount || undefined },
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'ledger', label: 'Ledger', icon: BookOpen },
    { id: 'agents', label: 'Agents', icon: Bot },
    { id: 'privacy', label: 'Privacy', icon: Shield },
  ];

  const statusColor = getStatusColor(state);
  const statusText = getStatusText(state);

  return (
    <div className="flex flex-col h-screen bg-surface text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-300 bg-surface-50">
        <div className="flex items-center gap-2">
          <div className="text-lurk-400 font-semibold text-sm tracking-tight">lurk</div>
          <div className="flex items-center gap-1.5">
            <div className={clsx('w-1.5 h-1.5 rounded-full', statusColor)} />
            <span className="text-2xs text-white/40">{statusText}</span>
          </div>
        </div>
        {state.meetingCaptureActive && (
          <div className="flex items-center gap-1 lurk-badge-red lurk-badge">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-red animate-pulse" />
            Recording
          </div>
        )}
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-surface-300 bg-surface-50 px-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'lurk-tab',
              activeTab === tab.id && 'lurk-tab-active'
            )}
          >
            <tab.icon size={13} />
            <span>{tab.label}</span>
            {tab.badge && tab.badge > 0 && (
              <span className="ml-0.5 bg-lurk-600 text-white text-2xs rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'inbox' && <InboxTab />}
        {activeTab === 'activity' && <ActivityTab />}
        {activeTab === 'ledger' && <LedgerTab />}
        {activeTab === 'agents' && <AgentsTab />}
        {activeTab === 'privacy' && <PrivacyTab />}
      </div>
    </div>
  );
}

function getStatusColor(state: ExtensionState): string {
  if (!state.captureEnabled) return 'bg-white/30';
  if (state.nativeHostStatus === 'connected') return 'bg-accent-green';
  if (state.standaloneMode) return 'bg-accent-yellow';
  if (state.authStatus === 'unauthenticated') return 'bg-accent-red';
  return 'bg-accent-yellow';
}

function getStatusText(state: ExtensionState): string {
  if (!state.captureEnabled) return 'Paused';
  if (state.nativeHostStatus === 'connected') return 'Connected';
  if (state.standaloneMode) return 'Standalone';
  if (state.authStatus === 'unauthenticated') return 'Sign in required';
  return 'Connecting...';
}
