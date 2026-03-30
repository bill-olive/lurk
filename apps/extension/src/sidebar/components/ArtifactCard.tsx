import React from 'react';
import { clsx } from 'clsx';
import {
  FileText,
  Code2,
  Mail,
  Palette,
  Database,
  BarChart3,
  GitPullRequest,
  StickyNote,
  Mic,
  Calendar,
  Globe,
} from 'lucide-react';

// ---- Types -----------------------------------------------------------------

export interface ArtifactCardData {
  id: string;
  type: string;
  title: string;
  sourceUrl: string;
  sourceApp: string;
  capturedAt: number;
  modifiedAt: number;
  sensitivity: string;
  tags: string[];
  metadata: Record<string, unknown>;
  version?: number;
}

interface ArtifactCardProps {
  artifact: ArtifactCardData;
  onClick?: (artifact: ArtifactCardData) => void;
  compact?: boolean;
}

// ---- Icon Mapping ----------------------------------------------------------

const TYPE_ICON_MAP: Record<string, React.FC<{ size?: number; className?: string }>> = {
  'document:gdoc': FileText,
  'document:notion': StickyNote,
  'document:markdown': FileText,
  'document:pdf': FileText,
  'document:word': FileText,
  'document:note': StickyNote,
  'document:wiki': Globe,
  'code:commit': Code2,
  'code:pr': GitPullRequest,
  'code:file': Code2,
  'code:snippet': Code2,
  'code:review': Code2,
  'comm:email_sent': Mail,
  'comm:email_received': Mail,
  'comm:call_recording': Mic,
  'comm:call_transcript': Mic,
  'comm:call_summary': Mic,
  'comm:chat_thread': Mail,
  'data:spreadsheet': BarChart3,
  'data:csv': Database,
  'data:dashboard': BarChart3,
  'data:report': BarChart3,
  'data:crm_record': Database,
  'data:issue_tracker': Database,
  'design:figma': Palette,
  'design:sketch': Palette,
  'design:screenshot': Palette,
  'meta:synthesis': Calendar,
  'meta:status': Calendar,
};

const TYPE_COLOR_MAP: Record<string, string> = {
  document: 'text-accent-blue',
  code: 'text-accent-green',
  comm: 'text-accent-orange',
  data: 'text-accent-cyan',
  design: 'text-accent-purple',
  meta: 'text-lurk-400',
};

const SENSITIVITY_BADGE: Record<string, string> = {
  public: 'lurk-badge-green',
  internal: 'lurk-badge-blue',
  confidential: 'lurk-badge-yellow',
  restricted: 'lurk-badge-red',
};

// ---- Component -------------------------------------------------------------

export function ArtifactCard({ artifact, onClick, compact }: ArtifactCardProps) {
  const typeCategory = artifact.type.split(':')[0];
  const Icon = TYPE_ICON_MAP[artifact.type] ?? FileText;
  const iconColor = TYPE_COLOR_MAP[typeCategory] ?? 'text-white/40';
  const timeAgo = formatTimeAgo(artifact.capturedAt);
  const sensitivityClass = SENSITIVITY_BADGE[artifact.sensitivity] ?? 'lurk-badge-gray';

  const typeLabel = artifact.type.split(':')[1]?.replace(/_/g, ' ') ?? artifact.type;

  if (compact) {
    return (
      <div
        className="flex items-center gap-2 px-2 py-1.5 hover:bg-surface-200 rounded cursor-pointer transition-colors"
        onClick={() => onClick?.(artifact)}
      >
        <Icon size={12} className={iconColor} />
        <span className="text-xs text-white/80 truncate flex-1">{artifact.title}</span>
        <span className="text-2xs text-white/30 flex-shrink-0">{timeAgo}</span>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'lurk-card animate-fade-in',
        onClick && 'cursor-pointer'
      )}
      onClick={() => onClick?.(artifact)}
    >
      <div className="flex items-start gap-2.5">
        <div className={clsx('mt-0.5', iconColor)}>
          <Icon size={15} />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-white truncate">
            {artifact.title}
          </h3>

          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xs text-white/40 capitalize">{typeLabel}</span>
            <span className="text-2xs text-white/20">|</span>
            <span className={clsx('lurk-badge', sensitivityClass)}>
              {artifact.sensitivity}
            </span>
          </div>

          {/* Tags */}
          {artifact.tags.length > 0 && (
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              {artifact.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="lurk-badge lurk-badge-gray"
                >
                  {tag}
                </span>
              ))}
              {artifact.tags.length > 3 && (
                <span className="text-2xs text-white/30">
                  +{artifact.tags.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-2">
            <span className="text-2xs text-white/30">
              {artifact.sourceApp.replace('chrome:', '')}
            </span>
            <div className="flex items-center gap-2">
              {artifact.version && artifact.version > 1 && (
                <span className="text-2xs text-white/30 font-mono">
                  v{artifact.version}
                </span>
              )}
              <span className="text-2xs text-white/30">{timeAgo}</span>
            </div>
          </div>
        </div>
      </div>
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
