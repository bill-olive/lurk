"use client";

import { useState } from "react";
import {
  ArrowLeftRight,
  Plus,
  Search,
  Upload,
  Bot,
  Globe,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  FileText,
  BarChart3,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Tabs, TabPanel } from "@/components/ui/tabs";

// ── Types ────────────────────────────────────

interface Platform {
  id: string;
  name: string;
  icon: string;
  description: string;
  supported: boolean;
  connected: boolean;
}

interface MigrationJob {
  id: string;
  platform: string;
  mode: "api_import" | "agentic_crawl" | "file_upload";
  scope: string;
  status: "running" | "completed" | "failed" | "paused" | "queued";
  progress: number;
  artifactsImported: number;
  artifactsTotal: number;
  startedAt: string;
  estimatedCompletion?: string;
  errors: number;
}

// ── Mock Data ────────────────────────────────

const platforms: Platform[] = [
  { id: "slack", name: "Slack", icon: "#", description: "Import messages, threads, and channel history", supported: true, connected: true },
  { id: "google_drive", name: "Google Drive", icon: "G", description: "Import documents, sheets, and slides", supported: true, connected: true },
  { id: "notion", name: "Notion", icon: "N", description: "Import pages, databases, and wikis", supported: true, connected: false },
  { id: "gmail", name: "Gmail", icon: "@", description: "Import email threads and attachments", supported: true, connected: true },
  { id: "jira", name: "Jira", icon: "J", description: "Import tickets, epics, and project data", supported: true, connected: false },
  { id: "linear", name: "Linear", icon: "L", description: "Import issues, projects, and documents", supported: true, connected: false },
  { id: "github", name: "GitHub", icon: "GH", description: "Import repos, issues, wikis, and discussions", supported: true, connected: true },
  { id: "confluence", name: "Confluence", icon: "C", description: "Import spaces, pages, and blog posts", supported: true, connected: false },
];

const migrationJobs: MigrationJob[] = [
  {
    id: "mig_1",
    platform: "Slack",
    mode: "api_import",
    scope: "#sales, #marketing, #product channels",
    status: "running",
    progress: 67,
    artifactsImported: 1247,
    artifactsTotal: 1860,
    startedAt: "2 hours ago",
    estimatedCompletion: "45 min",
    errors: 3,
  },
  {
    id: "mig_2",
    platform: "Google Drive",
    mode: "api_import",
    scope: "Sales Team Shared Drive",
    status: "completed",
    progress: 100,
    artifactsImported: 892,
    artifactsTotal: 892,
    startedAt: "1 day ago",
    errors: 0,
  },
  {
    id: "mig_3",
    platform: "GitHub",
    mode: "agentic_crawl",
    scope: "org/main-repo wiki + discussions",
    status: "running",
    progress: 34,
    artifactsImported: 156,
    artifactsTotal: 460,
    startedAt: "30 min ago",
    estimatedCompletion: "1.5 hours",
    errors: 1,
  },
  {
    id: "mig_4",
    platform: "Gmail",
    mode: "api_import",
    scope: "Customer-facing threads (90 days)",
    status: "paused",
    progress: 45,
    artifactsImported: 342,
    artifactsTotal: 760,
    startedAt: "3 hours ago",
    errors: 12,
  },
  {
    id: "mig_5",
    platform: "Confluence",
    mode: "file_upload",
    scope: "Engineering Space export",
    status: "queued",
    progress: 0,
    artifactsImported: 0,
    artifactsTotal: 0,
    startedAt: "Queued",
    errors: 0,
  },
  {
    id: "mig_6",
    platform: "Slack",
    mode: "api_import",
    scope: "#engineering, #devops channels",
    status: "completed",
    progress: 100,
    artifactsImported: 2103,
    artifactsTotal: 2103,
    startedAt: "3 days ago",
    errors: 7,
  },
  {
    id: "mig_7",
    platform: "Notion",
    mode: "agentic_crawl",
    scope: "Product wiki + team spaces",
    status: "failed",
    progress: 23,
    artifactsImported: 89,
    artifactsTotal: 387,
    startedAt: "1 day ago",
    errors: 45,
  },
];

const statusConfig = {
  running: { color: "info" as const, icon: <Play className="w-3 h-3" /> },
  completed: { color: "success" as const, icon: <CheckCircle2 className="w-3 h-3" /> },
  failed: { color: "danger" as const, icon: <XCircle className="w-3 h-3" /> },
  paused: { color: "warning" as const, icon: <Pause className="w-3 h-3" /> },
  queued: { color: "default" as const, icon: <Clock className="w-3 h-3" /> },
};

const modeLabels = {
  api_import: "API Import",
  agentic_crawl: "Agentic Crawl",
  file_upload: "File Upload",
};

// ── Page ─────────────────────────────────────

export default function MigrationPage() {
  const [activeTab, setActiveTab] = useState("jobs");
  const [showNewMigration, setShowNewMigration] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<string>("api_import");
  const [scopeInput, setScopeInput] = useState("");

  const runningJobs = migrationJobs.filter((j) => j.status === "running").length;
  const completedJobs = migrationJobs.filter((j) => j.status === "completed").length;
  const totalImported = migrationJobs.reduce((sum, j) => sum + j.artifactsImported, 0);

  const tabs = [
    { id: "jobs", label: "Migration Jobs", count: migrationJobs.length },
    { id: "platforms", label: "Connected Platforms", count: platforms.filter((p) => p.connected).length },
    { id: "reports", label: "Reports" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-800 tracking-tight flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-clay-400" />
            Migration
          </h1>
          <p className="text-sm text-ink-300 mt-1">
            Import data from external platforms into Lurk
          </p>
        </div>
        <Button
          size="sm"
          icon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => setShowNewMigration(true)}
        >
          New Migration
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-ink-100 rounded-xl p-4">
          <div className="text-2xs text-ink-300 uppercase tracking-wider mb-1">Running</div>
          <div className="text-xl font-bold text-accent-blue">{runningJobs}</div>
        </div>
        <div className="bg-white border border-ink-100 rounded-xl p-4">
          <div className="text-2xs text-ink-300 uppercase tracking-wider mb-1">Completed</div>
          <div className="text-xl font-bold text-olive-600">{completedJobs}</div>
        </div>
        <div className="bg-white border border-ink-100 rounded-xl p-4">
          <div className="text-2xs text-ink-300 uppercase tracking-wider mb-1">Total Imported</div>
          <div className="text-xl font-bold text-ink-800">{totalImported.toLocaleString()}</div>
        </div>
        <div className="bg-white border border-ink-100 rounded-xl p-4">
          <div className="text-2xs text-ink-300 uppercase tracking-wider mb-1">Platforms</div>
          <div className="text-xl font-bold text-ink-800">
            {platforms.filter((p) => p.connected).length}/{platforms.length}
          </div>
        </div>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Jobs Tab */}
      <TabPanel id="jobs" activeTab={activeTab}>
        <div className="mt-6 space-y-3">
          {migrationJobs.map((job) => (
            <Card key={job.id}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-ink-50 flex items-center justify-center text-sm font-bold text-ink-400">
                    {platforms.find((p) => p.name === job.platform)?.icon || "?"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-ink-700">
                        {job.platform}
                      </h3>
                      <Badge variant={statusConfig[job.status].color} dot size="sm">
                        {job.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" size="sm">{modeLabels[job.mode]}</Badge>
                      <span className="text-xs text-ink-300">{job.scope}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {job.status === "running" && (
                    <Button variant="ghost" size="xs" icon={<Pause className="w-3 h-3" />}>
                      Pause
                    </Button>
                  )}
                  {job.status === "paused" && (
                    <Button variant="ghost" size="xs" icon={<Play className="w-3 h-3" />}>
                      Resume
                    </Button>
                  )}
                  {job.status === "failed" && (
                    <Button variant="ghost" size="xs" icon={<RotateCcw className="w-3 h-3" />}>
                      Retry
                    </Button>
                  )}
                </div>
              </div>

              {/* Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-300">
                    {job.artifactsImported.toLocaleString()} / {job.artifactsTotal > 0 ? job.artifactsTotal.toLocaleString() : "..."} artifacts
                  </span>
                  <span className="text-ink-400 font-medium">{job.progress}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-ink-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      job.status === "failed"
                        ? "bg-accent-red"
                        : job.status === "completed"
                        ? "bg-olive-500"
                        : job.status === "paused"
                        ? "bg-accent-yellow"
                        : "bg-clay-500"
                    }`}
                    style={{ width: `${job.progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-2xs text-ink-300">
                  <span>Started {job.startedAt}</span>
                  <div className="flex items-center gap-3">
                    {job.errors > 0 && (
                      <span className="flex items-center gap-1 text-accent-red">
                        <AlertTriangle className="w-3 h-3" />
                        {job.errors} errors
                      </span>
                    )}
                    {job.estimatedCompletion && (
                      <span>ETA: {job.estimatedCompletion}</span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </TabPanel>

      {/* Platforms Tab */}
      <TabPanel id="platforms" activeTab={activeTab}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-6">
          {platforms.map((platform) => (
            <Card key={platform.id} hover>
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-ink-50 flex items-center justify-center text-sm font-bold text-ink-400">
                  {platform.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-ink-700">{platform.name}</h3>
                    {platform.connected && (
                      <Badge variant="success" size="sm" dot>Connected</Badge>
                    )}
                  </div>
                  <p className="text-xs text-ink-300 mt-0.5">{platform.description}</p>
                </div>
              </div>
              {platform.connected ? (
                <Button variant="secondary" size="sm" fullWidth>
                  Start Migration
                </Button>
              ) : (
                <Button variant="outline" size="sm" fullWidth icon={<Globe className="w-3 h-3" />}>
                  Connect
                </Button>
              )}
            </Card>
          ))}
        </div>
      </TabPanel>

      {/* Reports Tab */}
      <TabPanel id="reports" activeTab={activeTab}>
        <div className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Migration Summary</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <div className="text-2xs text-ink-300 uppercase tracking-wider mb-2">By Platform</div>
                <div className="space-y-2">
                  {["Slack", "Google Drive", "GitHub", "Gmail"].map((p) => {
                    const count = migrationJobs.filter((j) => j.platform === p).reduce((s, j) => s + j.artifactsImported, 0);
                    const total = totalImported || 1;
                    return (
                      <div key={p} className="flex items-center gap-3">
                        <span className="text-xs text-ink-400 w-24">{p}</span>
                        <div className="flex-1 h-2 rounded-full bg-ink-100 overflow-hidden">
                          <div
                            className="h-full bg-clay-500 rounded-full"
                            style={{ width: `${(count / total) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-ink-300 w-12 text-right">{count.toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="text-2xs text-ink-300 uppercase tracking-wider mb-2">By Status</div>
                <div className="space-y-2">
                  {(["completed", "running", "paused", "failed", "queued"] as const).map((status) => {
                    const count = migrationJobs.filter((j) => j.status === status).length;
                    return (
                      <div key={status} className="flex items-center justify-between">
                        <Badge variant={statusConfig[status].color} dot size="sm">{status}</Badge>
                        <span className="text-sm font-medium text-ink-600">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="text-2xs text-ink-300 uppercase tracking-wider mb-2">By Mode</div>
                <div className="space-y-2">
                  {(["api_import", "agentic_crawl", "file_upload"] as const).map((mode) => {
                    const count = migrationJobs.filter((j) => j.mode === mode).length;
                    return (
                      <div key={mode} className="flex items-center justify-between">
                        <span className="text-xs text-ink-400">{modeLabels[mode]}</span>
                        <span className="text-sm font-medium text-ink-600">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </TabPanel>

      {/* New Migration Modal */}
      <Modal
        open={showNewMigration}
        onClose={() => { setShowNewMigration(false); setSelectedPlatform(null); }}
        title="New Migration"
        description="Import data from an external platform"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowNewMigration(false)}>Cancel</Button>
            <Button
              disabled={!selectedPlatform}
              onClick={() => setShowNewMigration(false)}
            >
              Start Migration
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          {/* Platform Selection */}
          <div>
            <label className="text-xs font-medium text-ink-400 mb-3 block">Select Platform</label>
            <div className="grid grid-cols-4 gap-2">
              {platforms.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlatform(p.id)}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    selectedPlatform === p.id
                      ? "border-clay-500/40 bg-clay-50"
                      : "border-ink-100 hover:border-ink-200"
                  }`}
                >
                  <div className="text-lg font-bold text-ink-400 mb-1">{p.icon}</div>
                  <div className="text-xs text-ink-600">{p.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Mode */}
          {selectedPlatform && (
            <>
              <div>
                <label className="text-xs font-medium text-ink-400 mb-3 block">Migration Mode</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "api_import", label: "API Import", icon: <Globe className="w-5 h-5" />, desc: "Direct API connection" },
                    { id: "agentic_crawl", label: "Agentic Crawl", icon: <Bot className="w-5 h-5" />, desc: "AI-powered discovery" },
                    { id: "file_upload", label: "File Upload", icon: <Upload className="w-5 h-5" />, desc: "Upload export files" },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => setSelectedMode(mode.id)}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        selectedMode === mode.id
                          ? "border-clay-500/40 bg-clay-50"
                          : "border-ink-100 hover:border-ink-200"
                      }`}
                    >
                      <div className="text-clay-400 mb-2">{mode.icon}</div>
                      <div className="text-sm font-medium text-ink-700">{mode.label}</div>
                      <div className="text-xs text-ink-300 mt-0.5">{mode.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Scope */}
              <div>
                <label className="text-xs font-medium text-ink-400 mb-1.5 block">Scope</label>
                <textarea
                  value={scopeInput}
                  onChange={(e) => setScopeInput(e.target.value)}
                  placeholder="Define what to import (e.g., specific channels, folders, date ranges)..."
                  rows={3}
                  className="input-base w-full resize-none"
                />
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
