"use client";

import { useState } from "react";
import {
  LayoutDashboard,
  FileText,
  Bot,
  GitPullRequest,
  Zap,
  ArrowLeftRight,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from "@/components/ui/table";

// ── Mock Data ────────────────────────────────

const prAcceptanceData = [
  { week: "W1", accepted: 85, rejected: 12, pending: 3 },
  { week: "W2", accepted: 88, rejected: 9, pending: 3 },
  { week: "W3", accepted: 82, rejected: 14, pending: 4 },
  { week: "W4", accepted: 91, rejected: 7, pending: 2 },
  { week: "W5", accepted: 87, rejected: 10, pending: 3 },
  { week: "W6", accepted: 93, rejected: 5, pending: 2 },
  { week: "W7", accepted: 90, rejected: 8, pending: 2 },
  { week: "W8", accepted: 95, rejected: 4, pending: 1 },
];

const artifactVolumeData = [
  { day: "Mon", docs: 42, snippets: 18, meetings: 7 },
  { day: "Tue", docs: 38, snippets: 24, meetings: 12 },
  { day: "Wed", docs: 55, snippets: 31, meetings: 9 },
  { day: "Thu", docs: 47, snippets: 27, meetings: 15 },
  { day: "Fri", docs: 62, snippets: 35, meetings: 11 },
  { day: "Sat", docs: 12, snippets: 5, meetings: 2 },
  { day: "Sun", docs: 8, snippets: 3, meetings: 1 },
];

const recentActivity = [
  {
    id: "1",
    agent: "sales_ops",
    action: "Updated Q1 Sales Playbook",
    target: "Sales Playbook v3.2",
    time: "2 min ago",
    status: "success" as const,
  },
  {
    id: "2",
    agent: "compliance",
    action: "Flagged outdated GDPR policy",
    target: "Privacy Policy 2024",
    time: "8 min ago",
    status: "warning" as const,
  },
  {
    id: "3",
    agent: "brand_consistency",
    action: "Opened PR for brand updates",
    target: "Marketing Guidelines",
    time: "15 min ago",
    status: "success" as const,
  },
  {
    id: "4",
    agent: "security",
    action: "Blocked sensitive data exposure",
    target: "API Keys Doc",
    time: "22 min ago",
    status: "danger" as const,
  },
  {
    id: "5",
    agent: "customer_success",
    action: "Generated health report",
    target: "Acme Corp Account",
    time: "34 min ago",
    status: "success" as const,
  },
  {
    id: "6",
    agent: "engineering_standards",
    action: "Reviewed RFC submission",
    target: "RFC-042: API Versioning",
    time: "1 hr ago",
    status: "success" as const,
  },
];

const agentPerformance = [
  {
    name: "sales_ops",
    type: "Marketplace",
    prsOpened: 47,
    acceptRate: 94,
    avgTime: "2.1h",
    status: "active",
  },
  {
    name: "compliance",
    type: "Marketplace",
    prsOpened: 32,
    acceptRate: 89,
    avgTime: "1.8h",
    status: "active",
  },
  {
    name: "brand_consistency",
    type: "Marketplace",
    prsOpened: 28,
    acceptRate: 91,
    avgTime: "3.4h",
    status: "active",
  },
  {
    name: "security",
    type: "Custom",
    prsOpened: 15,
    acceptRate: 97,
    avgTime: "0.5h",
    status: "active",
  },
  {
    name: "onboarding",
    type: "Marketplace",
    prsOpened: 19,
    acceptRate: 86,
    avgTime: "4.2h",
    status: "paused",
  },
];

const customerHealthSummary = [
  { label: "Healthy", count: 42, color: "bg-emerald-400" },
  { label: "At Risk", count: 8, color: "bg-yellow-400" },
  { label: "Critical", count: 3, color: "bg-red-400" },
  { label: "Churned", count: 1, color: "bg-ink-300" },
];

const statusIcons = {
  success: <CheckCircle2 className="w-4 h-4 text-olive-600" />,
  warning: <AlertTriangle className="w-4 h-4 text-yellow-400" />,
  danger: <XCircle className="w-4 h-4 text-red-400" />,
};

// ── Custom Tooltip ──────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload) return null;
  return (
    <div className="bg-white border border-ink-200 rounded-lg px-3 py-2 shadow-warm-lg text-xs">
      <p className="text-ink-400 mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }} className="font-medium">
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

// ── Page ─────────────────────────────────────

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-xl font-bold text-ink-800 tracking-tight flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 text-clay-400" />
          Dashboard
        </h1>
        <p className="text-body-sm text-ink-300 mt-1">
          Overview of your knowledge management system
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          label="Total Artifacts"
          value="12,847"
          trend="up"
          trendValue="+8.3%"
          icon={<FileText className="w-4 h-4" />}
        />
        <StatCard
          label="Active Agents"
          value="7"
          trend="up"
          trendValue="+2"
          icon={<Bot className="w-4 h-4" />}
          variant="success"
        />
        <StatCard
          label="Open PRs"
          value="23"
          trend="down"
          trendValue="-12%"
          icon={<GitPullRequest className="w-4 h-4" />}
        />
        <StatCard
          label="YOLO Merge Rate"
          value="34%"
          trend="up"
          trendValue="+5%"
          icon={<Zap className="w-4 h-4" />}
          variant="warning"
        />
        <StatCard
          label="Migration"
          value="3/8"
          trend="flat"
          trendValue="In Progress"
          icon={<ArrowLeftRight className="w-4 h-4" />}
        />
        <StatCard
          label="Uptime"
          value="99.9%"
          trend="up"
          trendValue="30d"
          icon={<Activity className="w-4 h-4" />}
          variant="success"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PR Acceptance Rate */}
        <Card>
          <CardHeader>
            <CardTitle>PR Acceptance Rate</CardTitle>
            <span className="text-xs text-ink-300">Last 8 weeks</span>
          </CardHeader>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={prAcceptanceData}>
                <defs>
                  <linearGradient id="acceptedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e28" />
                <XAxis dataKey="week" tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="accepted" stroke="#6366f1" fill="url(#acceptedGrad)" strokeWidth={2} name="Accepted" />
                <Area type="monotone" dataKey="rejected" stroke="#ef4444" fill="transparent" strokeWidth={1.5} strokeDasharray="4 4" name="Rejected" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Artifact Volume */}
        <Card>
          <CardHeader>
            <CardTitle>Artifact Volume</CardTitle>
            <span className="text-xs text-ink-300">This week</span>
          </CardHeader>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={artifactVolumeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e28" />
                <XAxis dataKey="day" tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="docs" fill="#6366f1" radius={[4, 4, 0, 0]} name="Documents" />
                <Bar dataKey="snippets" fill="#a855f7" radius={[4, 4, 0, 0]} name="Snippets" />
                <Bar dataKey="meetings" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Meetings" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Activity + Health Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Agent Activity */}
        <Card className="lg:col-span-2" padding="none">
          <div className="p-5 border-b border-ink-100">
            <CardTitle>Recent Agent Activity</CardTitle>
          </div>
          <div className="divide-y divide-ink-100">
            {recentActivity.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 px-5 py-3 hover:bg-ink-50/30 transition-colors"
              >
                <div className="shrink-0">
                  {statusIcons[item.status]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="purple" size="sm">
                      {item.agent}
                    </Badge>
                    <span className="text-sm text-ink-600 truncate">
                      {item.action}
                    </span>
                  </div>
                  <span className="text-xs text-ink-300">{item.target}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-ink-300 shrink-0">
                  <Clock className="w-3 h-3" />
                  {item.time}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Customer Health Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Health</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            {customerHealthSummary.map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                  <span className="text-sm text-ink-600">{item.label}</span>
                </div>
                <span className="text-heading-2 font-serif text-ink-800">
                  {item.count}
                </span>
              </div>
            ))}
            <div className="pt-3 border-t border-ink-100">
              <div className="flex items-center gap-1 h-3 rounded-full overflow-hidden bg-ink-100">
                {customerHealthSummary.map((item) => {
                  const total = customerHealthSummary.reduce((a, b) => a + b.count, 0);
                  const pct = (item.count / total) * 100;
                  return (
                    <div
                      key={item.label}
                      className={`h-full ${item.color}`}
                      style={{ width: `${pct}%` }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Agent Performance Table */}
      <Card padding="none">
        <div className="p-5 border-b border-ink-100">
          <CardTitle>Agent Performance</CardTitle>
        </div>
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell>Agent</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell>PRs Opened</TableHeaderCell>
              <TableHeaderCell>Accept Rate</TableHeaderCell>
              <TableHeaderCell>Avg Review Time</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {agentPerformance.map((agent) => (
              <TableRow key={agent.name}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-clay-400" />
                    <span className="font-medium text-ink-700">
                      {agent.name}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={agent.type === "Custom" ? "info" : "default"} size="sm">
                    {agent.type}
                  </Badge>
                </TableCell>
                <TableCell>{agent.prsOpened}</TableCell>
                <TableCell>
                  <span
                    className={
                      agent.acceptRate >= 90
                        ? "text-olive-600"
                        : agent.acceptRate >= 80
                        ? "text-yellow-400"
                        : "text-red-400"
                    }
                  >
                    {agent.acceptRate}%
                  </span>
                </TableCell>
                <TableCell>{agent.avgTime}</TableCell>
                <TableCell>
                  <Badge
                    variant={agent.status === "active" ? "success" : "warning"}
                    dot
                    size="sm"
                  >
                    {agent.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
