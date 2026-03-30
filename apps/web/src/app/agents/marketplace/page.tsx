"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  ArrowLeft,
  Search,
  Bot,
  Check,
  Star,
  Download,
  Shield,
  Briefcase,
  Palette,
  Code2,
  Heart,
  GraduationCap,
  Lock,
  Rocket,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";

// ── Types ────────────────────────────────────

interface MarketplaceAgent {
  id: string;
  name: string;
  displayName: string;
  description: string;
  longDescription: string;
  model: string;
  icon: React.ReactNode;
  capabilities: string[];
  artifactTypes: string[];
  category: string;
  popularity: number;
  rating: number;
  deployed: boolean;
}

// ── Data ─────────────────────────────────────

const marketplaceAgents: MarketplaceAgent[] = [
  {
    id: "sales_ops",
    name: "sales_ops",
    displayName: "Sales Ops",
    description: "Keeps sales playbooks, competitive intel, and pricing docs up-to-date automatically.",
    longDescription:
      "The Sales Ops agent monitors your sales documentation ecosystem, identifies outdated competitive intelligence, refreshes pricing sheets when changes are detected, and ensures your team always has the latest battle cards and playbooks. It integrates with CRM data to surface relevant customer insights.",
    model: "claude-sonnet-4-20250514",
    icon: <Briefcase className="w-6 h-6 text-accent-blue" />,
    capabilities: [
      "Competitive intel refresh",
      "Pricing doc updates",
      "Battle card generation",
      "Win/loss analysis",
      "Sales playbook maintenance",
    ],
    artifactTypes: ["documents", "snippets", "spreadsheets"],
    category: "Sales",
    popularity: 2847,
    rating: 4.8,
    deployed: true,
  },
  {
    id: "compliance",
    name: "compliance",
    displayName: "Compliance",
    description: "Monitors regulatory compliance, flags outdated policies, and ensures documentation meets standards.",
    longDescription:
      "The Compliance agent continuously monitors your documentation for regulatory adherence across GDPR, SOC2, HIPAA, and other frameworks. It flags outdated policies, suggests updates when regulations change, and maintains an audit trail of all compliance-related modifications.",
    model: "claude-sonnet-4-20250514",
    icon: <Shield className="w-6 h-6 text-olive-600" />,
    capabilities: [
      "GDPR/SOC2/HIPAA monitoring",
      "Policy staleness detection",
      "Regulatory change tracking",
      "Audit trail generation",
      "Compliance scoring",
    ],
    artifactTypes: ["documents", "policies", "procedures"],
    category: "Legal",
    popularity: 3102,
    rating: 4.9,
    deployed: true,
  },
  {
    id: "brand_consistency",
    name: "brand_consistency",
    displayName: "Brand Consistency",
    description: "Ensures brand voice, tone, and style consistency across all content artifacts.",
    longDescription:
      "The Brand Consistency agent analyzes all customer-facing and internal content for adherence to your brand guidelines. It checks tone, voice, terminology, logo usage, color references, and messaging frameworks. Automatically flags deviations and suggests corrections.",
    model: "claude-haiku-4-20250514",
    icon: <Palette className="w-6 h-6 text-heather-600" />,
    capabilities: [
      "Tone & voice analysis",
      "Terminology standardization",
      "Logo/asset usage checks",
      "Style guide enforcement",
      "Content scoring",
    ],
    artifactTypes: ["documents", "presentations", "emails"],
    category: "Marketing",
    popularity: 1923,
    rating: 4.6,
    deployed: true,
  },
  {
    id: "engineering_standards",
    name: "engineering_standards",
    displayName: "Engineering Standards",
    description: "Reviews technical documentation, enforces coding standards, and maintains ADRs and RFCs.",
    longDescription:
      "The Engineering Standards agent keeps your technical documentation ecosystem healthy. It reviews RFCs, ADRs, runbooks, and API documentation for accuracy, completeness, and adherence to team conventions. It cross-references code changes to flag stale documentation.",
    model: "claude-sonnet-4-20250514",
    icon: <Code2 className="w-6 h-6 text-orange-400" />,
    capabilities: [
      "RFC/ADR review",
      "API doc validation",
      "Runbook freshness checks",
      "Code-doc sync detection",
      "Technical writing standards",
    ],
    artifactTypes: ["documents", "code_snippets", "api_specs"],
    category: "Engineering",
    popularity: 2456,
    rating: 4.7,
    deployed: false,
  },
  {
    id: "customer_success",
    name: "customer_success",
    displayName: "Customer Success",
    description: "Generates health reports, renewal playbooks, and proactive churn risk alerts.",
    longDescription:
      "The Customer Success agent synthesizes data from your artifact ecosystem to generate customer health reports, identify churn signals in communication patterns, build renewal playbooks, and surface upsell opportunities. It monitors support tickets, meeting notes, and engagement metrics.",
    model: "claude-sonnet-4-20250514",
    icon: <Heart className="w-6 h-6 text-pink-400" />,
    capabilities: [
      "Health score generation",
      "Churn risk detection",
      "Renewal playbook creation",
      "Engagement analysis",
      "Upsell opportunity detection",
    ],
    artifactTypes: ["documents", "meetings", "emails", "tickets"],
    category: "Customer Success",
    popularity: 1845,
    rating: 4.5,
    deployed: true,
  },
  {
    id: "onboarding",
    name: "onboarding",
    displayName: "Onboarding",
    description: "Maintains onboarding guides, training materials, and new hire documentation.",
    longDescription:
      "The Onboarding agent ensures your new hire experience stays current. It monitors onboarding guides, training materials, tool setup instructions, and team wikis. When processes change, it automatically proposes updates to keep the onboarding path accurate and welcoming.",
    model: "claude-haiku-4-20250514",
    icon: <GraduationCap className="w-6 h-6 text-cyan-400" />,
    capabilities: [
      "Onboarding guide updates",
      "Training material refresh",
      "Tool setup validation",
      "Process change detection",
      "30/60/90 plan generation",
    ],
    artifactTypes: ["documents", "checklists", "guides"],
    category: "HR",
    popularity: 1234,
    rating: 4.4,
    deployed: false,
  },
  {
    id: "security",
    name: "security",
    displayName: "Security",
    description: "Scans for exposed secrets, credential leaks, and security documentation gaps.",
    longDescription:
      "The Security agent provides continuous security monitoring across your knowledge base. It scans for accidentally committed secrets, API keys, credentials, and PII. It also monitors security runbooks and incident response documentation for completeness and accuracy.",
    model: "claude-sonnet-4-20250514",
    icon: <Lock className="w-6 h-6 text-accent-red" />,
    capabilities: [
      "Secret/key detection",
      "PII scanning",
      "Security doc freshness",
      "Incident runbook validation",
      "Access pattern analysis",
    ],
    artifactTypes: ["documents", "code_snippets", "configs"],
    category: "Security",
    popularity: 3541,
    rating: 4.9,
    deployed: false,
  },
];

const categories = ["All", "Sales", "Legal", "Marketing", "Engineering", "Customer Success", "HR", "Security"];

// ── Page ─────────────────────────────────────

export default function MarketplacePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedAgent, setSelectedAgent] = useState<MarketplaceAgent | null>(null);
  const [deployingId, setDeployingId] = useState<string | null>(null);

  const filtered = marketplaceAgents.filter((agent) => {
    if (selectedCategory !== "All" && agent.category !== selectedCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        agent.displayName.toLowerCase().includes(q) ||
        agent.description.toLowerCase().includes(q) ||
        agent.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleDeploy = (agentId: string) => {
    setDeployingId(agentId);
    setTimeout(() => setDeployingId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/agents"
            className="inline-flex items-center gap-1 text-xs text-ink-300 hover:text-ink-700 transition-colors mb-2"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to Agents
          </Link>
          <h1 className="text-xl font-bold text-ink-800 tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-clay-500" />
            Agent Marketplace
          </h1>
          <p className="text-sm text-ink-300 mt-1">
            Pre-built agents ready for one-click deployment
          </p>
        </div>
      </div>

      {/* Search + Category Filter */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" />
          <input
            type="text"
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-base pl-9 w-full"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                selectedCategory === cat
                  ? "bg-clay-100 text-clay-500 border border-clay-500/30"
                  : "text-ink-300 hover:text-ink-700 hover:bg-ink-50 border border-transparent"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Agent Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((agent) => (
          <Card key={agent.id} hover onClick={() => setSelectedAgent(agent)}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-ink-50 flex items-center justify-center shrink-0">
                {agent.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-ink-700">
                    {agent.displayName}
                  </h3>
                  {agent.deployed && (
                    <Badge variant="success" size="sm">
                      <Check className="w-3 h-3 mr-0.5" />
                      Deployed
                    </Badge>
                  )}
                </div>
                <Badge variant="outline" size="sm" className="mt-1">
                  {agent.category}
                </Badge>
              </div>
            </div>

            <p className="text-xs text-ink-300 mt-3 line-clamp-2">
              {agent.description}
            </p>

            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-ink-100">
              <div className="flex items-center gap-1 text-xs text-ink-300">
                <Star className="w-3 h-3 text-accent-yellow" />
                <span>{agent.rating}</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-ink-300">
                <Download className="w-3 h-3" />
                <span>{agent.popularity.toLocaleString()}</span>
              </div>
              <span className="text-2xs text-ink-300 font-mono">
                {agent.model.replace("claude-", "").split("-").slice(0, 2).join("-")}
              </span>
            </div>
          </Card>
        ))}
      </div>

      {/* Agent Detail Modal */}
      {selectedAgent && (
        <Modal
          open={!!selectedAgent}
          onClose={() => setSelectedAgent(null)}
          title={selectedAgent.displayName}
          description={selectedAgent.category}
          size="lg"
          footer={
            <>
              <Button variant="ghost" onClick={() => setSelectedAgent(null)}>
                Cancel
              </Button>
              {selectedAgent.deployed ? (
                <Button variant="secondary" disabled icon={<Check className="w-3.5 h-3.5" />}>
                  Already Deployed
                </Button>
              ) : (
                <Button
                  icon={<Rocket className="w-3.5 h-3.5" />}
                  loading={deployingId === selectedAgent.id}
                  onClick={() => handleDeploy(selectedAgent.id)}
                >
                  Deploy Agent
                </Button>
              )}
            </>
          }
        >
          <div className="space-y-6">
            {/* Icon + Info */}
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-ink-50 flex items-center justify-center shrink-0">
                {selectedAgent.icon}
              </div>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex items-center gap-1 text-xs text-ink-300">
                    <Star className="w-3 h-3 text-accent-yellow" />
                    {selectedAgent.rating}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-ink-300">
                    <Download className="w-3 h-3" />
                    {selectedAgent.popularity.toLocaleString()} deployments
                  </div>
                </div>
                <p className="text-sm text-ink-400">
                  {selectedAgent.longDescription}
                </p>
              </div>
            </div>

            {/* Capabilities */}
            <div>
              <h4 className="text-xs font-semibold text-ink-300 uppercase tracking-wider mb-3">
                Capabilities
              </h4>
              <div className="space-y-2">
                {selectedAgent.capabilities.map((cap) => (
                  <div key={cap} className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-olive-600" />
                    <span className="text-sm text-ink-600">{cap}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Config */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-ink-100">
              <div>
                <h4 className="text-xs font-semibold text-ink-300 uppercase tracking-wider mb-2">
                  Model
                </h4>
                <p className="text-sm text-ink-600 font-mono">
                  {selectedAgent.model}
                </p>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-ink-300 uppercase tracking-wider mb-2">
                  Artifact Types
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedAgent.artifactTypes.map((t) => (
                    <Badge key={t} variant="outline" size="sm">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
