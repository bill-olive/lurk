import React, { useState } from 'react';
import { clsx } from 'clsx';
import {
  ChevronDown,
  ChevronUp,
  Check,
  X,
  GitPullRequest,
  Zap,
  Bot,
} from 'lucide-react';

// ---- Types -----------------------------------------------------------------

export interface PRCardData {
  id: string;
  title: string;
  description: string;
  agentName: string;
  agentType: string;
  artifactTitle: string;
  confidence: number;
  changeSummary: string;
  autoMergeEligible: boolean;
  createdAt: number;
  diff?: {
    hunks?: Array<{
      lines?: Array<{
        type: 'add' | 'remove' | 'context';
        content: string;
      }>;
      header?: string;
    }>;
    summary?: string;
    addedLines?: number;
    removedLines?: number;
  };
}

interface PRCardProps {
  pr: PRCardData;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isReviewing?: boolean;
}

// ---- Component -------------------------------------------------------------

export function PRCard({ pr, onApprove, onReject, isReviewing }: PRCardProps) {
  const [expanded, setExpanded] = useState(false);

  const confidenceColor =
    pr.confidence >= 0.8
      ? 'text-accent-green'
      : pr.confidence >= 0.5
        ? 'text-accent-yellow'
        : 'text-accent-red';

  const confidencePct = Math.round(pr.confidence * 100);
  const timeAgo = formatTimeAgo(pr.createdAt);

  return (
    <div className="lurk-card animate-fade-in">
      {/* Header */}
      <div
        className="flex items-start gap-2 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="mt-0.5 text-lurk-400">
          <GitPullRequest size={14} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-medium text-white truncate">{pr.title}</h3>
            {pr.autoMergeEligible && (
              <span className="lurk-badge lurk-badge-yellow flex-shrink-0">
                <Zap size={9} className="mr-0.5" />
                YOLO
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            <span className="flex items-center gap-1 text-2xs text-white/40">
              <Bot size={10} />
              {pr.agentName}
            </span>
            <span className="text-2xs text-white/20">|</span>
            <span className={clsx('text-2xs font-mono', confidenceColor)}>
              {confidencePct}%
            </span>
            <span className="text-2xs text-white/20">|</span>
            <span className="text-2xs text-white/30">{timeAgo}</span>
          </div>

          <p className="text-2xs text-white/40 mt-1 truncate">
            {pr.artifactTitle}
          </p>
        </div>

        <button className="text-white/30 hover:text-white/60 transition-colors p-0.5">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="mt-3 space-y-3 animate-slide-in">
          {/* Change Summary */}
          <div>
            <h4 className="text-2xs font-medium text-white/60 uppercase tracking-wider mb-1">
              Changes
            </h4>
            <p className="text-xs text-white/70">{pr.changeSummary}</p>
          </div>

          {/* Description */}
          {pr.description && (
            <div>
              <h4 className="text-2xs font-medium text-white/60 uppercase tracking-wider mb-1">
                Justification
              </h4>
              <p className="text-xs text-white/50">{pr.description}</p>
            </div>
          )}

          {/* Diff View */}
          {pr.diff?.hunks && pr.diff.hunks.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-2xs font-medium text-white/60 uppercase tracking-wider">
                  Diff
                </h4>
                {pr.diff.addedLines !== undefined && pr.diff.removedLines !== undefined && (
                  <span className="text-2xs font-mono">
                    <span className="text-accent-green">+{pr.diff.addedLines}</span>
                    {' '}
                    <span className="text-accent-red">-{pr.diff.removedLines}</span>
                  </span>
                )}
              </div>
              <div className="bg-surface rounded-md border border-surface-300 overflow-hidden">
                {pr.diff.hunks.map((hunk, hunkIdx) => (
                  <div key={hunkIdx}>
                    {hunk.header && (
                      <div className="px-2 py-1 bg-surface-200 text-2xs font-mono text-white/30 border-b border-surface-300">
                        {hunk.header}
                      </div>
                    )}
                    {hunk.lines?.map((line, lineIdx) => (
                      <div
                        key={lineIdx}
                        className={clsx(
                          'px-2 py-0.5 text-2xs font-mono leading-4',
                          line.type === 'add' && 'lurk-diff-add',
                          line.type === 'remove' && 'lurk-diff-remove',
                          line.type === 'context' && 'lurk-diff-context'
                        )}
                      >
                        <span className="select-none text-white/20 mr-2">
                          {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                        </span>
                        {line.content}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Diff Summary (fallback when no hunks) */}
          {pr.diff?.summary && (!pr.diff.hunks || pr.diff.hunks.length === 0) && (
            <div>
              <h4 className="text-2xs font-medium text-white/60 uppercase tracking-wider mb-1">
                Diff Summary
              </h4>
              <p className="text-xs text-white/50 font-mono bg-surface rounded-md border border-surface-300 p-2">
                {pr.diff.summary}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onApprove(pr.id);
              }}
              disabled={isReviewing}
              className="lurk-btn-success flex-1 disabled:opacity-50"
            >
              <Check size={13} />
              Approve
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReject(pr.id);
              }}
              disabled={isReviewing}
              className="lurk-btn-danger flex-1 disabled:opacity-50"
            >
              <X size={13} />
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Helpers ---------------------------------------------------------------

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
