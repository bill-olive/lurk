"use client";

import { useState } from "react";
import {
  Bot,
  Search,
  Play,
  Pause,
  Settings,
  Sparkles,
  Zap,
  Activity,
  Clock,
  GitPullRequest,
  XCircle,
  ChevronDown,
  ChevronRight,
  Pencil,
  X,
  Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabPanel } from "@/components/ui/tabs";

// -- Types ----------------------------------------------------

interface Agent {
  id: string;
  name: string;
  displayName: string;
  type: "marketplace" | "custom" | "skill";
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
  prompt: string;
}

// -- Skill Prompts --------------------------------------------

const SKILL_PROMPTS = {
  "artifact-reviewer":
    "You are an artifact reviewer for the Lurk platform. When invoked, you analyze diffs between artifact versions and provide structured editorial feedback. Your goal is to ensure every artifact revision improves clarity, completeness, and consistency.\n\nAnalyze: diff inspection, clarity, completeness, consistency, and accuracy.\n\nReview severity levels: blocker (must resolve), suggestion (recommended), nit (minor stylistic).\n\nProduce structured review with Location, Severity, Comment, and Suggested fix for each finding. End with verdict: Approve, Approve with suggestions, or Request revisions.",
  "privacy-scanner":
    "You are a privacy scanner for the Lurk platform. Systematically scan artifact content for PII and privacy-sensitive data.\n\nDetect: Direct identifiers (names, emails, SSNs, CC numbers), Quasi-identifiers (addresses, DOB, IPs), Sensitive attributes (health info, salary, API keys), Contextual PII (job titles in small teams, location + timestamp).\n\nSensitivity levels: CRITICAL (direct identifiers), HIGH (quasi-identifiers), MEDIUM (sensitive attributes), LOW (contextual).\n\nFor each finding report: Location, Category, Sensitivity, Content (masked), and Recommendation. Never reproduce full PII in output.",
  "knowledge-synthesizer":
    "You are a knowledge synthesizer for the Lurk platform. Read across multiple artifacts to produce unified synthesis documents, identify gaps, and surface contradictions.\n\nMethodology: Gather scope, extract claims with source attribution, cluster themes (decisions, requirements, open questions, timelines, risks, stakeholder positions), detect conflicts, identify gaps.\n\nConflict types: Direct contradiction, Partial contradiction, Stale information, Ambiguity.\n\nProduce: Overview, Key themes with citations, Conflicts table, Knowledge gaps prioritized by impact, Timeline, and Recommendations.",
  "customer-health-analyzer":
    "You are a customer health analyzer for the Lurk platform. Review customer-facing artifacts and communications to produce health assessments.\n\nSignal categories: Engagement (30%), Sentiment (25%), Product adoption (25%), Business context (20%).\n\nHealth tiers: Healthy (75-100), Neutral (50-74), At risk (25-49), Critical (0-24).\n\nProduce health report with: Score and tier, Signal breakdown, Trend vs previous period, Risk factors ranked by severity, 2-5 concrete recommended actions with owner and urgency.",
  "doc-change-tracker":
    "You are a document change tracker for the Lurk platform. Detect changes in connected Google Docs, generate diff summaries, and create versioned artifact revisions.\n\nDetect: Content changes (added/deleted/modified), Structure changes (headings, sections), Formatting changes (meaningful only), Metadata changes.\n\nCommit format: <type>(<scope>): <description>. Types: update, add, remove, restructure, fix, format.\n\nBatch rapid saves (within 5 minutes) into single revisions. Flag concurrent edits. Every revision must be self-contained.",
} as const;

const DEFAULT_PROMPT = "No custom prompt configured. Click Edit to add instructions.";

// -- Mock Data ------------------------------------------------

const initialAgents: Agent[] = [
  // Existing mock agents
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
    prompt: DEFAULT_PROMPT,
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
    prompt: DEFAULT_PROMPT,
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
    prompt: DEFAULT_PROMPT,
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
    prompt: DEFAULT_PROMPT,
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
    prompt: DEFAULT_PROMPT,
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
    prompt: DEFAULT_PROMPT,
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
    prompt: DEFAULT_PROMPT,
  },
  // Skill-based agents
  {
    id: "skill_1",
    name: "artifact-reviewer",
    displayName: "Artifact Reviewer",
    type: "skill",
    status: "active",
    model: "claude-sonnet-4-20250514",
    acceptRate: 96,
    prsOpened: 63,
    prsThisWeek: 12,
    yoloEnabled: false,
    yoloThreshold: 0.0,
    lastActive: "5 min ago",
    description:
      "Reviews artifact submissions (pull requests) and provides editorial feedback on changes. Evaluates clarity, completeness, and consistency of document revisions.",
    scopes: ["artifacts", "editorial"],
    prompt: SKILL_PROMPTS["artifact-reviewer"],
  },
  {
    id: "skill_2",
    name: "privacy-scanner",
    displayName: "Privacy Scanner",
    type: "skill",
    status: "active",
    model: "claude-sonnet-4-20250514",
    acceptRate: 99,
    prsOpened: 41,
    prsThisWeek: 7,
    yoloEnabled: false,
    yoloThreshold: 0.0,
    lastActive: "12 min ago",
    description:
      "Scans artifacts for personally identifiable information (PII) and privacy policy violations. Flags sensitive content and suggests redactions.",
    scopes: ["privacy", "compliance"],
    prompt: SKILL_PROMPTS["privacy-scanner"],
  },
  {
    id: "skill_3",
    name: "knowledge-synthesizer",
    displayName: "Knowledge Synthesizer",
    type: "skill",
    status: "active",
    model: "claude-sonnet-4-20250514",
    acceptRate: 91,
    prsOpened: 28,
    prsThisWeek: 4,
    yoloEnabled: false,
    yoloThreshold: 0.0,
    lastActive: "18 min ago",
    description:
      "Analyzes multiple related artifacts to create synthesis documents, identify knowledge gaps, and surface conflicting information across the knowledge base.",
    scopes: ["knowledge", "research"],
    prompt: SKILL_PROMPTS["knowledge-synthesizer"],
  },
  {
    id: "skill_4",
    name: "customer-health-analyzer",
    displayName: "Customer Health Analyzer",
    type: "skill",
    status: "active",
    model: "claude-sonnet-4-20250514",
    acceptRate: 93,
    prsOpened: 35,
    prsThisWeek: 9,
    yoloEnabled: false,
    yoloThreshold: 0.0,
    lastActive: "7 min ago",
    description:
      "Monitors customer-facing artifacts and communications to assess customer health scores, detect churn signals, and recommend proactive interventions.",
    scopes: ["customer_success", "analytics"],
    prompt: SKILL_PROMPTS["customer-health-analyzer"],
  },
  {
    id: "skill_5",
    name: "doc-change-tracker",
    displayName: "Doc Change Tracker",
    type: "skill",
    status: "active",
    model: "claude-sonnet-4-20250514",
    acceptRate: 95,
    prsOpened: 52,
    prsThisWeek: 11,
    yoloEnabled: false,
    yoloThreshold: 0.0,
    lastActive: "3 min ago",
    description:
      "Monitors connected Google Docs for changes and automatically creates versioned artifact revisions with detailed change notes. Each save becomes a tracked commit.",
    scopes: ["docs", "versioning"],
    prompt: SKILL_PROMPTS["doc-change-tracker"],
  },
];

const activityLog = [
  { time: "2 min ago", agent: "sales_ops", action: "Updated Q1 Sales Playbook", type: "pr_opened" },
  { time: "3 min ago", agent: "doc-change-tracker", action: "Tracked 4 Google Doc revisions", type: "pr_opened" },
  { time: "5 min ago", agent: "artifact-reviewer", action: "Reviewed RFC-0042 revision", type: "report" },
  { time: "7 min ago", agent: "customer-health-analyzer", action: "Generated health score for Stripe", type: "report" },
  { time: "8 min ago", agent: "compliance", action: "Flagged outdated GDPR policy", type: "alert" },
  { time: "12 min ago", agent: "privacy-scanner", action: "Flagged PII in onboarding doc", type: "block" },
  { time: "15 min ago", agent: "brand_consistency", action: "Merged brand voice update", type: "pr_merged" },
  { time: "18 min ago", agent: "knowledge-synthesizer", action: "Synthesized Q1 planning artifacts", type: "report" },
  { time: "22 min ago", agent: "security", action: "Blocked API key exposure", type: "block" },
  { time: "34 min ago", agent: "customer_success", action: "Generated health report for Acme", type: "report" },
  { time: "1 hr ago", agent: "sales_ops", action: "Refreshed competitive analysis", type: "pr_opened" },
  { time: "1.5 hr ago", agent: "compliance", action: "Updated SOC2 evidence doc", type: "pr_merged" },
];

const statusColors = {
  active: "success" as const,
  paused: "warning" as const,
  disabled: "default" as const,
  error: "danger" as const,
};

const typeLabels: Record<string, string> = {
  marketplace: "Marketplace",
  custom: "Custom",
  skill: "Skill",
};

// -- Helpers --------------------------------------------------

/** Render prompt text with \n as paragraph breaks */
function PromptDisplay({ text }: { text: string }) {
  const paragraphs = text.split("\n\n");
  return (
    <div className="space-y-3">
      {paragraphs.map((para, i) => {
        // Check if paragraph contains sub-lines
        const lines = para.split("\n").filter(Boolean);
        if (lines.length > 1) {
          return (
            <div key={i} className="space-y-1">
              {lines.map((line, j) => (
                <p key={j} className="text-body-sm text-ink-500 leading-relaxed">
                  {line}
                </p>
              ))}
            </div>
          );
        }
        return (
          <p key={i} className="text-body-sm text-ink-500 leading-relaxed">
            {para}
          </p>
        );
      })}
    </div>
  );
}

// -- Page -----------------------------------------------------

export default function AgentsPage() {
  const [activeTab, setActiveTab] = useState("agents");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState("");
  const [agentPrompts, setAgentPrompts] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    initialAgents.forEach((a) => {
      map[a.id] = a.prompt;
    });
    return map;
  });

  const filteredAgents = initialAgents.filter((a) => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (
      searchQuery &&
      !a.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !a.displayName.toLowerCase().includes(searchQuery.toLowerCase())
    )
      return false;
    return true;
  });

  const tabs = [
    { id: "agents", label: "All Agents", count: initialAgents.length },
    { id: "activity", label: "Activity Log", count: activityLog.length },
  ];

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setEditingId(null);
    } else {
      setExpandedId(id);
      setEditingId(null);
    }
  };

  const startEditing = (agent: Agent) => {
    setEditingId(agent.id);
    setEditBuffer(agentPrompts[agent.id] ?? agent.prompt);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditBuffer("");
  };

  const savePrompt = (agentId: string) => {
    setAgentPrompts((prev) => ({ ...prev, [agentId]: editBuffer }));
    setEditingId(null);
    setEditBuffer("");
  };

  return (
    <div className="max-w-content mx-auto">
      {/* Page Header */}
      <div className="pt-2 pb-6">
        <h1 className="font-serif text-heading-2 text-ink-800 tracking-tight">
          Agents
        </h1>
        <p className="text-body-sm text-ink-400 mt-1">
          Deploy, configure, and monitor knowledge agents across your workspace.
        </p>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Agents Tab */}
      <TabPanel id="agents" activeTab={activeTab}>
        {/* Filters */}
        <div className="flex items-center gap-3 mt-6 mb-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" />
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

        {/* Agent List */}
        <div className="mt-4">
          {filteredAgents.map((agent, idx) => {
            const isExpanded = expandedId === agent.id;
            const isEditing = editingId === agent.id;
            const currentPrompt = agentPrompts[agent.id] ?? agent.prompt;

            return (
              <div key={agent.id}>
                {/* Hairline divider */}
                {idx > 0 && (
                  <div
                    className="w-full"
                    style={{ borderTop: "0.5px solid #d1cfc5" }}
                  />
                )}

                {/* Agent Row */}
                <div
                  className="flex items-center gap-4 py-4 px-1 cursor-pointer transition-colors hover:bg-ivory-100/50"
                  onClick={() => toggleExpand(agent.id)}
                >
                  {/* Expand chevron */}
                  <div className="shrink-0 w-4 text-ink-300">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </div>

                  {/* Name + description */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-serif text-sm font-semibold text-ink-800 truncate">
                        {agent.displayName}
                      </h3>
                      {agent.yoloEnabled && (
                        <span className="flex items-center gap-0.5 text-2xs font-medium text-accent-yellow">
                          <Zap className="w-3 h-3" />
                          YOLO
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-400 mt-0.5 truncate max-w-xl">
                      {agent.description}
                    </p>
                  </div>

                  {/* Status badge */}
                  <div className="shrink-0">
                    <Badge variant={statusColors[agent.status]} dot size="sm">
                      {agent.status}
                    </Badge>
                  </div>

                  {/* Type badge */}
                  <div className="shrink-0">
                    <Badge
                      variant={
                        agent.type === "skill"
                          ? "purple"
                          : agent.type === "custom"
                            ? "info"
                            : "default"
                      }
                      size="sm"
                    >
                      {typeLabels[agent.type] ?? agent.type}
                    </Badge>
                  </div>

                  {/* Model */}
                  <div className="shrink-0 hidden md:block">
                    <span className="text-2xs font-mono text-ink-300">
                      {agent.model}
                    </span>
                  </div>

                  {/* Last active */}
                  <div className="shrink-0 hidden lg:flex items-center gap-1 text-xs text-ink-300">
                    <Clock className="w-3 h-3" />
                    {agent.lastActive}
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="pb-5 pl-9 pr-2 animate-fade-in">
                    {/* Metrics row */}
                    <div className="flex items-center gap-8 mb-5 text-xs text-ink-400">
                      <span>
                        <span className="font-semibold text-ink-700">{agent.acceptRate}%</span>{" "}
                        accept rate
                      </span>
                      <span>
                        <span className="font-semibold text-ink-700">{agent.prsOpened}</span>{" "}
                        total PRs
                      </span>
                      <span>
                        <span className="font-semibold text-ink-700">{agent.prsThisWeek}</span>{" "}
                        this week
                      </span>
                      <span className="hidden sm:inline">
                        Scopes:{" "}
                        {agent.scopes.map((s, i) => (
                          <span key={s}>
                            {i > 0 && ", "}
                            <span className="text-ink-500">{s}</span>
                          </span>
                        ))}
                      </span>
                    </div>

                    {/* Prompt section */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-semibold text-ink-400 uppercase tracking-wider">
                          Prompt / Instructions
                        </h4>
                        {!isEditing && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditing(agent);
                            }}
                            className="flex items-center gap-1 text-xs text-clay-500 hover:text-clay-700 transition-colors"
                          >
                            <Pencil className="w-3 h-3" />
                            Edit Prompt
                          </button>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                          <textarea
                            value={editBuffer}
                            onChange={(e) => setEditBuffer(e.target.value)}
                            rows={10}
                            className="w-full bg-ivory-50 border border-ink-200 rounded-sm px-3 py-2.5 text-body-sm text-ink-600 font-mono leading-relaxed focus:outline-none focus:border-clay-400 focus:ring-1 focus:ring-clay-300/30 resize-y"
                            placeholder="Enter agent instructions..."
                          />
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="primary"
                              icon={<Check className="w-3 h-3" />}
                              onClick={() => savePrompt(agent.id)}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={<X className="w-3 h-3" />}
                              onClick={cancelEditing}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="bg-ivory-50/50 border-l-2 border-ink-100 pl-4 py-3 pr-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <PromptDisplay text={currentPrompt} />
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div
                      className="flex items-center gap-2 mt-4 pt-3"
                      style={{ borderTop: "0.5px solid #d1cfc5" }}
                    >
                      {agent.status === "active" ? (
                        <Button
                          size="xs"
                          variant="ghost"
                          icon={<Pause className="w-3 h-3" />}
                          onClick={(e) => e.stopPropagation()}
                        >
                          Pause
                        </Button>
                      ) : (
                        <Button
                          size="xs"
                          variant="ghost"
                          icon={<Play className="w-3 h-3" />}
                          onClick={(e) => e.stopPropagation()}
                        >
                          Resume
                        </Button>
                      )}
                      <Button
                        size="xs"
                        variant="ghost"
                        icon={<Settings className="w-3 h-3" />}
                        onClick={(e) => e.stopPropagation()}
                      >
                        Configure
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Bottom hairline */}
          {filteredAgents.length > 0 && (
            <div
              className="w-full"
              style={{ borderTop: "0.5px solid #d1cfc5" }}
            />
          )}

          {filteredAgents.length === 0 && (
            <div className="py-12 text-center text-sm text-ink-300">
              No agents match your filters.
            </div>
          )}
        </div>
      </TabPanel>

      {/* Activity Log Tab */}
      <TabPanel id="activity" activeTab={activeTab}>
        <div className="mt-6">
          {activityLog.map((entry, idx) => (
            <div key={idx}>
              {idx > 0 && (
                <div
                  className="w-full"
                  style={{ borderTop: "0.5px solid #d1cfc5" }}
                />
              )}
              <div className="flex items-center gap-4 py-3 px-1">
                <div className="w-7 h-7 rounded-sm bg-ink-50 flex items-center justify-center shrink-0">
                  {entry.type === "pr_opened" && (
                    <GitPullRequest className="w-3.5 h-3.5 text-accent-blue" />
                  )}
                  {entry.type === "pr_merged" && (
                    <GitPullRequest className="w-3.5 h-3.5 text-olive-600" />
                  )}
                  {entry.type === "alert" && (
                    <Activity className="w-3.5 h-3.5 text-accent-yellow" />
                  )}
                  {entry.type === "block" && (
                    <XCircle className="w-3.5 h-3.5 text-accent-red" />
                  )}
                  {entry.type === "report" && (
                    <Sparkles className="w-3.5 h-3.5 text-clay-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="purple" size="sm">
                      {entry.agent}
                    </Badge>
                    <span className="text-sm text-ink-600">{entry.action}</span>
                  </div>
                </div>
                <span className="text-xs text-ink-300 shrink-0">{entry.time}</span>
              </div>
            </div>
          ))}
        </div>
      </TabPanel>
    </div>
  );
}
