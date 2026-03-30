"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FileText,
  Mail,
  Table,
  HardDrive,
  Clock,
  Users,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useGoogleArtifacts, type GoogleArtifact } from "@/lib/google";

// -- Types -------------------------------------------------------------------

interface Artifact {
  id: string;
  title: string;
  excerpt: string;
  source: "google-docs" | "gmail" | "spreadsheet";
  status: "under-review" | "published" | "draft";
  date: string;
  contributor: string;
  editions: number;
}

type SourceFilter = "all" | "google-docs" | "gmail" | "spreadsheet" | "drive";

// -- Data --------------------------------------------------------------------

const sampleArtifacts: Artifact[] = [
  {
    id: "art-q2-product-spec",
    title: "Q2 Product Roadmap & Feature Spec",
    excerpt:
      "Outlines the three major workstreams for Q2: real-time co-editing, expanded connector marketplace, and the redesigned notifications system with priority scoring.",
    source: "google-docs",
    status: "published",
    date: "Mar 28, 2026",
    contributor: "Sarah Chen",
    editions: 14,
  },
  {
    id: "art-series-b-deck",
    title: "Series B Investor Update - March 2026",
    excerpt:
      "Monthly investor memo covering ARR growth to $4.2M, net retention at 138%, and the enterprise pilot pipeline with three Fortune 500 accounts entering evaluation.",
    source: "google-docs",
    status: "under-review",
    date: "Mar 27, 2026",
    contributor: "Marcus Reilly",
    editions: 7,
  },
  {
    id: "art-acme-onboarding",
    title: "Re: Acme Corp Onboarding Timeline",
    excerpt:
      "Thread with Acme's IT director confirming the phased rollout schedule, starting with their product team of 40 in April before expanding to engineering in May.",
    source: "gmail",
    status: "published",
    date: "Mar 26, 2026",
    contributor: "Priya Sharma",
    editions: 3,
  },
  {
    id: "art-agent-architecture",
    title: "Agent Orchestration Architecture",
    excerpt:
      "Technical design document for the multi-agent pipeline, covering task decomposition, context windowing, and the safety rail framework for autonomous operations.",
    source: "spreadsheet",
    status: "published",
    date: "Mar 25, 2026",
    contributor: "Jake Moreno",
    editions: 22,
  },
  {
    id: "art-privacy-framework",
    title: "Three-Layer Privacy Framework v2",
    excerpt:
      "Updated privacy architecture specifying on-device PII detection, tenant-isolated processing, and the new audit trail schema for compliance with SOC 2 Type II.",
    source: "google-docs",
    status: "under-review",
    date: "Mar 24, 2026",
    contributor: "Amara Osei",
    editions: 9,
  },
  {
    id: "art-standup-mar24",
    title: "Engineering Standup Notes - Mar 24",
    excerpt:
      "Sprint 14 standup covering the WebSocket migration to CloudFlare Durable Objects, connector SDK beta feedback, and the open P1 on message ordering in high-traffic channels.",
    source: "google-docs",
    status: "draft",
    date: "Mar 24, 2026",
    contributor: "Leo Tran",
    editions: 1,
  },
  {
    id: "art-enterprise-pricing",
    title: "Re: Enterprise Pricing Discussion",
    excerpt:
      "Internal thread between sales and finance reviewing the proposed per-seat pricing tiers, volume discounts for 500+ seat deals, and the bundled AI agent add-on pricing.",
    source: "gmail",
    status: "under-review",
    date: "Mar 23, 2026",
    contributor: "Dana Kim",
    editions: 5,
  },
  {
    id: "art-design-system",
    title: "Lurk Design System - Components & Tokens",
    excerpt:
      "Living design reference documenting the full token set, component variants, accessibility guidelines, and the editorial visual language with typography and color specs.",
    source: "spreadsheet",
    status: "published",
    date: "Mar 22, 2026",
    contributor: "Rina Takahashi",
    editions: 31,
  },
  {
    id: "art-connector-sdk",
    title: "Connector SDK Developer Guide",
    excerpt:
      "Step-by-step guide for third-party developers building Lurk connectors, covering the authentication flow, webhook registration, artifact schema mapping, and rate limits.",
    source: "spreadsheet",
    status: "published",
    date: "Mar 21, 2026",
    contributor: "Jake Moreno",
    editions: 18,
  },
  {
    id: "art-wellspring-feedback",
    title: "Re: Wellspring Health - Feature Requests",
    excerpt:
      "Client email summarizing Wellspring Health's top three requests: HIPAA-compliant artifact storage, custom retention policies, and SSO integration with their Okta instance.",
    source: "gmail",
    status: "draft",
    date: "Mar 20, 2026",
    contributor: "Priya Sharma",
    editions: 2,
  },
];

// -- Helpers -----------------------------------------------------------------

const sourceConfig: Record<
  Artifact["source"],
  { icon: typeof FileText; label: string }
> = {
  "google-docs": { icon: FileText, label: "Google Docs" },
  gmail: { icon: Mail, label: "Gmail" },
  spreadsheet: { icon: Table, label: "Spreadsheets" },
};

const googleSourceIcons: Record<GoogleArtifact["source"], typeof FileText> = {
  "google-docs": FileText,
  gmail: Mail,
  spreadsheet: Table,
  drive: HardDrive,
};

const statusConfig: Record<
  Artifact["status"],
  { label: string; variant: "danger" | "success" | "default" }
> = {
  "under-review": { label: "Under Review", variant: "danger" },
  published: { label: "Published", variant: "success" },
  draft: { label: "Draft", variant: "default" },
};

const tabs: { key: SourceFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "google-docs", label: "Docs" },
  { key: "gmail", label: "Emails" },
  { key: "spreadsheet", label: "Spreadsheets" },
  { key: "drive", label: "Drive" },
];

// -- Page --------------------------------------------------------------------

export default function ArtifactsPage() {
  const [activeTab, setActiveTab] = useState<SourceFilter>("all");

  const {
    artifacts: googleArtifacts,
    loading: googleLoading,
  } = useGoogleArtifacts();

  // Filter Google artifacts by active tab
  const filteredGoogle =
    activeTab === "all"
      ? googleArtifacts
      : activeTab === "drive"
        ? googleArtifacts
        : googleArtifacts.filter((a) => a.source === activeTab);

  // Filter sample artifacts by active tab
  const filteredSample =
    activeTab === "all"
      ? sampleArtifacts
      : activeTab === "drive"
        ? sampleArtifacts
        : sampleArtifacts.filter((a) => a.source === activeTab);

  // Check if Google token exists (no artifacts and not loading means no token)
  const hasToken = typeof window !== "undefined" && !!sessionStorage.getItem("google_access_token");

  return (
    <div className="min-h-screen bg-ivory">
      <div className="max-w-5xl mx-auto px-6 py-16 sm:px-8 lg:px-12">
        {/* Header */}
        <header className="mb-14">
          <h1 className="font-serif text-4xl sm:text-5xl font-bold text-ink-800 tracking-tight">
            Artifacts
          </h1>
          <p className="mt-3 text-lg text-ink-500 max-w-xl leading-relaxed">
            Your team&rsquo;s knowledge, tracked and versioned.
          </p>
        </header>

        {/* Source Tabs */}
        <nav className="flex items-center gap-6 mb-12" style={{ borderBottom: "0.5px solid #d1cfc5" }}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={
                activeTab === tab.key
                  ? "text-ink-800 font-medium text-sm pb-3 relative"
                  : "text-ink-400 text-sm pb-3 hover:text-ink-600 transition-colors"
              }
              style={
                activeTab === tab.key
                  ? { borderBottom: "2px solid currentColor", marginBottom: "-0.5px" }
                  : undefined
              }
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Your Files */}
        <section className="mb-16">
          <h2 className="font-serif text-2xl font-semibold text-ink-800 tracking-tight mb-6">
            Your Files
          </h2>

          {googleLoading ? (
            <div className="flex items-center gap-3 py-8">
              <Loader2 className="w-4 h-4 text-ink-400 animate-spin" />
              <p className="text-sm text-ink-400">Loading your files...</p>
            </div>
          ) : !hasToken && filteredGoogle.length === 0 ? (
            <div className="flex items-center gap-3 py-8">
              <HardDrive className="w-5 h-5 text-ink-300" />
              <p className="text-sm text-ink-400">
                Sign in with Google to see your files
              </p>
            </div>
          ) : filteredGoogle.length === 0 ? (
            <div className="flex items-center gap-3 py-8">
              <HardDrive className="w-5 h-5 text-ink-300" />
              <p className="text-sm text-ink-400">
                No files match this filter
              </p>
            </div>
          ) : (
            <div>
              {filteredGoogle.map((file, idx) => {
                const Icon = googleSourceIcons[file.source] ?? HardDrive;
                const formattedDate = new Date(file.lastModified).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });

                return (
                  <div
                    key={file.id}
                    style={
                      idx < filteredGoogle.length - 1
                        ? { borderBottom: "0.5px solid #d1cfc5" }
                        : undefined
                    }
                  >
                    <div className="flex items-center justify-between py-5 gap-6">
                      {/* Left: icon + title */}
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon className="w-4 h-4 text-ink-400 shrink-0" />
                        <h3 className="text-sm font-medium text-ink-800 truncate">
                          {file.title}
                        </h3>
                      </div>

                      {/* Right: date + owner + external link */}
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="flex items-center gap-1 text-xs text-ink-400">
                          <Clock className="w-3 h-3" />
                          {formattedDate}
                        </span>

                        <span className="flex items-center gap-1 text-xs text-ink-400 w-28 justify-end">
                          <Users className="w-3 h-3" />
                          {file.owner}
                        </span>

                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-ink-400 hover:text-ink-600 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ borderBottom: "0.5px solid #d1cfc5" }} />
        </section>

        {/* Recent */}
        <section>
          <h2 className="font-serif text-2xl font-semibold text-ink-800 tracking-tight mb-8">
            Recent
          </h2>

          <div>
            {filteredSample.map((artifact, idx) => {
              const source = sourceConfig[artifact.source];
              const status = statusConfig[artifact.status];
              const SourceIcon = source.icon;

              return (
                <div
                  key={artifact.id}
                  style={
                    idx < filteredSample.length - 1
                      ? { borderBottom: "0.5px solid #d1cfc5" }
                      : undefined
                  }
                >
                  <Link
                    href={`/artifacts/${artifact.id}`}
                    className="group flex items-center justify-between py-5 gap-6"
                  >
                    {/* Left: icon + title */}
                    <div className="flex items-center gap-3 min-w-0">
                      <SourceIcon className="w-4 h-4 text-ink-400 shrink-0" />
                      <h3 className="text-sm font-medium text-ink-800 truncate group-hover:underline underline-offset-2">
                        {artifact.title}
                      </h3>
                    </div>

                    {/* Right: status + date + contributor */}
                    <div className="flex items-center gap-4 shrink-0">
                      <Badge variant={status.variant} size="sm">
                        {status.label}
                      </Badge>

                      <span className="flex items-center gap-1 text-xs text-ink-400">
                        <Clock className="w-3 h-3" />
                        {artifact.date}
                      </span>

                      <span className="flex items-center gap-1 text-xs text-ink-400 w-28 justify-end">
                        <Users className="w-3 h-3" />
                        {artifact.contributor}
                      </span>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
