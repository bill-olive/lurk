import Link from "next/link";
import { ArrowLeft, ArrowRight, Clock, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// -- Types -------------------------------------------------------------------

type Category =
  | "Getting Started"
  | "Artifacts"
  | "Agents"
  | "Privacy"
  | "Integrations"
  | "Teams";

type Difficulty = "Beginner" | "Intermediate" | "Advanced";

interface TutorialMeta {
  id: string;
  title: string;
  category: Category;
  readingTime: string;
  difficulty: Difficulty;
  learns: string[];
}

// -- Tutorial metadata -------------------------------------------------------

const tutorialOrder: string[] = [
  "getting-started-with-lurk",
  "understanding-artifacts-and-editions",
  "connecting-google-docs",
  "setting-up-gmail-integration",
  "configuring-privacy-policies",
  "working-with-ai-agents",
  "managing-team-access-controls",
  "tracked-changes-and-notes",
  "setting-up-kill-switches",
  "building-custom-connectors",
  "understanding-the-audit-trail",
  "migrating-from-existing-tools",
];

const tutorials: Record<string, TutorialMeta> = {
  "getting-started-with-lurk": {
    id: "getting-started-with-lurk",
    title: "Getting Started with Lurk",
    category: "Getting Started",
    readingTime: "8 min",
    difficulty: "Beginner",
    learns: [
      "Account creation and Google OAuth setup",
      "Workspace configuration and organization settings",
      "Core concepts: artifacts, editions, submissions, notes, and contributors",
      "Inviting team members and assigning roles",
    ],
  },
  "understanding-artifacts-and-editions": {
    id: "understanding-artifacts-and-editions",
    title: "Understanding Artifacts and Editions",
    category: "Artifacts",
    readingTime: "12 min",
    difficulty: "Beginner",
    learns: [
      "What artifacts are and how they represent versioned documents",
      "How editions capture changes over time",
      "Browsing artifact history and the revision timeline",
      "Comparing editions with inline tracked changes",
    ],
  },
  "connecting-google-docs": {
    id: "connecting-google-docs",
    title: "Connecting Google Docs to Lurk",
    category: "Integrations",
    readingTime: "10 min",
    difficulty: "Beginner",
    learns: [
      "OAuth scopes and what permissions Lurk requests",
      "How file sync works with the Google Drive API",
      "Configuring folder-level sync rules",
      "How change detection creates new editions automatically",
    ],
  },
  "setting-up-gmail-integration": {
    id: "setting-up-gmail-integration",
    title: "Setting Up Gmail Integration",
    category: "Integrations",
    readingTime: "10 min",
    difficulty: "Intermediate",
    learns: [
      "Why tracking email in Lurk improves team visibility",
      "Connecting Gmail and configuring label-based filters",
      "How thread grouping works with Gmail thread IDs",
      "Privacy considerations for email artifacts",
    ],
  },
  "configuring-privacy-policies": {
    id: "configuring-privacy-policies",
    title: "Configuring Privacy Policies",
    category: "Privacy",
    readingTime: "15 min",
    difficulty: "Intermediate",
    learns: [
      "Lurk's three-layer privacy architecture",
      "Choosing the right redaction level for your organization",
      "Content access control models: open, team-based, and need-to-know",
      "Customer data policies and recording retention settings",
    ],
  },
  "working-with-ai-agents": {
    id: "working-with-ai-agents",
    title: "Working with AI Agents",
    category: "Agents",
    readingTime: "14 min",
    difficulty: "Intermediate",
    learns: [
      "The five built-in agent types and their roles",
      "Managing agents and viewing performance metrics",
      "Customizing agent prompts for your workflow",
      "Reviewing and approving agent submissions",
    ],
  },
  "managing-team-access-controls": {
    id: "managing-team-access-controls",
    title: "Managing Team Access Controls",
    category: "Teams",
    readingTime: "11 min",
    difficulty: "Intermediate",
    learns: [
      "Role-based access: Admin, Editor, and Viewer permissions",
      "Organizing members into teams for scoped visibility",
      "Artifact-level sharing and guest access",
      "Auditing access events for compliance",
    ],
  },
  "tracked-changes-and-notes": {
    id: "tracked-changes-and-notes",
    title: "Using Tracked Changes and Notes",
    category: "Artifacts",
    readingTime: "9 min",
    difficulty: "Beginner",
    learns: [
      "How inline tracked changes display additions and deletions",
      "Adding and threading Notes on artifact content",
      "The submission review flow for accepting or requesting revisions",
      "Resolving discussions and preserving comment history",
    ],
  },
  "setting-up-kill-switches": {
    id: "setting-up-kill-switches",
    title: "Setting Up Kill Switches",
    category: "Agents",
    readingTime: "13 min",
    difficulty: "Advanced",
    learns: [
      "What kill switches are and why they exist",
      "Three levels: agent, sharing, and workspace lockdown",
      "Configuring automatic triggers based on anomaly detection",
      "Incident response workflow when a kill switch fires",
    ],
  },
  "building-custom-connectors": {
    id: "building-custom-connectors",
    title: "Building Custom Connectors",
    category: "Integrations",
    readingTime: "20 min",
    difficulty: "Advanced",
    learns: [
      "Connector architecture: auth, sync, and webhook modules",
      "OAuth 2.0 and API key authentication flows",
      "Mapping external data to Lurk's artifact schema",
      "Webhook registration, deduplication, and rate limit handling",
    ],
  },
  "understanding-the-audit-trail": {
    id: "understanding-the-audit-trail",
    title: "Understanding the Audit Trail",
    category: "Privacy",
    readingTime: "12 min",
    difficulty: "Intermediate",
    learns: [
      "What events are logged and what metadata is captured",
      "Navigating, filtering, and searching audit events",
      "Agent audit events and transparency",
      "Generating SOC 2 and GDPR compliance reports",
    ],
  },
  "migrating-from-existing-tools": {
    id: "migrating-from-existing-tools",
    title: "Migrating from Existing Tools",
    category: "Getting Started",
    readingTime: "16 min",
    difficulty: "Advanced",
    learns: [
      "Planning your migration and inventorying current tools",
      "Bulk import from Slack, Teams, Google Workspace, and Notion",
      "How channels and threads map to artifacts and notes",
      "Managing a phased team transition",
    ],
  },
};

// -- Difficulty badge variants -----------------------------------------------

const difficultyVariant: Record<Difficulty, "success" | "default" | "purple"> = {
  Beginner: "success",
  Intermediate: "default",
  Advanced: "purple",
};

// -- Content renderer per tutorial -------------------------------------------

function TutorialContent({ id }: { id: string }) {
  switch (id) {
    // ========================================================================
    // 1. Getting Started with Lurk
    // ========================================================================
    case "getting-started-with-lurk":
      return (
        <>
          <h2>Creating Your Account</h2>
          <p>
            Getting started with Lurk takes less than two minutes. Navigate to the sign-in page and
            click <strong>Sign in with Google</strong>. During the OAuth flow, Lurk requests three
            read-only scopes: <code>documents.readonly</code> to read your Google Docs,{" "}
            <code>drive.readonly</code> to list and read files in your Drive, and{" "}
            <code>gmail.readonly</code> to read email threads. These permissions allow Lurk to track
            document changes as artifacts without ever modifying your Google files.
          </p>
          <p>
            You will see a permissions notice on the login page that explains exactly what each scope
            is used for. If your organization uses Google Workspace admin controls, your IT
            administrator may need to approve the Lurk application before team members can sign in.
            Once you grant consent, your access token is stored securely in your browser session.
          </p>

          <h2>Setting Up Your Workspace</h2>
          <p>
            After signing in for the first time, you will be prompted to create a workspace. Start by
            naming your workspace — this is the display name your team will see (e.g., &ldquo;Acme
            Corp&rdquo; or &ldquo;Product Team&rdquo;). Next, set your organization slug, which is
            used in all workspace URLs (e.g., <code>lurk.app/acme-corp</code>). Choose a slug that
            is short, memorable, and unlikely to change.
          </p>
          <p>
            Select your plan: <strong>Free</strong> includes up to 5 members and 100 artifacts,{" "}
            <strong>Pro</strong> supports unlimited members and artifacts with full agent access, and{" "}
            <strong>Enterprise</strong> adds SSO, advanced compliance controls, and dedicated
            support. You can upgrade at any time from the Settings page. Under Settings, you will
            also find organization-level controls for privacy policies, agent configurations,
            connector management, and team structure.
          </p>

          <h2>Understanding Core Concepts</h2>
          <p>
            Lurk is built around five core concepts that differentiate it from traditional chat
            tools:
          </p>
          <p>
            <strong>Artifacts</strong> are versioned documents from any source — a Google Doc, an
            email thread, a spreadsheet, or a design file. When you connect a source, Lurk treats
            each document as a first-class versioned object, not just a file attachment.
          </p>
          <p>
            <strong>Editions</strong> are snapshots of an artifact at a specific point in time. Every
            meaningful change to an artifact creates a new edition with a commit-style message, a
            diff summary, and the author who made the change. Think of editions as the version
            history for any document.
          </p>
          <p>
            <strong>Submissions</strong> are proposed changes from contributors, similar to pull
            requests. When someone suggests edits to an artifact, those changes become a submission
            that the team can review, discuss, and accept or request revisions on.
          </p>
          <p>
            <strong>Notes</strong> are inline comments attached to specific content within an
            artifact. They support threaded replies, can be resolved when a discussion reaches
            consensus, and persist across editions.
          </p>
          <p>
            <strong>Contributors</strong> are team members who have edit access to artifacts. Each
            contributor&apos;s changes are tracked individually, making it easy to see who changed what
            and when.
          </p>

          <h2>Inviting Your Team</h2>
          <p>
            Navigate to the <strong>Teams</strong> page from the sidebar. Click{" "}
            <strong>Add Member</strong> and enter your teammate&apos;s email address. Assign one of three
            roles:
          </p>
          <p>
            <strong>Admin</strong> — Full access to all settings, policies, agents, and artifacts.
            Admins can invite and remove members, configure privacy policies, and activate kill
            switches.
          </p>
          <p>
            <strong>Editor</strong> — Can create and modify artifacts, submit changes, add notes, and
            comment on submissions. Editors cannot access workspace settings or agent configurations.
          </p>
          <p>
            <strong>Viewer</strong> — Read-only access to artifacts they have been granted access to.
            Viewers can add notes but cannot create artifacts or submit changes.
          </p>
          <p>
            When invited members sign in for the first time, they will go through the same Google
            OAuth consent flow. Their Google files will become available as potential artifacts in the
            workspace once they grant the required permissions.
          </p>

          <h2>Next Steps</h2>
          <p>
            Now that your workspace is set up and your team is invited, dive deeper into how Lurk
            manages documents:
          </p>
          <p>
            <Link href="/tutorials/understanding-artifacts-and-editions" className="text-clay-500 hover:text-clay-600 underline underline-offset-2">
              Understanding Artifacts and Editions
            </Link>{" "}
            — Learn how Lurk turns every document into a versioned artifact with full edition
            history.
          </p>
          <p>
            <Link href="/tutorials/connecting-google-docs" className="text-clay-500 hover:text-clay-600 underline underline-offset-2">
              Connecting Google Docs to Lurk
            </Link>{" "}
            — Configure which Google Docs sync as artifacts and how change detection works.
          </p>
        </>
      );

    // ========================================================================
    // 2. Understanding Artifacts and Editions
    // ========================================================================
    case "understanding-artifacts-and-editions":
      return (
        <>
          <h2>What is an Artifact?</h2>
          <p>
            An artifact is any document, email thread, spreadsheet, or file tracked by Lurk. When
            you connect a Google Doc, every meaningful change creates a new edition — a versioned
            snapshot of the document at that point in time.
          </p>
          <p>
            Each artifact carries rich metadata: a title, the source it came from (Google Docs,
            Gmail, Drive, or a custom connector), the list of contributors who have edited it, a
            creation date, the current edition number, and a status. Lurk treats documents as
            first-class versioned objects, not just files sitting in a folder somewhere. This means
            every artifact has a complete, auditable history from the moment it enters your
            workspace.
          </p>

          <h2>How Editions Work</h2>
          <p>
            Each edition is a snapshot of an artifact at a specific moment. Editions are created
            automatically when Lurk detects meaningful changes, and each one includes a commit-style
            message that follows the format:{" "}
            <code>update(financials): Revise Q2 revenue forecast</code>. This convention makes it
            easy to scan the history and understand what changed at a glance.
          </p>
          <p>
            Every edition captures four things: the full document content as it existed at that
            point, a diff summary describing what changed from the previous edition, who made the
            change, and a precise timestamp. This level of detail means you can always reconstruct
            the exact state of any document at any point in its history.
          </p>
          <p>
            To reduce noise from rapid iterative edits, Lurk batches saves that occur within 5
            minutes by the same author into a single edition. If you make ten small tweaks to a
            paragraph over three minutes, they appear as one cohesive edition rather than ten
            separate entries cluttering the timeline.
          </p>

          <h2>Browsing Artifact History</h2>
          <p>
            On any artifact detail page, scroll down to the <strong>Revision Timeline</strong>{" "}
            section. The timeline displays each edition as a row with four columns: the edition
            number (e.g., v12), the commit message summarizing the change, the author who made the
            edit, and the timestamp.
          </p>
          <p>
            Click any edition in the timeline to view the document exactly as it existed at that
            point. This is a read-only view — you can inspect the content but cannot modify past
            editions. Use this feature to understand how a document evolved, recover content that was
            removed in a later edition, or reference the exact wording of a previous version during
            a team discussion.
          </p>

          <h2>Comparing Editions</h2>
          <p>
            When viewing an artifact, tracked changes appear inline to show exactly what differs
            between editions. Additions are highlighted with an olive green background and underline,
            making new content immediately visible. Deletions appear with a terracotta background,
            strikethrough text, and reduced opacity so you can see what was removed without it
            competing with current content. Comments are marked with a heather purple highlight.
          </p>
          <p>
            This visual diff system makes it easy to review changes without switching between tabs or
            loading separate comparison tools. Select any two editions from the timeline to compare
            them directly, regardless of how many editions apart they are.
          </p>

          <h2>Artifact Statuses</h2>
          <p>
            Every artifact has one of three statuses that control its visibility and workflow stage:
          </p>
          <p>
            <strong>Draft</strong> — The artifact is a work in progress. It is only visible to the
            author and any collaborators who have been explicitly granted access. Use this status
            while you are still iterating on content before it is ready for team review.
          </p>
          <p>
            <strong>Under Review</strong> — A submission has been opened for this artifact, and it
            is awaiting team review. Team members with access can see the proposed changes, add
            notes, and vote to accept or request revisions.
          </p>
          <p>
            <strong>Published</strong> — The artifact has been accepted and is visible to all team
            members who have access. Published artifacts represent the team&apos;s agreed-upon version of
            a document.
          </p>

          <h2>Next Steps</h2>
          <p>
            Continue learning about how to collaborate on artifacts:
          </p>
          <p>
            <Link href="/tutorials/tracked-changes-and-notes" className="text-clay-500 hover:text-clay-600 underline underline-offset-2">
              Using Tracked Changes and Notes
            </Link>{" "}
            — Learn how to annotate artifacts with inline comments and review tracked changes.
          </p>
          <p>
            <Link href="/tutorials/connecting-google-docs" className="text-clay-500 hover:text-clay-600 underline underline-offset-2">
              Connecting Google Docs to Lurk
            </Link>{" "}
            — Set up your Google Workspace integration to start tracking documents automatically.
          </p>
        </>
      );

    // ========================================================================
    // 3. Connecting Google Docs to Lurk
    // ========================================================================
    case "connecting-google-docs":
      return (
        <>
          <h2>Granting Google Workspace Access</h2>
          <p>
            During the sign-in process, Lurk requests three OAuth scopes from your Google account:{" "}
            <code>documents.readonly</code> to read the content and structure of your Google Docs,{" "}
            <code>drive.readonly</code> to list and read files across your Google Drive, and{" "}
            <code>gmail.readonly</code> to read email threads for the Gmail integration.
          </p>
          <p>
            All three scopes are read-only — Lurk never creates, modifies, or deletes any of your
            Google files. Your documents remain exactly as they are in Google Workspace. The access
            token generated during OAuth is stored securely in your browser session and is used to
            authenticate API requests on your behalf. If you ever revoke access from your Google
            account settings, Lurk will prompt you to re-authenticate on your next visit.
          </p>

          <h2>How Sync Works</h2>
          <p>
            Once your Google account is connected, navigate to the <strong>Artifacts</strong> page.
            Under the <strong>Your Files</strong> section, you will see your real Google Docs,
            Sheets, and Drive files listed. Lurk uses the Google Drive API v3 to list files ordered
            by modification time, so the documents you have been working on most recently appear
            first.
          </p>
          <p>
            Each file appears with its source icon (Docs, Sheets, Slides, or generic Drive), the
            document title, the last modified date, and the file owner. Lurk uses the Google Docs
            API to detect structural changes within documents — not just whether a file was touched,
            but whether the actual content changed in a meaningful way.
          </p>

          <h2>Configuring Folder Sync Rules</h2>
          <p>
            By default, Lurk shows your 10 most recently modified files across all of Google Drive.
            For most teams, this is too broad. Navigate to{" "}
            <strong>Settings &rarr; Connectors</strong> to configure folder sync rules.
          </p>
          <p>
            You can narrow the sync scope to specific shared drives, individual folders, or a
            combination of both. For example, you might configure Lurk to only track files in your
            &ldquo;Q2 Planning&rdquo; shared drive and the &ldquo;Client Proposals&rdquo; folder in
            your personal Drive. This keeps your artifact list focused on project-relevant documents
            and avoids cluttering the workspace with personal files or archived content.
          </p>
          <p>
            Sync rules support include and exclude patterns. You can include an entire shared drive
            but exclude a specific subfolder (e.g., exclude &ldquo;Archive&rdquo; or
            &ldquo;Drafts&rdquo;). Changes to sync rules take effect immediately — newly included
            files will appear on the Artifacts page within a few seconds.
          </p>

          <h2>Change Detection and Edition Creation</h2>
          <p>
            When Lurk detects a meaningful change to a synced document — not just whitespace
            adjustments or cursor movements, but actual content modifications — the Doc Change
            Tracker agent generates a diff summary and creates a new edition of the artifact.
          </p>
          <p>
            Changes are categorized into four types: <strong>content</strong> changes (text
            additions, deletions, or modifications), <strong>structure</strong> changes (headings
            added or reordered, sections moved), <strong>formatting</strong> changes (style updates
            that affect readability), and <strong>metadata</strong> changes (title, sharing settings,
            or document properties).
          </p>
          <p>
            The commit message for each edition follows a structured format:{" "}
            <code>&lt;type&gt;(&lt;scope&gt;): &lt;description&gt;</code>. For example:{" "}
            <code>content(executive-summary): Add competitive analysis section</code> or{" "}
            <code>structure(proposal): Reorganize pricing tiers into table format</code>. This
            convention makes it easy to scan the edition history and understand exactly what changed
            and where.
          </p>

          <h2>Next Steps</h2>
          <p>
            Expand your integrations and deepen your understanding of artifacts:
          </p>
          <p>
            <Link href="/tutorials/setting-up-gmail-integration" className="text-clay-500 hover:text-clay-600 underline underline-offset-2">
              Setting Up Gmail Integration
            </Link>{" "}
            — Route important email threads into Lurk to track client communications alongside
            project documents.
          </p>
          <p>
            <Link href="/tutorials/understanding-artifacts-and-editions" className="text-clay-500 hover:text-clay-600 underline underline-offset-2">
              Understanding Artifacts and Editions
            </Link>{" "}
            — Learn how the edition system works and how to compare document versions.
          </p>
        </>
      );

    // ========================================================================
    // 4. Setting Up Gmail Integration
    // ========================================================================
    case "setting-up-gmail-integration":
      return (
        <>
          <h2>Why Track Email in Lurk?</h2>
          <p>
            Client communications, vendor threads, and internal discussions contain critical
            decisions that often get lost in individual inboxes. A pricing agreement buried in an
            email chain, a scope change discussed over three weeks of replies, or a legal
            clarification from outside counsel — these decisions shape projects but remain invisible
            to most of the team.
          </p>
          <p>
            Lurk surfaces email threads as artifacts so your team can review, annotate, and reference
            them alongside project documents. When an important email thread becomes an artifact, it
            gains the same versioning, commenting, and access control capabilities as any other
            document in your workspace.
          </p>

          <h2>Connecting Gmail</h2>
          <p>
            The <code>gmail.readonly</code> scope is requested during the Google sign-in flow. If
            you already signed in with Google Docs and Drive permissions, you may need to
            re-authenticate to grant the additional Gmail scope. Navigate to{" "}
            <strong>Settings &rarr; Connectors &rarr; Gmail</strong> to verify your connection
            status.
          </p>
          <p>
            Once the Gmail scope is granted, your recent messages appear under the{" "}
            <strong>Emails</strong> tab on the Artifacts page. Lurk uses the Gmail API v1 to fetch
            message metadata — subject line, sender, date, and labels — without downloading full
            message bodies until you explicitly open an artifact. This means connecting Gmail does
            not trigger a large initial sync; messages are fetched on demand.
          </p>

          <h2>Label-Based Filtering</h2>
          <p>
            Not every email belongs in your workspace. Configure which Gmail labels to track under{" "}
            <strong>Settings &rarr; Connectors &rarr; Gmail &rarr; Label Filters</strong>. Common
            patterns include:
          </p>
          <p>
            Track all messages with a custom &ldquo;Lurk&rdquo; label — apply this label in Gmail to
            any thread you want surfaced in your workspace. Track everything in &ldquo;Clients&rdquo;
            and &ldquo;Projects&rdquo; labels to automatically capture all client-facing
            communications. Or take the exclusion approach: track all inbox messages except those
            categorized as &ldquo;Promotions&rdquo; and &ldquo;Social&rdquo; by Gmail&apos;s automatic
            categorization.
          </p>
          <p>
            Label filters are evaluated in real time. When you add or remove a label from a thread in
            Gmail, Lurk picks up the change on the next sync cycle (typically within a few minutes)
            and adds or removes the corresponding artifact.
          </p>

          <h2>Thread Grouping</h2>
          <p>
            Lurk groups related messages by Gmail thread ID, so a 15-message email chain becomes a
            single artifact with multiple editions rather than 15 separate items cluttering your
            workspace. Each reply in the thread creates a new edition of the artifact, preserving the
            full conversation history in chronological order.
          </p>
          <p>
            The artifact title is derived from the email subject line, and each edition shows the
            sender, timestamp, and message content. This makes it straightforward to review an entire
            email conversation in the same interface you use for documents, with the same commenting
            and tracked changes tools available.
          </p>

          <h2>Privacy Considerations</h2>
          <p>
            Email content frequently contains sensitive information — personal details, financial
            figures, confidential business terms, and personally identifiable information. Before
            sharing email artifacts with your team, configure redaction policies under{" "}
            <strong>Privacy Policies</strong> to automatically detect and mask PII in email
            artifacts.
          </p>
          <p>
            The Privacy Scanner agent can run on email artifacts to flag sensitive content before it
            is shared with the team. This is especially important for email threads that contain
            customer data, contract terms, or internal HR discussions. Set the agent to scan new
            email artifacts automatically, or run it on demand from the artifact detail page.
          </p>

          <h2>Next Steps</h2>
          <p>
            Secure your email artifacts and explore AI-powered analysis:
          </p>
          <p>
            <Link href="/tutorials/configuring-privacy-policies" className="text-clay-500 hover:text-clay-600 underline underline-offset-2">
              Configuring Privacy Policies
            </Link>{" "}
            — Set up redaction levels and content access controls to protect sensitive email content.
          </p>
          <p>
            <Link href="/tutorials/working-with-ai-agents" className="text-clay-500 hover:text-clay-600 underline underline-offset-2">
              Working with AI Agents
            </Link>{" "}
            — Learn how agents can summarize email threads, detect PII, and surface key decisions.
          </p>
        </>
      );

    // ========================================================================
    // 5. Configuring Privacy Policies
    // ========================================================================
    case "configuring-privacy-policies":
      return (
        <>
          <h2>Lurk&apos;s Privacy Architecture</h2>
          <p>
            Lurk uses a three-layer privacy model designed to meet SOC 2 Type II and GDPR
            requirements while keeping configuration straightforward for your team.
          </p>
          <p>
            <strong>Layer 1: On-device PII detection.</strong> Sensitive data is identified before it
            leaves your browser. The client-side scanner recognizes common PII patterns — Social
            Security numbers, credit card numbers, phone numbers, and email addresses — and flags
            them before any content is transmitted to Lurk&apos;s servers. This means sensitive data can
            be caught at the earliest possible point.
          </p>
          <p>
            <strong>Layer 2: Tenant-isolated processing.</strong> Your organization&apos;s data is
            processed in complete isolation from other tenants. There is no shared infrastructure
            between organizations — each workspace has its own processing pipeline, encryption keys,
            and storage partition. Data from one organization is never accessible to another, even at
            the infrastructure level.
          </p>
          <p>
            <strong>Layer 3: Granular sharing controls.</strong> Fine-grained rules govern who can
            see what within your organization. Sharing controls operate at the artifact, team, and
            individual level, giving you precise control over information flow.
          </p>

          <h2>Redaction Levels</h2>
          <p>
            Navigate to <strong>Settings &rarr; Privacy &amp; Agent Policies</strong> to configure
            your organization&apos;s redaction level. Lurk offers three options:
          </p>
          <p>
            <strong>Minimal</strong> — Only high-confidence PII is redacted: Social Security
            numbers, credit card numbers, and bank account numbers. Use this level when your team
            works primarily with internal documents that rarely contain customer PII.
          </p>
          <p>
            <strong>Standard</strong> — PII plus financial data (dollar amounts, invoice numbers)
            and internal identifiers (employee IDs, account numbers) are redacted. This is the
            default level and is appropriate for most teams. It balances data protection with
            usability — your team can still read and work with documents effectively while sensitive
            details are masked.
          </p>
          <p>
            <strong>Strict</strong> — All identifiable information is redacted, including
            organization names, email addresses, phone numbers, and physical addresses. Use this
            level in regulated industries (healthcare, finance, legal) where maximum data protection
            is required by compliance frameworks.
          </p>

          <h2>Content Access Controls</h2>
          <p>
            Choose from three content access models that determine how artifacts are shared within
            your organization:
          </p>
          <p>
            <strong>Open Access</strong> — All members can see all artifacts in the workspace. This
            model is suitable for small, high-trust teams where transparency is more valuable than
            access restrictions. Every artifact is visible to every member regardless of team
            assignment.
          </p>
          <p>
            <strong>Team-Based</strong> — Artifacts are scoped to team visibility. Members of the
            Engineering team see engineering artifacts; members of Sales see sales artifacts. A
            member who belongs to multiple teams sees artifacts from all their teams. This is the
            default for most organizations and strikes a balance between openness and
            compartmentalization.
          </p>
          <p>
            <strong>Need-to-Know</strong> — Every artifact requires an explicit access grant. No
            member can see an artifact unless they are specifically added to its access list. This
            model is required for regulated industries and provides the tightest control over
            information access, at the cost of requiring more administrative overhead.
          </p>

          <h2>Customer Data Policy</h2>
          <p>
            The customer data policy controls how customer-related information is processed by AI
            agents. Navigate to <strong>Privacy &amp; Agent Policies &rarr; Customer Data</strong>{" "}
            to choose:
          </p>
          <p>
            <strong>Full Access</strong> — Agents see customer data as-is. Use this when agents need
            full context to provide accurate analysis (e.g., the Customer Health Analyzer needs real
            customer names to track engagement across artifacts).
          </p>
          <p>
            <strong>Anonymized</strong> — Customer names and identifiers are replaced with tokens
            (e.g., &ldquo;Customer-A&rdquo;, &ldquo;Customer-B&rdquo;) before being passed to
            agents. The agent can still analyze patterns and trends but cannot identify specific
            customers. Use this when you want agent insights without exposing customer identities.
          </p>
          <p>
            <strong>Restricted</strong> — No customer data is included in agent context. Agents
            operate only on non-customer content. Choose this option when compliance requirements
            prohibit any customer data processing by third-party AI systems.
          </p>

          <h2>Recording and Retention</h2>
          <p>
            Under the <strong>Recording &amp; Retention</strong> tab, configure policies for meeting
            recordings and data retention. Specify whether meetings require explicit consent from
            all participants before recording begins, whether recordings are automatically
            transcribed into artifacts, and the retention period for recorded content (options range
            from 30 days to indefinite).
          </p>
          <p>
            All privacy settings are versioned. Every policy change is logged in the{" "}
            <strong>Version History</strong> tab with a record of who changed the setting, what the
            previous value was, and when the change took effect. This audit trail of configuration
            changes is essential for compliance and for understanding how your policies have evolved
            over time.
          </p>

          <h2>Next Steps</h2>
          <p>
            Strengthen your compliance posture and refine access controls:
          </p>
          <p>
            <Link href="/tutorials/understanding-the-audit-trail" className="text-clay-500 hover:text-clay-600 underline underline-offset-2">
              Understanding the Audit Trail
            </Link>{" "}
            — Learn how to navigate audit events and generate compliance reports for SOC 2 and GDPR.
          </p>
          <p>
            <Link href="/tutorials/managing-team-access-controls" className="text-clay-500 hover:text-clay-600 underline underline-offset-2">
              Managing Team Access Controls
            </Link>{" "}
            — Set up role-based access, guest permissions, and artifact-level sharing rules.
          </p>
        </>
      );

    // ========================================================================
    // 6. Working with AI Agents
    // ========================================================================
    case "working-with-ai-agents":
      return (
        <>
          <h2>What Are Lurk Agents?</h2>
          <p>
            Agents are AI-powered assistants that operate on your artifacts. Each agent has a
            specific role within your workspace, and they work autonomously within the boundaries you
            define. Lurk ships with five built-in agents:
          </p>
          <p>
            The <strong>Artifact Reviewer</strong> provides editorial feedback on submissions —
            grammar, clarity, consistency, and tone. The <strong>Privacy Scanner</strong> detects PII
            and sensitive content in artifacts, flagging items that need redaction before sharing. The{" "}
            <strong>Knowledge Synthesizer</strong> connects information across artifacts, surfacing
            relevant context when you are working on a document. The{" "}
            <strong>Customer Health Analyzer</strong> monitors client engagement across email threads
            and documents, generating health scores and risk alerts. The{" "}
            <strong>Doc Change Tracker</strong> monitors connected Google Docs for structural changes
            and creates new editions when meaningful updates are detected.
          </p>
          <p>
            All agents use Claude Sonnet 4.6 by default, though Enterprise plans support
            configuring alternative models for specific agents.
          </p>

          <h2>Agent Management</h2>
          <p>
            Navigate to the <strong>Agents</strong> page from the sidebar. The agent dashboard shows
            every agent configured in your workspace. Each agent card displays its current status
            (active, paused, disabled, or error), type (marketplace, custom, or skill), the model it
            uses, its accept rate (how often the team approves the agent&apos;s suggestions), and a
            summary of recent activity.
          </p>
          <p>
            Click any agent to expand its detail panel. Here you can view the agent&apos;s full prompt,
            review performance metrics over time (submissions created, acceptance rate trend, average
            response time), and see a log of every action the agent has taken. Use the status toggle
            to pause an agent temporarily — paused agents stop processing new artifacts but retain
            their configuration and history.
          </p>

          <h2>Editing Agent Prompts</h2>
          <p>
            Each agent&apos;s behavior is defined by its prompt — a set of instructions that tell the
            agent what to analyze, how to format its output, and what severity levels to use for
            different types of findings. Click <strong>Edit Prompt</strong> on any agent to customize
            its instructions.
          </p>
          <p>
            For example, you might add industry-specific terminology to the Artifact Reviewer&apos;s
            prompt so it understands your domain vocabulary and does not flag technical terms as
            errors. Or you might adjust the Customer Health Analyzer&apos;s scoring weights to
            prioritize response time over email frequency for your business model. Prompt changes
            take effect immediately for all new agent actions — existing submissions are not
            reprocessed unless you explicitly trigger a rescan.
          </p>

          <h2>Agent Permissions and Scopes</h2>
          <p>
            Agents operate within defined scopes that control which artifacts they can access. A
            scope is a tag-based filter — for example, an agent with scope &ldquo;sales&rdquo; only
            sees artifacts tagged with the sales team. An agent with scope &ldquo;all&rdquo; can
            access every artifact in the workspace.
          </p>
          <p>
            Configure scopes based on your team structure and data sensitivity requirements. The
            Privacy Scanner might have scope &ldquo;all&rdquo; so it can scan every artifact for
            PII, while the Customer Health Analyzer might be scoped to &ldquo;sales&rdquo; and
            &ldquo;customer-success&rdquo; where client-facing content lives. Restricting scopes is
            a best practice — it limits the blast radius if an agent behaves unexpectedly and ensures
            agents only process content that is relevant to their function.
          </p>

          <h2>Reviewing Agent Actions</h2>
          <p>
            When an agent suggests changes to an artifact, it creates a submission — similar to a
            pull request in code review. The submission appears on the artifact detail page with a
            badge indicating it was created by an agent rather than a human contributor.
          </p>
          <p>
            Your team reviews agent submissions the same way they review human submissions: read the
            tracked changes, add notes on specific suggestions, and then choose{" "}
            <strong>Accept Changes</strong> to merge the submission into the published edition or{" "}
            <strong>Request Revisions</strong> to send feedback. The accept rate metric on each
            agent&apos;s dashboard shows how often the team approves the agent&apos;s suggestions over time —
            a declining accept rate is a signal that the agent&apos;s prompt may need tuning.
          </p>

          <h2>Next Steps</h2>
          <p>
            Learn how to maintain control over your agents and protect your data:
          </p>
          <p>
            <Link href="/tutorials/setting-up-kill-switches" className="text-clay-500 hover:text-clay-600 underline underline-offset-2">
              Setting Up Kill Switches
            </Link>{" "}
            — Configure emergency controls to instantly disable agents if they behave unexpectedly.
          </p>
          <p>
            <Link href="/tutorials/configuring-privacy-policies" className="text-clay-500 hover:text-clay-600 underline underline-offset-2">
              Configuring Privacy Policies
            </Link>{" "}
            — Control what data agents can access and how customer information is processed.
          </p>
        </>
      );

    // ========================================================================
    // 7. Managing Team Access Controls
    // ========================================================================
    case "managing-team-access-controls":
      return (
        <>
          <h2>Role-Based Access</h2>
          <p>
            Lurk ships with three built-in roles that cover most organizational needs. Understanding
            what each role can and cannot do is essential for maintaining the right balance between
            openness and security.
          </p>
          <p>
            <strong>Admin</strong> — Full access to all settings, privacy policies, agent
            configurations, and artifacts. Admins can invite and remove members, change roles,
            configure connectors, activate kill switches, and export audit reports. Every workspace
            must have at least one admin.
          </p>
          <p>
            <strong>Editor</strong> — Can create and modify artifacts, submit changes for review, add
            notes and comments, and interact with agent submissions. Editors cannot modify workspace
            settings, configure agents, or access other members&apos; private drafts. This is the
            standard role for active contributors.
          </p>
          <p>
            <strong>Viewer</strong> — Read-only access to artifacts they have been granted access to.
            Viewers can add notes (to ask questions or provide feedback) but cannot create artifacts,
            submit changes, or modify any content. This role is appropriate for stakeholders who need
            visibility without edit capability.
          </p>
          <p>
            Assign roles on the <strong>Teams</strong> page when inviting members. You can change a
            member&apos;s role at any time — the change takes effect immediately and is logged in the
            audit trail.
          </p>

          <h2>Team Structure</h2>
          <p>
            Organize members into teams that map to your organizational structure. Common examples
            include Engineering, Sales, Product, Design, and Legal. Teams serve two primary purposes:
            they determine default artifact visibility when using the Team-Based content access model,
            and they provide a convenient way to manage permissions at scale.
          </p>
          <p>
            A member can belong to multiple teams. A product manager might be in both Product and
            Engineering teams, giving them visibility into artifacts from both groups. Create teams
            from the <strong>Teams</strong> page by clicking <strong>Create Team</strong>, naming the
            team, and adding members. Team membership changes take effect immediately.
          </p>

          <h2>Artifact-Level Sharing</h2>
          <p>
            Beyond team-level defaults, you can set per-artifact sharing rules for fine-grained
            control. On any artifact detail page, click the sharing icon to open the access panel.
            Here you can grant access to specific individuals (regardless of their team membership)
            or revoke access for individuals who would otherwise have it through their team.
          </p>
          <p>
            This is essential for sensitive documents. A compensation planning spreadsheet should be
            visible only to HR and the executive team, not the entire organization. A legal review
            document might need to be shared with outside counsel (a guest user) while remaining
            hidden from most internal team members. Artifact-level sharing gives you the precision to
            handle these cases without restructuring your entire team hierarchy.
          </p>

          <h2>Guest Access</h2>
          <p>
            Invite external collaborators — clients, contractors, auditors, or legal counsel — with
            Guest access. Guests receive an email invitation with a sign-in link. Once authenticated,
            they see only the artifacts that have been explicitly shared with them.
          </p>
          <p>
            Guests cannot access workspace settings, agent configurations, team membership lists, or
            any content beyond their explicitly shared artifacts. Guest sessions are logged in the
            audit trail with the same level of detail as internal member sessions, so you always have
            visibility into what external collaborators accessed and when.
          </p>

          <h2>Auditing Access</h2>
          <p>
            The <strong>Audit Trail</strong> page records every access event in your workspace: who
            viewed an artifact, when they viewed it, and from which device and IP address. Use the
            filter bar to narrow results by user, artifact, action type, or time range.
          </p>
          <p>
            For compliance reporting, generate structured exports that document access patterns over
            any time period. These reports satisfy the evidence requirements for SOC 2 Type II access
            control assessments and GDPR data access logging. The audit trail is immutable — events
            cannot be edited or deleted, even by admins, ensuring the integrity of your compliance
            records.
          </p>

          <h2>Next Steps</h2>
          <p>
            Secure your workspace further with privacy policies and audit capabilities:
          </p>
          <p>
            <Link href="/tutorials/configuring-privacy-policies" className="text-clay-500 hover:text-clay-600 underline underline-offset-2">
              Configuring Privacy Policies
            </Link>{" "}
            — Set up redaction levels, content access models, and customer data policies.
          </p>
          <p>
            <Link href="/tutorials/understanding-the-audit-trail" className="text-clay-500 hover:text-clay-600 underline underline-offset-2">
              Understanding the Audit Trail
            </Link>{" "}
            — Learn how to navigate, filter, and export audit events for compliance.
          </p>
        </>
      );

    // ========================================================================
    // 8. Using Tracked Changes and Notes
    // ========================================================================
    case "tracked-changes-and-notes":
      return (
        <>
          <h2>How Tracked Changes Work</h2>
          <p>
            When an artifact is updated — whether by a human contributor editing a Google Doc or an
            AI agent suggesting improvements — Lurk displays the changes inline on the artifact
            detail page. This tracked changes view is the primary way your team reviews what has been
            modified between editions.
          </p>
          <p>
            Additions appear with an olive green background and underline, making new content
            immediately visible. Deletions appear with a terracotta background, strikethrough text,
            and reduced opacity, so removed content is still readable but visually distinct from
            current content. This color coding is consistent throughout the application, so your team
            quickly learns to scan documents for changes at a glance.
          </p>
          <p>
            The tracked changes view is not a separate mode you need to toggle — it is the default
            display whenever you are viewing an artifact that has been updated. To see the clean
            version without change markup, click <strong>View Published</strong> to see only the
            accepted content.
          </p>

          <h2>Adding Notes</h2>
          <p>
            Click any highlighted section of an artifact to add a Note — an inline comment attached
            to that specific piece of content. A Note panel opens in the right margin with a text
            field for your comment. After you submit your Note, it appears anchored to the content
            you selected, displaying your name, a timestamp, and the comment text.
          </p>
          <p>
            Notes support threaded replies. Other team members can respond to your Note, creating a
            focused discussion about that specific part of the document. This is far more effective
            than discussing document changes in a separate chat channel, because the conversation
            stays attached to the content it references.
          </p>
          <p>
            Notes are persistent across editions. If the surrounding text changes in a subsequent
            edition, Lurk reattaches the Note to the closest matching content. This means
            discussions are not lost when the document evolves — they follow the content they are
            about.
          </p>

          <h2>The Submission Review Flow</h2>
          <p>
            When a contributor (human or AI agent) submits changes to an artifact, the artifact
            detail page shows the full tracked changes view with all proposed modifications visible.
            This is the review interface where your team evaluates the submission.
          </p>
          <p>
            Reviewers can add Notes on specific changes to ask questions, suggest alternatives, or
            flag concerns. Once the review is complete, the reviewer chooses one of two actions:{" "}
            <strong>Accept Changes</strong> merges the submission into the published edition, making
            the changes part of the official artifact. <strong>Request Revisions</strong> sends the
            submission back to the contributor with the reviewer&apos;s Notes as feedback. The
            contributor can then revise and resubmit.
          </p>
          <p>
            This flow mirrors the pull request review workflow familiar to engineering teams, applied
            to any type of document. It ensures that every change to important artifacts is reviewed
            by at least one other team member before it becomes the published version.
          </p>

          <h2>Resolving Discussions</h2>
          <p>
            Once a Note thread reaches consensus — whether that means the suggested change was
            accepted, the question was answered, or the concern was addressed — any participant in
            the thread can mark it as resolved. Resolved Notes collapse in the margin to reduce
            visual clutter but remain in the history.
          </p>
          <p>
            You can view resolved Notes by toggling the <strong>Show Resolved</strong> filter on the
            artifact detail page. Navigate to any previous edition to see Notes exactly as they
            existed at that point in time, including which Notes were open and which were resolved.
            This preserves the full context of your team&apos;s decision-making process.
          </p>

          <h2>Next Steps</h2>
          <p>
            Deepen your understanding of artifacts and explore agent-powered reviews:
          </p>
          <p>
            <Link href="/tutorials/understanding-artifacts-and-editions" className="text-clay-500 hover:text-clay-600 underline underline-offset-2">
              Understanding Artifacts and Editions
            </Link>{" "}
            — Learn how editions capture the full history of document changes.
          </p>
          <p>
            <Link href="/tutorials/working-with-ai-agents" className="text-clay-500 hover:text-clay-600 underline underline-offset-2">
              Working with AI Agents
            </Link>{" "}
            — Discover how AI agents create submissions and how to review their suggestions.
          </p>
        </>
      );

    // ========================================================================
    // 9. Setting Up Kill Switches
    // ========================================================================
    case "setting-up-kill-switches":
      return (
        <>
          <h2>What Are Kill Switches?</h2>
          <p>
            Kill switches are emergency controls that instantly revoke agent access, freeze artifact
            sharing, or lock down an entire workspace. They exist because AI agents operating
            autonomously can occasionally produce unexpected results — a misconfigured prompt might
            cause an agent to flood artifacts with unhelpful suggestions, or a scope that is too
            broad might allow an agent to access sensitive content it should not see.
          </p>
          <p>
            Your team needs the ability to stop any agent immediately, without waiting for a support
            ticket or a configuration change to propagate. Kill switches provide that capability,
            and they can be triggered either manually by an admin or automatically based on
            configurable anomaly detection thresholds.
          </p>

          <h2>Types of Kill Switches</h2>
          <p>
            Lurk provides three levels of emergency control, each with increasing scope:
          </p>
          <p>
            <strong>Agent Kill Switch</strong> — Disables a specific agent immediately. All pending
            submissions from that agent are paused, and the agent stops processing new artifacts. Use
            this when a single agent is behaving unexpectedly — for example, if the Artifact Reviewer
            starts generating irrelevant feedback or the Privacy Scanner is producing false positives
            at a high rate.
          </p>
          <p>
            <strong>Sharing Kill Switch</strong> — Freezes all external sharing across the workspace.
            No artifacts can be shared outside the organization until the switch is lifted. Existing
            guest access is suspended (guests see an access revoked message). Use this when you
            suspect a data leak or when an audit reveals that artifacts were shared inappropriately.
          </p>
          <p>
            <strong>Workspace Lockdown</strong> — The most severe option. Pauses all agent activity,
            restricts artifact access to admins only, and suspends all external integrations. Regular
            members and editors see a maintenance mode message. Use this only in critical incidents
            when you need to freeze the entire workspace to investigate a serious issue.
          </p>

          <h2>Automatic Triggers</h2>
          <p>
            Kill switches can fire automatically based on anomaly detection. Navigate to{" "}
            <strong>Settings &rarr; Kill Switches</strong> to configure thresholds for each switch
            type.
          </p>
          <p>
            For the Agent Kill Switch, set thresholds like: if an agent&apos;s error rate exceeds 20%
            over a 1-hour window, auto-disable it. Or if an agent creates more than 50 submissions
            in a 10-minute window (suggesting runaway behavior), auto-disable it immediately.
          </p>
          <p>
            For the Sharing Kill Switch, set thresholds like: if more than 50 artifacts are shared
            externally in a 10-minute window, auto-freeze sharing. Or if a single user shares more
            than 20 artifacts externally in an hour, freeze sharing and flag the user for admin
            review.
          </p>
          <p>
            These thresholds are fully customizable per organization. Start with the defaults (which
            are tuned for medium-sized teams) and adjust based on your team&apos;s normal patterns of
            activity.
          </p>

          <h2>Manual Activation</h2>
          <p>
            Any Admin can activate a kill switch from the <strong>Kill Switches</strong> page. Click
            the switch you want to activate, confirm the action in the dialog, and optionally enter a
            reason (e.g., &ldquo;Agent producing incorrect PII flags&rdquo; or &ldquo;Investigating
            unauthorized external share&rdquo;). The activation is logged in the audit trail with
            the reason, the activating user, and a timestamp.
          </p>
          <p>
            Other admins are notified immediately via their configured notification channels (email,
            or a webhook to your team&apos;s alerting system). This ensures that the entire admin team is
            aware when a kill switch is activated, even if they are not actively using Lurk at the
            time.
          </p>

          <h2>Incident Response Workflow</h2>
          <p>
            When a kill switch fires — whether automatically or manually — follow this workflow to
            resolve the incident:
          </p>
          <p>
            <strong>Step 1:</strong> The triggering event is logged with full context — which
            threshold was breached, which agent or user was involved, and what the anomalous activity
            looked like.
          </p>
          <p>
            <strong>Step 2:</strong> Affected agents are paused and all their pending submissions are
            held in a queue. No agent submissions are lost — they are preserved for review once the
            incident is resolved.
          </p>
          <p>
            <strong>Step 3:</strong> Admins are notified through all configured channels.
          </p>
          <p>
            <strong>Step 4:</strong> Review the audit trail to understand exactly what happened. Look
            at the sequence of events leading up to the trigger, the specific artifacts and agents
            involved, and any patterns that explain the anomaly.
          </p>
          <p>
            <strong>Step 5:</strong> Fix the root cause. This might mean adjusting an agent&apos;s
            prompt, narrowing its scope, updating a privacy policy, or revoking a user&apos;s sharing
            permissions.
          </p>
          <p>
            <strong>Step 6:</strong> Deactivate the kill switch to resume normal operations. Review
            any held submissions and process them as appropriate.
          </p>

          <h2>Next Steps</h2>
          <p>
            Understand the tools that support your incident response:
          </p>
          <p>
            <Link href="/tutorials/working-with-ai-agents" className="text-clay-500 hover:text-clay-600 underline underline-offset-2">
              Working with AI Agents
            </Link>{" "}
            — Learn agent management, prompt editing, and scope configuration to prevent incidents.
          </p>
          <p>
            <Link href="/tutorials/understanding-the-audit-trail" className="text-clay-500 hover:text-clay-600 underline underline-offset-2">
              Understanding the Audit Trail
            </Link>{" "}
            — Navigate audit events to investigate incidents and generate compliance reports.
          </p>
        </>
      );

    // ========================================================================
    // 10. Building Custom Connectors
    // ========================================================================
    case "building-custom-connectors":
      return (
        <>
          <h2>What Are Connectors?</h2>
          <p>
            Connectors are integrations that bring external data into Lurk as artifacts. The built-in
            connectors cover Google Docs, Gmail, and Google Drive, but your team likely uses other
            tools — Figma for design files, Linear or Jira for project tracking, Notion for wikis,
            or custom internal databases for proprietary data.
          </p>
          <p>
            The Lurk Connector SDK lets you build integrations for any external service, transforming
            its data into artifacts that your team can version, review, annotate, and share using
            all of Lurk&apos;s standard tools. Once connected, external data is treated identically to
            Google Docs data — it has editions, tracked changes, notes, and access controls.
          </p>

          <h2>Connector Architecture</h2>
          <p>
            Every connector has three components that handle different aspects of the integration:
          </p>
          <p>
            The <strong>Authentication module</strong> handles OAuth or API key exchange with the
            external service. It manages the initial authorization flow, stores encrypted credentials
            per-user, and handles automatic token refresh when access tokens expire.
          </p>
          <p>
            The <strong>Sync module</strong> fetches data from the external service and maps it to
            Lurk&apos;s artifact schema. It runs on a configurable schedule (e.g., every 5 minutes) or
            can be triggered manually. The sync module is responsible for detecting changes and
            determining when a new edition should be created.
          </p>
          <p>
            The <strong>Webhook module</strong> receives real-time notifications from the external
            service when data changes. This provides faster updates than polling — instead of waiting
            for the next sync cycle, changes are captured within seconds of occurring in the source
            system.
          </p>

          <h2>Authentication Flows</h2>
          <p>
            The SDK supports two authentication methods: OAuth 2.0 (both authorization code and
            client credentials grants) and static API key authentication. Configure your connector&apos;s
            auth flow in the connector manifest file:
          </p>
          <pre className="bg-ink-50 border border-ink-200 rounded-lg p-4 text-sm font-mono text-ink-700 overflow-x-auto my-6">
{`{
  "name": "my-connector",
  "version": "1.0.0",
  "auth": {
    "type": "oauth2",
    "authorizationUrl": "https://api.example.com/oauth/authorize",
    "tokenUrl": "https://api.example.com/oauth/token",
    "scopes": ["read:projects", "read:issues"]
  }
}`}
          </pre>
          <p>
            Lurk stores encrypted credentials per-user and handles token refresh automatically. When
            a user connects your custom connector, they see the same clean OAuth consent flow they
            are familiar with from the Google integration. For API key authentication, the key is
            entered once and stored encrypted — it is never exposed in the UI after initial entry.
          </p>

          <h2>Artifact Schema Mapping</h2>
          <p>
            External data must be mapped to Lurk&apos;s artifact schema. Every artifact has a standard
            shape:
          </p>
          <pre className="bg-ink-50 border border-ink-200 rounded-lg p-4 text-sm font-mono text-ink-700 overflow-x-auto my-6">
{`{
  "id": "unique-identifier",
  "title": "Human-readable title",
  "content": "The full document content",
  "source": "my-connector",
  "mimeType": "text/plain",
  "lastModified": "2026-03-28T14:30:00Z",
  "owner": "user@example.com",
  "metadata": {
    "priority": "high",
    "assignee": "jane@example.com",
    "status": "in-progress"
  }
}`}
          </pre>
          <p>
            The SDK provides helper functions for common transformations. For a Jira integration, the
            issue summary maps to <code>title</code>, the description plus comments map to{" "}
            <code>content</code>, and fields like priority, assignee, sprint, and status map to{" "}
            <code>metadata</code>. For a Figma integration, the file name maps to <code>title</code>,
            the rendered frame exports map to <code>content</code>, and version history provides
            edition data.
          </p>

          <h2>Webhook Registration and Rate Limits</h2>
          <p>
            Register webhooks with the external service to receive real-time change notifications.
            The SDK handles webhook verification (validating that incoming requests genuinely
            originate from the external service), deduplication (filtering out duplicate events that
            some APIs send), and retry logic (reprocessing events that fail on the first attempt).
          </p>
          <p>
            Respect external API rate limits by configuring <code>maxRequestsPerMinute</code> in your
            connector manifest:
          </p>
          <pre className="bg-ink-50 border border-ink-200 rounded-lg p-4 text-sm font-mono text-ink-700 overflow-x-auto my-6">
{`{
  "sync": {
    "schedule": "*/5 * * * *",
    "maxRequestsPerMinute": 60,
    "batchSize": 50
  },
  "webhooks": {
    "endpoint": "/webhooks/my-connector",
    "secret": "WEBHOOK_SECRET",
    "events": ["item.created", "item.updated"]
  }
}`}
          </pre>
          <p>
            The SDK queues requests and backs off automatically when rate limits are approached. If
            the external API returns a 429 (Too Many Requests) response, the SDK pauses requests and
            resumes after the retry-after period. This prevents your connector from being blocked by
            the external service due to aggressive polling.
          </p>

          <h2>Next Steps</h2>
          <p>
            Learn more about the built-in connectors to understand patterns for your custom
            integration:
          </p>
          <p>
            <Link href="/tutorials/connecting-google-docs" className="text-clay-500 hover:text-clay-600 underline underline-offset-2">
              Connecting Google Docs to Lurk
            </Link>{" "}
            — See how the built-in Google Docs connector handles sync, change detection, and edition
            creation.
          </p>
          <p>
            <Link href="/tutorials/setting-up-gmail-integration" className="text-clay-500 hover:text-clay-600 underline underline-offset-2">
              Setting Up Gmail Integration
            </Link>{" "}
            — Understand how the Gmail connector handles thread grouping and label-based filtering.
          </p>
        </>
      );

    // ========================================================================
    // 11. Understanding the Audit Trail
    // ========================================================================
    case "understanding-the-audit-trail":
      return (
        <>
          <h2>What Gets Logged</h2>
          <p>
            Every action in Lurk generates an audit event. There are no exceptions — the audit trail
            is comprehensive by design, because partial logging undermines both compliance and trust.
            The following actions are recorded:
          </p>
          <p>
            Artifact events: views, edits, shares, status changes, and deletion. Agent events:
            submissions created, scans performed, health reports generated, and errors encountered.
            Policy events: privacy policy changes, redaction level updates, and access model
            modifications. User events: sign-ins, sign-outs, role changes, team membership changes,
            and guest invitations. System events: kill switch activations, connector sync operations,
            and webhook deliveries.
          </p>
          <p>
            Each event records five pieces of information: the actor (who performed the action), the
            action type (what they did), the target resource (which artifact, agent, or setting was
            affected), a timestamp (when it happened), and client metadata (IP address, device type,
            and browser). This level of detail ensures that any question about &ldquo;who did what
            and when&rdquo; can be answered definitively.
          </p>

          <h2>Navigating the Audit Trail</h2>
          <p>
            The <strong>Audit</strong> page shows events in reverse chronological order — the most
            recent events appear first. The default view shows all events from the past 24 hours, but
            you can adjust the time range to any period within your retention window.
          </p>
          <p>
            Use the filter bar to narrow results by: <strong>user</strong> (who performed the
            action), <strong>action type</strong> (view, edit, share, agent_action, policy_change,
            sign_in), <strong>resource</strong> (a specific artifact or agent), and{" "}
            <strong>time range</strong> (any start and end date). Filters can be combined — for
            example, show all &ldquo;share&rdquo; actions by a specific user in the past week.
          </p>
          <p>
            Full-text search is also available. Type a keyword into the search bar to find events
            that match by resource name, user name, or event description. This is useful when you
            know what you are looking for but not exactly when it happened or who was involved.
          </p>

          <h2>Agent Audit Events</h2>
          <p>
            When an agent takes an action — creates a submission, scans an artifact for PII,
            generates a customer health report, or encounters an error — the audit trail records
            detailed information about the event:
          </p>
          <p>
            Which agent performed the action, what type of action it was, which artifacts were
            accessed as input, what output the agent produced (the submission content, scan results,
            or health score), and the elapsed time for the operation. If the agent encountered an
            error, the error message and stack trace are included.
          </p>
          <p>
            This transparency is critical for understanding and trusting agent behavior. When an
            agent produces an unexpected result, the audit trail lets you trace exactly what inputs
            it received, what it produced, and how long it took. This information is essential for
            debugging agent prompts and scopes, and for demonstrating to stakeholders that AI
            operations are fully observable.
          </p>

          <h2>Generating Compliance Reports</h2>
          <p>
            Click <strong>Export</strong> on the Audit page to generate compliance reports. Lurk
            supports two standard report formats:
          </p>
          <p>
            <strong>SOC 2 Type II</strong> — Generates evidence for three control domains: access
            control (who accessed what resources and when), change management (all modifications to
            artifacts, policies, and configurations with before/after values), and incident response
            (kill switch activations, agent errors, and resolution timelines). The report covers
            your selected time period and includes all events relevant to each control domain.
          </p>
          <p>
            <strong>GDPR</strong> — Generates documentation for data processing compliance: data
            access logs (every instance of personal data being accessed), consent records (user
            consent grants and revocations for OAuth scopes and recording policies), and data
            processing activities (a register of all processing operations performed on personal
            data, including agent operations).
          </p>
          <p>
            Reports are generated as structured CSV files with all required fields for auditor
            review. Download them directly from the Audit page or schedule automatic report
            generation on a monthly cadence for ongoing compliance programs.
          </p>

          <h2>Retention and Immutability</h2>
          <p>
            Audit events are immutable. They cannot be edited or deleted, even by workspace admins.
            This is a deliberate design decision — an audit trail that can be tampered with is
            worthless for compliance and trust. The immutability guarantee means that audit records
            are always a faithful representation of what actually happened.
          </p>
          <p>
            Retention follows your organization&apos;s configured policy. The default retention period is
            2 years, which satisfies SOC 2 Type II requirements. You can extend retention to 5 years
            or set it to indefinite for industries with longer regulatory requirements. Events older
            than the retention period are archived to cold storage — they are no longer visible on
            the Audit page but remain accessible for legal holds and regulatory investigations.
          </p>

          <h2>Next Steps</h2>
          <p>
            Complement your audit capabilities with strong privacy and access controls:
          </p>
          <p>
            <Link href="/tutorials/configuring-privacy-policies" className="text-clay-500 hover:text-clay-600 underline underline-offset-2">
              Configuring Privacy Policies
            </Link>{" "}
            — Set up the privacy policies that the audit trail monitors for compliance.
          </p>
          <p>
            <Link href="/tutorials/managing-team-access-controls" className="text-clay-500 hover:text-clay-600 underline underline-offset-2">
              Managing Team Access Controls
            </Link>{" "}
            — Configure the roles and sharing rules that generate access events in the audit trail.
          </p>
        </>
      );

    // ========================================================================
    // 12. Migrating from Existing Tools
    // ========================================================================
    case "migrating-from-existing-tools":
      return (
        <>
          <h2>Planning Your Migration</h2>
          <p>
            Before you start importing data, take time to inventory your current tools and identify
            what needs to migrate. Which Slack channels have active, ongoing discussions? Which
            Google Docs are still being actively edited? Which email threads contain critical
            decisions that your team references regularly? Not everything needs to move — focus on
            content that is actively used or historically important.
          </p>
          <p>
            Lurk&apos;s <strong>Migration</strong> page provides a planning checklist that walks you
            through the inventory process. It also includes a compatibility assessment for common
            source platforms — select the tools you currently use and Lurk will show you exactly what
            data can be imported, what metadata is preserved, and what (if anything) cannot be
            migrated. Complete this assessment before starting any import to set accurate
            expectations with your team.
          </p>

          <h2>Bulk Import</h2>
          <p>
            Lurk supports bulk import from four major platforms:
          </p>
          <p>
            <strong>Slack</strong> — Import via Slack export files (JSON format). Export your Slack
            workspace from the Slack admin panel, then upload the export file on Lurk&apos;s Migration
            page. Lurk parses channels, messages, threads, reactions, pinned items, and file
            attachments.
          </p>
          <p>
            <strong>Microsoft Teams</strong> — Import via the Microsoft Graph API. Authenticate with
            your Microsoft 365 account and select which Teams channels to import. Messages, replies,
            files, and meeting notes are all supported.
          </p>
          <p>
            <strong>Google Workspace</strong> — Import via the Drive and Gmail APIs. This uses the
            same OAuth connection you set up for the Google Docs and Gmail connectors, extended to
            cover historical data beyond the default sync window.
          </p>
          <p>
            <strong>Notion</strong> — Import via the Notion API. Authenticate with your Notion
            workspace and select which databases or pages to import. Notion pages become artifacts,
            page history becomes editions, and comments become notes.
          </p>
          <p>
            Navigate to <strong>Settings &rarr; Migration</strong>, select your source platform,
            authenticate, and choose which channels, folders, or labels to import. Large imports
            (thousands of messages or hundreds of documents) run as background jobs with real-time
            progress tracking. You can continue using Lurk while the import runs.
          </p>

          <h2>Channel-to-Artifact Mapping</h2>
          <p>
            In Lurk, there are no chat channels — everything is an artifact. This is the most
            significant conceptual shift for teams migrating from Slack or Teams. During migration,
            the mapping works as follows:
          </p>
          <p>
            Slack channels become <strong>artifact collections</strong> — a group of related
            artifacts tagged with the channel name. The #product-updates channel in Slack becomes a
            &ldquo;product-updates&rdquo; tag that groups all related artifacts together.
          </p>
          <p>
            Pinned messages become <strong>highlighted editions</strong> — they are marked as
            important in the artifact timeline and appear prominently when browsing the collection.
          </p>
          <p>
            Threaded replies become <strong>Notes</strong> on the parent artifact. A Slack thread
            with 12 replies becomes an artifact with 12 Notes, preserving the discussion context and
            chronological order.
          </p>
          <p>
            File attachments become <strong>separate artifacts</strong> linked to the conversation
            artifact. A PDF shared in a Slack channel becomes its own artifact (with its own edition
            history) that references the conversation artifact it was shared in.
          </p>

          <h2>Handling Message History</h2>
          <p>
            Lurk imports message history as artifact editions with the original timestamps preserved.
            A Slack message from six months ago retains its original date and time in the artifact
            timeline, not the date it was imported. This means your team can search and reference
            historical discussions just like any other artifact, with accurate chronological context.
          </p>
          <p>
            Metadata is preserved as well: reactions are stored in the artifact&apos;s metadata field,
            user mentions are converted to contributor references, and links to external resources
            are maintained. The imported content is fully searchable — use the global search on the
            Artifacts page to find historical discussions by keyword, date range, or participant.
          </p>

          <h2>Managing the Team Transition</h2>
          <p>
            The most successful migrations happen in phases rather than as a single big-bang cutover.
            Start with one team or project and let them use Lurk alongside the existing tool for one
            to two weeks. This parallel period lets the team build familiarity with the artifact-
            centric workflow without the pressure of having their old tool removed.
          </p>
          <p>
            Use Lurk&apos;s tutorials — this very page — to onboard team members. Share relevant
            tutorials based on each member&apos;s role: admins should start with privacy policies and
            access controls, editors should start with artifacts and tracked changes, and viewers
            just need the getting started guide.
          </p>
          <p>
            Common friction points during the transition include: adjusting to artifact-centric
            thinking where documents are the unit of communication rather than ephemeral messages,
            learning the submission review flow which is new for teams that have not used pull
            request-style workflows for documents, and configuring personal notification preferences
            to avoid being overwhelmed by activity from imported historical content.
          </p>
          <p>
            After the pilot team is comfortable (typically two weeks), expand to additional teams.
            Each subsequent team benefits from the lessons learned during the pilot and from having
            internal champions who can answer questions and demonstrate workflows.
          </p>

          <h2>Next Steps</h2>
          <p>
            Revisit the fundamentals and connect your Google Workspace:
          </p>
          <p>
            <Link href="/tutorials/getting-started-with-lurk" className="text-clay-500 hover:text-clay-600 underline underline-offset-2">
              Getting Started with Lurk
            </Link>{" "}
            — Review workspace setup, core concepts, and team invitation if you need a refresher.
          </p>
          <p>
            <Link href="/tutorials/connecting-google-docs" className="text-clay-500 hover:text-clay-600 underline underline-offset-2">
              Connecting Google Docs to Lurk
            </Link>{" "}
            — Set up real-time sync for your Google Docs now that your historical data is imported.
          </p>
        </>
      );

    default:
      return null;
  }
}

// -- Static params -----------------------------------------------------------

export function generateStaticParams() {
  return tutorialOrder.map((id) => ({ id }));
}

// -- Page component ----------------------------------------------------------

export default async function TutorialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tutorial = tutorials[id];

  // Not found fallback
  if (!tutorial) {
    return (
      <div className="min-h-screen bg-ivory">
        <div className="max-w-3xl mx-auto px-6 py-16 sm:px-8">
          <Link
            href="/tutorials"
            className="inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-600 transition-colors duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to tutorials
          </Link>
          <h1 className="font-serif text-3xl font-bold text-ink-800 mt-8">
            Tutorial not found
          </h1>
          <p className="mt-4 text-ink-500">
            The tutorial you are looking for does not exist. It may have been moved or removed.
          </p>
          <Link
            href="/tutorials"
            className="inline-flex items-center gap-1.5 mt-6 text-sm font-medium text-clay-500 hover:text-clay-600 transition-colors duration-200"
          >
            Browse all tutorials
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  // Determine next tutorial
  const currentIndex = tutorialOrder.indexOf(id);
  const nextId =
    currentIndex >= 0 && currentIndex < tutorialOrder.length - 1
      ? tutorialOrder[currentIndex + 1]
      : tutorialOrder[0];
  const nextTutorial = tutorials[nextId];

  return (
    <div className="min-h-screen bg-ivory">
      <div className="max-w-3xl mx-auto px-6 py-16 sm:px-8">
        {/* Back link */}
        <Link
          href="/tutorials"
          className="inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-600 transition-colors duration-200"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to tutorials
        </Link>

        {/* Header */}
        <header className="mt-10">
          {/* Eyebrow row */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-medium uppercase tracking-widest text-ink-400">
              {tutorial.category}
            </span>
            <Badge
              variant={difficultyVariant[tutorial.difficulty]}
              size="sm"
            >
              {tutorial.difficulty}
            </Badge>
            <span className="flex items-center gap-1 text-xs text-ink-400">
              <Clock className="w-3.5 h-3.5" />
              {tutorial.readingTime}
            </span>
          </div>

          {/* Title */}
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-ink-800 tracking-tight leading-tight">
            {tutorial.title}
          </h1>
        </header>

        {/* Hairline divider */}
        <div className="mt-8 mb-10" style={{ borderTop: "0.5px solid #d1cfc5" }} />

        {/* What you'll learn */}
        <div className="mb-10 bg-ink-50/50 border border-ink-100 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-ink-400" />
            <span className="text-sm font-semibold text-ink-700">
              What you&apos;ll learn
            </span>
          </div>
          <ul className="space-y-1.5">
            {tutorial.learns.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-ink-600">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-clay-400 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Prose content */}
        <div className="prose-reading">
          <TutorialContent id={id} />
        </div>

        {/* Bottom hairline */}
        <div className="mt-16 mb-8" style={{ borderTop: "0.5px solid #d1cfc5" }} />

        {/* Next tutorial link */}
        {nextTutorial && (
          <Link
            href={`/tutorials/${nextId}`}
            className="group flex items-center justify-between p-6 bg-white border border-ink-100 rounded-lg hover:border-ink-200 hover:shadow-warm-sm transition-all duration-200"
          >
            <div>
              <span className="text-xs font-medium uppercase tracking-widest text-ink-400">
                Next tutorial
              </span>
              <p className="mt-1 font-serif text-lg font-semibold text-ink-800 group-hover:text-clay-500 transition-colors duration-200">
                {nextTutorial.title}
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-ink-300 group-hover:text-clay-500 group-hover:translate-x-0.5 transition-all duration-200" />
          </Link>
        )}
      </div>
    </div>
  );
}
