"use client";

import { useState } from "react";
import {
  FileText,
  Search,
  Filter,
  Eye,
  Clock,
  User,
  Tag,
  GitBranch,
  AlertTriangle,
  ChevronRight,
  Download,
  BarChart3,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabPanel } from "@/components/ui/tabs";
import { Modal } from "@/components/ui/modal";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from "@/components/ui/table";

// ── Types ────────────────────────────────────

interface Artifact {
  id: string;
  title: string;
  type: "document" | "snippet" | "meeting" | "email" | "presentation" | "spreadsheet";
  owner: string;
  team: string;
  sensitivity: "public" | "internal" | "confidential" | "restricted";
  quality: number;
  staleness: "fresh" | "aging" | "stale" | "critical";
  versions: number;
  lastUpdated: string;
  relatedCount: number;
}

// ── Mock Data ────────────────────────────────

const artifacts: Artifact[] = [
  { id: "art_1", title: "Q1 Sales Playbook", type: "document", owner: "Sarah Chen", team: "Sales", sensitivity: "internal", quality: 92, staleness: "fresh", versions: 12, lastUpdated: "2 hours ago", relatedCount: 8 },
  { id: "art_2", title: "GDPR Compliance Policy", type: "document", owner: "Casey Taylor", team: "Legal & Compliance", sensitivity: "confidential", quality: 88, staleness: "aging", versions: 7, lastUpdated: "5 days ago", relatedCount: 4 },
  { id: "art_3", title: "API Reference v4.2", type: "document", owner: "Mike Johnson", team: "Engineering", sensitivity: "internal", quality: 95, staleness: "fresh", versions: 24, lastUpdated: "1 hour ago", relatedCount: 15 },
  { id: "art_4", title: "Weekly Sales Meeting Notes", type: "meeting", owner: "Alex Rivera", team: "Sales", sensitivity: "internal", quality: 72, staleness: "fresh", versions: 1, lastUpdated: "3 hours ago", relatedCount: 2 },
  { id: "art_5", title: "Brand Voice Guidelines", type: "document", owner: "Jordan Lee", team: "Marketing", sensitivity: "public", quality: 96, staleness: "fresh", versions: 5, lastUpdated: "1 day ago", relatedCount: 12 },
  { id: "art_6", title: "Customer Onboarding Checklist", type: "document", owner: "Drew Kim", team: "Customer Success", sensitivity: "internal", quality: 64, staleness: "stale", versions: 3, lastUpdated: "32 days ago", relatedCount: 6 },
  { id: "art_7", title: "Infrastructure Runbook", type: "document", owner: "Pat Morgan", team: "Engineering", sensitivity: "restricted", quality: 78, staleness: "aging", versions: 9, lastUpdated: "12 days ago", relatedCount: 7 },
  { id: "art_8", title: "Pricing Sheet 2026", type: "spreadsheet", owner: "Sarah Chen", team: "Sales", sensitivity: "confidential", quality: 85, staleness: "fresh", versions: 4, lastUpdated: "6 hours ago", relatedCount: 3 },
  { id: "art_9", title: "Security Incident Response", type: "document", owner: "Mike Johnson", team: "Engineering", sensitivity: "restricted", quality: 45, staleness: "critical", versions: 2, lastUpdated: "90 days ago", relatedCount: 5 },
  { id: "art_10", title: "Product Roadmap Q2", type: "presentation", owner: "Pat Morgan", team: "Product", sensitivity: "confidential", quality: 82, staleness: "aging", versions: 6, lastUpdated: "8 days ago", relatedCount: 9 },
  { id: "art_11", title: "Customer Email Template", type: "email", owner: "Alex Rivera", team: "Customer Success", sensitivity: "internal", quality: 70, staleness: "stale", versions: 2, lastUpdated: "45 days ago", relatedCount: 1 },
  { id: "art_12", title: "API Auth Code Snippet", type: "snippet", owner: "Mike Johnson", team: "Engineering", sensitivity: "internal", quality: 90, staleness: "fresh", versions: 8, lastUpdated: "4 hours ago", relatedCount: 11 },
];

const typeIcons: Record<string, string> = {
  document: "text-blue-400",
  snippet: "text-purple-400",
  meeting: "text-cyan-400",
  email: "text-green-400",
  presentation: "text-orange-400",
  spreadsheet: "text-emerald-400",
};

const stalenessColors = {
  fresh: "success" as const,
  aging: "warning" as const,
  stale: "danger" as const,
  critical: "danger" as const,
};

const sensitivityColors = {
  public: "default" as const,
  internal: "info" as const,
  confidential: "warning" as const,
  restricted: "danger" as const,
};

// ── Quality Heatmap ──────────────────────────

const heatmapTeams = ["Engineering", "Sales", "Marketing", "Legal", "CS", "Product"];
const heatmapTypes = ["Docs", "Snippets", "Meetings", "Emails"];
const heatmapData: number[][] = [
  [92, 88, 76, 70],
  [78, 65, 72, 80],
  [95, 60, 68, 85],
  [88, 72, 55, 90],
  [70, 58, 82, 75],
  [82, 90, 66, 78],
];

function getHeatColor(value: number): string {
  if (value >= 90) return "bg-emerald-500/40 text-emerald-300";
  if (value >= 80) return "bg-emerald-500/20 text-emerald-400";
  if (value >= 70) return "bg-yellow-500/20 text-yellow-400";
  if (value >= 60) return "bg-orange-500/20 text-orange-400";
  return "bg-red-500/20 text-red-400";
}

// ── Relationship Graph ───────────────────────

const relationshipNodes = [
  { id: "center", label: "Q1 Sales Playbook", x: 200, y: 150 },
  { id: "r1", label: "Pricing Sheet", x: 60, y: 60 },
  { id: "r2", label: "Competitive Intel", x: 340, y: 60 },
  { id: "r3", label: "Win/Loss Report", x: 60, y: 240 },
  { id: "r4", label: "Sales Training", x: 340, y: 240 },
  { id: "r5", label: "Customer Profiles", x: 200, y: 30 },
  { id: "r6", label: "Demo Script", x: 200, y: 270 },
];

// ── Page ─────────────────────────────────────

export default function ArtifactsPage() {
  const [activeTab, setActiveTab] = useState("explorer");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [stalenessFilter, setStalenessFilter] = useState("all");
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);

  const filtered = artifacts.filter((a) => {
    if (typeFilter !== "all" && a.type !== typeFilter) return false;
    if (teamFilter !== "all" && a.team !== teamFilter) return false;
    if (stalenessFilter !== "all" && a.staleness !== stalenessFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return a.title.toLowerCase().includes(q) || a.owner.toLowerCase().includes(q);
    }
    return true;
  });

  const tabs = [
    { id: "explorer", label: "Explorer", count: artifacts.length },
    { id: "relationships", label: "Relationships" },
    { id: "quality", label: "Quality Heatmap" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100 tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-lurk-400" />
            Artifact Explorer
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Browse, filter, and inspect all knowledge artifacts
          </p>
        </div>
        <Button variant="secondary" size="sm" icon={<Download className="w-3.5 h-3.5" />}>
          Export
        </Button>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Explorer Tab */}
      <TabPanel id="explorer" activeTab={activeTab}>
        <div className="mt-6">
          {/* Filters */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search artifacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-base pl-9 w-full"
              />
            </div>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input-base">
              <option value="all">All Types</option>
              <option value="document">Documents</option>
              <option value="snippet">Snippets</option>
              <option value="meeting">Meetings</option>
              <option value="email">Emails</option>
              <option value="presentation">Presentations</option>
              <option value="spreadsheet">Spreadsheets</option>
            </select>
            <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className="input-base">
              <option value="all">All Teams</option>
              <option value="Engineering">Engineering</option>
              <option value="Sales">Sales</option>
              <option value="Marketing">Marketing</option>
              <option value="Legal & Compliance">Legal</option>
              <option value="Customer Success">CS</option>
              <option value="Product">Product</option>
            </select>
            <select value={stalenessFilter} onChange={(e) => setStalenessFilter(e.target.value)} className="input-base">
              <option value="all">All Freshness</option>
              <option value="fresh">Fresh</option>
              <option value="aging">Aging</option>
              <option value="stale">Stale</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          {/* Table */}
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>Artifact</TableHeaderCell>
                <TableHeaderCell>Type</TableHeaderCell>
                <TableHeaderCell>Owner</TableHeaderCell>
                <TableHeaderCell>Team</TableHeaderCell>
                <TableHeaderCell>Sensitivity</TableHeaderCell>
                <TableHeaderCell>Quality</TableHeaderCell>
                <TableHeaderCell>Freshness</TableHeaderCell>
                <TableHeaderCell>Updated</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {filtered.map((artifact) => (
                <TableRow
                  key={artifact.id}
                  onClick={() => setSelectedArtifact(artifact)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className={`w-4 h-4 ${typeIcons[artifact.type]}`} />
                      <span className="font-medium text-gray-200 truncate max-w-[200px]">
                        {artifact.title}
                      </span>
                      {artifact.staleness === "critical" && (
                        <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" size="sm">{artifact.type}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-gray-400">{artifact.owner}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-gray-400">{artifact.team}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={sensitivityColors[artifact.sensitivity]} size="sm">
                      {artifact.sensitivity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-surface-300 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            artifact.quality >= 80
                              ? "bg-emerald-400"
                              : artifact.quality >= 60
                              ? "bg-yellow-400"
                              : "bg-red-400"
                          }`}
                          style={{ width: `${artifact.quality}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{artifact.quality}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={stalenessColors[artifact.staleness]} dot size="sm">
                      {artifact.staleness}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-gray-500">{artifact.lastUpdated}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </TabPanel>

      {/* Relationships Tab */}
      <TabPanel id="relationships" activeTab={activeTab}>
        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Artifact Relationship Graph</CardTitle>
            </CardHeader>
            <div className="relative h-80 bg-surface-200/30 rounded-lg border border-gray-800/40 overflow-hidden">
              {/* Simple SVG relationship graph */}
              <svg className="w-full h-full" viewBox="0 0 400 300">
                {/* Connections */}
                {relationshipNodes.slice(1).map((node) => (
                  <line
                    key={`line-${node.id}`}
                    x1={relationshipNodes[0].x}
                    y1={relationshipNodes[0].y}
                    x2={node.x}
                    y2={node.y}
                    stroke="#4338ca"
                    strokeWidth="1"
                    strokeOpacity="0.4"
                    strokeDasharray="4 4"
                  />
                ))}
                {/* Nodes */}
                {relationshipNodes.map((node, idx) => (
                  <g key={node.id}>
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={idx === 0 ? 28 : 20}
                      fill={idx === 0 ? "#4f46e5" : "#1e1e28"}
                      stroke={idx === 0 ? "#6366f1" : "#3a3a4a"}
                      strokeWidth="1.5"
                      opacity="0.9"
                    />
                    <text
                      x={node.x}
                      y={node.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={idx === 0 ? "#fff" : "#9ca3af"}
                      fontSize={idx === 0 ? "7" : "6"}
                      fontWeight={idx === 0 ? "600" : "400"}
                    >
                      {node.label.length > 14
                        ? node.label.slice(0, 14) + "..."
                        : node.label}
                    </text>
                  </g>
                ))}
              </svg>
              <div className="absolute bottom-3 left-3 text-2xs text-gray-600">
                Click an artifact from the explorer to view its relationships
              </div>
            </div>
          </Card>
        </div>
      </TabPanel>

      {/* Quality Heatmap Tab */}
      <TabPanel id="quality" activeTab={activeTab}>
        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Quality Heatmap by Team & Type</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-xs font-medium text-gray-500 text-left"></th>
                    {heatmapTypes.map((type) => (
                      <th key={type} className="px-4 py-2 text-xs font-medium text-gray-500 text-center">
                        {type}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmapTeams.map((team, rowIdx) => (
                    <tr key={team}>
                      <td className="px-4 py-2 text-xs font-medium text-gray-400">{team}</td>
                      {heatmapData[rowIdx].map((value, colIdx) => (
                        <td key={colIdx} className="px-2 py-1.5 text-center">
                          <div
                            className={`px-3 py-2 rounded-lg text-xs font-semibold ${getHeatColor(value)}`}
                          >
                            {value}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </TabPanel>

      {/* Artifact Detail Modal */}
      {selectedArtifact && (
        <Modal
          open={!!selectedArtifact}
          onClose={() => setSelectedArtifact(null)}
          title={selectedArtifact.title}
          description={`${selectedArtifact.type} / ${selectedArtifact.team}`}
          size="lg"
          footer={
            <>
              <Button variant="ghost" onClick={() => setSelectedArtifact(null)}>Close</Button>
              <Button variant="secondary" icon={<Eye className="w-3.5 h-3.5" />}>View Full</Button>
            </>
          }
        >
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <label className="text-2xs text-gray-500">Owner</label>
                  <div className="flex items-center gap-2 mt-1">
                    <User className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-sm text-gray-200">{selectedArtifact.owner}</span>
                  </div>
                </div>
                <div>
                  <label className="text-2xs text-gray-500">Sensitivity</label>
                  <div className="mt-1">
                    <Badge variant={sensitivityColors[selectedArtifact.sensitivity]}>
                      {selectedArtifact.sensitivity}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-2xs text-gray-500">Related Artifacts</label>
                  <p className="text-sm text-gray-200 mt-1">{selectedArtifact.relatedCount}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-2xs text-gray-500">Quality Score</label>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="w-24 h-2 rounded-full bg-surface-300 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          selectedArtifact.quality >= 80
                            ? "bg-emerald-400"
                            : selectedArtifact.quality >= 60
                            ? "bg-yellow-400"
                            : "bg-red-400"
                        }`}
                        style={{ width: `${selectedArtifact.quality}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-200">
                      {selectedArtifact.quality}/100
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-2xs text-gray-500">Version History</label>
                  <div className="flex items-center gap-2 mt-1">
                    <GitBranch className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-sm text-gray-200">{selectedArtifact.versions} versions</span>
                  </div>
                </div>
                <div>
                  <label className="text-2xs text-gray-500">Last Updated</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-sm text-gray-200">{selectedArtifact.lastUpdated}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Version timeline */}
            <div className="border-t border-gray-800/60 pt-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Recent Versions
              </h4>
              <div className="space-y-2">
                {[
                  { v: `v${selectedArtifact.versions}`, who: selectedArtifact.owner, when: selectedArtifact.lastUpdated, note: "Latest update" },
                  { v: `v${selectedArtifact.versions - 1}`, who: "Agent: sales_ops", when: "3 days ago", note: "Automated refresh" },
                  { v: `v${selectedArtifact.versions - 2}`, who: selectedArtifact.owner, when: "1 week ago", note: "Manual edit" },
                ].map((ver, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-200/30 transition-colors">
                    <Badge variant={idx === 0 ? "success" : "default"} size="sm">{ver.v}</Badge>
                    <div className="flex-1">
                      <span className="text-xs text-gray-400">{ver.who}</span>
                      <span className="text-xs text-gray-600 mx-2">&middot;</span>
                      <span className="text-xs text-gray-500">{ver.note}</span>
                    </div>
                    <span className="text-xs text-gray-600">{ver.when}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
