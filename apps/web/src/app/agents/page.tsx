"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bot,
  Plus,
  Search,
  Play,
  Pause,
  XCircle,
  Settings,
  ExternalLink,
  Sparkles,
  Zap,
  Filter,
  MoreVertical,
  Activity,
  Clock,
  GitPullRequest,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabPanel } from "@/components/ui/tabs";
import { Modal } from "@/components/ui/modal";

// ── Types ────────────────────────────────────

interface Agent {
  id: string;
  name: string;
  displayName: string;
  type: "marketplace" | "custom";
  status: "active" | "paused" | "disabled" | "error";
  model: string;
  acceptRate: number;
  prsOpened: number;
  prsThisWeek: number;
  yoloEnabled: boolean;
  yoloThreshold: number;
  lastActive: string;
  description: string;
  scopes: string[];
}

// ── Mock Data ────────────────────────────────

const agents: Agent[] = [
  {
    id: "agent_1",
    name: "sales_ops",
    displayName: "Sales Ops Agent",
    type: "marketplace",
    status: "active",
    model: "claude-sonnet-4-20250514",
    acceptRate: 94,
    prsOpened: 47,
    prsThisWeek: 8,
    yoloEnabled: true,
    yoloThreshold: 0.95,
    lastActive: "2 min ago",
    description: "Keeps sales playbooks, competitive intel, and pricing docs up-to-date",
    scopes: ["sales", "marketing"],
  },
  {
    id: "agent_2",
    name: "compliance",
    displayName: "Compliance Agent",
    type: "marketplace",
    status: "active",
    model: "claude-sonnet-4-20250514",
    acceptRate: 89,
    prsOpened: 32,
    prsThisWeek: 5,
    yoloEnabled: false,
    yoloThreshold: 0.0,
    lastActive: "8 min ago",
    description: "Monitors regulatory compliance across all documentation",
    scopes: ["legal", "compliance", "all"],
  },
  {
    id: "agent_3",
    name: "brand_consistency",
    displayName: "Brand Consistency Agent",
    type: "marketplace",
    status: "active",
    model: "claude-haiku-4-20250514",
    acceptRate: 91,
    prsOpened: 28,
    prsThisWeek: 4,
    yoloEnabled: true,
    yoloThreshold: 0.9,
    lastActive: "15 min ago",
    description: "Ensures brand voice and style consistency across artifacts",
    scopes: ["marketing", "product"],
  },
  {
    id: "agent_4",
    name: "security",
    displayName: "Security Agent",
    type: "custom",
    status: "active",
    model: "claude-sonnet-4-20250514",
    acceptRate: 97,
    prsOpened: 15,
    prsThisWeek: 3,
    yoloEnabled: false,
    yoloThreshold: 0.0,
    lastActive: "22 min ago",
    description: "Scans for exposed secrets, credential leaks, and security gaps",
    scopes: ["engineering", "all"],
  },
  {
    id: "agent_5",
    name: "customer_success",
    displayName: "Customer Success Agent",
    type: "marketplace",
    status: "active",
    model: "claude-sonnet-4-20250514",
    acceptRate: 88,
    prsOpened: 21,
    prsThisWeek: 6,
    yoloEnabled: true,
    yoloThreshold: 0.85,
    lastActive: "34 min ago",
    description: "Generates customer health reports and renewal playbooks",
    scopes: ["customer_success", "sales"],
  },
  {
    id: "agent_6",
    name: "onboarding",
    displayName: "Onboarding Agent",
    type: "marketplace",
    status: "paused",
    model: "claude-haiku-4-20250514",
    acceptRate: 86,
    prsOpened: 19,
    prsThisWeek: 0,
    yoloEnabled: false,
    yoloThreshold: 0.0,
    lastActive: "2 days ago",
    description: "Maintains onboarding guides and training materials",
    scopes: ["hr", "engineering"],
  },
  {
    id: "agent_7",
    name: "eng_standards",
    displayName: "Engineering Standards Agent",
    type: "custom",
    status: "error",
    model: "claude-sonnet-4-20250514",
    acceptRate: 72,
    prsOpened: 9,
    prsThisWeek: 0,
    yoloEnabled: false,
    yoloThreshold: 0.0,
    lastActive: "1 day ago",
    description: "Enforces coding standards and reviews technical documentation",
    scopes: ["engineering"],
  },
];

const activityLog = [
  { time: "2 min ago", agent: "sales_ops", action: "Updated Q1 Sales Playbook", type: "pr_opened" },
  { time: "8 min ago", agent: "compliance", action: "Flagged outdated GDPR policy", type: "alert" },
  { time: "15 min ago", agent: "brand_consistency", action: "Merged brand voice update", type: "pr_merged" },
  { time: "22 min ago", agent: "security", action: "Blocked API key exposure", type: "block" },
  { time: "34 min ago", agent: "customer_success", action: "Generated health report for Acme", type: "report" },
  { time: "1 hr ago", agent: "sales_ops", action: "Refreshed competitive analysis", type: "pr_opened" },
  { time: "1.5 hr ago", agent: "compliance", action: "Updated SOC2 evidence doc", type: "pr_merged" },
  { time: "2 hr ago", agent: "brand_consistency", action: "Fixed logo usage in 3 docs", type: "pr_opened" },
];

const statusColors = {
  active: "success" as const,
  paused: "warning" as const,
  disabled: "default" as const,
  error: "danger" as const,
};

// ── Page ─────────────────────────────────────

export default function AgentsPage() {
  const [activeTab, setActiveTab] = useState("agents");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const filteredAgents = agents.filter((a) => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (searchQuery && !a.name.includes(searchQuery.toLowerCase()) && !a.displayName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const tabs = [
    { id: "agents", label: "All Agents", count: agents.length },
    { id: "activity", label: "Activity Log", count: activityLog.length },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100 tracking-tight flex items-center gap-2">
            <Bot className="w-5 h-5 text-lurk-400" />
            Agent Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Deploy, configure, and monitor knowledge agents
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/agents/marketplace">
            <Button variant="secondary" size="sm" icon={<Sparkles className="w-3.5 h-3.5" />}>
              Marketplace
            </Button>
          </Link>
          <Link href="/agents/builder">
            <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />}>
              Build Custom Agent
            </Button>
          </Link>
        </div>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <TabPanel id="agents" activeTab={activeTab}>
        {/* Filters */}
        <div className="flex items-center gap-3 mt-6 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-base pl-9 w-full"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-base"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="disabled">Disabled</option>
            <option value="error">Error</option>
          </select>
        </div>

        {/* Agent Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredAgents.map((agent) => (
            <Card
              key={agent.id}
              hover
              onClick={() => {
                setSelectedAgent(agent);
                setDetailOpen(true);
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-lurk-600/15 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-lurk-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-200">
                      {agent.displayName}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge
                        variant={statusColors[agent.status]}
                        dot
                        size="sm"
                      >
                        {agent.status}
                      </Badge>
                      <Badge
                        variant={agent.type === "custom" ? "info" : "default"}
                        size="sm"
                      >
                        {agent.type}
                      </Badge>
                    </div>
                  </div>
                </div>
                {agent.yoloEnabled && (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-yellow-500/15 border border-yellow-500/20">
                    <Zap className="w-3 h-3 text-yellow-400" />
                    <span className="text-2xs font-medium text-yellow-400">YOLO</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-500 mb-4 line-clamp-2">
                {agent.description}
              </p>

              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-800/60">
                <div>
                  <div className="text-lg font-bold text-gray-100">
                    {agent.acceptRate}%
                  </div>
                  <div className="text-2xs text-gray-500">Accept Rate</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-gray-100">
                    {agent.prsOpened}
                  </div>
                  <div className="text-2xs text-gray-500">Total PRs</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-gray-100">
                    {agent.prsThisWeek}
                  </div>
                  <div className="text-2xs text-gray-500">This Week</div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-500">
                <Clock className="w-3 h-3" />
                Last active {agent.lastActive}
              </div>
            </Card>
          ))}
        </div>
      </TabPanel>

      <TabPanel id="activity" activeTab={activeTab}>
        <div className="mt-6 space-y-1">
          {activityLog.map((entry, idx) => (
            <div
              key={idx}
              className="flex items-center gap-4 p-3 rounded-lg hover:bg-surface-100 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-surface-200 flex items-center justify-center shrink-0">
                {entry.type === "pr_opened" && <GitPullRequest className="w-4 h-4 text-blue-400" />}
                {entry.type === "pr_merged" && <GitPullRequest className="w-4 h-4 text-emerald-400" />}
                {entry.type === "alert" && <Activity className="w-4 h-4 text-yellow-400" />}
                {entry.type === "block" && <XCircle className="w-4 h-4 text-red-400" />}
                {entry.type === "report" && <Activity className="w-4 h-4 text-lurk-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="purple" size="sm">{entry.agent}</Badge>
                  <span className="text-sm text-gray-300">{entry.action}</span>
                </div>
              </div>
              <span className="text-xs text-gray-500 shrink-0">{entry.time}</span>
            </div>
          ))}
        </div>
      </TabPanel>

      {/* Agent Detail Modal */}
      {selectedAgent && (
        <Modal
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
          title={selectedAgent.displayName}
          description={selectedAgent.description}
          size="lg"
          footer={
            <>
              <Button variant="ghost" onClick={() => setDetailOpen(false)}>
                Close
              </Button>
              {selectedAgent.status === "active" ? (
                <Button variant="secondary" icon={<Pause className="w-3.5 h-3.5" />}>
                  Pause Agent
                </Button>
              ) : (
                <Button variant="primary" icon={<Play className="w-3.5 h-3.5" />}>
                  Resume Agent
                </Button>
              )}
              <Button variant="danger" icon={<XCircle className="w-3.5 h-3.5" />}>
                Disable
              </Button>
            </>
          }
        >
          <div className="space-y-6">
            {/* Status & Config */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500">Status</label>
                  <div className="mt-1">
                    <Badge variant={statusColors[selectedAgent.status]} dot>
                      {selectedAgent.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Model</label>
                  <p className="text-sm text-gray-200 font-mono mt-1">
                    {selectedAgent.model}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Type</label>
                  <p className="text-sm text-gray-200 mt-1 capitalize">
                    {selectedAgent.type}
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500">Scopes</label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {selectedAgent.scopes.map((s) => (
                      <Badge key={s} variant="outline" size="sm">{s}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500">YOLO Mode</label>
                  <div className="mt-1">
                    {selectedAgent.yoloEnabled ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="warning" dot size="sm">Enabled</Badge>
                        <span className="text-xs text-gray-500">
                          Threshold: {selectedAgent.yoloThreshold}
                        </span>
                      </div>
                    ) : (
                      <Badge variant="default" size="sm">Disabled</Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Performance */}
            <div className="border-t border-gray-800/60 pt-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Performance Metrics
              </h4>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-lg bg-surface-200/50">
                  <div className="text-xl font-bold text-gray-100">
                    {selectedAgent.prsOpened}
                  </div>
                  <div className="text-2xs text-gray-500">Total PRs</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-surface-200/50">
                  <div className="text-xl font-bold text-emerald-400">
                    {selectedAgent.acceptRate}%
                  </div>
                  <div className="text-2xs text-gray-500">Accept Rate</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-surface-200/50">
                  <div className="text-xl font-bold text-gray-100">
                    {selectedAgent.prsThisWeek}
                  </div>
                  <div className="text-2xs text-gray-500">This Week</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-surface-200/50">
                  <div className="text-xl font-bold text-gray-100">2.1h</div>
                  <div className="text-2xs text-gray-500">Avg Review</div>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
