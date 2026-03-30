"use client";

import { useState } from "react";
import {
  ScrollText,
  Search,
  Download,
  Filter,
  Calendar,
  User,
  FileText,
  Bot,
  Shield,
  Settings,
  ArrowRight,
  ChevronDown,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabPanel } from "@/components/ui/tabs";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
  Pagination,
} from "@/components/ui/table";

// ── Types ────────────────────────────────────

interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  actorType: "user" | "agent" | "system";
  action: string;
  category: "artifact" | "agent" | "policy" | "access" | "migration" | "system";
  target: string;
  details: string;
  severity: "info" | "warning" | "critical";
}

// ── Mock Data ────────────────────────────────

const auditLog: AuditEntry[] = [
  { id: "a1", timestamp: "2026-03-29 10:32:15", actor: "sales_ops", actorType: "agent", action: "artifact.updated", category: "artifact", target: "Q1 Sales Playbook", details: "Updated competitive analysis section", severity: "info" },
  { id: "a2", timestamp: "2026-03-29 10:28:44", actor: "Sarah Chen", actorType: "user", action: "policy.changed", category: "policy", target: "Redaction Policy", details: "Increased redaction level from minimal to standard", severity: "warning" },
  { id: "a3", timestamp: "2026-03-29 10:22:01", actor: "security", actorType: "agent", action: "artifact.blocked", category: "artifact", target: "API Keys Doc", details: "Blocked exposure of AWS credentials", severity: "critical" },
  { id: "a4", timestamp: "2026-03-29 10:15:33", actor: "Mike Johnson", actorType: "user", action: "agent.created", category: "agent", target: "eng_standards", details: "Created custom agent for engineering docs", severity: "info" },
  { id: "a5", timestamp: "2026-03-29 10:08:19", actor: "compliance", actorType: "agent", action: "artifact.flagged", category: "artifact", target: "GDPR Policy 2024", details: "Flagged as potentially outdated (90+ days)", severity: "warning" },
  { id: "a6", timestamp: "2026-03-29 09:55:02", actor: "System", actorType: "system", action: "migration.completed", category: "migration", target: "Slack Import Batch #47", details: "Imported 234 messages from #sales channel", severity: "info" },
  { id: "a7", timestamp: "2026-03-29 09:42:18", actor: "Alex Rivera", actorType: "user", action: "access.granted", category: "access", target: "Customer Success Team", details: "Added Drew Kim as member", severity: "info" },
  { id: "a8", timestamp: "2026-03-29 09:30:55", actor: "brand_consistency", actorType: "agent", action: "pr.merged", category: "artifact", target: "Marketing Guidelines", details: "Auto-merged brand voice update (YOLO, confidence: 0.97)", severity: "info" },
  { id: "a9", timestamp: "2026-03-29 09:18:40", actor: "Sarah Chen", actorType: "user", action: "agent.paused", category: "agent", target: "onboarding", details: "Paused agent pending content review", severity: "warning" },
  { id: "a10", timestamp: "2026-03-29 09:05:22", actor: "System", actorType: "system", action: "kill_switch.activated", category: "system", target: "Meeting Capture", details: "Kill switch activated by admin override", severity: "critical" },
  { id: "a11", timestamp: "2026-03-29 08:50:11", actor: "customer_success", actorType: "agent", action: "report.generated", category: "artifact", target: "Acme Corp Health Report", details: "Generated weekly health report", severity: "info" },
  { id: "a12", timestamp: "2026-03-29 08:35:48", actor: "Mike Johnson", actorType: "user", action: "artifact.created", category: "artifact", target: "RFC-042: API Versioning", details: "Created new RFC document", severity: "info" },
];

const complianceReports = [
  { id: "cr1", name: "SOC2 Compliance Report", period: "Q1 2026", status: "complete", generatedAt: "2026-03-28", findings: 2 },
  { id: "cr2", name: "GDPR Data Audit", period: "March 2026", status: "complete", generatedAt: "2026-03-25", findings: 5 },
  { id: "cr3", name: "Access Control Review", period: "Q1 2026", status: "in_progress", generatedAt: "2026-03-29", findings: 0 },
  { id: "cr4", name: "Agent Activity Audit", period: "March 2026", status: "complete", generatedAt: "2026-03-27", findings: 1 },
  { id: "cr5", name: "Data Retention Audit", period: "Q1 2026", status: "scheduled", generatedAt: "2026-04-01", findings: 0 },
];

const actorTypeIcons = {
  user: <User className="w-3.5 h-3.5 text-blue-400" />,
  agent: <Bot className="w-3.5 h-3.5 text-purple-400" />,
  system: <Settings className="w-3.5 h-3.5 text-gray-400" />,
};

const severityColors = {
  info: "default" as const,
  warning: "warning" as const,
  critical: "danger" as const,
};

const categoryColors = {
  artifact: "info" as const,
  agent: "purple" as const,
  policy: "warning" as const,
  access: "success" as const,
  migration: "default" as const,
  system: "danger" as const,
};

// ── Page ─────────────────────────────────────

export default function AuditPage() {
  const [activeTab, setActiveTab] = useState("log");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [actorTypeFilter, setActorTypeFilter] = useState("all");
  const [page, setPage] = useState(1);

  const filtered = auditLog.filter((entry) => {
    if (categoryFilter !== "all" && entry.category !== categoryFilter) return false;
    if (severityFilter !== "all" && entry.severity !== severityFilter) return false;
    if (actorTypeFilter !== "all" && entry.actorType !== actorTypeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        entry.actor.toLowerCase().includes(q) ||
        entry.target.toLowerCase().includes(q) ||
        entry.details.toLowerCase().includes(q) ||
        entry.action.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const tabs = [
    { id: "log", label: "Audit Log", count: auditLog.length },
    { id: "compliance", label: "Compliance Reports", count: complianceReports.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100 tracking-tight flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-lurk-400" />
            Audit Log
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Complete audit trail of all system activity
          </p>
        </div>
        <Button variant="secondary" size="sm" icon={<Download className="w-3.5 h-3.5" />}>
          Export CSV
        </Button>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Audit Log Tab */}
      <TabPanel id="log" activeTab={activeTab}>
        <div className="mt-6">
          {/* Filters */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search audit log..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-base pl-9 w-full"
              />
            </div>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="input-base">
              <option value="all">All Categories</option>
              <option value="artifact">Artifact</option>
              <option value="agent">Agent</option>
              <option value="policy">Policy</option>
              <option value="access">Access</option>
              <option value="migration">Migration</option>
              <option value="system">System</option>
            </select>
            <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="input-base">
              <option value="all">All Severities</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
            <select value={actorTypeFilter} onChange={(e) => setActorTypeFilter(e.target.value)} className="input-base">
              <option value="all">All Actors</option>
              <option value="user">Users</option>
              <option value="agent">Agents</option>
              <option value="system">System</option>
            </select>
          </div>

          {/* Log Entries */}
          <div className="space-y-1">
            {filtered.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-4 p-3 rounded-lg hover:bg-surface-100 transition-colors group"
              >
                <div className="shrink-0 mt-0.5">
                  {actorTypeIcons[entry.actorType]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-200">{entry.actor}</span>
                    <ArrowRight className="w-3 h-3 text-gray-600" />
                    <code className="text-xs text-gray-400 font-mono bg-surface-200 px-1.5 py-0.5 rounded">
                      {entry.action}
                    </code>
                    <ArrowRight className="w-3 h-3 text-gray-600" />
                    <span className="text-sm text-gray-300">{entry.target}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{entry.details}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={categoryColors[entry.category]} size="sm">
                    {entry.category}
                  </Badge>
                  <Badge variant={severityColors[entry.severity]} size="sm">
                    {entry.severity}
                  </Badge>
                  <span className="text-2xs text-gray-600 font-mono whitespace-nowrap">
                    {entry.timestamp.split(" ")[1]}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-12">
              <p className="text-sm text-gray-500">No entries match your filters</p>
            </div>
          )}
        </div>
      </TabPanel>

      {/* Compliance Reports Tab */}
      <TabPanel id="compliance" activeTab={activeTab}>
        <div className="mt-6 space-y-3">
          {complianceReports.map((report) => (
            <Card key={report.id} hover>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-surface-200 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-lurk-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-200">{report.name}</h3>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-500">{report.period}</span>
                      <span className="text-xs text-gray-600">&middot;</span>
                      <span className="text-xs text-gray-500">Generated {report.generatedAt}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {report.findings > 0 && (
                    <Badge variant="warning" size="sm">
                      {report.findings} findings
                    </Badge>
                  )}
                  <Badge
                    variant={
                      report.status === "complete" ? "success" : report.status === "in_progress" ? "info" : "default"
                    }
                    dot
                    size="sm"
                  >
                    {report.status.replace("_", " ")}
                  </Badge>
                  {report.status === "complete" && (
                    <Button variant="ghost" size="xs" icon={<Download className="w-3 h-3" />}>
                      Download
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </TabPanel>
    </div>
  );
}
