"use client";

import { useState } from "react";
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Target,
  Users,
  Lightbulb,
  FileText,
  Clock,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabPanel } from "@/components/ui/tabs";
import { StatCard } from "@/components/ui/stat-card";

// ── Mock Data ────────────────────────────────

const qualityDistribution = [
  { range: "0-20", count: 3, color: "#ef4444" },
  { range: "21-40", count: 8, color: "#f97316" },
  { range: "41-60", count: 15, color: "#eab308" },
  { range: "61-80", count: 42, color: "#22c55e" },
  { range: "81-100", count: 67, color: "#6366f1" },
];

const stalenessData = [
  { week: "W1", fresh: 85, aging: 10, stale: 4, critical: 1 },
  { week: "W2", fresh: 82, aging: 12, stale: 5, critical: 1 },
  { week: "W3", fresh: 80, aging: 13, stale: 5, critical: 2 },
  { week: "W4", fresh: 78, aging: 14, stale: 6, critical: 2 },
  { week: "W5", fresh: 81, aging: 12, stale: 5, critical: 2 },
  { week: "W6", fresh: 83, aging: 11, stale: 5, critical: 1 },
  { week: "W7", fresh: 86, aging: 9, stale: 4, critical: 1 },
  { week: "W8", fresh: 88, aging: 8, stale: 3, critical: 1 },
];

const coverageData = [
  { area: "Sales Processes", covered: 85, total: 100 },
  { area: "Engineering Docs", covered: 72, total: 100 },
  { area: "Onboarding", covered: 60, total: 100 },
  { area: "Compliance", covered: 92, total: 100 },
  { area: "Product Specs", covered: 78, total: 100 },
  { area: "Customer Support", covered: 55, total: 100 },
  { area: "HR Policies", covered: 45, total: 100 },
  { area: "Security", covered: 88, total: 100 },
];

const teamBreakdown = [
  {
    team: "Engineering",
    artifacts: 3245,
    avgQuality: 84,
    stalePct: 8,
    coverage: 72,
    topType: "Technical Docs",
    agentActivity: 47,
  },
  {
    team: "Sales",
    artifacts: 2156,
    avgQuality: 78,
    stalePct: 12,
    coverage: 85,
    topType: "Playbooks",
    agentActivity: 62,
  },
  {
    team: "Marketing",
    artifacts: 1432,
    avgQuality: 82,
    stalePct: 15,
    coverage: 68,
    topType: "Brand Assets",
    agentActivity: 28,
  },
  {
    team: "Legal",
    artifacts: 876,
    avgQuality: 90,
    stalePct: 5,
    coverage: 92,
    topType: "Policies",
    agentActivity: 32,
  },
  {
    team: "Customer Success",
    artifacts: 1823,
    avgQuality: 72,
    stalePct: 18,
    coverage: 55,
    topType: "Playbooks",
    agentActivity: 41,
  },
  {
    team: "Product",
    artifacts: 1567,
    avgQuality: 80,
    stalePct: 10,
    coverage: 78,
    topType: "Specs & RFCs",
    agentActivity: 35,
  },
];

const radarData = [
  { subject: "Quality", Engineering: 84, Sales: 78, Marketing: 82 },
  { subject: "Coverage", Engineering: 72, Sales: 85, Marketing: 68 },
  { subject: "Freshness", Engineering: 92, Sales: 88, Marketing: 85 },
  { subject: "Agent Use", Engineering: 80, Sales: 90, Marketing: 65 },
  { subject: "Compliance", Engineering: 75, Sales: 70, Marketing: 78 },
];

const recommendations = [
  {
    id: "r1",
    priority: "high",
    team: "Customer Success",
    title: "18% stale artifact rate exceeds threshold",
    description: "Deploy the Customer Success agent to auto-review and flag stale playbooks. Consider assigning dedicated doc owners.",
    impact: "Estimated 25% improvement in CS documentation freshness",
  },
  {
    id: "r2",
    priority: "high",
    team: "HR",
    title: "Only 45% HR policy coverage documented",
    description: "Critical gap in employee handbook, benefits documentation, and remote work policies. Prioritize onboarding docs migration.",
    impact: "Reduce new hire ramp time by an estimated 30%",
  },
  {
    id: "r3",
    priority: "medium",
    team: "Marketing",
    title: "Brand asset quality score declining",
    description: "15% of marketing artifacts are stale. Brand consistency agent should be configured for more frequent reviews.",
    impact: "Improve brand score consistency by 12%",
  },
  {
    id: "r4",
    priority: "medium",
    team: "Engineering",
    title: "API documentation coverage gap at 72%",
    description: "28% of API endpoints lack documentation. Enable engineering standards agent to auto-detect undocumented endpoints.",
    impact: "Reduce developer onboarding time by 20%",
  },
  {
    id: "r5",
    priority: "low",
    team: "Sales",
    title: "Sales competitive intel refresh cycle too long",
    description: "Average refresh cycle is 14 days. Configure sales_ops agent to run daily competitive monitoring.",
    impact: "Keep competitive intel within 24-hour freshness",
  },
];

const priorityColors: Record<string, "danger" | "warning" | "info"> = {
  high: "danger",
  medium: "warning",
  low: "info",
};

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

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState("overview");

  const totalArtifacts = teamBreakdown.reduce((s, t) => s + t.artifacts, 0);
  const avgQuality = Math.round(teamBreakdown.reduce((s, t) => s + t.avgQuality, 0) / teamBreakdown.length);
  const avgStalePct = Math.round(teamBreakdown.reduce((s, t) => s + t.stalePct, 0) / teamBreakdown.length);

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "quality", label: "Quality" },
    { id: "coverage", label: "Coverage Gaps" },
    { id: "teams", label: "Team Breakdown" },
    { id: "recommendations", label: "Recommendations", count: recommendations.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-ink-800 tracking-tight flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-clay-400" />
          Analytics
        </h1>
        <p className="text-body-sm text-ink-300 mt-1">
          Artifact quality, coverage analysis, and team performance insights
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="Total Artifacts"
          value={totalArtifacts.toLocaleString()}
          trend="up"
          trendValue="+342"
          icon={<FileText className="w-4 h-4" />}
        />
        <StatCard
          label="Avg Quality"
          value={`${avgQuality}%`}
          trend="up"
          trendValue="+2.1%"
          icon={<TrendingUp className="w-4 h-4" />}
          variant="success"
        />
        <StatCard
          label="Stale Rate"
          value={`${avgStalePct}%`}
          trend="down"
          trendValue="-3%"
          icon={<Clock className="w-4 h-4" />}
          variant="warning"
        />
        <StatCard
          label="Avg Coverage"
          value="72%"
          trend="up"
          trendValue="+5%"
          icon={<Target className="w-4 h-4" />}
        />
        <StatCard
          label="Teams Active"
          value="6"
          icon={<Users className="w-4 h-4" />}
        />
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Overview */}
      <TabPanel id="overview" activeTab={activeTab}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Quality Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Quality Distribution</CardTitle>
            </CardHeader>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={qualityDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e28" />
                  <XAxis dataKey="range" tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" name="Artifacts" radius={[4, 4, 0, 0]}>
                    {qualityDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Staleness Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Staleness Heatmap (Trend)</CardTitle>
            </CardHeader>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stalenessData} stackOffset="expand" barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e28" />
                  <XAxis dataKey="week" tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v: number) => `${Math.round(v * 100)}%`} tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="fresh" stackId="a" fill="#22c55e" name="Fresh" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="aging" stackId="a" fill="#eab308" name="Aging" />
                  <Bar dataKey="stale" stackId="a" fill="#f97316" name="Stale" />
                  <Bar dataKey="critical" stackId="a" fill="#ef4444" name="Critical" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </TabPanel>

      {/* Quality */}
      <TabPanel id="quality" activeTab={activeTab}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Team Quality Comparison</CardTitle>
            </CardHeader>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                  <PolarGrid stroke="#2d2d3a" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "#6b7280", fontSize: 10 }} />
                  <Radar name="Engineering" dataKey="Engineering" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} strokeWidth={2} />
                  <Radar name="Sales" dataKey="Sales" stroke="#22c55e" fill="#22c55e" fillOpacity={0.1} strokeWidth={2} />
                  <Radar name="Marketing" dataKey="Marketing" stroke="#a855f7" fill="#a855f7" fillOpacity={0.1} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-2">
              <div className="flex items-center gap-2"><div className="w-3 h-1.5 rounded bg-clay-500" /><span className="text-xs text-ink-400">Engineering</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-1.5 rounded bg-emerald-500" /><span className="text-xs text-ink-400">Sales</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-1.5 rounded bg-heather-500" /><span className="text-xs text-ink-400">Marketing</span></div>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quality by Team</CardTitle>
            </CardHeader>
            <div className="space-y-4">
              {teamBreakdown.sort((a, b) => b.avgQuality - a.avgQuality).map((team) => (
                <div key={team.team} className="flex items-center gap-3">
                  <span className="text-xs text-ink-400 w-28 shrink-0">{team.team}</span>
                  <div className="flex-1 h-3 rounded-full bg-ink-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        team.avgQuality >= 85 ? "bg-emerald-400" : team.avgQuality >= 75 ? "bg-yellow-400" : "bg-red-400"
                      }`}
                      style={{ width: `${team.avgQuality}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-ink-600 w-10 text-right">{team.avgQuality}%</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </TabPanel>

      {/* Coverage Gaps */}
      <TabPanel id="coverage" activeTab={activeTab}>
        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Knowledge Coverage by Area</CardTitle>
            </CardHeader>
            <div className="space-y-4">
              {coverageData.sort((a, b) => a.covered - b.covered).map((area) => (
                <div key={area.area} className="flex items-center gap-4">
                  <span className="text-sm text-ink-400 w-36 shrink-0">{area.area}</span>
                  <div className="flex-1 h-4 rounded-full bg-ink-100 overflow-hidden relative">
                    <div
                      className={`h-full rounded-full transition-all ${
                        area.covered >= 80
                          ? "bg-emerald-400/80"
                          : area.covered >= 60
                          ? "bg-yellow-400/80"
                          : "bg-red-400/80"
                      }`}
                      style={{ width: `${area.covered}%` }}
                    />
                  </div>
                  <span className={`text-sm font-medium w-12 text-right ${
                    area.covered >= 80 ? "text-olive-600" : area.covered >= 60 ? "text-yellow-400" : "text-red-400"
                  }`}>
                    {area.covered}%
                  </span>
                  {area.covered < 60 && (
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </TabPanel>

      {/* Team Breakdown */}
      <TabPanel id="teams" activeTab={activeTab}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-6">
          {teamBreakdown.map((team) => (
            <Card key={team.team}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-clay-500/15 flex items-center justify-center">
                  <Users className="w-5 h-5 text-clay-400" />
                </div>
                <div>
                  <h3 className="text-sm font-serif text-ink-700">{team.team}</h3>
                  <span className="text-xs text-ink-300">{team.artifacts.toLocaleString()} artifacts</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded-lg bg-ink-50/50">
                  <div className="text-lg font-bold text-ink-800">{team.avgQuality}%</div>
                  <div className="text-2xs text-ink-300">Avg Quality</div>
                </div>
                <div className="p-2.5 rounded-lg bg-ink-50/50">
                  <div className={`text-lg font-bold ${team.stalePct > 15 ? "text-red-400" : team.stalePct > 10 ? "text-yellow-400" : "text-olive-600"}`}>
                    {team.stalePct}%
                  </div>
                  <div className="text-2xs text-ink-300">Stale Rate</div>
                </div>
                <div className="p-2.5 rounded-lg bg-ink-50/50">
                  <div className="text-lg font-bold text-ink-800">{team.coverage}%</div>
                  <div className="text-2xs text-ink-300">Coverage</div>
                </div>
                <div className="p-2.5 rounded-lg bg-ink-50/50">
                  <div className="text-lg font-bold text-clay-500">{team.agentActivity}</div>
                  <div className="text-2xs text-ink-300">Agent PRs</div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-ink-100 flex items-center justify-between text-xs">
                <span className="text-ink-300">Top type:</span>
                <Badge variant="outline" size="sm">{team.topType}</Badge>
              </div>
            </Card>
          ))}
        </div>
      </TabPanel>

      {/* Recommendations */}
      <TabPanel id="recommendations" activeTab={activeTab}>
        <div className="mt-6 space-y-3">
          {recommendations.map((rec) => (
            <Card key={rec.id}>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/15 flex items-center justify-center shrink-0">
                  <Lightbulb className="w-5 h-5 text-yellow-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={priorityColors[rec.priority]} size="sm">
                      {rec.priority}
                    </Badge>
                    <Badge variant="outline" size="sm">{rec.team}</Badge>
                  </div>
                  <h3 className="text-sm font-serif text-ink-700">{rec.title}</h3>
                  <p className="text-xs text-ink-300 mt-1">{rec.description}</p>
                  <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-clay-50/30 border border-clay-500/20">
                    <TrendingUp className="w-3.5 h-3.5 text-clay-400 shrink-0" />
                    <span className="text-xs text-clay-500">{rec.impact}</span>
                  </div>
                </div>
                <Button variant="secondary" size="sm">
                  Take Action
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </TabPanel>
    </div>
  );
}
