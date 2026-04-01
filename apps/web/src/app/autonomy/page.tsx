"use client";

import { useState } from "react";
import {
  Brain,
  TrendingUp,
  Undo2,
  Bot,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
  Shield,
  Eye,
  Sparkles,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ---- Types -----------------------------------------------------------------

type AutonomyTier = "supervised" | "assisted" | "autonomous" | "yolo";

interface TrustEvent {
  id: string;
  agentName: string;
  action: string;
  description: string;
  trustDelta: number;
  timestamp: string;
  canUndo: boolean;
}

interface AgentTrust {
  id: string;
  name: string;
  tier: AutonomyTier;
  acceptanceRate: number;
  totalActions: number;
  recentActions: number;
  lastAction: string;
}

// ---- Mock Data (replace with Firestore) ------------------------------------

const MOCK_SCORE = {
  voiceProfileConfidence: 0.73,
  historicalAcceptanceRate: 0.85,
  artifactFamiliarity: 0.62,
  domainExpertise: 0.70,
  compositeScore: 0.738,
  tier: "autonomous" as AutonomyTier,
};

const MOCK_EVENTS: TrustEvent[] = [
  {
    id: "te-1",
    agentName: "Editorial Agent",
    action: "auto_merged",
    description: "Auto-merged PR: Fix typos in Q2 Product Roadmap",
    trustDelta: 0.01,
    timestamp: "2026-03-30T08:15:00Z",
    canUndo: true,
  },
  {
    id: "te-2",
    agentName: "Synthesis Agent",
    action: "accepted",
    description: "PR accepted: Weekly team digest for Engineering",
    trustDelta: 0.05,
    timestamp: "2026-03-29T16:42:00Z",
    canUndo: false,
  },
  {
    id: "te-3",
    agentName: "Editorial Agent",
    action: "accepted_edited",
    description: "PR accepted with edits: Privacy Framework v2 summary",
    trustDelta: 0.02,
    timestamp: "2026-03-29T10:20:00Z",
    canUndo: false,
  },
  {
    id: "te-4",
    agentName: "Customer Health Agent",
    action: "rejected",
    description: "PR rejected: Wellspring Health risk assessment tone was off",
    trustDelta: -0.08,
    timestamp: "2026-03-28T14:35:00Z",
    canUndo: false,
  },
  {
    id: "te-5",
    agentName: "Editorial Agent",
    action: "auto_merged",
    description: "Auto-merged PR: Format connector SDK code samples",
    trustDelta: 0.01,
    timestamp: "2026-03-28T09:10:00Z",
    canUndo: true,
  },
];

const MOCK_AGENTS: AgentTrust[] = [
  {
    id: "agent-editorial",
    name: "Editorial Agent",
    tier: "autonomous",
    acceptanceRate: 0.94,
    totalActions: 47,
    recentActions: 12,
    lastAction: "2026-03-30T08:15:00Z",
  },
  {
    id: "agent-synthesis",
    name: "Synthesis Agent",
    tier: "assisted",
    acceptanceRate: 0.78,
    totalActions: 23,
    recentActions: 5,
    lastAction: "2026-03-29T16:42:00Z",
  },
  {
    id: "agent-customer",
    name: "Customer Health Agent",
    tier: "supervised",
    acceptanceRate: 0.61,
    totalActions: 18,
    recentActions: 3,
    lastAction: "2026-03-28T14:35:00Z",
  },
  {
    id: "agent-migration",
    name: "Migration Agent",
    tier: "assisted",
    acceptanceRate: 0.82,
    totalActions: 31,
    recentActions: 7,
    lastAction: "2026-03-27T11:00:00Z",
  },
];

// ---- Helpers ---------------------------------------------------------------

const tierConfig: Record<AutonomyTier, { label: string; color: string; icon: typeof Shield; description: string }> = {
  supervised: {
    label: "Supervised",
    color: "text-ink-500 bg-ink-50 border-ink-200",
    icon: Eye,
    description: "Human drives, agent suggests",
  },
  assisted: {
    label: "Assisted",
    color: "text-heather-600 bg-heather-50 border-heather-200",
    icon: Shield,
    description: "Agent drafts, human approves",
  },
  autonomous: {
    label: "Autonomous",
    color: "text-olive-600 bg-olive-50 border-olive-200",
    icon: Bot,
    description: "Agent acts, human reviews async",
  },
  yolo: {
    label: "YOLO",
    color: "text-clay-600 bg-clay-50 border-clay-200",
    icon: Zap,
    description: "Full auto with auto-merge",
  },
};

const actionIcons: Record<string, typeof CheckCircle2> = {
  accepted: CheckCircle2,
  accepted_edited: CheckCircle2,
  auto_merged: Sparkles,
  rejected: XCircle,
  rolled_back: Undo2,
  corrected: AlertTriangle,
};

const actionColors: Record<string, string> = {
  accepted: "text-green-500",
  accepted_edited: "text-green-400",
  auto_merged: "text-clay-500",
  rejected: "text-red-400",
  rolled_back: "text-red-500",
  corrected: "text-amber-500",
};

function formatRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---- Page ------------------------------------------------------------------

export default function AutonomyPage() {
  const [score] = useState(MOCK_SCORE);
  const [events] = useState(MOCK_EVENTS);
  const [agents] = useState(MOCK_AGENTS);

  const tierInfo = tierConfig[score.tier];
  const TierIcon = tierInfo.icon;

  return (
    <div className="min-h-screen bg-ivory">
      <div className="max-w-5xl mx-auto px-6 py-16 sm:px-8 lg:px-12">
        {/* Header */}
        <header className="mb-14">
          <h1 className="font-serif text-4xl sm:text-5xl font-bold text-ink-800 tracking-tight">
            Autonomy
          </h1>
          <p className="mt-3 text-lg text-ink-500 max-w-xl leading-relaxed">
            How much your agents know about you, and how much you trust them.
          </p>
        </header>

        {/* Score Card */}
        <section className="mb-12 p-8 bg-white border border-ink-100 rounded-editorial">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            {/* Big Score */}
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-full border-4 border-ink-100 flex items-center justify-center">
                  <span className="text-3xl font-bold text-ink-800 font-serif">
                    {(score.compositeScore * 100).toFixed(0)}
                  </span>
                </div>
                {/* Progress ring overlay */}
                <svg className="absolute inset-0 w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                  <circle
                    cx="48" cy="48" r="44"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeDasharray={`${score.compositeScore * 276.46} 276.46`}
                    className="text-clay-500"
                  />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <TierIcon className={`w-5 h-5 ${tierInfo.color.split(" ")[0]}`} />
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${tierInfo.color}`}>
                    {tierInfo.label}
                  </span>
                </div>
                <p className="text-sm text-ink-400">{tierInfo.description}</p>
              </div>
            </div>

            {/* Score Breakdown */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              {[
                { label: "Voice Profile", value: score.voiceProfileConfidence, weight: "0.3" },
                { label: "Acceptance Rate", value: score.historicalAcceptanceRate, weight: "0.3" },
                { label: "Artifact Familiarity", value: score.artifactFamiliarity, weight: "0.2" },
                { label: "Domain Expertise", value: score.domainExpertise, weight: "0.2" },
              ].map((dim) => (
                <div key={dim.label} className="flex items-center gap-3">
                  <div className="w-24">
                    <div className="text-2xs text-ink-400">{dim.label}</div>
                    <div className="text-xs font-medium text-ink-700">
                      {(dim.value * 100).toFixed(0)}%
                      <span className="text-ink-300 font-normal ml-1">×{dim.weight}</span>
                    </div>
                  </div>
                  <div className="w-20 h-1.5 bg-ink-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-clay-500 rounded-full transition-all"
                      style={{ width: `${dim.value * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Two columns: Activity Feed + Agent Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Activity Feed — While You Were Away */}
          <section className="lg:col-span-3">
            <h2 className="font-serif text-2xl font-semibold text-ink-800 tracking-tight mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-ink-400" />
              While You Were Away
            </h2>

            <div className="space-y-1">
              {events.map((event) => {
                const ActionIcon = actionIcons[event.action] ?? Brain;
                const actionColor = actionColors[event.action] ?? "text-ink-400";

                return (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 p-4 bg-white border border-ink-100 rounded-editorial hover:border-ink-200 transition-colors"
                  >
                    <ActionIcon className={`w-4 h-4 mt-0.5 shrink-0 ${actionColor}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium text-ink-700">{event.agentName}</span>
                        <span className={`text-2xs font-medium ${
                          event.trustDelta >= 0 ? "text-green-500" : "text-red-400"
                        }`}>
                          {event.trustDelta >= 0 ? "+" : ""}{event.trustDelta.toFixed(2)}
                        </span>
                        <span className="text-2xs text-ink-300 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatRelativeTime(event.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs text-ink-500 truncate">{event.description}</p>
                    </div>
                    {event.canUndo && (
                      <button className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-2xs font-medium text-clay-600 bg-clay-50 hover:bg-clay-100 border border-clay-200 rounded-lg transition-colors">
                        <Undo2 className="w-3 h-3" />
                        Undo
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Agent Breakdown */}
          <section className="lg:col-span-2">
            <h2 className="font-serif text-2xl font-semibold text-ink-800 tracking-tight mb-6 flex items-center gap-2">
              <Bot className="w-5 h-5 text-ink-400" />
              Agent Trust
            </h2>

            <div className="space-y-3">
              {agents.map((agent) => {
                const agentTier = tierConfig[agent.tier];
                return (
                  <div
                    key={agent.id}
                    className="p-4 bg-white border border-ink-100 rounded-editorial"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-ink-700">{agent.name}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-medium border ${agentTier.color}`}>
                        {agentTier.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-2xs text-ink-400">
                      <span>
                        Accept rate: <span className="font-medium text-ink-600">{(agent.acceptanceRate * 100).toFixed(0)}%</span>
                      </span>
                      <span>{agent.totalActions} total / {agent.recentActions} recent</span>
                    </div>
                    <div className="mt-2 w-full h-1 bg-ink-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-clay-500 rounded-full"
                        style={{ width: `${agent.acceptanceRate * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
