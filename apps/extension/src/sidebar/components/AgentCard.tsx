import React from 'react';
import { clsx } from 'clsx';
import {
  Bot,
  Users,
  Building2,
  Wrench,
  Mic,
  Calendar,
  ArrowRightLeft,
  Pause,
  Play,
  TrendingUp,
} from 'lucide-react';

// ---- Types -----------------------------------------------------------------

export interface AgentCardData {
  id: string;
  name: string;
  type: string;
  description: string;
  status: 'active' | 'paused' | 'disabled' | 'error';
  totalActions: number;
  acceptanceRate: number;
  lastRunAt: number | null;
  actionBudget?: {
    maxPRsPerDay: number;
    maxTokensPerDay: number;
    costCapPerMonth: number;
  };
}

interface AgentCardProps {
  agent: AgentCardData;
  onToggle: (agentId: string, status: 'active' | 'paused') => void;
  isToggling?: boolean;
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

const STATUS_STYLES: Record<string, { dot: string; label: string; badge: string }> = {
  active: { dot: 'bg-accent-green', label: 'Active', badge: 'lurk-badge-green' },
  paused: { dot: 'bg-accent-yellow', label: 'Paused', badge: 'lurk-badge-yellow' },
  disabled: { dot: 'bg-white/30', label: 'Disabled', badge: 'lurk-badge-gray' },
  error: { dot: 'bg-accent-red', label: 'Error', badge: 'lurk-badge-red' },
};

// ---- Component -------------------------------------------------------------

export function AgentCard({ agent, onToggle, isToggling }: AgentCardProps) {
  const TypeIcon = AGENT_TYPE_ICONS[agent.type] ?? Bot;
  const statusStyle = STATUS_STYLES[agent.status] ?? STATUS_STYLES.disabled;
  const acceptancePct = Math.round(agent.acceptanceRate * 100);

  const canToggle = agent.status === 'active' || agent.status === 'paused';
  const toggleTarget = agent.status === 'active' ? 'paused' : 'active';

  return (
    <div className="lurk-card animate-fade-in">
      <div className="flex items-start gap-2.5">
        {/* Icon */}
        <div className="w-8 h-8 rounded-lg bg-lurk-600/15 flex items-center justify-center flex-shrink-0">
          <TypeIcon size={15} className="text-lurk-400" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="text-sm font-medium text-white truncate">{agent.name}</h3>
              <span className={clsx('lurk-badge flex-shrink-0', statusStyle.badge)}>
                <span className={clsx('w-1 h-1 rounded-full mr-1', statusStyle.dot)} />
                {statusStyle.label}
              </span>
            </div>

            {/* Toggle Button */}
            {canToggle && (
              <button
                onClick={() => onToggle(agent.id, toggleTarget)}
                disabled={isToggling}
                className={clsx(
                  'lurk-btn-ghost p-1 rounded-md',
                  isToggling && 'opacity-50'
                )}
                title={agent.status === 'active' ? 'Pause agent' : 'Resume agent'}
              >
                {agent.status === 'active' ? (
                  <Pause size={13} />
                ) : (
                  <Play size={13} />
                )}
              </button>
            )}
          </div>

          <p className="text-2xs text-white/40 mt-0.5 line-clamp-2">
            {agent.description}
          </p>

          {/* Stats */}
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1">
              <TrendingUp size={10} className="text-white/30" />
              <span className="text-2xs text-white/40">
                {agent.totalActions} actions
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-2xs text-white/40">
                {acceptancePct}% accepted
              </span>
            </div>
            {agent.lastRunAt && (
              <span className="text-2xs text-white/30">
                Last: {formatTimeAgo(agent.lastRunAt)}
              </span>
            )}
          </div>

          {/* Budget Bar */}
          {agent.actionBudget && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-2xs text-white/30">Budget</span>
                <span className="text-2xs text-white/30 font-mono">
                  ${agent.actionBudget.costCapPerMonth}/mo
                </span>
              </div>
              <div className="h-1 bg-surface-300 rounded-full overflow-hidden">
                <div
                  className="h-full bg-lurk-500 rounded-full transition-all"
                  style={{ width: `${Math.min((agent.totalActions / (agent.actionBudget.maxPRsPerDay * 30)) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Helpers ---------------------------------------------------------------

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return new Date(timestamp).toLocaleDateString();
}
