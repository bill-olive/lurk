import React, { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import {
  Bot,
  Users,
  Building2,
  Wrench,
  Mic,
  Calendar,
  ArrowRightLeft,
  GitBranch,
  GitPullRequest,
  Sparkles,
  Bell,
  SkipForward,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

// ---- Types -----------------------------------------------------------------

interface AgentAction {
  id: string;
  agentId: string;
  agentName: string;
  agentType: string;
  action: string;
  description: string;
  artifactId: string | null;
  artifactTitle: string | null;
  timestamp: number;
}

// ---- Icon Mapping ----------------------------------------------------------

const AGENT_TYPE_ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
  personal: Bot,
  team: Users,
  org: Building2,
  function: Wrench,
  voice: Mic,
  calendar: Calendar,
  migration: ArrowRightLeft,
};

const ACTION_ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
  fork: GitBranch,
  pr: GitPullRequest,
  synthesize: Sparkles,
  notify: Bell,
  skip: SkipForward,
};

const ACTION_COLORS: Record<string, string> = {
  fork: 'text-accent-blue',
  pr: 'text-lurk-400',
  synthesize: 'text-accent-purple',
  notify: 'text-accent-orange',
  skip: 'text-white/30',
};

// ---- Component -------------------------------------------------------------

export function ActivityTab() {
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchActions = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await sendMessage<AgentAction[] | { data?: AgentAction[] }>({
        type: 'LURK_GET_AGENT_ACTIONS',
        payload: { limit: 50 },
      });

      if (Array.isArray(response)) {
        setActions(response);
      } else if (response?.data && Array.isArray(response.data)) {
        setActions(response.data);
      }
    } catch (err) {
      console.error('[ActivityTab] Failed to fetch actions:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchActions();

    const handleMessage = (message: { type: string }) => {
      if (message.type === 'LURK_STATE_UPDATE') {
        fetchActions();
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [fetchActions]);

  // Group actions by day
  const groupedActions = groupByDay(actions);

  if (loading) {
    return (
      <div className="p-3 space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="lurk-skeleton w-6 h-6 rounded-full flex-shrink-0" />
            <div className="flex-1">
              <div className="lurk-skeleton h-3 w-3/4 mb-1" />
              <div className="lurk-skeleton h-2.5 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-300">
        <span className="text-xs text-white/50">
          {actions.length} recent actions
        </span>
        <button
          onClick={() => fetchActions(true)}
          disabled={refreshing}
          className={clsx(
            'lurk-btn-ghost p-1 rounded',
            refreshing && 'animate-spin'
          )}
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto">
        {actions.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="py-2">
            {groupedActions.map(([dayLabel, dayActions]) => (
              <div key={dayLabel}>
                <div className="sticky top-0 bg-surface/90 backdrop-blur-sm px-3 py-1.5 z-10">
                  <span className="text-2xs font-medium text-white/30 uppercase tracking-wider">
                    {dayLabel}
                  </span>
                </div>
                <div className="px-3 space-y-0.5">
                  {dayActions.map((action, idx) => (
                    <ActivityItem
                      key={action.id}
                      action={action}
                      isLast={idx === dayActions.length - 1}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Activity Item ---------------------------------------------------------

function ActivityItem({
  action,
  isLast,
}: {
  action: AgentAction;
  isLast: boolean;
}) {
  const AgentIcon = AGENT_TYPE_ICONS[action.agentType] ?? Bot;
  const ActionIcon = ACTION_ICONS[action.action] ?? Sparkles;
  const actionColor = ACTION_COLORS[action.action] ?? 'text-white/40';
  const time = formatTime(action.timestamp);

  return (
    <div className="flex items-start gap-2.5 py-1.5 group">
      {/* Timeline line + icon */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="w-6 h-6 rounded-full bg-surface-200 flex items-center justify-center border border-surface-300 group-hover:border-surface-400 transition-colors">
          <AgentIcon size={11} className="text-lurk-400" />
        </div>
        {!isLast && (
          <div className="w-px h-full min-h-[16px] bg-surface-300 mt-0.5" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-white/80">{action.agentName}</span>
          <ActionIcon size={10} className={actionColor} />
          <span className="text-2xs text-white/30">{time}</span>
        </div>

        <p className="text-2xs text-white/50 mt-0.5">{action.description}</p>

        {action.artifactTitle && (
          <div className="flex items-center gap-1 mt-1 group/link">
            <ExternalLink size={9} className="text-white/20 group-hover/link:text-lurk-400" />
            <span className="text-2xs text-white/30 group-hover/link:text-lurk-400 cursor-pointer truncate">
              {action.artifactTitle}
            </span>
          </div>
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
      <p className="text-sm text-white/40 font-medium">No agent activity yet</p>
      <p className="text-2xs text-white/25 mt-1 max-w-[200px]">
        Agent actions will appear here as they process your artifacts
      </p>
    </div>
  );
}

// ---- Helpers ---------------------------------------------------------------

function groupByDay(actions: AgentAction[]): [string, AgentAction[]][] {
  const groups = new Map<string, AgentAction[]>();

  for (const action of actions) {
    const date = new Date(action.timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let label: string;
    if (date.toDateString() === today.toDateString()) {
      label = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      label = 'Yesterday';
    } else {
      label = date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    }

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(action);
  }

  return Array.from(groups.entries());
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

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
