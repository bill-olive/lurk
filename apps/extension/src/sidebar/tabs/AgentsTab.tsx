import React, { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { RefreshCw, Zap, Bot, AlertTriangle } from 'lucide-react';
import { AgentCard, type AgentCardData } from '../components/AgentCard';

// ---- Component -------------------------------------------------------------

export function AgentsTab() {
  const [agents, setAgents] = useState<AgentCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [yoloEnabled, setYoloEnabled] = useState(false);
  const [yoloToggling, setYoloToggling] = useState(false);

  const fetchAgents = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [agentsResponse, yoloResponse] = await Promise.all([
        sendMessage<AgentCardData[] | { data?: AgentCardData[] }>({
          type: 'LURK_GET_AGENTS',
        }),
        sendMessage<{ enabled?: boolean } | { data?: { enabled?: boolean } }>({
          type: 'LURK_GET_YOLO_CONFIG',
        }),
      ]);

      if (Array.isArray(agentsResponse)) {
        setAgents(agentsResponse);
      } else if (agentsResponse?.data && Array.isArray(agentsResponse.data)) {
        setAgents(agentsResponse.data);
      }

      if (yoloResponse && 'enabled' in yoloResponse) {
        setYoloEnabled(yoloResponse.enabled ?? false);
      } else if (yoloResponse?.data && 'enabled' in yoloResponse.data) {
        setYoloEnabled(yoloResponse.data.enabled ?? false);
      }
    } catch (err) {
      console.error('[AgentsTab] Failed to fetch agents:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleToggleAgent = async (agentId: string, status: 'active' | 'paused') => {
    setTogglingId(agentId);
    try {
      await sendMessage({
        type: 'LURK_TOGGLE_AGENT',
        payload: { agentId, status },
      });
      setAgents((prev) =>
        prev.map((a) => (a.id === agentId ? { ...a, status } : a))
      );
    } catch (err) {
      console.error('[AgentsTab] Failed to toggle agent:', err);
    } finally {
      setTogglingId(null);
    }
  };

  const handleToggleYolo = async () => {
    setYoloToggling(true);
    const newEnabled = !yoloEnabled;
    try {
      await sendMessage({
        type: 'LURK_TOGGLE_YOLO',
        payload: { enabled: newEnabled },
      });
      setYoloEnabled(newEnabled);
    } catch (err) {
      console.error('[AgentsTab] Failed to toggle YOLO:', err);
    } finally {
      setYoloToggling(false);
    }
  };

  const activeCount = agents.filter((a) => a.status === 'active').length;
  const errorCount = agents.filter((a) => a.status === 'error').length;

  if (loading) {
    return (
      <div className="p-3 space-y-3">
        <div className="lurk-skeleton h-16 w-full mb-4" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="lurk-card">
            <div className="flex gap-2.5">
              <div className="lurk-skeleton w-8 h-8 rounded-lg flex-shrink-0" />
              <div className="flex-1">
                <div className="lurk-skeleton h-4 w-3/4 mb-2" />
                <div className="lurk-skeleton h-3 w-full mb-1" />
                <div className="lurk-skeleton h-3 w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* YOLO Mode Toggle */}
      <div className="px-3 py-3 border-b border-surface-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={clsx(
              'w-8 h-8 rounded-lg flex items-center justify-center',
              yoloEnabled ? 'bg-accent-yellow/15' : 'bg-surface-200'
            )}>
              <Zap size={15} className={yoloEnabled ? 'text-accent-yellow' : 'text-white/30'} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-white">YOLO Mode</span>
                {yoloEnabled && (
                  <span className="lurk-badge lurk-badge-yellow">Active</span>
                )}
              </div>
              <p className="text-2xs text-white/40">
                Auto-merge high-confidence, low-risk PRs
              </p>
            </div>
          </div>

          <button
            onClick={handleToggleYolo}
            disabled={yoloToggling}
            className={clsx(
              'lurk-toggle',
              yoloEnabled ? 'lurk-toggle-on' : 'lurk-toggle-off',
              yoloToggling && 'opacity-50'
            )}
          >
            <span
              className={clsx(
                'lurk-toggle-thumb',
                yoloEnabled ? 'lurk-toggle-thumb-on' : 'lurk-toggle-thumb-off'
              )}
            />
          </button>
        </div>

        {yoloEnabled && (
          <div className="mt-2 flex items-start gap-1.5 animate-slide-in">
            <AlertTriangle size={11} className="text-accent-yellow mt-0.5 flex-shrink-0" />
            <p className="text-2xs text-accent-yellow/70">
              Agents will auto-merge PRs that meet confidence and safety thresholds without your review.
            </p>
          </div>
        )}
      </div>

      {/* Stats Bar */}
      <div className="flex items-center gap-4 px-3 py-2 border-b border-surface-300">
        <span className="text-2xs text-white/40">
          <span className="text-accent-green font-medium">{activeCount}</span> active
        </span>
        {errorCount > 0 && (
          <span className="text-2xs text-white/40">
            <span className="text-accent-red font-medium">{errorCount}</span> errors
          </span>
        )}
        <span className="text-2xs text-white/30">{agents.length} total</span>
        <div className="flex-1" />
        <button
          onClick={() => fetchAgents(true)}
          disabled={refreshing}
          className={clsx(
            'lurk-btn-ghost p-1 rounded',
            refreshing && 'animate-spin'
          )}
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {agents.length === 0 ? (
          <EmptyState />
        ) : (
          agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onToggle={handleToggleAgent}
              isToggling={togglingId === agent.id}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ---- Empty State -----------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-10 h-10 rounded-full bg-surface-200 flex items-center justify-center mb-3">
        <Bot size={18} className="text-white/20" />
      </div>
      <p className="text-sm text-white/40 font-medium">No agents configured</p>
      <p className="text-2xs text-white/25 mt-1 max-w-[200px]">
        Create agents in the admin console to start automating your workflow
      </p>
    </div>
  );
}

// ---- Helpers ---------------------------------------------------------------

function sendMessage<T>(message: { type: string; payload?: unknown }): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response as T);
      }
    });
  });
}
