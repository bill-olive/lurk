"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Clock, ArrowRight, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// -- Types -------------------------------------------------------------------

type Category =
  | "All"
  | "Getting Started"
  | "Artifacts"
  | "Agents"
  | "Privacy"
  | "Integrations"
  | "Teams";

type Difficulty = "Beginner" | "Intermediate" | "Advanced";

interface Tutorial {
  id: string;
  title: string;
  description: string;
  category: Category;
  readingTime: string;
  difficulty: Difficulty;
  colorClass: string;
}

// -- Data --------------------------------------------------------------------

const categories: Category[] = [
  "All",
  "Getting Started",
  "Artifacts",
  "Agents",
  "Privacy",
  "Integrations",
  "Teams",
];

const tutorials: Tutorial[] = [
  {
    id: "getting-started-with-lurk",
    title: "Getting Started with Lurk",
    description:
      "Set up your workspace, invite your first team members, and send your first artifact-backed message. This guide walks you through account creation, workspace configuration, and the core concepts that make Lurk different from traditional chat tools.",
    category: "Getting Started",
    readingTime: "8 min",
    difficulty: "Beginner",
    colorClass: "bg-clay-100",
  },
  {
    id: "understanding-artifacts-and-editions",
    title: "Understanding Artifacts and Editions",
    description:
      "Learn how Lurk turns every shared document, email thread, and design file into a versioned artifact with a full edition history. Understand how editions capture changes over time and how your team can review, compare, and restore any previous state.",
    category: "Artifacts",
    readingTime: "12 min",
    difficulty: "Beginner",
    colorClass: "bg-olive-100",
  },
  {
    id: "connecting-google-docs",
    title: "Connecting Google Docs to Lurk",
    description:
      "Link your Google Workspace account and configure which documents sync as artifacts. This tutorial covers OAuth setup, folder-level sync rules, and how Lurk detects structural changes in your docs to create meaningful edition snapshots.",
    category: "Integrations",
    readingTime: "10 min",
    difficulty: "Beginner",
    colorClass: "bg-heather-100",
  },
  {
    id: "setting-up-gmail-integration",
    title: "Setting Up Gmail Integration",
    description:
      "Route important email threads into Lurk so your team can track client communications alongside project artifacts. Configure label-based filters, set up automatic thread grouping, and control which messages surface in your workspace.",
    category: "Integrations",
    readingTime: "10 min",
    difficulty: "Intermediate",
    colorClass: "bg-ivory",
  },
  {
    id: "configuring-privacy-policies",
    title: "Configuring Privacy Policies",
    description:
      "Define what data stays on-device, what reaches the cloud, and what gets shared with AI agents. Walk through Lurk's three-layer privacy model including on-device PII detection, tenant-isolated processing, and granular sharing controls.",
    category: "Privacy",
    readingTime: "15 min",
    difficulty: "Intermediate",
    colorClass: "bg-clay-100",
  },
  {
    id: "working-with-ai-agents",
    title: "Working with AI Agents",
    description:
      "Discover how Lurk's AI agents summarize discussions, surface relevant artifacts, and draft responses on your behalf. Learn to configure agent permissions, review agent actions before they execute, and tune agent behavior for your team's workflow.",
    category: "Agents",
    readingTime: "14 min",
    difficulty: "Intermediate",
    colorClass: "bg-olive-100",
  },
  {
    id: "managing-team-access-controls",
    title: "Managing Team Access Controls",
    description:
      "Set up role-based access for your workspace with fine-grained permissions on artifacts, channels, and agent capabilities. This guide covers admin roles, guest access, artifact-level sharing rules, and how to audit who accessed what.",
    category: "Teams",
    readingTime: "11 min",
    difficulty: "Intermediate",
    colorClass: "bg-heather-100",
  },
  {
    id: "tracked-changes-and-notes",
    title: "Using Tracked Changes and Notes",
    description:
      "Annotate artifacts with inline comments, suggest edits through tracked changes, and resolve discussions without leaving Lurk. Learn how change tracking integrates with the edition system to preserve a complete history of collaborative decisions.",
    category: "Artifacts",
    readingTime: "9 min",
    difficulty: "Beginner",
    colorClass: "bg-ivory",
  },
  {
    id: "setting-up-kill-switches",
    title: "Setting Up Kill Switches",
    description:
      "Configure emergency controls that let you instantly revoke agent access, freeze artifact sharing, or lock down a workspace. Understand when kill switches trigger automatically based on anomaly detection and how to customize their thresholds.",
    category: "Agents",
    readingTime: "13 min",
    difficulty: "Advanced",
    colorClass: "bg-clay-100",
  },
  {
    id: "building-custom-connectors",
    title: "Building Custom Connectors",
    description:
      "Use the Lurk Connector SDK to build integrations with your internal tools and third-party services. This tutorial covers authentication flows, webhook registration, artifact schema mapping, and best practices for handling rate limits and retries.",
    category: "Integrations",
    readingTime: "20 min",
    difficulty: "Advanced",
    colorClass: "bg-olive-100",
  },
  {
    id: "understanding-the-audit-trail",
    title: "Understanding the Audit Trail",
    description:
      "Every action in Lurk is logged. Learn how to navigate the audit trail to see who viewed, edited, or shared an artifact, when agents took autonomous actions, and how to generate compliance reports for SOC 2 and GDPR requirements.",
    category: "Privacy",
    readingTime: "12 min",
    difficulty: "Intermediate",
    colorClass: "bg-heather-100",
  },
  {
    id: "migrating-from-existing-tools",
    title: "Migrating from Existing Tools",
    description:
      "Move your team from Slack, Microsoft Teams, or other collaboration platforms to Lurk without losing history. This guide covers bulk message import, channel mapping, file migration strategies, and tips for managing the transition with your team.",
    category: "Getting Started",
    readingTime: "16 min",
    difficulty: "Advanced",
    colorClass: "bg-ivory",
  },
];

// -- Helpers -----------------------------------------------------------------

const difficultyVariant: Record<Difficulty, "success" | "default" | "purple"> =
  {
    Beginner: "success",
    Intermediate: "default",
    Advanced: "purple",
  };

// -- Page --------------------------------------------------------------------

export default function TutorialsPage() {
  const [activeCategory, setActiveCategory] = useState<Category>("All");

  const filtered =
    activeCategory === "All"
      ? tutorials
      : tutorials.filter((t) => t.category === activeCategory);

  return (
    <div className="min-h-screen bg-ivory">
      <div className="max-w-6xl mx-auto px-6 py-16 sm:px-8 lg:px-12">
        {/* Hero */}
        <header className="mb-14 max-w-2xl">
          <h1 className="font-serif text-4xl sm:text-5xl font-bold text-ink-800 tracking-tight">
            Learn Lurk
          </h1>
          <p className="mt-3 text-lg text-ink-500 leading-relaxed">
            Step-by-step guides to help you master artifact-centric
            collaboration, configure AI agents, and get the most from every
            integration.
          </p>
        </header>

        {/* Filter bar */}
        <div className="flex items-center gap-2 mb-10 flex-wrap">
          <Filter className="w-4 h-4 text-ink-400 mr-1" />
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors duration-200 ${
                activeCategory === cat
                  ? "bg-ink-800 text-white"
                  : "bg-white text-ink-600 border border-ink-200 hover:border-ink-300 hover:text-ink-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Tutorial grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((tutorial) => (
            <Link
              key={tutorial.id}
              href={`/tutorials/${tutorial.id}`}
              className="group block bg-white border border-ink-100 rounded-editorial shadow-warm-sm hover:shadow-warm transition-shadow duration-200 overflow-hidden"
            >
              {/* Color band */}
              <div className={`h-2 ${tutorial.colorClass}`} />

              <div className="p-6">
                {/* Category eyebrow */}
                <span className="text-xs font-medium uppercase tracking-wider text-ink-400">
                  {tutorial.category}
                </span>

                {/* Title */}
                <h2 className="mt-2 font-serif text-lg font-semibold text-ink-800 leading-snug group-hover:text-clay-500 transition-colors duration-200">
                  {tutorial.title}
                </h2>

                {/* Description */}
                <p className="mt-2 text-sm text-ink-500 leading-relaxed line-clamp-3">
                  {tutorial.description}
                </p>

                {/* Meta row */}
                <div className="mt-4 flex items-center gap-3">
                  <span className="flex items-center gap-1 text-xs text-ink-400">
                    <Clock className="w-3.5 h-3.5" />
                    {tutorial.readingTime}
                  </span>

                  <Badge
                    variant={difficultyVariant[tutorial.difficulty]}
                    size="sm"
                  >
                    {tutorial.difficulty}
                  </Badge>
                </div>

                {/* Read link */}
                <div className="mt-5 flex items-center gap-1.5 text-sm font-medium text-clay-500 group-hover:text-clay-600 transition-colors duration-200">
                  Read tutorial
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-200" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
