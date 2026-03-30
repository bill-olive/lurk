// ---------------------------------------------------------------------------
// ArtifactIcon — maps ArtifactType to a lucide icon with color
// ---------------------------------------------------------------------------

import React from 'react';
import {
  FileText,
  FileCode,
  Mail,
  MailOpen,
  Phone,
  FileAudio,
  MessageSquare,
  Table,
  FileSpreadsheet,
  BarChart3,
  FileBarChart,
  Database,
  Bug,
  Figma,
  PenTool,
  Image,
  Sparkles,
  Activity,
  AlertTriangle,
  Lightbulb,
  Heart,
  LineChart,
  Calendar,
  MessageCircle,
  FolderArchive,
  HardDrive,
  BookOpen,
  StickyNote,
  Globe,
  GitCommit,
  GitPullRequest,
  FileSearch,
  Code,
  type LucideIcon,
} from 'lucide-react';
import type { ArtifactType } from '@lurk/shared-types';

// ---- Icon mapping ----------------------------------------------------------

interface IconMapping {
  icon: LucideIcon;
  color: string;
}

const ARTIFACT_ICON_MAP: Record<ArtifactType, IconMapping> = {
  // Documents
  'document:gdoc': { icon: FileText, color: '#4285F4' },
  'document:notion': { icon: BookOpen, color: '#000000' },
  'document:markdown': { icon: FileText, color: '#374151' },
  'document:pdf': { icon: FileText, color: '#EF4444' },
  'document:word': { icon: FileText, color: '#2B579A' },
  'document:note': { icon: StickyNote, color: '#F59E0B' },
  'document:wiki': { icon: Globe, color: '#8B5CF6' },

  // Code
  'code:commit': { icon: GitCommit, color: '#F97316' },
  'code:pr': { icon: GitPullRequest, color: '#8B5CF6' },
  'code:file': { icon: FileCode, color: '#10B981' },
  'code:snippet': { icon: Code, color: '#6366F1' },
  'code:review': { icon: FileSearch, color: '#EC4899' },

  // Communication
  'comm:email_sent': { icon: Mail, color: '#3B82F6' },
  'comm:email_received': { icon: MailOpen, color: '#6366F1' },
  'comm:call_recording': { icon: Phone, color: '#22C55E' },
  'comm:call_transcript': { icon: FileAudio, color: '#14B8A6' },
  'comm:call_summary': { icon: FileText, color: '#0EA5E9' },
  'comm:chat_thread': { icon: MessageSquare, color: '#8B5CF6' },

  // Data
  'data:spreadsheet': { icon: Table, color: '#22C55E' },
  'data:csv': { icon: FileSpreadsheet, color: '#10B981' },
  'data:dashboard': { icon: BarChart3, color: '#3B82F6' },
  'data:report': { icon: FileBarChart, color: '#6366F1' },
  'data:crm_record': { icon: Database, color: '#F59E0B' },
  'data:issue_tracker': { icon: Bug, color: '#EF4444' },

  // Design
  'design:figma': { icon: Figma, color: '#A259FF' },
  'design:sketch': { icon: PenTool, color: '#F59E0B' },
  'design:screenshot': { icon: Image, color: '#6366F1' },

  // Meta (agent-generated)
  'meta:synthesis': { icon: Sparkles, color: '#8B5CF6' },
  'meta:status': { icon: Activity, color: '#3B82F6' },
  'meta:conflict': { icon: AlertTriangle, color: '#EF4444' },
  'meta:recommendation': { icon: Lightbulb, color: '#F59E0B' },
  'meta:customer_health': { icon: Heart, color: '#EC4899' },
  'meta:analytics_report': { icon: LineChart, color: '#0EA5E9' },
  'meta:calendar_review': { icon: Calendar, color: '#14B8A6' },

  // Migration
  'migration:slack_message': { icon: MessageCircle, color: '#E01E5A' },
  'migration:slack_file': { icon: FolderArchive, color: '#ECB22E' },
  'migration:drive_file': { icon: HardDrive, color: '#0F9D58' },
  'migration:notion_page': { icon: BookOpen, color: '#000000' },
  'migration:email_archive': { icon: Mail, color: '#9CA3AF' },
  'migration:jira_issue': { icon: Bug, color: '#0052CC' },
};

// ---- Props -----------------------------------------------------------------

export interface ArtifactIconProps {
  /** The artifact type to render an icon for. */
  type: ArtifactType;
  /** Icon size in pixels (default: 20). */
  size?: number;
  /** Additional CSS class name. */
  className?: string;
}

// ---- Component -------------------------------------------------------------

export function ArtifactIcon({ type, size = 20, className }: ArtifactIconProps) {
  const mapping = ARTIFACT_ICON_MAP[type];

  if (!mapping) {
    // Fallback for any unrecognized type
    return <FileText size={size} color="#9CA3AF" className={className} />;
  }

  const IconComponent = mapping.icon;
  return <IconComponent size={size} color={mapping.color} className={className} />;
}

/**
 * Utility: get the color associated with an artifact type.
 */
export function getArtifactColor(type: ArtifactType): string {
  return ARTIFACT_ICON_MAP[type]?.color ?? '#9CA3AF';
}
