"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import {
  Clock,
  User,
  GitBranch,
  MessageSquare,
  ArrowLeft,
  Check,
  FileText,
  ChevronRight,
} from "lucide-react";

// ── Types ────────────────────────────────────

interface InlineComment {
  id: string;
  anchor: string;
  author: string;
  avatarColor: string;
  timestamp: string;
  body: string;
  resolved?: boolean;
}

interface Revision {
  id: string;
  author: string;
  timestamp: string;
  message: string;
}

interface Submission {
  id: string;
  title: string;
  author: string;
  avatarColor: string;
  status: "open" | "merged" | "closed";
  createdAt: string;
  revisions: Revision[];
  additions: number;
  deletions: number;
}

interface ArtifactData {
  id: string;
  title: string;
  subtitle: string;
  source: string;
  edition: string;
  lastUpdated: string;
  contributor: {
    name: string;
    avatarColor: string;
    role: string;
  };
  submission: Submission;
  comments: InlineComment[];
}

// ── Mock Data ────────────────────────────────

const MOCK_ARTIFACT: ArtifactData = {
  id: "art_3",
  title: "Enterprise Knowledge Management: A Product Strategy for the Next Era",
  subtitle:
    "How we plan to transform institutional knowledge from a passive archive into an active, intelligent asset.",
  source: "Product Strategy",
  edition: "Edition 4 of 4",
  lastUpdated: "March 28, 2026",
  contributor: {
    name: "Sarah Chen",
    avatarColor: "bg-clay-400",
    role: "VP of Product",
  },
  submission: {
    id: "sub_18",
    title: "Revise market positioning and add AI-native section",
    author: "Sarah Chen",
    avatarColor: "bg-clay-400",
    status: "open",
    createdAt: "March 26, 2026",
    revisions: [
      {
        id: "rev_1",
        author: "Sarah Chen",
        timestamp: "Mar 26, 10:14am",
        message: "Initial draft of revised positioning section",
      },
      {
        id: "rev_2",
        author: "James Okafor",
        timestamp: "Mar 27, 2:38pm",
        message: "Add competitive analysis notes from field team",
      },
      {
        id: "rev_3",
        author: "Sarah Chen",
        timestamp: "Mar 28, 9:02am",
        message: "Incorporate feedback, refine AI-native section",
      },
    ],
    additions: 342,
    deletions: 87,
  },
  comments: [
    {
      id: "c1",
      anchor: "anchor-market",
      author: "James Okafor",
      avatarColor: "bg-heather-400",
      timestamp: "Mar 27",
      body: "Field team is seeing this exact pain point. Should we cite the Gartner report here?",
    },
    {
      id: "c2",
      anchor: "anchor-ai",
      author: "Priya Mehta",
      avatarColor: "bg-olive-400",
      timestamp: "Mar 28",
      body: "Love this framing. Can we add a specific example of how the summarization would work in practice?",
    },
    {
      id: "c3",
      anchor: "anchor-pricing",
      author: "Marcus Webb",
      avatarColor: "bg-clay-300",
      timestamp: "Mar 28",
      body: "Legal flagged that the per-seat language needs review before we share externally.",
      resolved: false,
    },
  ],
};

// ── Component ────────────────────────────────

export default function ArtifactReadingView() {
  const params = useParams();
  const artifactId = params.id as string;
  const artifact = MOCK_ARTIFACT;

  return (
    <div className="min-h-screen bg-ivory">
      {/* ── Top Bar ─────────────────────────── */}
      <header className="sticky top-0 z-20 bg-ivory/90 backdrop-blur-sm border-b border-ink-100/60">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/artifacts"
              className="flex items-center gap-1.5 text-ink-400 hover:text-ink-700 transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>All Artifacts</span>
            </Link>
            <span className="text-ink-200">/</span>
            <span className="text-sm text-ink-500 font-medium">
              {artifact.source}
            </span>
          </div>

          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2 text-sm text-ink-400">
              <Clock className="w-3.5 h-3.5" />
              <span>{artifact.lastUpdated}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-ink-400">
              <GitBranch className="w-3.5 h-3.5" />
              <span>{artifact.edition}</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={clsx(
                  "w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium",
                  artifact.contributor.avatarColor
                )}
              >
                {artifact.contributor.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </div>
              <div className="text-sm">
                <span className="text-ink-600 font-medium">
                  {artifact.contributor.name}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Layout ─────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 pt-12 pb-24 grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-12">
        {/* ── Reading Area ───────────────────── */}
        <article className="max-w-[65ch]">
          {/* Eyebrow */}
          <div className="eyebrow mb-4">{artifact.source}</div>

          {/* Title */}
          <h1 className="font-serif text-4xl md:text-5xl font-semibold text-ink-800 leading-tight tracking-tight mb-4">
            {artifact.title}
          </h1>

          {/* Subtitle */}
          <p className="text-xl text-ink-400 leading-relaxed mb-8 max-w-full">
            {artifact.subtitle}
          </p>

          {/* Byline */}
          <div className="flex items-center gap-3 pb-8 mb-10 border-b border-ink-100">
            <div
              className={clsx(
                "w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium",
                artifact.contributor.avatarColor
              )}
            >
              {artifact.contributor.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </div>
            <div>
              <div className="text-sm font-medium text-ink-700">
                {artifact.contributor.name}
              </div>
              <div className="text-xs text-ink-400">
                {artifact.contributor.role} &middot; {artifact.lastUpdated}
              </div>
            </div>
          </div>

          {/* ── Document Content (prose-reading) ── */}
          <div className="prose-reading">
            <h2>Executive Summary</h2>
            <p>
              The enterprise knowledge management market is undergoing a
              fundamental transformation. Organizations are no longer satisfied
              with static document repositories that serve as digital filing
              cabinets. They need systems that understand context, surface
              relevant information proactively, and help teams build on
              institutional knowledge rather than perpetually reinventing it.
            </p>
            <p>
              This document outlines our strategic direction for the next
              eighteen months, focusing on three pillars:{" "}
              <span className="addition">
                intelligent knowledge graphs, AI-native authoring workflows, and
                real-time collaborative surfaces
              </span>
              . Together, these capabilities will position us as the definitive
              platform for enterprises that treat knowledge as a competitive
              asset.
            </p>

            <h2>
              <span id="anchor-market">Market Landscape</span>
            </h2>
            <p>
              The knowledge management space has consolidated significantly over
              the past two years.{" "}
              <span className="deletion">
                Our primary competitors remain Confluence, Notion, and SharePoint,
                each serving different segments of the market.
              </span>{" "}
              <span className="addition">
                While legacy players like Confluence and SharePoint retain
                installed bases, the real competitive threat now comes from
                AI-native startups that are reimagining knowledge work from first
                principles. Notion has pivoted aggressively toward AI, and a new
                wave of tools like Glean, Guru, and Sana are capturing
                enterprise attention with intelligent search and retrieval.
              </span>
            </p>
            <p>
              Our{" "}
              <span className="comment-highlight" id="anchor-market-note">
                analysis of 200 enterprise accounts shows that the average
                knowledge worker spends 3.2 hours per day searching for
                information, validating its currency, or recreating content that
                already exists elsewhere in the organization
              </span>
              . This is not merely an efficiency problem. It represents a
              fundamental failure of organizational memory.
            </p>
            <p>
              The addressable market for intelligent knowledge management
              platforms has grown to $14.8 billion in 2026, up from $9.3 billion
              in 2023. Enterprise buyers are increasingly willing to consolidate
              spending from multiple point solutions into a single platform that
              can serve as the authoritative source of truth.
            </p>

            <h2>Strategic Pillars</h2>

            <h3>Pillar 1: Intelligent Knowledge Graphs</h3>
            <p>
              Every document, conversation, decision, and data point within an
              organization exists in relation to other artifacts. Current tools
              treat these as isolated files. Our approach builds a living graph
              of relationships: a document links to the meeting where it was
              discussed, which links to the project it supports, which links to
              the OKRs it advances.
            </p>
            <p>
              <span className="deletion">
                We will build this graph incrementally, starting with explicit
                link analysis and expanding to semantic relationship detection in
                Q3.
              </span>{" "}
              <span className="addition">
                The graph will be constructed through a hybrid approach: explicit
                links and metadata form the structural backbone, while our
                fine-tuned embedding model continuously discovers latent
                relationships between artifacts based on semantic similarity,
                shared context, and temporal proximity. We expect the
                automatically inferred edges to outnumber explicit links by a
                factor of ten within six months of deployment.
              </span>
            </p>

            <h3>
              <span id="anchor-ai">
                Pillar 2: AI-Native Authoring
              </span>
            </h3>
            <p>
              The current generation of AI writing tools treats documents as
              isolated units of text to be generated or polished. Our vision goes
              further. When a contributor begins drafting a new artifact, the
              system should already understand the organizational context:
              existing documents on the topic, recent decisions that affect the
              subject matter, and the institutional voice and terminology that
              the team uses.
            </p>
            <p>
              <span className="addition">
                We are building what we internally call "contextual co-authoring"
                &mdash; an AI layer that does not merely autocomplete sentences
                but actively participates in knowledge creation. It flags when
                new content contradicts existing documentation. It suggests
                citations to relevant internal sources. It identifies stakeholders
                who should review the material based on their areas of
                expertise and prior contributions.
              </span>
            </p>
            <p>
              <span className="comment-highlight" id="anchor-ai-note">
                Early prototyping suggests that contextual co-authoring reduces
                document creation time by approximately 40% while increasing
                citation of existing internal knowledge by over 300%.
              </span>{" "}
              These are preliminary numbers, but the directional signal is
              strong enough to justify accelerated investment.
            </p>

            <h3>Pillar 3: Collaborative Surfaces</h3>
            <p>
              Knowledge is not created in isolation. The most valuable artifacts
              emerge from structured collaboration between people with different
              perspectives and expertise. Our collaborative surfaces provide
              real-time co-editing with a twist: every change is tracked not just
              as a diff, but as a meaningful contribution with context.
            </p>
            <p>
              When a legal reviewer modifies a clause, the system captures not
              just the text change but the regulatory rationale. When an engineer
              updates a technical specification, the change is linked to the
              relevant pull request or incident report. This creates an audit
              trail that transforms version history from a list of timestamps
              into a narrative of how organizational knowledge evolved.
            </p>

            <blockquote>
              The best knowledge management system is one that makes
              organizational memory as natural and reliable as individual memory.
              People should not need to know where something is stored. They
              should simply be able to recall it.
            </blockquote>

            <h2>Go-to-Market Approach</h2>
            <p>
              Our go-to-market strategy focuses on landing within product and
              engineering teams, where the pain of fragmented knowledge is most
              acute, and expanding into adjacent functions.{" "}
              <span className="deletion">
                Initial pricing will follow a simple per-seat model with
                three tiers.
              </span>{" "}
              <span className="addition">
                We are adopting a usage-based pricing model that aligns cost with
                the value customers extract from the platform. Base platform
                access is priced per seat, but AI-powered features &mdash;
                including contextual co-authoring, intelligent search, and
                automated knowledge graph construction &mdash; are metered based
                on consumption.
              </span>
            </p>
            <p>
              <span className="comment-highlight" id="anchor-pricing">
                This model reduces friction at the point of adoption while
                ensuring that customers who derive the most value from AI
                capabilities contribute proportionally to the cost of serving
                them.
              </span>{" "}
              We project this approach will yield 15&ndash;20% higher net
              revenue retention compared to a flat per-seat model, based on
              comparable benchmarks from infrastructure SaaS companies that have
              made similar transitions.
            </p>

            <h2>Risks and Mitigations</h2>
            <p>
              <span className="addition">
                The primary risk to this strategy is execution speed. The
                competitive window for establishing an AI-native knowledge
                platform is narrow &mdash; likely 12 to 18 months before the
                market consolidates around two or three dominant players.
              </span>{" "}
              We mitigate this by taking a modular approach: each pillar
              delivers standalone value and can be shipped incrementally rather
              than requiring a monolithic launch.
            </p>
            <p>
              Data privacy and security remain critical concerns for enterprise
              buyers. Our architecture ensures that all AI processing occurs
              within the customer&apos;s trust boundary, with no training on
              customer data and full SOC 2 Type II compliance maintained
              throughout.{" "}
              <span className="deletion">
                We plan to achieve FedRAMP authorization by end of year.
              </span>{" "}
              <span className="addition">
                FedRAMP authorization is targeted for Q3, with preliminary
                assessment already underway through our partnership with
                Coalfire.
              </span>
            </p>
          </div>
        </article>

        {/* ── Right Margin: Notes ────────────── */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <div className="flex items-center gap-2 mb-6">
              <MessageSquare className="w-4 h-4 text-heather-500" />
              <span className="text-sm font-medium text-ink-500">
                {artifact.comments.length} Notes
              </span>
            </div>

            {artifact.comments.map((comment) => (
              <div
                key={comment.id}
                className={clsx(
                  "p-3.5 rounded-editorial border transition-all duration-200 hover:shadow-warm-sm",
                  comment.resolved
                    ? "bg-ink-50/50 border-ink-100/40 opacity-60"
                    : "bg-white border-heather-200/60"
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={clsx(
                      "w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-medium",
                      comment.avatarColor
                    )}
                  >
                    {comment.author
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <span className="text-xs font-medium text-ink-600">
                    {comment.author}
                  </span>
                  <span className="text-xs text-ink-300 ml-auto">
                    {comment.timestamp}
                  </span>
                </div>
                <p className="text-xs text-ink-500 leading-relaxed max-w-full">
                  {comment.body}
                </p>
                {comment.resolved && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-olive-600">
                    <Check className="w-3 h-3" />
                    <span>Resolved</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* ── Submission Details (Bottom Section) ── */}
      <section className="border-t border-ink-100 bg-white/60">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="max-w-[65ch]">
            {/* Section header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-clay-100 flex items-center justify-center">
                <GitBranch className="w-4 h-4 text-clay-600" />
              </div>
              <div>
                <h3 className="font-serif text-lg text-ink-800">
                  Current Submission
                </h3>
                <p className="text-xs text-ink-400">
                  Tracked changes from this edition
                </p>
              </div>
            </div>

            {/* Submission card */}
            <div className="card-editorial p-5 mb-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={clsx(
                      "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium",
                      artifact.submission.avatarColor
                    )}
                  >
                    {artifact.submission.author
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-ink-700">
                      {artifact.submission.title}
                    </div>
                    <div className="text-xs text-ink-400 mt-0.5">
                      Opened by {artifact.submission.author} &middot;{" "}
                      {artifact.submission.createdAt}
                    </div>
                  </div>
                </div>
                <span
                  className={clsx(
                    "px-2.5 py-1 rounded-full text-xs font-medium",
                    artifact.submission.status === "open" &&
                      "bg-olive-100 text-olive-700",
                    artifact.submission.status === "merged" &&
                      "bg-heather-100 text-heather-700",
                    artifact.submission.status === "closed" &&
                      "bg-ink-100 text-ink-500"
                  )}
                >
                  {artifact.submission.status === "open"
                    ? "Open"
                    : artifact.submission.status === "merged"
                    ? "Merged"
                    : "Closed"}
                </span>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-6 text-xs text-ink-400 mb-4">
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  <span>
                    {artifact.submission.revisions.length} revisions
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-olive-600 font-medium">
                    +{artifact.submission.additions}
                  </span>
                  <span className="text-ink-300">/</span>
                  <span className="text-clay-500 font-medium">
                    &minus;{artifact.submission.deletions}
                  </span>
                  <span>words</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>{artifact.comments.length} notes</span>
                </div>
              </div>

              {/* Divider */}
              <div className="divider mb-4" />

              {/* Revision timeline */}
              <div className="space-y-3">
                {artifact.submission.revisions.map((rev, idx) => (
                  <div
                    key={rev.id}
                    className="flex items-start gap-3 group"
                  >
                    {/* Timeline dot + line */}
                    <div className="flex flex-col items-center pt-1">
                      <div
                        className={clsx(
                          "w-2 h-2 rounded-full",
                          idx === 0 ? "bg-clay-400" : "bg-ink-200"
                        )}
                      />
                      {idx < artifact.submission.revisions.length - 1 && (
                        <div className="w-px h-6 bg-ink-100 mt-1" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-ink-600">
                        {rev.message}
                      </div>
                      <div className="text-xs text-ink-300 mt-0.5">
                        {rev.author} &middot; {rev.timestamp}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Contributors */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-ink-400 font-medium">
                Contributors
              </span>
              <div className="flex -space-x-2">
                {[
                  { name: "Sarah Chen", color: "bg-clay-400" },
                  { name: "James Okafor", color: "bg-heather-400" },
                  { name: "Priya Mehta", color: "bg-olive-400" },
                ].map((person) => (
                  <div
                    key={person.name}
                    className={clsx(
                      "w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-medium ring-2 ring-ivory",
                      person.color
                    )}
                    title={person.name}
                  >
                    {person.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                ))}
              </div>
              <span className="text-xs text-ink-300">
                3 contributors to this edition
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
