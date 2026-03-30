import React, { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import {
  PanelRight,
  Settings,
  Pause,
  Play,
  GitPullRequest,
  Mic,
  MicOff,
  Wifi,
  WifiOff,
  HardDrive,
  LogIn,
  LogOut,
  ExternalLink,
} from 'lucide-react';

// ---- Types -----------------------------------------------------------------

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
  const [state, setState] = useState<ExtensionState>({
    nativeHostStatus: 'disconnected',
    standaloneMode: false,
    captureEnabled: true,
    pendingPRCount: 0,
    authStatus: 'loading',
    meetingCaptureActive: false,
  });
  const [loading, setLoading] = useState(true);

  const fetchState = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'LURK_GET_STATE' }, (response) => {
      if (chrome.runtime.lastError) {
        setLoading(false);
        return;
      }
      if (response && typeof response === 'object' && 'captureEnabled' in response) {
        setState(response as ExtensionState);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const handleToggleCapture = () => {
    chrome.runtime.sendMessage({ type: 'LURK_TOGGLE_CAPTURE' }, (response) => {
      if (response?.captureEnabled !== undefined) {
        setState((prev) => ({ ...prev, captureEnabled: response.captureEnabled }));
      }
    });
  };

  const handleOpenSidebar = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.sidePanel.open({ tabId: tabs[0].id });
        window.close();
      }
    });
  };

  const handleOpenAdmin = () => {
    chrome.runtime.sendMessage({ type: 'LURK_OPEN_ADMIN' });
    window.close();
  };

  const handleSignIn = () => {
    chrome.runtime.sendMessage({ type: 'LURK_SIGN_IN' }, (response) => {
      if (response?.success) {
        fetchState();
      }
    });
  };

  const handleSignOut = () => {
    chrome.runtime.sendMessage({ type: 'LURK_SIGN_OUT' }, () => {
      fetchState();
    });
  };

  // ---- Status computation ----------------------------------------------------

  const statusConfig = getStatusConfig(state);

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <div className="lurk-skeleton h-12 w-full" />
        <div className="lurk-skeleton h-8 w-full" />
        <div className="lurk-skeleton h-8 w-full" />
      </div>
    );
  }

  return (
    <div className="bg-surface text-white">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lurk-400 font-bold text-base tracking-tight">lurk</span>
            <span className="text-2xs text-white/20 font-mono">v0.1.0</span>
          </div>
          {state.authStatus === 'authenticated' ? (
            <button
              onClick={handleSignOut}
              className="lurk-btn-ghost text-2xs px-2 py-0.5 rounded"
            >
              <LogOut size={10} className="mr-1" />
              Sign Out
            </button>
          ) : (
            <button
              onClick={handleSignIn}
              className="lurk-btn-primary text-2xs px-2 py-0.5 rounded"
            >
              <LogIn size={10} className="mr-1" />
              Sign In
            </button>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="mx-4 mb-3 p-3 rounded-lg bg-surface-100 border border-surface-300">
        <div className="flex items-center gap-3">
          <div className={clsx(
            'w-9 h-9 rounded-lg flex items-center justify-center',
            statusConfig.bgColor
          )}>
            <statusConfig.icon size={17} className={statusConfig.color} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <div className={clsx('w-2 h-2 rounded-full', statusConfig.dotColor)} />
              <span className="text-sm font-medium text-white">{statusConfig.label}</span>
            </div>
            <p className="text-2xs text-white/40 mt-0.5">{statusConfig.description}</p>
          </div>
        </div>

        {/* PR Count */}
        {state.pendingPRCount > 0 && (
          <div className="mt-2 pt-2 border-t border-surface-300 flex items-center gap-2">
            <GitPullRequest size={12} className="text-lurk-400" />
            <span className="text-xs text-white/70">
              <span className="font-medium text-lurk-400">{state.pendingPRCount}</span>
              {' '}PR{state.pendingPRCount !== 1 ? 's' : ''} awaiting review
            </span>
          </div>
        )}

        {/* Meeting capture indicator */}
        {state.meetingCaptureActive && (
          <div className="mt-2 pt-2 border-t border-surface-300 flex items-center gap-2">
            <Mic size={12} className="text-accent-red animate-pulse" />
            <span className="text-xs text-accent-red/80">Meeting capture active</span>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="px-4 pb-4 space-y-1">
        <ActionButton
          icon={state.captureEnabled ? Pause : Play}
          label={state.captureEnabled ? 'Pause Capture' : 'Resume Capture'}
          description={state.captureEnabled ? 'Stop capturing artifacts' : 'Start capturing again'}
          onClick={handleToggleCapture}
        />
        <ActionButton
          icon={PanelRight}
          label="Open Sidebar"
          description="Full artifact browser & PR inbox"
          onClick={handleOpenSidebar}
        />
        <ActionButton
          icon={Settings}
          label="Admin Console"
          description="Full dashboard & settings"
          onClick={handleOpenAdmin}
          external
        />
      </div>

      {/* Connection Info */}
      <div className="px-4 pb-3 pt-1 border-t border-surface-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {state.nativeHostStatus === 'connected' ? (
              <Wifi size={10} className="text-accent-green" />
            ) : state.standaloneMode ? (
              <HardDrive size={10} className="text-accent-yellow" />
            ) : (
              <WifiOff size={10} className="text-white/30" />
            )}
            <span className="text-2xs text-white/30">
              {state.nativeHostStatus === 'connected'
                ? 'Mac app connected'
                : state.standaloneMode
                  ? 'Standalone mode'
                  : 'Not connected'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Sub-components --------------------------------------------------------

function ActionButton({
  icon: Icon,
  label,
  description,
  onClick,
  external,
}: {
  icon: React.FC<{ size?: number; className?: string }>;
  label: string;
  description: string;
  onClick: () => void;
  external?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-surface-200 transition-colors group text-left"
    >
      <Icon size={14} className="text-white/40 group-hover:text-white/60 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium text-white/80 group-hover:text-white">
          {label}
        </span>
        <p className="text-2xs text-white/30">{description}</p>
      </div>
      {external && (
        <ExternalLink size={10} className="text-white/20 flex-shrink-0" />
      )}
    </button>
  );
}

// ---- Helpers ---------------------------------------------------------------

function getStatusConfig(state: ExtensionState): {
  icon: React.FC<{ size?: number; className?: string }>;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  dotColor: string;
} {
  if (!state.captureEnabled) {
    return {
      icon: Pause,
      label: 'Capture Paused',
      description: 'Artifact capture is paused',
      color: 'text-white/40',
      bgColor: 'bg-white/5',
      dotColor: 'bg-white/30',
    };
  }

  if (state.nativeHostStatus === 'connected') {
    return {
      icon: Wifi,
      label: 'Connected',
      description: 'Capturing via Mac app',
      color: 'text-accent-green',
      bgColor: 'bg-accent-green/10',
      dotColor: 'bg-accent-green',
    };
  }

  if (state.standaloneMode) {
    return {
      icon: HardDrive,
      label: 'Standalone',
      description: 'Capturing locally (Mac app not found)',
      color: 'text-accent-yellow',
      bgColor: 'bg-accent-yellow/10',
      dotColor: 'bg-accent-yellow',
    };
  }

  if (state.authStatus === 'unauthenticated') {
    return {
      icon: LogIn,
      label: 'Sign In Required',
      description: 'Sign in to start capturing',
      color: 'text-accent-red',
      bgColor: 'bg-accent-red/10',
      dotColor: 'bg-accent-red',
    };
  }

  return {
    icon: WifiOff,
    label: 'Connecting...',
    description: 'Attempting to connect',
    color: 'text-accent-yellow',
    bgColor: 'bg-accent-yellow/10',
    dotColor: 'bg-accent-yellow animate-pulse',
  };
}
