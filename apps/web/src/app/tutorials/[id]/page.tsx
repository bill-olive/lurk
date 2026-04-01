import Link from "next/link";
import { ArrowLeft, ArrowRight, Clock, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// -- Types -------------------------------------------------------------------

type Category =
  | "Getting Started"
  | "Desktop"
  | "System"
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
  "installing-the-desktop-app",
  "using-the-desktop-daemon",
  "understanding-artifacts-and-editions",
  "connecting-google-docs",
  "setting-up-gmail-integration",
  "how-the-lurk-system-works",
  "configuring-privacy-policies",
  "working-with-ai-agents",
  "voice-profile-and-digital-twin",
  "understanding-autonomy-and-yolo-mode",
  "managing-team-access-controls",
  "tracked-changes-and-notes",
  "setting-up-kill-switches",
  "connecting-desktop-web-and-extension",
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
  "installing-the-desktop-app": {
    id: "installing-the-desktop-app",
    title: "Installing the Lurk Desktop App",
    category: "Desktop",
    readingTime: "6 min",
    difficulty: "Beginner",
    learns: [
      "Downloading and installing the Lurk DMG on macOS",
      "What the menu bar tray icon does and how to interact with it",
      "How the daemon starts automatically and runs in the background",
      "Verifying the daemon is healthy and watching your files",
    ],
  },
  "using-the-desktop-daemon": {
    id: "using-the-desktop-daemon",
    title: "Using the Desktop Daemon",
    category: "Desktop",
    readingTime: "12 min",
    difficulty: "Beginner",
    learns: [
      "Adding and removing watched folders from the dashboard",
      "How file changes are detected, hashed, and versioned",
      "Understanding the Recent tab, stats bar, and health indicator",
      "Using the localhost API and WebSocket for advanced integrations",
    ],
  },
  "how-the-lurk-system-works": {
    id: "how-the-lurk-system-works",
    title: "How the Lurk System Works",
    category: "System",
    readingTime: "15 min",
    difficulty: "Intermediate",
    learns: [
      "The four layers: Desktop Daemon, Web App, Chrome Extension, and Cloud",
      "Data flow from a local file change to a team-visible artifact",
      "How SQLite, Firestore, and the sync queue work together",
      "The role of the Express server, WebSocket, and native messaging",
    ],
  },
  "voice-profile-and-digital-twin": {
    id: "voice-profile-and-digital-twin",
    title: "Voice Profile and Digital Twin",
    category: "Agents",
    readingTime: "14 min",
    difficulty: "Intermediate",
    learns: [
      "What a Voice Profile is and why it matters for agent quality",
      "How style dimensions are extracted from your writing",
      "The confidence score and how it improves over time",
      "Providing corrections so agents write more like you",
    ],
  },
  "understanding-autonomy-and-yolo-mode": {
    id: "understanding-autonomy-and-yolo-mode",
    title: "Understanding Autonomy and YOLO Mode",
    category: "Agents",
    readingTime: "16 min",
    difficulty: "Advanced",
    learns: [
      "The four autonomy tiers: Supervised, Assisted, Autonomous, and YOLO",
      "How trust scores are computed from acceptance rates and voice confidence",
      "What happens when an agent reaches YOLO mode",
      "Rollback mechanics and how to undo autonomous agent actions",
    ],
  },
  "connecting-desktop-web-and-extension": {
    id: "connecting-desktop-web-and-extension",
    title: "Connecting Desktop, Web, and Extension",
    category: "Integrations",
    readingTime: "11 min",
    difficulty: "Intermediate",
    learns: [
      "How the Desktop daemon syncs artifacts to the cloud",
      "Connecting the Chrome extension to the desktop daemon via native messaging",
      "How the Web app displays artifacts from all sources",
      "Troubleshooting connectivity between the three surfaces",
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

    // ========================================================================
    // 13. Installing the Lurk Desktop App
    // ========================================================================
    case "installing-the-desktop-app":
      return (
        <>
          <h2>What is the Desktop App?</h2>
          <p>
            The Lurk Desktop App is a lightweight macOS menu bar application that lives in your
            system tray — the row of small icons in the upper-right corner of your screen, next to
            the clock, Wi-Fi, and battery indicators. It works like other menu bar apps you may
            already use (Zoom, Dropbox, or Claude Desktop): no dock icon, no windows cluttering your
            workspace, just a small icon that you click when you need it.
          </p>
          <p>
            Behind that icon, a daemon runs continuously in the background. It watches folders you
            choose, detects file changes, computes content diffs, and stores every version in a local
            SQLite database. Think of it as Time Machine for your documents, but intelligent — it
            understands content changes, not just file metadata. Every edit to a Markdown file, every
            update to a spreadsheet, every revision to a PDF is captured, versioned, and eventually
            synced to the cloud so your team can see it.
          </p>

          <h2>Downloading the DMG</h2>
          <p>
            The Lurk Desktop App is distributed as a standard macOS DMG (disk image) file. You can
            download it from the <strong>Settings</strong> page in the Lurk Web App under the{" "}
            <strong>Desktop</strong> section, or ask your team admin for the direct download link.
            The DMG is a universal binary that supports both Apple Silicon (M1/M2/M3/M4) and Intel
            Macs.
          </p>
          <p>
            Once downloaded, double-click the <code>.dmg</code> file to mount it. You will see the
            Lurk app icon and a shortcut to your Applications folder. Drag the Lurk icon into
            Applications — this is the standard macOS installation gesture. After the copy completes,
            you can eject the DMG from Finder.
          </p>

          <h2>First Launch</h2>
          <p>
            Open Lurk from your Applications folder (or search for &ldquo;Lurk&rdquo; in Spotlight).
            Because this is a menu bar app, you will not see a window appear immediately. Instead,
            look for a small icon in your menu bar — it appears as a minimal dark shape that adapts
            to your system&apos;s light or dark mode automatically.
          </p>
          <p>
            On first launch, macOS may show a security prompt: &ldquo;Lurk is an application
            downloaded from the internet. Are you sure you want to open it?&rdquo; Click{" "}
            <strong>Open</strong>. If macOS blocks the app entirely, go to{" "}
            <strong>System Settings &rarr; Privacy &amp; Security</strong> and click{" "}
            <strong>Open Anyway</strong> next to the Lurk entry.
          </p>
          <p>
            Click the tray icon to open the dashboard dropdown. You will see three sections: a stats
            bar showing your artifact count, sync status, and number of watched folders; a tabbed
            area with Recent files, Watched Dirs, and Voice profile; and a footer with a link to the
            full Lurk Web App.
          </p>

          <h2>Understanding the Menu Bar Dashboard</h2>
          <p>
            The dashboard is a compact 420-pixel-wide panel that anchors directly below the tray
            icon, similar to how the macOS Wi-Fi or Bluetooth panels work. It provides a quick
            overview without opening a full application window.
          </p>
          <p>
            The <strong>stats bar</strong> at the top shows three numbers: <strong>Artifacts</strong>{" "}
            is the total number of files being tracked, <strong>Synced</strong> is how many have been
            uploaded to the cloud, and <strong>Folders</strong> is the count of directories you are
            watching.
          </p>
          <p>
            A green dot next to the &ldquo;Lurk&rdquo; title indicates the daemon is healthy and
            running. A red dot means something needs attention — usually the local server failed to
            start, which can happen if the port is already in use.
          </p>
          <p>
            The dashboard auto-refreshes every ten seconds, so you can leave it open and watch
            artifacts appear in real time as you edit files.
          </p>

          <h2>Default Configuration</h2>
          <p>
            Out of the box, Lurk watches your <strong>Desktop</strong> folder. It tracks files with
            these extensions: <code>.md</code>, <code>.txt</code>, <code>.docx</code>,{" "}
            <code>.pdf</code>, <code>.xlsx</code>, <code>.csv</code>, <code>.json</code>,{" "}
            <code>.html</code>, and <code>.rtf</code>. It automatically excludes system directories
            like <code>node_modules</code>, <code>.git</code>, <code>.DS_Store</code>,{" "}
            <code>Library</code>, and cache folders.
          </p>
          <p>
            You can add more folders immediately by switching to the <strong>Watched Dirs</strong>{" "}
            tab. The next tutorial covers this in detail.
          </p>

          <h2>Verifying the Daemon</h2>
          <p>
            To confirm the daemon is running correctly, click the tray icon to open the dashboard.
            If you see the green health dot and your Artifacts count is increasing as existing files
            are discovered, everything is working.
          </p>
          <p>
            For advanced verification, open Terminal and run:{" "}
            <code>curl http://localhost:3847/health</code>. You should see a JSON response:{" "}
            <code>{`{"status":"ok","version":"0.1.0"}`}</code>. This confirms the daemon&apos;s
            Express server is running on port 3847.
          </p>
          <p>
            The daemon starts automatically with the app and shuts down cleanly when you quit from
            the menu bar. To quit, click the tray icon and then the <strong>X</strong> button in the
            top-right of the dashboard, or right-click the tray icon.
          </p>

          <h2>Next Steps</h2>
          <p>
            Now that the Desktop App is installed and running, learn how to configure it:
          </p>
          <p>
            <Link href="/tutorials/using-the-desktop-daemon" className="text-clay-500 hover:text-clay-600 underline underline-offset-2">
              Using the Desktop Daemon
            </Link>{" "}
            — Add watched folders, understand how versioning works, and explore the stats dashboard.
          </p>
          <p>
            <Link href="/tutorials/how-the-lurk-system-works" className="text-clay-500 hover:text-clay-600 underline underline-offset-2">
              How the Lurk System Works
            </Link>{" "}
            — Understand the full architecture from desktop to cloud.
          </p>
        </>
      );

    // ========================================================================
    // 14. Using the Desktop Daemon
    // ========================================================================
    case "using-the-desktop-daemon":
      return (
        <>
          <h2>The Watched Dirs Tab</h2>
          <p>
            Click the tray icon and switch to the <strong>Watched Dirs</strong> tab. This is where
            you control which folders the daemon monitors for file changes. Each folder appears as a
            row with its full path and a remove button (X) on the right side.
          </p>
          <p>
            To add a new folder, click the <strong>+ Add Folder</strong> button at the bottom.
            This opens a native macOS folder picker — the same dialog you see in Finder when
            choosing a destination. Navigate to the folder you want to watch and click{" "}
            <strong>Watch This Folder</strong>. The daemon immediately begins monitoring that
            directory and all its subdirectories (up to 3 levels deep).
          </p>
          <p>
            To remove a folder, click the <strong>X</strong> button next to it. The daemon stops
            watching that directory immediately, but artifacts already captured from that folder
            remain in your local database — removing a watched folder does not delete historical
            data.
          </p>
          <p>
            Your watched folder configuration is persisted in the local SQLite database, so it
            survives app restarts. When you launch Lurk the next day, it picks up exactly where it
            left off with the same folders.
          </p>

          <h2>How File Change Detection Works</h2>
          <p>
            The daemon uses macOS FSEvents — the same native file system notification API that
            Spotlight, Time Machine, and Finder use. When a file is created or modified in a watched
            folder, the operating system notifies the daemon within milliseconds.
          </p>
          <p>
            To avoid capturing every keystroke in an active editor, the daemon applies a five-second
            debounce per file. If a file changes multiple times within five seconds, only the final
            state is processed. The daemon also waits for the write to finish (using a two-second
            stability threshold) so it never reads a half-written file.
          </p>
          <p>
            When processing a change, the daemon performs these steps in order: it reads the file
            content, computes a SHA-256 hash, and compares it to the hash stored in the database.
            If the hash has not changed (the content is identical), the change is silently skipped.
            If the hash differs, the daemon creates a new versioned commit with a full content
            snapshot and a computed diff against the previous version.
          </p>

          <h2>Understanding Artifacts and Commits</h2>
          <p>
            In the desktop daemon, an <strong>artifact</strong> represents a single tracked file.
            Each artifact has a unique ID, a file path, a file name, an extension, the current
            content hash, and its size in bytes. The first time the daemon sees a file, it creates a
            new artifact. Every subsequent change to that file creates a new <strong>commit</strong>{" "}
            — a versioned snapshot of the content at that moment, along with a diff showing exactly
            what changed.
          </p>
          <p>
            This is conceptually identical to how Git tracks source code, but applied to your
            documents. You get a complete, granular history of every change to every file, without
            ever running a commit command manually. The daemon handles it all transparently.
          </p>

          <h2>The Recent Tab</h2>
          <p>
            The <strong>Recent</strong> tab shows the latest file changes detected by the daemon.
            Each entry displays the file name with a colored extension badge (Markdown in olive,
            JSON in terracotta, CSV in purple, and so on), a relative timestamp (&ldquo;just
            now&rdquo;, &ldquo;5m ago&rdquo;, &ldquo;2h ago&rdquo;), and the file size.
          </p>
          <p>
            This tab refreshes automatically every ten seconds, so you can leave the dashboard open
            while editing files and watch new entries appear as the daemon captures changes. If no
            artifacts have been tracked yet, the tab shows an empty state with a document icon and a
            message prompting you to add folders.
          </p>

          <h2>The Stats Bar</h2>
          <p>
            The three numbers across the top of the dashboard give you a quick health check.{" "}
            <strong>Artifacts</strong> is the total count of unique files the daemon has ever tracked
            — this number only grows, because removing a watched folder does not delete historical
            artifacts. <strong>Synced</strong> is how many artifacts have been successfully uploaded
            to the Lurk cloud. <strong>Folders</strong> is the number of directories currently being
            watched.
          </p>

          <h2>The Voice Tab</h2>
          <p>
            The third tab, <strong>Voice</strong>, shows the status of your Digital Twin voice
            profile. The daemon automatically extracts writing samples from text-based files (
            <code>.md</code>, <code>.txt</code>, <code>.html</code>, <code>.csv</code>) and stores
            them locally. These samples are used by the Voice Profile system to learn how you write
            so that AI agents can produce content in your style. View your full voice profile
            analysis in the Web App under <strong>Settings &rarr; Voice Profile</strong>.
          </p>

          <h2>The Localhost API</h2>
          <p>
            The daemon runs a full REST API on <code>http://localhost:3847</code>. While the
            dashboard UI is the primary interface, power users and developers can interact with the
            API directly. Key endpoints include:
          </p>
          <p>
            <code>GET /health</code> — Returns daemon status and version.
            <br />
            <code>GET /api/stats</code> — Returns artifact count, sync status, watched dirs, and
            recent changes.
            <br />
            <code>GET /api/artifacts?limit=50&amp;offset=0</code> — Lists tracked artifacts with
            pagination.
            <br />
            <code>GET /api/artifacts/:id</code> — Returns a single artifact with its full commit
            history.
            <br />
            <code>GET /api/artifacts/:id/commits</code> — Returns the version history for an
            artifact.
            <br />
            <code>GET /api/watched-dirs</code> — Lists all watched directories.
            <br />
            <code>POST /api/watched-dirs</code> — Adds a directory (body:{" "}
            <code>{`{"dir": "/path/to/folder"}`}</code>).
            <br />
            <code>DELETE /api/watched-dirs</code> — Removes a directory.
          </p>
          <p>
            The daemon also runs a WebSocket server on the same port. Connect to{" "}
            <code>ws://localhost:3847</code> to receive real-time notifications when files change.
            Each message is a JSON object with an <code>event</code> field, a <code>data</code>{" "}
            payload, and a <code>timestamp</code>.
          </p>

          <h2>Handling Large Directories</h2>
          <p>
            The daemon is designed to handle large folders gracefully. It limits concurrent file
            reads (processing at most ten files simultaneously) to avoid exhausting system resources.
            It watches subdirectories up to three levels deep and filters by supported file
            extensions, so it skips application binaries, images, and other non-document files
            automatically.
          </p>
          <p>
            If you add a very large directory (like your entire Documents folder), the daemon will
            process files progressively. You may notice the artifact count climbing over several
            minutes as it works through the backlog. The dashboard remains responsive throughout this
            process because file processing happens asynchronously.
          </p>

          <h2>Next Steps</h2>
          <p>
            Understand how the desktop daemon fits into the broader Lurk platform:
          </p>
          <p>
            <Link href="/tutorials/how-the-lurk-system-works" className="text-clay-500 hover:text-clay-600 underline underline-offset-2">
              How the Lurk System Works
            </Link>{" "}
            — See the full architecture from desktop to cloud.
          </p>
          <p>
            <Link href="/tutorials/connecting-desktop-web-and-extension" className="text-clay-500 hover:text-clay-600 underline underline-offset-2">
              Connecting Desktop, Web, and Extension
            </Link>{" "}
            — Wire all three Lurk surfaces together for a complete workflow.
          </p>
        </>
      );

    // ========================================================================
    // 15. How the Lurk System Works
    // ========================================================================
    case "how-the-lurk-system-works":
      return (
        <>
          <h2>The Four Layers</h2>
          <p>
            Lurk is not a single application — it is a platform composed of four layers that work
            together. Understanding how these layers connect is essential for getting the most out of
            the system and for troubleshooting when something does not work as expected.
          </p>
          <p>
            <strong>Layer 1: Desktop Daemon</strong> — A macOS menu bar app that watches your local
            filesystem, versions every document change, and stores everything in a local SQLite
            database. This layer works entirely offline. Even if you never connect to the internet,
            you get a complete version history of every document you edit.
          </p>
          <p>
            <strong>Layer 2: Web App</strong> — A Next.js application hosted at{" "}
            <code>lurk-web.vercel.app</code> that provides the team collaboration interface.
            Artifacts from all team members appear here, along with dashboards, agent management,
            policy configuration, and the full tutorial library you are reading right now.
          </p>
          <p>
            <strong>Layer 3: Chrome Extension</strong> — A browser extension that captures content
            from web pages, Google Docs, Gmail threads, and other browser-based sources. It
            communicates with the desktop daemon through Chrome&apos;s native messaging protocol.
          </p>
          <p>
            <strong>Layer 4: Cloud Services</strong> — Firebase (authentication and Firestore
            database), Google APIs (Docs, Gmail, Drive, Calendar), and the Lurk API gateway that
            coordinates AI agents, voice profile analysis, and the policy engine.
          </p>

          <h2>Data Flow: From File Change to Team Artifact</h2>
          <p>
            Here is the complete journey of a document change through the Lurk system:
          </p>
          <p>
            <strong>Step 1: File change detected.</strong> You edit a Markdown file in your Documents
            folder. macOS FSEvents notifies the Lurk daemon within milliseconds. The daemon waits
            five seconds for the write to stabilize (debounce), then reads the file.
          </p>
          <p>
            <strong>Step 2: Hash and diff.</strong> The daemon computes a SHA-256 hash of the file
            content and compares it to the stored hash. If the content changed, it computes a
            line-by-line diff against the previous version using a longest-common-subsequence
            algorithm.
          </p>
          <p>
            <strong>Step 3: Local commit.</strong> A new commit is created in the local SQLite
            database with the full content snapshot, the diff, diff statistics (lines added, removed,
            changed), and a timestamp. The artifact record is updated with the new hash and size.
          </p>
          <p>
            <strong>Step 4: Sync queue.</strong> The commit is added to the sync queue with a pending
            status. The queue tracks whether each item needs to be created, updated, or deleted on
            the cloud.
          </p>
          <p>
            <strong>Step 5: Cloud sync.</strong> The syncer runs every 60 seconds, picks up pending
            items from the queue, and POSTs them to the Lurk API gateway. On success, the queue item
            is marked as synced. On failure, it stays pending and retries on the next cycle.
          </p>
          <p>
            <strong>Step 6: Team visibility.</strong> Once synced, the artifact and its complete
            edition history appear in the Lurk Web App. Your teammates can see the change, view the
            diff, add notes, and assign agents to review or improve the content.
          </p>

          <h2>The Local Database</h2>
          <p>
            The heart of the desktop daemon is a SQLite database stored at{" "}
            <code>~/.lurk/ledger.db</code>. It contains five tables:
          </p>
          <p>
            <strong>artifacts</strong> — One row per tracked file. Stores the file path, name,
            extension, current content hash, size, and timestamps.
          </p>
          <p>
            <strong>commits</strong> — One row per version of a file. Each commit references an
            artifact, stores the full content snapshot, the diff from the previous version, diff
            statistics, and the content hash at that point in time.
          </p>
          <p>
            <strong>sync_queue</strong> — Tracks which commits need to be uploaded to the cloud.
            Each entry has a status (pending, synced, or failed) and an action type (create, update,
            or delete).
          </p>
          <p>
            <strong>voice_samples</strong> — Writing excerpts extracted from text-based files. Used
            by the Voice Profile system to learn your writing style. Each sample references an
            artifact and stores the text content, source extension, and timestamps.
          </p>
          <p>
            <strong>config</strong> — Key-value pairs for persistent settings, including the list of
            watched directories (stored as a JSON array under the key{" "}
            <code>watched_dirs</code>).
          </p>

          <h2>The Express Server and WebSocket</h2>
          <p>
            The daemon runs an Express.js HTTP server on <code>localhost:3847</code>. This serves
            two purposes: it provides the REST API that the dashboard UI and Chrome extension use to
            read data and manage settings, and it hosts a WebSocket server for real-time push
            notifications.
          </p>
          <p>
            When a new file change is processed, the server can broadcast a WebSocket message to all
            connected clients. This is how the dashboard auto-refreshes without polling — it
            receives push notifications when the underlying data changes. The Chrome extension also
            uses this channel to stay in sync with the daemon.
          </p>

          <h2>Native Messaging</h2>
          <p>
            The Chrome extension communicates with the desktop daemon through Chrome&apos;s native
            messaging protocol. This is a stdio-based JSON protocol where the extension sends
            structured messages to the daemon and receives responses. The protocol supports three
            message types: <code>handshake</code> (initial connection), <code>artifact_capture</code>{" "}
            (sending captured web content), and <code>heartbeat</code> (connection health check).
          </p>
          <p>
            The daemon responds with <code>policy_update</code> (current privacy and agent policies)
            and <code>badge_update</code> (status information to display on the extension icon).
            This two-way communication ensures the extension always reflects the current state of
            the daemon.
          </p>

          <h2>Authentication and Multi-Tenancy</h2>
          <p>
            The Web App uses Firebase Authentication with Google OAuth. When you sign in, your Google
            account is linked to a Lurk organization. All artifacts, policies, and agent
            configurations are scoped to your organization — you never see another organization&apos;s
            data. This tenant isolation is enforced at the Firestore security rules level, not just
            in application code.
          </p>
          <p>
            The desktop daemon currently operates in local-only mode — it does not require
            authentication to capture and version files. Authentication is required only for the
            cloud sync step, where the syncer authenticates with the API gateway using credentials
            stored in the local config.
          </p>

          <h2>Next Steps</h2>
          <p>
            Explore specific parts of the system in detail:
          </p>
          <p>
            <Link href="/tutorials/voice-profile-and-digital-twin" className="text-clay-500 hover:text-clay-600 underline underline-offset-2">
              Voice Profile and Digital Twin
            </Link>{" "}
            — Learn how the system learns your writing style from captured artifacts.
          </p>
          <p>
            <Link href="/tutorials/understanding-autonomy-and-yolo-mode" className="text-clay-500 hover:text-clay-600 underline underline-offset-2">
              Understanding Autonomy and YOLO Mode
            </Link>{" "}
            — Discover how agents earn trust and eventually act independently.
          </p>
        </>
      );

    // ========================================================================
    // 16. Voice Profile and Digital Twin
    // ========================================================================
    case "voice-profile-and-digital-twin":
      return (
        <>
          <h2>Why Voice Profiles Matter</h2>
          <p>
            Every person writes differently. You have a vocabulary you reach for, sentence structures
            you prefer, a level of formality that feels natural, and topics where you dive deep versus
            skim the surface. When an AI agent drafts a PR description, writes a customer email, or
            summarizes a document on your behalf, the result should sound like <em>you</em> — not
            like generic AI output.
          </p>
          <p>
            This is the core problem Lurk&apos;s Voice Profile solves. By analyzing your writing across
            documents, emails, and local files, Lurk builds a quantitative model of your style —
            your Digital Twin. This model is then embedded into every agent&apos;s system prompt, so
            when an agent acts on your behalf, it writes in your voice.
          </p>

          <h2>What Gets Analyzed</h2>
          <p>
            The Voice Profile draws from three sources. First, <strong>local files</strong>: the
            desktop daemon extracts writing samples from text-based files (<code>.md</code>,{" "}
            <code>.txt</code>, <code>.html</code>, <code>.rtf</code>, <code>.csv</code>) as you
            edit them. It looks for substantial paragraphs (at least 50 characters) and filters out
            code blocks, tables, and formatting-heavy content that does not represent natural
            writing.
          </p>
          <p>
            Second, <strong>Google Docs</strong>: documents synced through the Google Docs connector
            provide rich writing samples with full context. Docs tend to be more polished than quick
            notes, giving the profile a view of your careful, deliberate writing style.
          </p>
          <p>
            Third, <strong>Gmail threads</strong>: email messages capture your conversational writing
            style — how you communicate with colleagues, clients, and external stakeholders. This is
            often quite different from document writing, and the profile tracks these variations.
          </p>

          <h2>Style Dimensions</h2>
          <p>
            The Voice Profile is not a single number — it is a multi-dimensional model of your
            writing. The system measures these quantitative dimensions:
          </p>
          <p>
            <strong>Average sentence length</strong> — Short, punchy sentences (12 words) versus
            flowing, complex ones (28+ words). This affects readability and tone.
          </p>
          <p>
            <strong>Vocabulary complexity</strong> — On a 1-to-10 scale. A score of 3 means you use
            plain, accessible language. A score of 8 means you favor precise, domain-specific
            terminology.
          </p>
          <p>
            <strong>Formality level</strong> — On a 1-to-10 scale. Low formality means contractions,
            casual phrasing, and conversational tone. High formality means complete sentences,
            professional language, and structured paragraphs.
          </p>
          <p>
            <strong>Technical depth</strong> — How deep you go into technical details. Some writers
            explain concepts at a high level; others provide implementation-level specifics.
          </p>
          <p>
            Beyond these numbers, the profile also captures qualitative patterns:{" "}
            <strong>tone descriptors</strong> (e.g., &ldquo;direct&rdquo;, &ldquo;empathetic&rdquo;,
            &ldquo;data-driven&rdquo;), <strong>communication patterns</strong> (e.g., &ldquo;leads
            with context before the ask&rdquo;, &ldquo;uses bullet points for lists of three or
            more&rdquo;), <strong>signature phrases</strong> you frequently use, and{" "}
            <strong>patterns you avoid</strong> (e.g., never uses exclamation marks, avoids passive
            voice).
          </p>

          <h2>The Confidence Score</h2>
          <p>
            Your Voice Profile includes a confidence score from 0% to 100%. This represents how well
            Lurk knows your writing style. At 20%, the profile has a rough sketch based on a few
            samples. At 60%, it has captured your major patterns and can produce reasonable
            approximations. At 85%+, the profile is highly refined and agents consistently produce
            output that reads like you wrote it.
          </p>
          <p>
            The confidence score increases as more writing samples are analyzed and as you provide
            corrections. It can also decrease temporarily if the system detects that your writing
            style has changed — for example, after a role change or when writing for a new audience.
          </p>

          <h2>Viewing Your Profile</h2>
          <p>
            In the Web App, go to <strong>Settings &rarr; Voice Profile</strong>. This tab shows
            your current style dimensions as visual bars, your confidence score as a percentage, a
            list of detected tone descriptors and communication patterns, and representative writing
            excerpts (exemplars) that the system considers most characteristic of your style.
          </p>
          <p>
            On the Desktop App, the <strong>Voice</strong> tab provides a simpler view with a link
            to the full profile in the Web App. The desktop daemon continuously feeds new writing
            samples to the profile in the background — you do not need to trigger analysis manually.
          </p>

          <h2>How Agents Use Your Profile</h2>
          <p>
            When an AI agent executes a task on your behalf — drafting a PR description, writing a
            customer response, summarizing a document — your Voice Profile is converted into a system
            prompt fragment and prepended to the agent&apos;s instructions. This fragment tells the
            agent: &ldquo;Write in this person&apos;s style. Use these sentence lengths, this
            vocabulary level, this tone. Incorporate these phrases. Avoid these patterns.&rdquo;
          </p>
          <p>
            The result is agent output that sounds like you, not like a generic AI assistant. This is
            especially valuable in team settings where multiple people use agents — each person&apos;s
            agents produce distinctly different output that matches their individual style.
          </p>

          <h2>Providing Corrections</h2>
          <p>
            The profile improves fastest when you tell it what it got wrong. When you review an
            agent&apos;s output and it does not sound like you — the tone is too formal, it used a
            phrase you would never use, it structured the content differently than you would — you
            can submit a correction.
          </p>
          <p>
            On the Voice Profile settings page, the correction interface shows agent-generated text
            alongside an editor where you can rewrite it in your own voice. When you save the
            correction, the system stores both the original and the corrected version. These
            correction pairs are the highest-signal training data for the profile — they directly
            encode the gap between what the agent produced and what you actually wanted.
          </p>
          <p>
            After five corrections or every 24 hours (whichever comes first), the refinement
            pipeline runs automatically. It takes the existing profile, the new writing samples, and
            the correction pairs, and produces an updated profile. All agents pick up the new profile
            on their next execution.
          </p>

          <h2>Next Steps</h2>
          <p>
            Understand how the Voice Profile connects to agent autonomy:
          </p>
          <p>
            <Link href="/tutorials/understanding-autonomy-and-yolo-mode" className="text-clay-500 hover:text-clay-600 underline underline-offset-2">
              Understanding Autonomy and YOLO Mode
            </Link>{" "}
            — Learn how voice confidence feeds into trust scores and enables agents to act
            independently.
          </p>
          <p>
            <Link href="/tutorials/working-with-ai-agents" className="text-clay-500 hover:text-clay-600 underline underline-offset-2">
              Working with AI Agents
            </Link>{" "}
            — Configure agent permissions and review agent submissions.
          </p>
        </>
      );

    // ========================================================================
    // 17. Understanding Autonomy and YOLO Mode
    // ========================================================================
    case "understanding-autonomy-and-yolo-mode":
      return (
        <>
          <h2>The Problem with Agent Autonomy</h2>
          <p>
            AI agents are most useful when they can act independently — drafting documents, creating
            PRs, responding to routine requests without waiting for human approval on every step.
            But most organizations are not comfortable giving agents free rein from day one, and for
            good reason. An agent that does not understand your preferences will produce work that
            needs constant correction, which is worse than doing it yourself.
          </p>
          <p>
            Lurk solves this with <strong>progressive autonomy</strong>: agents start with zero
            independence and earn trust over time based on measurable performance. The system is
            designed so that you never have to flip a &ldquo;make it autonomous&rdquo; switch. Instead,
            autonomy emerges naturally from a track record of accepted work.
          </p>

          <h2>The Four Autonomy Tiers</h2>
          <p>
            Every agent operates at one of four tiers, determined by its composite trust score:
          </p>
          <p>
            <strong>Supervised</strong> (score below 0.4) — The agent can draft content but every
            action requires explicit human approval before it takes effect. This is the starting
            tier for all new agents. The agent cannot create PRs, send messages, or modify artifacts
            without your review and acceptance.
          </p>
          <p>
            <strong>Assisted</strong> (score 0.4 to 0.6) — The agent can take low-risk actions
            automatically (adding notes, updating metadata) but still requires approval for
            substantive changes like creating editions or sending external communications. You review
            less frequently but still approve all important work.
          </p>
          <p>
            <strong>Autonomous</strong> (score 0.6 to 0.8) — The agent can take most actions
            independently, including creating editions and drafting PRs. Only high-sensitivity
            actions (deleting content, modifying policies, external communications) still require
            approval. The &ldquo;While You Were Away&rdquo; feed on the Autonomy page shows what
            the agent did while you were not watching.
          </p>
          <p>
            <strong>YOLO</strong> (score above 0.8) — Full autonomy. The agent acts independently on
            all actions within its configured scope, including auto-merging PRs and sending
            communications. All actions are still logged in the audit trail and can be rolled back.
            YOLO mode is the destination, not the starting point — agents reach it only after
            demonstrating consistent quality over dozens of interactions.
          </p>

          <h2>How Trust Scores Are Computed</h2>
          <p>
            The trust score is a weighted composite of four factors:
          </p>
          <p>
            <strong>Voice Profile confidence (30% weight)</strong> — How well Lurk knows your writing
            style. An agent cannot write like you if the system does not understand how you write. A
            high voice profile confidence means the agent&apos;s output is more likely to match your
            expectations.
          </p>
          <p>
            <strong>Historical acceptance rate (30% weight)</strong> — The 30-day exponential weighted
            average of how often you accept the agent&apos;s work versus rejecting or correcting it.
            Recent actions weigh more than older ones. If the agent&apos;s last ten submissions were
            all accepted, the rate trends toward 1.0. If three of the last five were rejected, it
            drops sharply.
          </p>
          <p>
            <strong>Artifact familiarity (20% weight)</strong> — How well the agent knows the specific
            artifacts it is working on. An agent that has successfully edited the same document ten
            times has high familiarity with that artifact. An agent encountering a new document for
            the first time has zero familiarity.
          </p>
          <p>
            <strong>Domain expertise (20% weight)</strong> — How well the agent performs in the
            specific domain. An agent that excels at technical documentation but struggles with
            marketing copy will have different domain scores for each. This prevents an agent from
            gaining YOLO access in areas where it has not proven itself.
          </p>

          <h2>The Trust Ledger</h2>
          <p>
            Every time you interact with an agent&apos;s output — accepting it, rejecting it,
            correcting it, or rolling it back — a trust event is recorded in the trust ledger.
            Each event adjusts the agent&apos;s trust score:
          </p>
          <p>
            <strong>Accepted</strong> — Positive signal. The score increases proportionally.
            <br />
            <strong>Rejected</strong> — Moderate negative signal. The score decreases.
            <br />
            <strong>Corrected</strong> — Mild negative signal. The agent was close but not right.
            The correction also feeds back into the Voice Profile.
            <br />
            <strong>Rolled back</strong> — Strong negative signal (minus 0.2). A rollback means the
            agent&apos;s autonomous action was harmful enough to undo. This heavily penalizes the
            score and can drop an agent from Autonomous to Assisted in a single event.
          </p>

          <h2>The Autonomy Dashboard</h2>
          <p>
            Navigate to the <strong>Autonomy</strong> page from the sidebar. This page is your
            command center for understanding and controlling agent independence:
          </p>
          <p>
            <strong>Autonomy Score</strong> — A prominent display of your overall score and current
            tier, shown as a large number with a tier badge. This is the composite score across all
            your agents.
          </p>
          <p>
            <strong>While You Were Away</strong> — A feed of actions agents took autonomously. Each
            entry shows what the agent did, when, and includes a one-click Undo button if the action
            is within the rollback window.
          </p>
          <p>
            <strong>Trust Progression</strong> — A line chart showing how your autonomy score has
            changed over time. Look for trends — a steadily rising line means agents are improving.
            A sudden drop means a rollback or a series of rejections occurred.
          </p>
          <p>
            <strong>Per-Agent Breakdown</strong> — Each agent&apos;s individual acceptance rate,
            current tier, and recent actions. This helps you identify which agents are performing
            well and which need more supervision or prompt tuning.
          </p>

          <h2>Rollback</h2>
          <p>
            Any autonomous action taken by an agent can be rolled back within the configured rollback
            window (default: 24 hours). Rolling back an auto-merged PR creates a revert commit from
            the pre-merge state. Rolling back an edition restores the artifact to its previous
            version. The rollback action is recorded as a trust event that significantly penalizes
            the agent&apos;s score.
          </p>
          <p>
            The Rollback Center on the Autonomy page lists all recent auto-merged PRs and autonomous
            editions within the rollback window. Each entry has an <strong>Undo</strong> button.
            After the rollback window expires, the action becomes permanent — you can still manually
            revert but it no longer affects the trust score.
          </p>

          <h2>Guardrails That Never Go Away</h2>
          <p>
            Even at YOLO tier, certain guardrails remain enforced. The policy engine caps daily
            autonomous actions (default: 50 per day per agent). Cooldown periods prevent rapid-fire
            autonomous actions (minimum 60 seconds between actions). Diff size limits prevent agents
            from making sweepingly large changes autonomously. Sensitivity detection flags content
            involving customer data, financial information, or legal language for human review
            regardless of tier. And kill switches can instantly revoke all autonomous access.
          </p>
          <p>
            These guardrails ensure that YOLO mode means &ldquo;trusted to act independently on
            routine work&rdquo;, not &ldquo;trusted to do anything without limits.&rdquo;
          </p>

          <h2>Next Steps</h2>
          <p>
            Configure the safety systems that complement autonomy:
          </p>
          <p>
            <Link href="/tutorials/setting-up-kill-switches" className="text-clay-500 hover:text-clay-600 underline underline-offset-2">
              Setting Up Kill Switches
            </Link>{" "}
            — Configure emergency controls to instantly disable autonomous agents.
          </p>
          <p>
            <Link href="/tutorials/voice-profile-and-digital-twin" className="text-clay-500 hover:text-clay-600 underline underline-offset-2">
              Voice Profile and Digital Twin
            </Link>{" "}
            — Improve the voice confidence component of the trust score.
          </p>
        </>
      );

    // ========================================================================
    // 18. Connecting Desktop, Web, and Extension
    // ========================================================================
    case "connecting-desktop-web-and-extension":
      return (
        <>
          <h2>The Three Surfaces</h2>
          <p>
            Lurk meets you where you work through three purpose-built interfaces. The{" "}
            <strong>Desktop App</strong> runs silently in your menu bar, watching local files and
            versioning every change. The <strong>Web App</strong> is where your team collaborates —
            reviewing artifacts, managing agents, configuring policies. The{" "}
            <strong>Chrome Extension</strong> captures content from your browser — Google Docs edits,
            Gmail threads, web pages — and routes it through the same versioning pipeline.
          </p>
          <p>
            Each surface can work independently, but the full power of Lurk emerges when all three
            are connected. A file edited on your desktop appears as a versioned artifact in the web
            app within minutes. A Google Doc captured by the extension is tracked alongside your
            local Markdown files. Your team sees a unified view of all knowledge, regardless of where
            it originated.
          </p>

          <h2>Setting Up Cloud Sync (Desktop to Web)</h2>
          <p>
            The desktop daemon syncs artifacts to the cloud automatically through its built-in sync
            queue. Every time a new commit is created locally, it is added to the queue with a
            &ldquo;pending&rdquo; status. The syncer runs every 60 seconds, picks up pending items,
            and uploads them to the Lurk API gateway.
          </p>
          <p>
            To verify sync is working, check the <strong>Synced</strong> number in the desktop
            dashboard stats bar. If it is increasing over time, artifacts are reaching the cloud.
            If it stays at zero while the Artifacts count grows, there may be a connectivity issue
            or the API endpoint has not been configured.
          </p>
          <p>
            Failed sync attempts are retried automatically on the next cycle. The desktop dashboard
            does not expose the failure count directly, but you can check via the API:{" "}
            <code>curl http://localhost:3847/api/sync</code> returns the full queue status including
            pending, synced, and failed counts.
          </p>

          <h2>Connecting the Chrome Extension</h2>
          <p>
            The Chrome Extension communicates with the desktop daemon through Chrome&apos;s native
            messaging protocol — a secure, OS-level communication channel that does not go through
            the network. This means the extension talks directly to the daemon running on your Mac,
            with no internet involved in the communication.
          </p>
          <p>
            To set up native messaging, the Lurk Desktop installer places a manifest file at the
            expected location for Chrome native messaging hosts. This manifest tells Chrome where to
            find the Lurk daemon binary and what extension IDs are allowed to connect to it.
          </p>
          <p>
            Once configured, the extension icon in Chrome shows a green indicator when it is
            successfully connected to the desktop daemon. A gray or red indicator means the
            connection failed — usually because the daemon is not running or the native messaging
            manifest is not installed correctly.
          </p>

          <h2>What the Extension Captures</h2>
          <p>
            The Chrome Extension can capture content from several browser-based sources:
          </p>
          <p>
            <strong>Google Docs</strong> — When you visit a Google Doc, the extension detects the
            document and can capture its current content as an artifact. If the doc changes later,
            the extension captures the new version and the daemon creates a diff against the previous
            one. This works alongside the Google Docs connector in the web app — the extension
            captures the document from the browser, while the connector accesses it through the API.
          </p>
          <p>
            <strong>Gmail</strong> — The extension can capture email threads as artifacts. It
            extracts the thread content, subject line, participants, and metadata. This is
            particularly useful for client communications that your team needs to track.
          </p>
          <p>
            <strong>Web pages</strong> — Any web page can be captured as an artifact using the
            extension&apos;s capture button. The extension extracts the main content (stripping
            navigation, ads, and boilerplate) and sends it to the daemon for versioning.
          </p>

          <h2>How the Web App Unifies Everything</h2>
          <p>
            The Web App at <code>lurk-web.vercel.app</code> is the unified view where all artifacts
            converge. When you sign in, the <strong>Artifacts</strong> page shows documents from
            every source: local files synced from the desktop daemon, Google Docs accessed through
            the API connector, Gmail threads captured by the extension, and any other content routed
            through connectors.
          </p>
          <p>
            Each artifact carries metadata about its source — you can filter by source type (Docs,
            Emails, Spreadsheets, Drive, Local Files) using the tabs on the Artifacts page. The
            source badge on each artifact card tells you where it came from.
          </p>
          <p>
            The Web App also provides features that the desktop dashboard cannot: team collaboration
            (notes, tracked changes, submissions), AI agent management, policy configuration, the
            full autonomy dashboard, and this tutorial library. Think of the desktop app as your
            personal capture tool and the web app as your team&apos;s collaboration hub.
          </p>

          <h2>Troubleshooting Connectivity</h2>
          <p>
            <strong>Desktop daemon not running:</strong> Click the tray icon. If you do not see it,
            open Lurk from Applications. Check the health dot in the dashboard — green means
            running, red means an error. Run <code>curl http://localhost:3847/health</code> in
            Terminal to verify.
          </p>
          <p>
            <strong>Sync stuck at zero:</strong> Check the sync queue via{" "}
            <code>curl http://localhost:3847/api/sync</code>. If you see failed items, the API
            endpoint may be unreachable. Verify your internet connection and check the daemon logs
            for error messages.
          </p>
          <p>
            <strong>Chrome extension disconnected:</strong> Make sure the desktop daemon is running
            first. Then check that the native messaging manifest is installed:{" "}
            <code>ls ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/</code>{" "}
            should show <code>com.lurk.native_host.json</code>. If missing, reinstall the desktop
            app.
          </p>
          <p>
            <strong>Artifacts not appearing in web app:</strong> Check the Synced count in the
            desktop dashboard. If artifacts are synced but not visible in the web app, verify you are
            signed into the same organization in both places. Artifacts are scoped to organizations
            — if your desktop syncs to org A but you are viewing org B in the web app, you will not
            see them.
          </p>

          <h2>Next Steps</h2>
          <p>
            Explore the integrations that expand what Lurk can capture:
          </p>
          <p>
            <Link href="/tutorials/connecting-google-docs" className="text-clay-500 hover:text-clay-600 underline underline-offset-2">
              Connecting Google Docs to Lurk
            </Link>{" "}
            — Set up API-level Google Docs sync for your entire workspace.
          </p>
          <p>
            <Link href="/tutorials/setting-up-gmail-integration" className="text-clay-500 hover:text-clay-600 underline underline-offset-2">
              Setting Up Gmail Integration
            </Link>{" "}
            — Configure which email threads become tracked artifacts.
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
