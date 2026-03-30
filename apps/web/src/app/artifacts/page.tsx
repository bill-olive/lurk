"use client";

import Link from "next/link";
import {
  FileText,
  Mail,
  BookOpen,
  Clock,
  Users,
  ArrowRight,
  Filter,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// -- Types -------------------------------------------------------------------

interface Artifact {
  id: string;
  title: string;
  excerpt: string;
  source: "google-docs" | "gmail" | "notion";
  status: "under-review" | "published" | "draft";
  date: string;
  contributor: string;
  editions: number;
}

// -- Data --------------------------------------------------------------------

const artifacts: Artifact[] = [
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
    source: "notion",
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
    source: "notion",
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
    source: "notion",
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
  notion: { icon: BookOpen, label: "Notion" },
};

const statusConfig: Record<
  Artifact["status"],
  { label: string; variant: "danger" | "success" | "default" }
> = {
  "under-review": { label: "Under Review", variant: "danger" },
  published: { label: "Published", variant: "success" },
  draft: { label: "Draft", variant: "default" },
};

// -- Page --------------------------------------------------------------------

export default function ArtifactsPage() {
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

        {/* Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {artifacts.map((artifact) => {
            const source = sourceConfig[artifact.source];
            const status = statusConfig[artifact.status];
            const SourceIcon = source.icon;

            return (
              <Link
                key={artifact.id}
                href={`/artifacts/${artifact.id}`}
                className="group block bg-white border border-ink-100 rounded-editorial shadow-warm-sm hover:shadow-warm transition-shadow duration-200"
              >
                <div className="p-6">
                  {/* Source eyebrow */}
                  <div className="flex items-center gap-2 mb-3">
                    <SourceIcon className="w-4 h-4 text-ink-400" />
                    <span className="text-xs font-medium uppercase tracking-wider text-ink-400">
                      {source.label}
                    </span>
                  </div>

                  {/* Title */}
                  <h2 className="font-serif text-xl font-semibold text-ink-800 leading-snug group-hover:text-clay-500 transition-colors duration-200">
                    {artifact.title}
                  </h2>

                  {/* Excerpt */}
                  <p className="mt-2 text-sm text-ink-500 leading-relaxed line-clamp-2">
                    {artifact.excerpt}
                  </p>

                  {/* Meta row */}
                  <div className="mt-4 flex items-center flex-wrap gap-3">
                    <Badge variant={status.variant} size="sm">
                      {status.label}
                    </Badge>

                    <span className="flex items-center gap-1 text-xs text-ink-400">
                      <Clock className="w-3.5 h-3.5" />
                      {artifact.date}
                    </span>

                    <span className="flex items-center gap-1 text-xs text-ink-400">
                      <Users className="w-3.5 h-3.5" />
                      {artifact.contributor}
                    </span>

                    <span className="text-xs text-ink-300">
                      {artifact.editions}{" "}
                      {artifact.editions === 1 ? "edition" : "editions"}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* View All link */}
        <div className="mt-12 text-center">
          <Link
            href="/artifacts?view=all"
            className="inline-flex items-center gap-2 text-sm font-medium text-clay-500 hover:text-clay-600 transition-colors duration-200"
          >
            View all artifacts
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
