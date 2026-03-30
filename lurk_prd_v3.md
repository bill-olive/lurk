# Lurk — Product Requirements Document & Technical Specification v3

**Status:** Implementation-ready
**Last updated:** 2026-03-29
**Revision:** v3 — all capabilities in scope, Mac/iOS first, Anthropic LLM stack
**Positioning:** Slack competitor — autonomous, artifact-centric collaboration that eliminates internal communication overhead

---

## 1. Executive Summary

### What Lurk is

Lurk is an autonomous collaboration platform that replaces internal messaging, meetings, and status documents with a single primitive: **the artifact**. Every meaningful work product — code commits, documents, customer call recordings, emails, designs, sales data, spreadsheets — is captured, timestamped, and stored in a versioned ledger inspired by git's primitives (commits, branches, forks, merges) but built as Lurk's own platform-native system. AI agents powered by Anthropic's Claude (Sonnet 4.6 for speed, Opus 4.6 for depth) operate on behalf of users, teams, and organizational functions to autonomously observe, fork, modify, and propose changes to these artifacts. The original author receives a pull request to accept, reject, or configure for automatic acceptance (YOLO mode).

Lurk is **Mac and iOS first**. The primary surfaces are a macOS menu bar app (always-on, system-level capture), a Chrome extension (browser-level capture), and an iOS app (mobile review, voice capture, and agent management). Meeting ingestion from Zoom and Google Meet is zero-effort — Lurk captures system audio on Mac like Granola does, requiring no bot, no calendar integration, and no meeting participant awareness.

### What Lurk replaces

Lurk replaces Slack, Microsoft Teams, and the internal communication tax that consumes 60–80% of a knowledge worker's day. Instead of:

- **Slack messages** → Agents read your artifacts and surface what's relevant to others automatically
- **Status meetings** → Agents produce synthesized status artifacts from the work itself
- **Review requests** → Agents fork artifacts and propose changes as PRs
- **@mentions and notifications** → Agents deliver context-aware, PII-scrubbed summaries only when action is needed
- **Cross-team alignment docs** → Agents merge related artifacts across functions and present unified views
- **Meeting notes** → Lurk captures and transcribes calls automatically, agents extract action items and update affected artifacts
- **Onboarding to the platform** → Agentic migration bots crawl your existing Slack, Google Drive, Notion, and email, converting history into artifacts automatically

### The thesis

The only thing that matters is **work that touches the customer**. Internal communication is overhead. Lurk makes internal communication unnecessary by making the work itself the communication medium.

### How it works in 30 seconds

1. Employee installs Lurk's Mac app (menu bar) and works normally — writes code, drafts docs, takes customer calls, sends emails.
2. Lurk observes actions across the system: browser activity via Chrome extension, meetings via system audio capture, files via filesystem watchers, and IDE activity via editor plugins.
3. Every captured artifact is timestamped, PII-scrubbed per policy, and committed to the employee's **artifact ledger** — a versioned store using commit, branch, fork, and merge primitives inspired by git but native to Lurk.
4. AI agents — personal, team-level, org-level, and function-level — continuously read artifact ledgers they have permission to access.
5. When an agent determines a change is needed (e.g., a sales deck references outdated pricing, a spec contradicts a customer commitment), it **forks** the artifact, makes the change, and opens a **PR** against the original.
6. The original author reviews the PR on Mac, iOS, or in the Chrome sidebar and accepts, rejects, or comments. Or they enable **YOLO mode** and the agent's changes auto-merge.
7. All forks, merges, and PRs are versioned, auditable, and access-controlled.

---

## 2. Problem Statement

### The internal communication tax

Knowledge workers spend an estimated 28 hours per week on email, meetings, and internal messaging (McKinsey, Asana Work Index). Less than 30% of their time goes to skilled, customer-impacting work. The problem is structural: organizations use synchronous, high-interruption, low-context communication channels (Slack, email, meetings) to coordinate work that is fundamentally asynchronous and artifact-based.

### Why Slack fails

Slack optimized for **message throughput**, not **work throughput**. It created a new attention tax: hundreds of channels, thousands of unread messages, and a culture of performative presence. The information in Slack messages is ephemeral, unsearchable in practice, and disconnected from the artifacts it references. Slack is where work goes to be talked about, not where work gets done.

### Why existing AI assistants fail

Current AI tools (Copilot, Gemini, ChatGPT) operate in a vacuum. They lack access to the non-public, organization-specific context that makes suggestions actually useful: the customer commitment your sales team made last Tuesday, the deprecation your platform team announced in a doc nobody read, the brand guidelines your design team updated yesterday. Without this context, AI suggestions are generic and low-trust.

### Lurk's insight

The artifacts themselves — the code, the docs, the recordings, the data — already contain everything needed to coordinate. The missing piece is an autonomous layer that reads the artifacts, understands them in organizational context, and proposes changes across boundaries. No meetings. No messages. Just PRs on real work.

---

## 3. Platform Architecture: Mac & iOS First

### 3.1 Platform Surfaces

Lurk ships four client surfaces, all shipping in v1:

| Surface | Role | Technology |
|---------|------|-----------|
| **macOS Menu Bar App** | Always-on system daemon. Captures system audio (meetings), coordinates Chrome extension, manages local ledger, runs on-device PII detection. The "brain" on the user's machine. | Swift/SwiftUI, runs as a persistent menu bar agent. Core audio capture via CoreAudio/AudioToolbox. Local ML via Core ML + WASM runtime for PII detection. |
| **Chrome Extension** | Browser-level artifact capture. DOM observation for Google Docs, Gmail, Figma, GitHub, etc. Sidebar UI for PR review and ledger browsing. | Manifest V3, React, Shadow DOM. Communicates with Mac app via Native Messaging (chrome.runtime.connectNative). |
| **iOS App** | Mobile PR review, voice memo capture, agent management, notification hub. | SwiftUI, shares core packages with macOS via Swift Package Manager. Push notifications via APNs. |
| **Web Admin Console** | Org administration: policies, agents, teams, audit, migration, kill switches. | Next.js 15, React, Tailwind. Deployed on Cloud Run. |

### 3.2 Mac App Architecture

The Mac app is the primary local runtime. It replaces what a typical Chrome extension background process would do, but with full system-level access.

```
LurkMacApp {
  // System-level capture
  audioCapture: {
    engine: 'CoreAudio'          // system audio tap, not mic-only
    method: 'aggregate_device'   // virtual audio device that mirrors system output
    targets: ['zoom.us', 'Google Meet', 'Microsoft Teams', 'FaceTime', 'Webex']
    detection: 'audio_session'   // detect when a meeting app is producing audio
    recording: 'on_detect'       // start recording when meeting audio detected
    consent: 'system_preference' // user must enable in System Settings > Privacy > Audio
    format: 'audio/opus'         // compressed, efficient
    localOnly: true              // raw audio never leaves the device
  }
  
  // Transcription (on-device first, cloud fallback)
  transcription: {
    localEngine: 'whisper.cpp'   // Whisper large-v3 via whisper.cpp, runs on Apple Silicon
    cloudFallback: 'openai_whisper_api' // fallback if local transcription is too slow
    speakerDiarization: true     // identify who said what
    language: 'auto'             // auto-detect language
    outputFormat: 'artifact'     // transcripts become comm:call_transcript artifacts
  }
  
  // Filesystem watcher
  fileWatcher: {
    engine: 'FSEvents'           // macOS native filesystem events
    watchPaths: ['~/Documents', '~/Desktop', '~/Downloads'] // configurable
    triggers: ['create', 'modify', 'rename']
    allowedExtensions: ['.md', '.docx', '.pdf', '.xlsx', '.csv', '.pptx', '.sketch', '.fig']
    excludePatterns: ['node_modules', '.git', '.DS_Store', '*.tmp']
  }
  
  // IDE integration
  ideCapture: {
    vsCodeExtension: true        // VS Code extension that pipes to Mac app
    cursorExtension: true        // Cursor extension
    xcodePlugin: true            // Xcode source editor extension
    jetbrainsPlugin: true        // IntelliJ/WebStorm plugin (deferred to v1.1)
    captureMode: 'on_save'       // capture file state on save events
  }
  
  // Chrome extension coordination
  chromeNativeMessaging: {
    hostManifest: 'com.lurk.native_host'
    protocol: 'json_lines'       // newline-delimited JSON over stdio
    bidirectional: true          // Mac app can push policy updates to extension
  }
  
  // Local ledger
  localLedger: {
    storage: 'SQLite + filesystem' // SQLite for metadata, filesystem for content
    location: '~/Library/Application Support/Lurk/'
    encryption: 'FileVault-aware' // respects system-level encryption
    maxLocalStorageGB: 50         // configurable, oldest artifacts pruned first
  }
  
  // PII detection runtime
  piiRuntime: {
    engine: 'lurk-pii-swift'     // Swift native PII detector
    mlModel: 'CoreML'            // NER model compiled to Core ML
    regexEngine: 'native'        // Swift Regex for pattern matching
    wasmFallback: false          // not needed on Mac, native is faster
  }
  
  // Background processing
  scheduling: {
    audioProcessing: 'immediate'  // transcribe as meeting ends
    artifactSync: 'debounced_5s'  // batch sync every 5 seconds
    agentTasks: 'queue'           // agent tasks queued and processed in order
    idleBehavior: 'continue'      // keep processing when user is idle
    powerManagement: 'respect'    // pause heavy tasks on battery
  }
}
```

### 3.3 Meeting Capture: Zero-Effort Design

Meeting capture must require **zero configuration** after initial setup. The model is Granola-style: Lurk taps system audio, detects when a meeting app is active, records and transcribes locally, and creates artifacts automatically.

```
MeetingCaptureFlow {
  // Detection
  1. Mac app monitors audio sessions via CoreAudio
  2. When a known meeting app (Zoom, Google Meet, Teams, FaceTime, Webex) 
     starts producing audio output, Lurk detects it
  3. Detection can also be augmented by calendar integration: if a Google Calendar 
     event is active with a meeting link, Lurk pre-arms capture
  
  // Recording
  4. Lurk creates a virtual aggregate audio device that mirrors system audio output
  5. Meeting audio is recorded in Opus format to local storage
  6. Recording is ephemeral — raw audio is deleted after transcription (configurable retention)
  
  // Transcription
  7. When meeting ends (audio session closes), Lurk transcribes using on-device 
     Whisper large-v3 via whisper.cpp (Apple Silicon optimized, ~real-time speed)
  8. Speaker diarization identifies participants
  9. If the user has Google Calendar connected, Lurk matches speakers to attendee names
  
  // Artifact creation
  10. A comm:call_recording artifact is created (metadata only — raw audio deleted unless retained)
  11. A comm:call_transcript artifact is created with the full transcript
  12. The transcript is PII-scrubbed per policy before any sync
  13. A comm:call_summary artifact is created by running the transcript through 
      Claude Sonnet 4.6 with a meeting-summary prompt (action items, decisions, follow-ups)
  
  // Agent processing
  14. Personal agent reads the meeting artifacts
  15. Agent cross-references action items against existing artifacts in the ledger
  16. Agent opens PRs on affected artifacts (e.g., update a spec mentioned in the meeting,
      add a timeline commitment to a roadmap, flag a customer concern to the sales team agent)
  
  // Consent model
  - First-time setup: user must grant Audio Recording permission in macOS System Settings
  - Per-meeting: configurable — always-on, or only when calendar event is marked "record"
  - Participant notification: configurable — Lurk can optionally post a message in the meeting
    chat ("This meeting is being transcribed by Lurk for [Org Name]"), but this is org policy,
    not a hard requirement at the system level
  - Org policy can force consent banner or disable meeting capture entirely
}
```

### 3.4 iOS App

```
LurkiOSApp {
  // Primary use cases
  prReview: {
    // Full PR review experience: diff view, justification, approve/reject/comment
    // Optimized for mobile: swipe to approve, swipe to reject
    // Push notification → deep link to specific PR
  }
  
  agentManagement: {
    // View agent activity, pause/resume agents
    // YOLO mode toggle
    // Action budget overview
  }
  
  voiceCapture: {
    // Voice memo → artifact pipeline
    // User records a voice note (e.g., after a customer meeting, walking between meetings)
    // On-device transcription via Speech framework or Whisper
    // Transcription becomes a document:note artifact in their ledger
    // Agent processes it like any other artifact
  }
  
  ledgerBrowse: {
    // Browse artifact history, search, filter
    // View artifact content (redacted as appropriate)
    // View artifact relationships and fork graph
  }
  
  notifications: {
    // Action-required notifications only
    // Configurable quiet hours
    // Digest mode: bundle into morning/evening summary
    channels: ['push_notification', 'in_app']
  }
  
  // Shared code with macOS
  sharedPackages: [
    'LurkCore',          // types, models, serialization
    'LurkPII',           // PII detection (shared Swift code)
    'LurkLedger',        // local ledger operations
    'LurkSync',          // cloud sync protocol
    'LurkUI',            // shared SwiftUI components
  ]
  
  // Offline support
  offline: {
    localCache: true     // cache recent PRs and artifacts for offline review
    queueActions: true   // queue approve/reject actions for when connectivity returns
    voiceCapture: true   // voice memos work fully offline
  }
}
```

### 3.5 Chrome Extension (Browser Capture Layer)

The Chrome extension is a capture and UI layer that delegates heavy processing to the Mac app via Native Messaging.

```
ChromeExtension {
  // Capture (same as v2 but delegates to Mac app)
  domObserver: {
    targets: [
      { app: 'docs.google.com', type: 'document:gdoc' },
      { app: 'notion.so',       type: 'document:notion' },
      { app: 'figma.com',       type: 'design:figma' },
      { app: 'github.com',      type: 'code:file' },
      { app: 'linear.app',      type: 'data:issue_tracker' },
      { app: 'mail.google.com', type: 'comm:email_sent | comm:email_received' },
      { app: '*.salesforce.com',type: 'data:crm_record' },
      { app: '*.hubspot.com',   type: 'data:crm_record' },
    ]
    processingMode: 'delegate_to_mac_app' // send raw captures to Mac app for PII + commit
    fallbackMode: 'extension_local'       // if Mac app not running, process locally in extension
  }
  
  // Sidebar UI (same as v2)
  sidebar: {
    tabs: ['Inbox', 'Activity', 'Ledger', 'Agents', 'Privacy']
    rendering: 'shadow_dom'
    framework: 'React'
  }
  
  // Native Messaging to Mac app
  nativeMessaging: {
    host: 'com.lurk.native_host'
    // Extension sends: raw DOM captures, navigation events, form submissions
    // Mac app sends: policy updates, insight responses, PR notifications
  }
  
  // Standalone mode (when Mac app is not installed — e.g., non-Mac users in v2)
  standaloneMode: {
    // Extension runs its own PII detection (WASM runtime)
    // Extension maintains its own local ledger (IndexedDB)
    // Extension syncs directly to cloud
    // Reduced capability: no meeting capture, no filesystem capture, no IDE capture
    enabled: true  // allows non-Mac users to participate with reduced functionality
  }
}
```

---

## 4. Core Primitives

These are the foundational objects in Lurk. Everything is built from six primitives. The versioning system is inspired by git's model (commits, branches, forks, merges) but is Lurk's own implementation — not built on top of git, not using git's file format, not requiring git as a dependency. Lurk borrows the conceptual primitives because they are the right abstractions for versioned, distributed, collaborative work on artifacts.

### 4.1 Artifact

An artifact is any discrete unit of work product captured by Lurk. It is the **only** first-class object in the system.

```
Artifact {
  id:                 string           // UUID v7 (time-sortable)
  ledgerId:           string           // which ledger owns this artifact
  orgId:              string           // organization scope
  
  // Identity
  type:               ArtifactType     // see taxonomy below
  title:              string           // human-readable name
  sourceUrl:          string?          // original URL if browser-captured
  sourceApp:          string           // 'chrome:gdocs', 'mac:zoom_transcript', 'ios:voice_memo', etc.
  mimeType:           string           // 'text/plain', 'audio/webm', 'application/json', etc.
  captureMethod:      CaptureMethod    // how this artifact was captured
  
  // Content (privacy-layered)
  contentHash:        string           // SHA-256 of raw content (never stored centrally)
  redactedContent:    string?          // PII-scrubbed version (stored centrally if policy allows)
  featureBundle:      FeatureBundle    // privacy-preserving extracted features
  metadata:           ArtifactMetadata // structural metadata
  
  // Classification
  tags:               string[]
  customerFacing:     boolean          // is this artifact customer-facing?
  customerRefs:       CustomerRef[]    // which customers does this touch?
  sensitivity:        SensitivityLevel // public | internal | confidential | restricted
  
  // Customer health (for customer-facing artifacts)
  customerHealth:     CustomerHealthSignal? // populated by customer health agent
  
  // Ownership
  authorId:           string           // who created this
  ownerIds:           string[]         // who is responsible for this
  teamIds:            string[]         // which teams own this
  
  // Versioning (Lurk ledger semantics)
  version:            number           // monotonically increasing
  parentVersion:      number?          // null for initial commit
  commitHash:         string           // Lurk commit hash (SHA-256 of version content + metadata)
  commitMessage:      string           // auto-generated or agent-provided
  branchId:           string?          // null = main branch
  
  // Timestamps
  capturedAt:         timestamp        // when Lurk first observed this
  modifiedAt:         timestamp        // last modification
  committedAt:        timestamp        // when committed to ledger
  
  // Access control
  accessTier:         AccessTier       // who can see this
  aclOverrides:       ACLOverride[]    // explicit grants/denials
  
  // Lineage
  forkedFrom:         ForkRef?         // if this is a fork, what's the upstream
  mergedInto:         MergeRef?        // if this was merged, where
  relatedArtifacts:   RelationRef[]    // agent-discovered relationships
  
  // Analytics
  qualityScore:       number?          // agent-assessed quality (0.0–1.0)
  stalenessScore:     number?          // how stale is this artifact (0.0–1.0)
  coverageGaps:       string[]?        // what's missing from this artifact
}

CaptureMethod =
  | 'chrome_dom'           // captured via DOM observation in Chrome
  | 'chrome_api'           // captured via API interception in Chrome
  | 'mac_audio'            // captured via macOS system audio
  | 'mac_filesystem'       // captured via macOS FSEvents
  | 'mac_ide'              // captured via IDE plugin → Mac app
  | 'ios_voice'            // captured via iOS voice memo
  | 'ios_photo'            // captured via iOS camera/screenshot
  | 'migration_import'     // imported during migration from another platform
  | 'api_ingest'           // ingested via external API
  | 'agent_generated'      // created by an agent (synthesis, summary, etc.)
```

#### Artifact Type Taxonomy

```
ArtifactType =
  // Documents
  | 'document:gdoc'          // Google Doc
  | 'document:notion'        // Notion page
  | 'document:markdown'      // Markdown file
  | 'document:pdf'           // PDF
  | 'document:word'          // Word doc
  | 'document:note'          // Voice memo transcript, quick note
  | 'document:wiki'          // Confluence, wiki page
  
  // Code
  | 'code:commit'            // Code commit
  | 'code:pr'                // Pull request
  | 'code:file'              // Source file
  | 'code:snippet'           // Code snippet
  | 'code:review'            // Code review comment
  
  // Communication (customer-facing only by default)
  | 'comm:email_sent'        // Outbound email
  | 'comm:email_received'    // Inbound email
  | 'comm:call_recording'    // Call/meeting recording metadata (audio is local-only)
  | 'comm:call_transcript'   // Transcription of recording
  | 'comm:call_summary'      // Agent-generated meeting summary
  | 'comm:chat_thread'       // Customer chat thread
  
  // Data
  | 'data:spreadsheet'       // Spreadsheet
  | 'data:csv'               // CSV/TSV
  | 'data:dashboard'         // Dashboard snapshot
  | 'data:report'            // Generated report
  | 'data:crm_record'        // CRM record snapshot
  | 'data:issue_tracker'     // Linear, Jira, Asana issue
  
  // Design
  | 'design:figma'           // Figma file
  | 'design:sketch'          // Design file
  | 'design:screenshot'      // Screenshot capture
  
  // Meta (agent-generated)
  | 'meta:synthesis'         // Agent-generated synthesis of multiple artifacts
  | 'meta:status'            // Agent-generated status summary
  | 'meta:conflict'          // Agent-detected conflict between artifacts
  | 'meta:recommendation'    // Agent-generated recommendation
  | 'meta:customer_health'   // Agent-generated customer health score
  | 'meta:analytics_report'  // Agent-generated analytics on artifact quality/coverage
  | 'meta:calendar_review'   // Agent-generated calendar analysis
  
  // Migration (from other platforms)
  | 'migration:slack_message'    // Imported Slack message/thread
  | 'migration:slack_file'       // Imported Slack file upload
  | 'migration:drive_file'       // Imported Google Drive file
  | 'migration:notion_page'      // Imported Notion page
  | 'migration:email_archive'    // Imported email archive
  | 'migration:jira_issue'       // Imported Jira issue
```

### 4.2 Ledger

A ledger is a per-user versioned store of all artifacts. Every user has exactly one ledger. Conceptually analogous to a personal monorepo, using commit/branch/merge primitives inspired by git but implemented as Lurk's own system.

The ledger is **not a git repository**. It does not use git's object format, packfiles, or refs. It uses Lurk's own commit graph stored in SQLite (locally) and Firestore (cloud). The git-inspired primitives (commit, branch, fork, merge, diff) are implemented from scratch to handle Lurk's specific needs: multi-type artifacts (not just files), privacy-layered content (where different viewers see different content), and agent-authored commits (where the "author" is an AI agent, not a human with a GPG key).

```
Ledger {
  id:                 string
  userId:             string
  orgId:              string
  
  // Versioning (Lurk-native, git-inspired primitives)
  head:               string           // commit hash of latest state on main
  branches:           Branch[]         // active branches
  commitLog:          CommitEntry[]    // ordered commit history (DAG)
  
  // Stats
  artifactCount:      number
  lastCommitAt:       timestamp
  
  // Policy
  defaultSensitivity: SensitivityLevel
  autoCommit:         boolean          // commit on every capture, or batch
  yoloMode:           YoloConfig       // auto-accept configuration
  
  // Local storage (Mac/iOS)
  localPath:          string           // ~/Library/Application Support/Lurk/ledgers/{id}/
  localSizeBytes:     number
  syncState:          SyncState        // ahead | behind | synced | diverged
}

Branch {
  id:                 string
  name:               string           // 'main', 'agent/pricing-update', etc.
  head:               string           // commit hash
  upstream:           UpstreamRef?     // if tracking another ledger's branch
  createdBy:          string           // userId or agentId
  createdAt:          timestamp
}

CommitEntry {
  hash:               string           // SHA-256(parentHash + artifactId + version + content_hash + timestamp)
  parentHash:         string?          // null for initial commit; can have multiple parents for merges
  artifactId:         string
  version:            number
  message:            string
  authorId:           string           // user or agent
  authorType:         'user' | 'agent'
  timestamp:          timestamp
  signature:          string           // HMAC signature using org signing key
  policyVersion:      string           // which policy was in effect
}

SyncState {
  lastSyncAt:         timestamp
  localHead:          string
  remoteHead:         string
  pendingCommits:     number           // commits not yet synced to cloud
  pendingPRs:         number           // PRs not yet synced
  conflictState:      'none' | 'diverged_resolvable' | 'diverged_manual'
}
```

### 4.3 Fork

A fork is a copy of an artifact created by an agent (or user) to propose changes without modifying the original. Forks live in the forking agent's workspace ledger, not the original author's ledger.

```
Fork {
  id:                 string
  orgId:              string
  
  // Source
  upstreamArtifactId: string           // what was forked
  upstreamVersion:    number           // at which version
  upstreamLedgerId:   string           // from whose ledger
  
  // Fork state
  forkLedgerId:       string           // the agent's working ledger
  forkBranchId:       string           // branch in the fork ledger
  artifactId:         string           // the forked artifact copy
  
  // Agent context
  agentId:            string           // which agent created this fork
  agentType:          AgentType        // personal | team | org | function
  reason:             string           // why the agent forked this
  confidence:         number           // 0.0–1.0 agent confidence in proposed change
  
  // Lifecycle
  status:             ForkStatus       // active | merged | abandoned | rejected
  createdAt:          timestamp
  updatedAt:          timestamp
}

ForkStatus = 'active' | 'merged' | 'abandoned' | 'rejected'
```

### 4.4 Pull Request (PR)

A PR is a proposal to merge changes from a fork back into the original artifact's ledger.

```
PullRequest {
  id:                 string
  orgId:              string
  
  // References
  forkId:             string
  sourceArtifactId:   string          // the changed version
  targetArtifactId:   string          // the original
  targetLedgerId:     string          // where to merge
  
  // Content
  title:              string          // agent-generated summary
  description:        string          // detailed explanation of changes
  diff:               Diff            // structured diff
  changeSummary:      string          // human-readable summary
  
  // Agent context
  agentId:            string
  agentType:          AgentType
  confidence:         number
  justification:      string          // why this change matters
  sourceRefs:         SourceRef[]     // what data/artifacts informed this
  
  // Review
  status:             PRStatus
  reviewerId:         string?         // who reviewed (user or auto)
  reviewAction:       ReviewAction?
  reviewComment:      string?
  reviewedAt:         timestamp?
  
  // YOLO
  autoMergeEligible:  boolean         // meets YOLO criteria
  autoMergedAt:       timestamp?      // if auto-merged
  
  // Lifecycle
  createdAt:          timestamp
  updatedAt:          timestamp
  mergedAt:           timestamp?
  closedAt:           timestamp?
}

PRStatus = 'open' | 'approved' | 'merged' | 'rejected' | 'closed' | 'auto_merged'
ReviewAction = 'approve' | 'reject' | 'request_changes' | 'comment'

Diff {
  type:               'text' | 'structured' | 'binary' | 'multimodal'
  hunks:              DiffHunk[]      // for text diffs
  summary:            string          // always present, human-readable
  addedLines:         number
  removedLines:       number
  changedSections:    string[]        // which sections changed
  voiceNarration:     string?         // TTS-ready summary for iOS review (generated by OpenAI TTS)
}
```

### 4.5 Agent

An agent is an autonomous entity that operates on artifacts on behalf of a user, team, or organizational function.

```
Agent {
  id:                 string
  orgId:              string
  
  // Identity
  name:               string           // 'bill-personal', 'sales-team', 'legal-compliance'
  type:               AgentType
  description:        string           // what this agent does
  
  // Ownership
  ownerId:            string           // user, team, or org who controls this agent
  ownerType:          'user' | 'team' | 'org'
  
  // Permissions
  readScope:          ScopeConfig      // what artifacts can this agent read
  writeScope:         ScopeConfig      // what artifacts can this agent fork/PR
  actionBudget:       ActionBudget     // rate limits and cost caps
  
  // Behavior
  triggers:           TriggerConfig[]  // what causes this agent to act
  capabilities:       AgentCapability[]// what this agent can do
  modelConfig:        ModelConfig      // which Claude model, temperature, etc.
  
  // Marketplace
  templateId:         string?          // if created from a marketplace template
  customPrompts:      CustomPrompt[]   // user/admin customizations on top of template
  
  // State
  status:             'active' | 'paused' | 'disabled' | 'error'
  lastRunAt:          timestamp
  totalActions:       number
  acceptanceRate:     number           // historical PR acceptance rate
  
  // Audit
  createdBy:          string
  createdAt:          timestamp
  updatedAt:          timestamp
}

AgentType = 
  | 'personal'       // acts on behalf of one user
  | 'team'           // acts on behalf of a team (e.g., "Design team agent")
  | 'org'            // acts on behalf of the whole org (e.g., "Compliance agent")
  | 'function'       // acts on behalf of a business function (e.g., "Sales ops agent")
  | 'migration'      // special type for platform migration bots
  | 'voice'          // voice agent that joins/monitors calls
  | 'calendar'       // calendar intelligence agent

ScopeConfig {
  ledgerIds:          string[]?       // specific ledgers (null = all permitted)
  teamIds:            string[]?       // specific teams
  artifactTypes:      ArtifactType[]? // specific types
  sensitivityMax:     SensitivityLevel// maximum sensitivity level
  customerFacingOnly: boolean         // only customer-facing artifacts?
  tagFilters:         TagFilter[]     // include/exclude by tag
}

ActionBudget {
  maxForksPerHour:    number          // rate limit on forks
  maxPRsPerDay:       number          // rate limit on PRs
  maxTokensPerDay:    number          // LLM token budget
  requireApprovalAbove: number        // confidence threshold below which PR needs human review
  costCapPerMonth:    number          // dollar cap on compute costs
}

TriggerConfig {
  type:               TriggerType
  filter:             Record<string, unknown> // type-specific filter
  debounceMs:         number          // minimum interval between triggers
  enabled:            boolean
}

TriggerType =
  | 'artifact_committed'    // new artifact or version committed
  | 'artifact_modified'     // existing artifact changed
  | 'schedule'              // cron-like schedule
  | 'pr_opened'             // a PR was opened on a watched artifact
  | 'pr_merged'             // a PR was merged
  | 'keyword_detected'      // specific content detected
  | 'conflict_detected'     // two artifacts conflict
  | 'staleness_threshold'   // artifact hasn't been updated in N days
  | 'customer_event'        // customer-related event (call, email, etc.)
  | 'meeting_ended'         // a meeting transcript is ready
  | 'calendar_event'        // upcoming/changed calendar event
  | 'migration_batch'       // migration batch ready for processing
  | 'manual'                // explicitly triggered by user

AgentCapability =
  | 'read_artifacts'        // read artifact content
  | 'fork_artifacts'        // create forks
  | 'open_prs'              // open pull requests
  | 'synthesize'            // create meta:synthesis artifacts
  | 'summarize'             // create meta:status artifacts
  | 'detect_conflicts'      // create meta:conflict artifacts
  | 'recommend'             // create meta:recommendation artifacts
  | 'notify'                // send notifications through connectors
  | 'auto_merge'            // merge PRs when YOLO mode allows
  | 'score_customer_health' // compute customer health scores
  | 'analyze_artifacts'     // compute quality/staleness/coverage analytics
  | 'review_calendar'       // analyze calendar and suggest cancellations
  | 'voice_narrate'         // generate voice narration of PR summaries (via OpenAI TTS)
  | 'migrate_data'          // crawl and import data from external platforms
  | 'browse_web'            // use Browserbase for agentic web browsing during migration
```

### 4.6 YOLO Mode Configuration

YOLO mode allows agents to auto-merge PRs without human review, subject to configurable guardrails.

```
YoloConfig {
  enabled:            boolean
  
  // What can auto-merge
  allowedAgentTypes:  AgentType[]     // which agent types can auto-merge
  allowedAgentIds:    string[]?       // specific agents (null = all of allowed types)
  allowedCategories:  string[]        // e.g., ['formatting', 'typo', 'data_refresh']
  
  // Guardrails
  minConfidence:      number          // minimum agent confidence (0.0–1.0)
  maxDiffSize:        number          // max lines changed
  maxSensitivity:     SensitivityLevel// max sensitivity of affected artifact
  excludeCustomerFacing: boolean      // never auto-merge customer-facing artifacts
  excludeTags:        string[]        // never auto-merge artifacts with these tags
  
  // Safety
  cooldownAfterReject: number         // hours to pause YOLO after a rejection
  dailyAutoMergeCap:  number          // max auto-merges per day
  requireSecondAgent: boolean         // require two agents to agree before auto-merge
  rollbackWindow:     number          // hours during which auto-merge can be undone
}
```

---

## 5. LLM and AI Stack

All intelligence in Lurk is powered by Anthropic's Claude models, with OpenAI used exclusively for text-to-speech.

### 5.1 Model Allocation

| Task | Model | Rationale |
|------|-------|-----------|
| **Personal agent**: routine artifact analysis, stale reference detection, formatting fixes | **Claude Sonnet 4.6** | Fast, cost-effective, high-volume tasks |
| **Team agent**: cross-artifact conflict detection, synthesis, recommendations | **Claude Sonnet 4.6** | Good balance of speed and reasoning |
| **Org agent**: compliance analysis, cross-functional synthesis, policy evaluation | **Claude Opus 4.6** | Deep reasoning needed for org-wide analysis |
| **Function agent**: customer health scoring, revenue impact analysis | **Claude Opus 4.6** | Complex multi-artifact reasoning |
| **Migration agent**: content classification, relationship mapping | **Claude Sonnet 4.6** | High volume, needs speed |
| **Calendar agent**: meeting analysis, cancellation recommendations | **Claude Sonnet 4.6** | Routine analysis |
| **Meeting summary**: call transcript → structured summary | **Claude Sonnet 4.6** | Fast turnaround after meetings |
| **Complex meeting analysis**: multi-meeting synthesis, customer health from calls | **Claude Opus 4.6** | Deep analysis of multiple transcripts |
| **PR description generation**: diff → human-readable summary | **Claude Sonnet 4.6** | Fast, frequent |
| **Artifact quality scoring**: content evaluation, staleness detection | **Claude Sonnet 4.6** | Routine analysis |
| **Voice narration of PR summaries** | **OpenAI TTS** (tts-1-hd) | Best-in-class TTS for natural speech |
| **On-device transcription** | **Whisper large-v3** (whisper.cpp) | On-device, Apple Silicon optimized |
| **Cloud transcription fallback** | **OpenAI Whisper API** | Fallback when local transcription is too slow |

### 5.2 LLM Gateway Service

```
LLMGateway {
  // Centralized model access — all agent LLM calls go through this service
  
  provider: 'anthropic'
  models: {
    fast:    'claude-sonnet-4-6'    // model string for Sonnet 4.6
    deep:    'claude-opus-4-6'      // model string for Opus 4.6
  }
  
  // Model selection logic
  selectModel(agent, task) → {
    if agent.type in ['org', 'function'] → 'deep'
    if task.complexity == 'high' → 'deep'
    if task.type == 'multi_artifact_synthesis' && artifact_count > 10 → 'deep'
    default → 'fast'
  }
  
  // Token metering
  metering: {
    perAgent: true            // track tokens per agent
    perOrg: true              // track tokens per org
    budgetEnforcement: true   // refuse calls that would exceed agent/org budget
    alertThresholds: [50%, 80%, 95%]
  }
  
  // Prompt management
  prompts: {
    storage: 'versioned'      // all prompts versioned, rollback-able
    templates: {
      artifact_analysis:       'prompts/artifact_analysis_v{n}.txt'
      conflict_detection:      'prompts/conflict_detection_v{n}.txt'
      meeting_summary:         'prompts/meeting_summary_v{n}.txt'
      pr_description:          'prompts/pr_description_v{n}.txt'
      customer_health:         'prompts/customer_health_v{n}.txt'
      calendar_review:         'prompts/calendar_review_v{n}.txt'
      migration_classify:      'prompts/migration_classify_v{n}.txt'
      quality_score:           'prompts/quality_score_v{n}.txt'
    }
  }
  
  // API configuration
  api: {
    endpoint: 'https://api.anthropic.com/v1/messages'
    authMethod: 'api_key'     // stored in Google Secret Manager
    maxConcurrent: 50         // max concurrent API calls per org
    retryPolicy: { maxRetries: 3, backoffMs: [1000, 5000, 15000] }
    timeout: 120000           // 120 seconds max per call
  }
  
  // OpenAI (TTS only)
  tts: {
    provider: 'openai'
    model: 'tts-1-hd'
    voice: 'nova'             // configurable per org
    endpoint: 'https://api.openai.com/v1/audio/speech'
    maxLengthChars: 4096      // max input text length
    outputFormat: 'opus'      // compressed audio
    useCase: 'pr_voice_summary' // ONLY used for voice narration of PR summaries
  }
}
```

### 5.3 Agent Execution Model

```
AgentExecutionLoop {
  1. TRIGGER: An event matches the agent's trigger configuration
  2. SCOPE: Agent resolves which artifacts it can read (ACL check)
  3. CONTEXT: Agent loads relevant artifacts and their feature bundles
  4. ANALYZE: Agent sends context to LLM Gateway with agent-specific prompt
     → LLM Gateway selects Sonnet 4.6 or Opus 4.6 based on agent type and task complexity
  5. DECIDE: Claude returns structured analysis:
     - action: 'fork' | 'pr' | 'synthesize' | 'notify' | 'skip'
     - confidence: 0.0–1.0
     - justification: string
  6. GATE: Policy engine evaluates whether the action is allowed:
     - Is the agent within its action budget?
     - Does confidence exceed threshold?
     - Is the target artifact within write scope?
     - Does YOLO mode apply?
  7. EXECUTE: If allowed, perform the action:
     - Fork the artifact → compute diff → open PR
     - OR create a meta artifact
     - OR send notification
  8. AUDIT: Log the action with full lineage
  9. NOTIFY: If PR opened, notify the artifact owner through their preferred channel
     - Optionally: generate voice narration of PR summary via OpenAI TTS for iOS push notification
}
```

### 5.4 Agent Rate Limits and Safety

```
AgentSafetyConfig {
  // Global rate limits
  maxAgentActionsPerMinute:  100    // across all agents in the org
  maxForksPerAgentPerHour:   20     // per individual agent
  maxPRsPerAgentPerDay:      50
  maxTokensPerAgentPerDay:   500000 // Anthropic API token budget
  
  // Circuit breakers
  errorRateThreshold:        0.1    // 10% error rate → pause agent
  rejectionRateThreshold:    0.5    // 50% PR rejection rate → pause and alert admin
  cascadeProtection:         true   // prevent agent A's PR from triggering agent B's fork
  maxChainDepth:             3      // max number of agent-to-agent fork chains
  
  // Human-in-the-loop triggers
  requireHumanReviewWhen: [
    'confidence < 0.7',
    'artifact.sensitivity >= confidential',
    'artifact.customerFacing == true',
    'diff.changedLines > 50',
    'agent.type == org',
  ]
  
  // Rollback
  autoRollbackWindow:        24     // hours during which auto-merged PRs can be undone
  rollbackOnOwnerReject:     true   // if owner rejects after auto-merge, revert
}
```

---

## 6. Agent Types: Full Specifications

Every agent type from v2's "Future Extensions" is now part of the core system.

### 6.1 Personal Agent
- **Scope:** One user's ledger
- **Model:** Sonnet 4.6 (default), Opus 4.6 for complex analysis
- **Purpose:** Keep the user's own work consistent, up-to-date, and conflict-free
- **Capabilities:** read_artifacts, fork_artifacts, open_prs, summarize, detect_conflicts
- **Examples:**
  - Detect that a sales deck references pricing from 3 months ago → fork and update
  - Notice a spec references a deprecated API → fork and suggest replacement
  - After a meeting transcript is committed, cross-reference action items against existing artifacts

### 6.2 Team Agent
- **Scope:** All ledgers of team members (redacted per policy)
- **Model:** Sonnet 4.6
- **Purpose:** Maintain consistency within a functional team
- **Capabilities:** read_artifacts, fork_artifacts, open_prs, synthesize, detect_conflicts, recommend
- **Examples:**
  - Detect two specs that contradict each other → create meta:conflict artifact
  - Synthesize all customer call transcripts from this week into a trend report
  - New team member's artifact references outdated team standards → fork and fix

### 6.3 Org Agent
- **Scope:** All ledgers across the org (redacted per policy)
- **Model:** Opus 4.6 (deep reasoning required)
- **Purpose:** Enforce org-wide standards and surface cross-functional insights
- **Capabilities:** All capabilities
- **Examples:**
  - Compliance scan: flag regulatory red flags across all artifacts
  - Brand consistency: detect off-brand language in customer-facing docs
  - Security: detect leaked credentials → alert + force local-only

### 6.4 Function Agent
- **Scope:** Cross-team, scoped to a business function
- **Model:** Opus 4.6
- **Purpose:** Represent a business function's interests across teams
- **Capabilities:** read_artifacts, fork_artifacts, open_prs, synthesize, score_customer_health, recommend
- **Examples:**
  - "Customer Success" function agent reads engineering specs, flags items that affect existing customers
  - "Revenue Operations" agent reads sales artifacts and engineering roadmaps, creates alignment artifacts
  - "Product" function agent synthesizes customer call transcripts, support tickets, and sales data into feature request rankings

### 6.5 Voice Agent
- **Scope:** Meeting transcripts across permitted ledgers
- **Model:** Sonnet 4.6 for transcription processing, Opus 4.6 for multi-meeting synthesis
- **TTS:** OpenAI tts-1-hd for voice narration
- **Purpose:** Turn meetings into actionable artifacts automatically
- **Capabilities:** read_artifacts, synthesize, summarize, notify, voice_narrate
- **Trigger:** meeting_ended
- **Pipeline:**
  ```
  1. Meeting ends → Mac app creates comm:call_transcript artifact
  2. Voice agent triggers on meeting_ended
  3. Agent generates comm:call_summary with:
     - Structured summary (decisions, action items, follow-ups, open questions)
     - Customer references extracted
     - Related artifact links discovered
  4. Agent opens PRs on affected artifacts:
     - Spec mentioned needs update? → fork + PR
     - Timeline commitment made? → fork roadmap + PR
     - Customer concern raised? → PR on customer health artifact
  5. Agent generates voice narration of summary via OpenAI TTS
     - Sent as audio attachment to iOS push notification
     - User can listen to meeting recap while walking to next meeting
  ```

### 6.6 Calendar Agent
- **Scope:** User's calendar (via Google Calendar API) + related meeting artifacts
- **Model:** Sonnet 4.6
- **Purpose:** Eliminate unnecessary meetings by analyzing whether they're needed
- **Capabilities:** review_calendar, recommend, notify
- **Pipeline:**
  ```
  1. Calendar agent runs on schedule (daily at configured time, e.g., 7 AM)
  2. Agent reviews upcoming meetings for next 3 days
  3. For each meeting, agent checks:
     - Are there recent artifacts that address the meeting's stated purpose?
     - Were action items from last occurrence completed?
     - Is there new information since the meeting was scheduled?
     - How many participants? (large meetings are lower ROI)
  4. Agent generates meta:calendar_review artifact with recommendations:
     - "Cancel: All action items from last week's standup are visible in artifacts"
     - "Shorten: Only 2 of 5 agenda items remain unresolved"
     - "Keep: New customer escalation requires live discussion"
  5. User reviews recommendations on iOS/Mac and cancels directly
  ```

### 6.7 Customer Health Agent
- **Scope:** All customer-facing artifacts across the org (redacted per policy)
- **Model:** Opus 4.6 (complex multi-source reasoning)
- **Purpose:** Synthesize all customer touchpoints into health scores
- **Capabilities:** read_artifacts, score_customer_health, synthesize, recommend, notify
- **Pipeline:**
  ```
  1. Agent runs on schedule (daily) or triggered by customer_event
  2. For each customer (identified by customerRefs in artifacts), agent collects:
     - Recent call transcripts and summaries
     - Email sentiment and frequency
     - CRM record changes
     - Support ticket artifacts
     - Contract/renewal artifacts
     - Engineering artifacts referencing customer-specific work
  3. Agent computes CustomerHealthSignal:
     {
       customerId:       string
       healthScore:      number          // 0–100
       trend:            'improving' | 'stable' | 'declining' | 'critical'
       signals: [
         { source: 'call_sentiment', value: 'positive', weight: 0.3 },
         { source: 'support_tickets', value: '3 open, 1 critical', weight: 0.4 },
         { source: 'engagement_frequency', value: 'declining', weight: 0.2 },
         { source: 'contract_renewal', value: '60 days out', weight: 0.1 },
       ]
       recommendations:  string[]
       alertLevel:       'none' | 'watch' | 'action_required' | 'escalation'
     }
  4. Agent creates meta:customer_health artifact in the appropriate team ledger
  5. If alertLevel >= 'action_required', agent notifies account owner and CS team
  ```

### 6.8 Analytics Agent
- **Scope:** All artifacts the agent has permission to read
- **Model:** Sonnet 4.6 for individual analysis, Opus 4.6 for org-wide synthesis
- **Purpose:** Measure artifact quality, staleness, and coverage gaps
- **Capabilities:** analyze_artifacts, synthesize, recommend
- **Pipeline:**
  ```
  1. Agent runs on schedule (weekly) or triggered by admin
  2. Agent scores each artifact on:
     - Quality: completeness, consistency, accuracy against related artifacts
     - Staleness: time since last update vs. rate of change in related artifacts
     - Coverage: what should exist but doesn't (e.g., no postmortem for an incident)
  3. Agent generates meta:analytics_report artifact with:
     - Org-wide dashboard data (artifact counts, quality distribution, staleness heatmap)
     - Team-level breakdowns
     - Specific recommendations ("Engineering team has 12 specs with stale API references")
  4. Agent opens PRs on stale artifacts with suggested updates
  ```

---

## 7. Migration System

Migration is not an afterthought — it's a core capability that determines whether Lurk can replace Slack. If users can't bring their history, they won't switch.

### 7.1 Migration Architecture

```
MigrationSystem {
  // Three migration modes
  
  // Mode 1: API-based import (structured data with API access)
  apiImport: {
    sources: [
      {
        platform: 'slack',
        method: 'Slack Export API + Slack Web API',
        artifacts: ['messages', 'files', 'channels', 'threads', 'reactions'],
        auth: 'OAuth2 (workspace admin)',
        rateLimit: 'tier_4 (100+ calls/min)',
        historical: true,        // can import all history
      },
      {
        platform: 'google_drive',
        method: 'Google Drive API v3',
        artifacts: ['docs', 'sheets', 'slides', 'pdfs', 'files'],
        auth: 'OAuth2 (user or domain-wide)',
        rateLimit: '10 queries/sec',
        historical: true,
      },
      {
        platform: 'notion',
        method: 'Notion API',
        artifacts: ['pages', 'databases', 'blocks'],
        auth: 'OAuth2 (workspace admin)',
        rateLimit: '3 requests/sec',
        historical: true,
      },
      {
        platform: 'gmail',
        method: 'Gmail API',
        artifacts: ['emails', 'attachments', 'threads'],
        auth: 'OAuth2 (user)',
        rateLimit: '250 quota units/sec',
        historical: true,
      },
      {
        platform: 'jira',
        method: 'Jira REST API v3',
        artifacts: ['issues', 'comments', 'attachments', 'boards'],
        auth: 'OAuth2 or API token',
        historical: true,
      },
      {
        platform: 'linear',
        method: 'Linear GraphQL API',
        artifacts: ['issues', 'comments', 'projects', 'cycles'],
        auth: 'OAuth2',
        historical: true,
      },
      {
        platform: 'github',
        method: 'GitHub REST + GraphQL API',
        artifacts: ['repos', 'issues', 'prs', 'comments', 'files'],
        auth: 'OAuth2 (org admin)',
        historical: true,
      },
      {
        platform: 'confluence',
        method: 'Confluence REST API',
        artifacts: ['pages', 'spaces', 'comments', 'attachments'],
        auth: 'OAuth2 or API token',
        historical: true,
      },
    ]
  }
  
  // Mode 2: Agentic browser crawl (for platforms without good APIs or for richer capture)
  agenticCrawl: {
    engine: 'browserbase',       // Browserbase for headless browser orchestration
    fallback: 'playwright',      // local Playwright if Browserbase is unavailable
    agent: {
      type: 'migration',
      model: 'claude-sonnet-4-6', // fast, high-volume
      capabilities: ['browse_web', 'migrate_data'],
    }
    
    // How it works:
    // 1. User authenticates to the target platform in their browser
    // 2. Lurk extension captures the session cookies
    // 3. Migration agent launches a Browserbase session with those cookies
    // 4. Agent navigates the platform systematically:
    //    - Slack: visits each channel, scrolls through history, captures messages + files
    //    - Google Drive: traverses folder structure, opens each doc, captures content
    //    - Notion: traverses workspace tree, captures each page
    //    - Any web app: agent uses Claude to understand the UI and navigate
    // 5. Each captured item is classified, PII-scrubbed, and committed as a migration artifact
    // 6. Agent maps relationships between items (threads, replies, links, mentions)
    
    targets: [
      {
        platform: 'slack',
        crawlStrategy: 'channel_by_channel',
        // Navigate to each channel, scroll to load history, capture messages
        // Capture files, reactions, threads
        // Map @mentions to Lurk user IDs
        captureDepth: 'full_history',  // configurable: last_30d, last_90d, last_year, full
      },
      {
        platform: 'google_drive',
        crawlStrategy: 'folder_tree',
        // Traverse shared drives and My Drive
        // Open each document, capture content
        // Capture sharing permissions as access tier metadata
      },
      {
        platform: 'notion',
        crawlStrategy: 'workspace_tree',
        // Traverse sidebar, open each page
        // Capture databases as structured artifacts
        // Preserve page hierarchy as artifact relationships
      },
      {
        platform: 'any_web_app',
        crawlStrategy: 'agent_navigated',
        // Claude agent understands the UI and navigates
        // User provides starting URL and high-level instructions
        // Agent explores, captures, classifies
      },
    ]
    
    // Safety controls
    safety: {
      maxPagesPerSession:    1000,     // prevent runaway crawling
      maxSessionDuration:    '4h',     // timeout
      requireUserApproval:   true,     // user must approve migration plan before execution
      previewBeforeCommit:   true,     // show user what will be imported before committing
      rollbackCapability:    true,     // can undo entire migration batch
    }
  }
  
  // Mode 3: File upload (for exports, archives, and offline data)
  fileUpload: {
    supportedFormats: [
      'slack_export.zip',        // Slack workspace export
      'google_takeout.zip',      // Google Takeout archive
      'notion_export.zip',       // Notion workspace export
      'mbox',                    // Email archive
      'csv',                     // Generic CSV data
      'json',                    // Generic JSON data
    ]
    // Upload via admin console or Mac app
    // Migration agent processes the archive:
    //   1. Extract and classify each item
    //   2. PII-scrub per policy
    //   3. Map relationships
    //   4. Commit as migration artifacts
    //   5. Present migration report to admin
  }
}
```

### 7.2 Migration Pipeline

```
MigrationPipeline {
  1. PLAN:
     - Admin selects source platform(s) and migration mode
     - Admin configures scope: which channels/folders/teams, how far back
     - Admin configures PII policy for imported data
     - System generates migration plan with estimated volume and duration
     - Admin reviews and approves plan
  
  2. AUTHENTICATE:
     - API mode: OAuth2 flow, tokens stored in Secret Manager
     - Agentic crawl: user authenticates in browser, extension captures session
     - File upload: user uploads export file
  
  3. EXTRACT:
     - API: paginated API calls, rate-limited, with backoff
     - Agentic crawl: Browserbase session, agent navigates and captures
     - File upload: archive extraction and parsing
     - All modes: raw content held in memory/temp storage, never persisted unredacted
  
  4. CLASSIFY:
     - Claude Sonnet 4.6 classifies each item:
       - ArtifactType assignment
       - Sensitivity assessment
       - Customer-facing determination
       - Tag extraction
       - Relationship detection (what references what)
  
  5. REDACT:
     - PII detection and redaction per org policy
     - Entity resolution: map Slack user IDs to Lurk user IDs
     - Customer reference extraction
  
  6. MAP:
     - Build relationship graph: which items reference, reply to, or link to others
     - Map channel/folder structure to team/tag structure in Lurk
     - Identify duplicate content across platforms
  
  7. PREVIEW:
     - Present migration preview to admin:
       - N artifacts to import, by type
       - M relationships mapped
       - P PII entities redacted
       - Estimated storage impact
     - Admin can include/exclude specific items or categories
  
  8. COMMIT:
     - Create migration artifacts in target ledgers
     - Preserve original timestamps (capturedAt = original creation date)
     - Mark all with captureMethod: 'migration_import'
     - Create relationship links
  
  9. VERIFY:
     - Migration agent runs verification:
       - Count comparison: source items vs imported artifacts
       - Relationship integrity: all links resolve
       - Sample quality check: random sample reviewed by Claude for accuracy
     - Generate migration report artifact
  
  10. CLEANUP:
      - Delete temp files and session data
      - Revoke OAuth tokens if one-time migration
      - Archive migration logs
}
```

### 7.3 Slack-Specific Migration Details

Because Slack is the primary competitor, its migration path is first-class:

```
SlackMigration {
  // What gets migrated
  channels: {
    publicChannels → team-scoped artifacts tagged with channel name
    privateChannels → confidential-tier artifacts, only visible to original members
    directMessages → personal artifacts in each participant's ledger
    groupDMs → shared artifacts with explicit ACL for participants
  }
  
  messages: {
    textMessages → document:note artifacts (grouped by thread/day)
    fileShares → appropriate artifact type based on file type
    codeSnippets → code:snippet artifacts
    links → preserved as metadata on the containing artifact
    reactions → preserved as engagement metadata
    threads → preserved as artifact version chains (reply = child artifact)
  }
  
  files: {
    documents → document:* artifacts
    images → design:screenshot artifacts
    spreadsheets → data:spreadsheet artifacts
    pdfs → document:pdf artifacts
  }
  
  metadata: {
    channelTopics → artifact tags
    channelPurpose → artifact description
    pinnedMessages → high-priority tag
    bookmarks → starred flag
    userProfiles → user metadata in Lurk
    customEmoji → not migrated (decorative, not work product)
    workflows → migration agent attempts to map to Lurk agent configurations
  }
  
  // Relationship mapping
  relationships: {
    threadReplies → parent-child artifact links
    crossChannelLinks → artifact relationship refs
    fileInChannel → artifact-to-context link
    mentionedUsers → owner/stakeholder metadata
    mentionedChannels → team/tag cross-references
  }
  
  // Intelligence layer (what makes this better than a dumb import)
  intelligence: {
    // Claude Sonnet 4.6 analyzes imported Slack data to:
    deduplication: 'identify and merge duplicate discussions across channels'
    topicClustering: 'group related messages into coherent artifact clusters'
    decisionExtraction: 'find decisions buried in threads, create meta:synthesis artifacts'
    actionItemExtraction: 'find action items, create PR suggestions on relevant artifacts'
    knowledgeExtraction: 'identify tribal knowledge, create document:wiki artifacts'
    customerMentions: 'tag all customer-referenced content with customerRefs'
  }
}
```

---

## 8. Privacy, PII, and Data Protection

### 8.1 Privacy Architecture: Three-Layer Model

**Layer 1 — On-Device (raw content, never leaves)**
- Full document text, email bodies, call audio
- Entity maps (which PII was found where)
- User keystrokes and interaction patterns
- Local session buffers
- Raw meeting audio recordings

**Layer 2 — Redacted Transit (sent to Lurk cloud)**
- PII-scrubbed content (entities replaced with typed tokens)
- Feature bundles (structural metadata, topic vectors, entity counts)
- Content hashes (for dedup and version tracking)
- Classification labels
- Meeting transcripts (PII-scrubbed)

**Layer 3 — Stored (persisted in Lurk cloud)**
- Artifact metadata (title, type, ownership, timestamps)
- Feature bundles (no reconstructable content)
- Redacted content (only if org policy explicitly allows)
- Diffs and PR descriptions (redacted)
- Audit events (fingerprints only)
- Customer health scores (no raw data)

### 8.2 PII Detection and Redaction

#### Detection Engine

On macOS and iOS, PII detection runs natively in Swift with Core ML for NER. In the Chrome extension standalone mode, it runs in a WASM worker as fallback.

```
PIIDetector {
  // Regex-based detectors (fast, high precision)
  regexDetectors: [
    { type: 'EMAIL',        pattern: RFC5322-compliant },
    { type: 'PHONE',        pattern: E.164 + common formats },
    { type: 'SSN',          pattern: NNN-NN-NNNN variants },
    { type: 'CREDIT_CARD',  pattern: Luhn-valid 13-19 digit },
    { type: 'API_KEY',      pattern: common key prefixes (sk-, pk-, AKIA, ghp_, etc.) },
    { type: 'TOKEN',        pattern: JWT, Bearer, OAuth patterns },
    { type: 'PASSWORD',     pattern: password= | passwd= | secret= contexts },
    { type: 'IP_ADDRESS',   pattern: IPv4 + IPv6 },
    { type: 'URL',          pattern: with credential detection },
    { type: 'ACCOUNT_ID',   pattern: org-configurable patterns },
  ]
  
  // NER-based detectors
  nerDetectors: [
    // macOS/iOS: Core ML model (~5MB), runs on Neural Engine
    // Chrome standalone: WASM model (~2MB), runs in Web Worker
    { type: 'PERSON',       model: 'lurk-ner' },
    { type: 'ORGANIZATION', model: 'lurk-ner' },
    { type: 'ADDRESS',      model: 'lurk-ner' },
    { type: 'DATE_OF_BIRTH',model: 'lurk-ner' },
  ]
  
  // Context-aware detectors
  contextDetectors: [
    { type: 'FINANCIAL_TERM',   keywords + proximity rules },
    { type: 'HEALTH_TERM',      keywords + proximity rules },
    { type: 'LEGAL_PRIVILEGED', pattern: attorney-client markers },
    { type: 'COMPENSATION',     pattern: salary, equity, bonus contexts },
  ]
  
  // Org-configurable custom detectors
  customDetectors: PolicyRule[]  // admin-defined regex/keyword rules
}
```

#### Redaction Behavior

```
RedactionEngine {
  redact(text, detections) → {
    "Meeting with [PERSON_1] at [ORG_1] about [FINANCIAL_TERM_1]"
    // Entity map stays LOCAL ONLY
  }
  
  levels: {
    'aggressive':   // redact all detected entities + contextual terms
    'standard':     // redact PII entities, preserve org-internal names if policy allows
    'minimal':      // redact only secrets, credentials, and financial PII
    'none':         // no redaction (only for orgs that explicitly opt in)
  }
  
  serverValidation: true  // PII Service re-checks before storage (defense-in-depth)
}
```

### 8.3 Org-Level Privacy Controls

```
OrgPrivacyPolicy {
  // Content controls
  redactionLevel:         'aggressive' | 'standard' | 'minimal' | 'none'
  allowRedactedContent:   boolean
  allowFeatureBundlesOnly:boolean
  
  // Agent content access
  agentContentAccess:     'features_only' | 'redacted' | 'full'
  crossTeamVisibility:    'features_only' | 'redacted' | 'full'
  
  // Customer data
  customerDataPolicy: {
    requireCustomerConsent:  boolean
    retentionDays:          number
    allowCrossTeamSharing:  boolean
    piiFieldsToAlwaysRedact: string[]
  }
  
  // Meeting/recording
  recordingPolicy: {
    requireConsentBanner:   boolean
    transcriptRedaction:    'aggressive' | 'standard'
    audioRetentionHours:    number       // how long raw audio is kept locally (0 = delete immediately after transcription)
    retentionDays:          number       // how long transcripts are kept
    allowAgentAccess:       boolean
  }
  
  // Migration
  migrationPolicy: {
    allowAgenticCrawl:      boolean      // allow Browserbase-based crawling
    requireAdminApproval:   boolean      // admin must approve each migration batch
    piiRedactionOnImport:   'aggressive' | 'standard'
    maxHistoryDepth:        'all' | '1y' | '90d' | '30d'
  }
  
  // Kill switches
  globalKillSwitch:       boolean
  teamKillSwitches:       Record<string, boolean>
  agentKillSwitch:        boolean
  captureKillSwitch:      boolean      // stop all capture, keep existing data
  meetingCaptureKill:     boolean      // stop meeting capture specifically
  migrationKill:          boolean      // stop all migration activity
  
  // Data residency
  dataRegion:             'us' | 'eu' | 'ap'
  crossRegionAllowed:     boolean
}
```

### 8.4 PII Removal Rules by Boundary

| Boundary | PII Treatment | Content Visible |
|----------|--------------|-----------------|
| Within user's own ledger | None — full content | Full |
| User → Personal agent | Configurable (default: full) | Full or redacted |
| User → Team agent | Standard redaction | Redacted content or features |
| Team → Cross-team agent | Aggressive redaction | Features only (default) |
| Any → Org agent | Per org policy | Redacted or features |
| Any → Migration agent | Standard redaction | Redacted (import-time scrub) |
| Any → Audit log | Fingerprints only | No content |
| Any → External connector | Maximum redaction | Summary only |
| Any → Customer health score | Aggressive redaction | Scores and signals only, no raw quotes |

### 8.5 Hard Privacy Invariants

1. **Raw content never leaves the device** unless the user explicitly shares it AND org policy allows it.
2. **Entity maps are ephemeral** — session-scoped, memory-only, never written to disk or transmitted.
3. **Local-only mode is absolute** — when enabled, zero bytes leave the device.
4. **Audit logs never contain content** — only fingerprints, metadata, and action codes.
5. **PII detection runs on-device first** — the server PII Service is defense-in-depth, not primary.
6. **Deletion is real** — when a user deletes an artifact, all redacted content and features are purged within 24 hours.
7. **Cross-boundary escalation is one-way** — you can increase redaction at a boundary, never decrease it.
8. **No training on user data** — Lurk never uses customer artifacts to train or fine-tune models. All LLM calls go to Anthropic's API which has its own data policies.
9. **Meeting audio is ephemeral** — raw audio is deleted after transcription per retention policy (default: immediate).
10. **Migration data is scrubbed at ingest** — imported data goes through the same PII pipeline as live-captured data.

---

## 9. Access Control Model

### 9.1 Roles

```
Role =
  | 'org_admin'        // full org control
  | 'team_admin'       // manage team agents, policies, members
  | 'member'           // standard user
  | 'viewer'           // read-only (no ledger, no agents)
  | 'service_account'  // system-level for agent execution
  | 'migration_admin'  // can configure and run migrations
```

### 9.2 Access Tiers

```
AccessTier =
  | 'public'           // anyone in the org
  | 'team'             // only members of the owning team(s)
  | 'project'          // only members of the specified project(s)
  | 'confidential'     // only explicit ACL grants
  | 'restricted'       // only org_admin + explicit grants, agents excluded by default
```

### 9.3 ACL Resolution

```
resolveAccess(requestor, artifact) → AccessOutcome {
  if org.killSwitch || team.killSwitch → DENIED
  if artifact.aclOverrides has DENY for requestor → DENIED
  if artifact.aclOverrides has GRANT for requestor → FULL
  
  match artifact.accessTier {
    'public'       → FULL
    'team'         → requestor.teamIds ∩ artifact.teamIds ≠ ∅ ? REDACTED : DENIED
    'project'      → requestor.projectScopes ∩ artifact.projectScopes ≠ ∅ ? REDACTED : DENIED
    'confidential' → DENIED (explicit grants only)
    'restricted'   → DENIED (explicit grants + org_admin only)
  }
  
  // Cross-boundary redaction for agents
  if requestor is agent {
    apply agentContentAccess policy
    apply cross-boundary PII escalation
  }
}
```

### 9.4 Group-Level Controls

```
GroupPolicy {
  groupId:              string
  groupType:            'team' | 'department' | 'business_unit'
  
  defaultArtifactTier:  AccessTier
  forceLocalOnly:       boolean
  
  allowTeamAgents:      boolean
  allowOrgAgents:       boolean
  allowCrossTeamAgents: boolean
  agentContentAccess:   'features_only' | 'redacted' | 'full'
  
  requirePRReview:      boolean        // no YOLO for this group
  requireTwoApprovers:  boolean
  maxAutoMergePerDay:   number
  
  piiRedactionLevel:    'aggressive' | 'standard' | 'minimal'
  retentionDays:        number
  allowExternalSharing: boolean
  
  blockedArtifactTypes: ArtifactType[]
  requireClassification:boolean
  
  // Meeting-specific
  allowMeetingCapture:  boolean
  meetingRetentionDays: number
  
  // Migration-specific
  allowMigrationImport: boolean
}
```

---

## 10. Agent Marketplace and Custom Agent Builder

### 10.1 Agent Marketplace

Pre-built agent templates that admins can deploy with one click and customize:

```
AgentMarketplace {
  // Built-in templates (ship with Lurk)
  builtInTemplates: [
    {
      id: 'sales_ops',
      name: 'Sales Operations Agent',
      type: 'function',
      description: 'Keeps pricing, competitive intel, and customer data consistent across sales artifacts',
      defaultModel: 'sonnet_4_6',
      defaultTriggers: ['artifact_committed', 'customer_event'],
      defaultCapabilities: ['read_artifacts', 'fork_artifacts', 'open_prs', 'score_customer_health'],
      defaultScope: { artifactTypes: ['comm:*', 'data:crm_record', 'document:*'], customerFacingOnly: true },
      customizablePrompts: ['analysis_prompt', 'pr_description_prompt'],
    },
    {
      id: 'compliance',
      name: 'Compliance Agent',
      type: 'org',
      description: 'Scans all artifacts for regulatory, legal, and policy violations',
      defaultModel: 'opus_4_6',
      // ...
    },
    {
      id: 'brand_consistency',
      name: 'Brand Consistency Agent',
      type: 'org',
      description: 'Detects off-brand language, outdated messaging, and inconsistent positioning',
      defaultModel: 'sonnet_4_6',
      // ...
    },
    {
      id: 'engineering_standards',
      name: 'Engineering Standards Agent',
      type: 'team',
      description: 'Enforces API conventions, deprecation awareness, and code review standards',
      defaultModel: 'sonnet_4_6',
      // ...
    },
    {
      id: 'customer_success',
      name: 'Customer Success Agent',
      type: 'function',
      description: 'Monitors customer health across all touchpoints',
      defaultModel: 'opus_4_6',
      // ...
    },
    {
      id: 'onboarding',
      name: 'New Employee Onboarding Agent',
      type: 'personal',
      description: 'Surfaces relevant artifacts and context for new team members',
      defaultModel: 'sonnet_4_6',
      // ...
    },
    {
      id: 'security',
      name: 'Security Agent',
      type: 'org',
      description: 'Detects leaked credentials, insecure configurations, and data exposure risks',
      defaultModel: 'sonnet_4_6',
      // ...
    },
  ]
  
  // Future: community/third-party templates
  communityTemplates: [] // deferred to v1.1
}
```

### 10.2 Custom Agent Builder

A low-code interface in the admin console for non-technical admins to create agents:

```
CustomAgentBuilder {
  // Builder UI flow:
  // 1. Name and describe the agent
  // 2. Select agent type (personal, team, org, function)
  // 3. Define scope: which artifact types, teams, sensitivity levels
  // 4. Define triggers: when should this agent activate
  // 5. Define behavior: natural language description of what the agent should do
  //    → System converts to structured prompt using Claude
  // 6. Set guardrails: budget, confidence thresholds, human review requirements
  // 7. Test: run agent against a sample of existing artifacts, preview PRs it would create
  // 8. Deploy: activate with monitoring
  
  // Builder API
  createFromDescription(naturalLanguageDescription) → AgentConfig {
    // Uses Claude Opus 4.6 to convert natural language into structured agent config
    // Example: "I want an agent that monitors all engineering specs and flags any that 
    //           reference APIs we've marked as deprecated in our platform docs"
    // → Generates: triggers, scope, capabilities, prompt template
  }
  
  // Testing sandbox
  testAgent(agentConfig, sampleArtifactIds) → TestResult {
    // Run agent against real artifacts but don't commit any changes
    // Show what PRs would be created
    // Show confidence scores
    // Admin reviews before deploying
  }
}
```

---

## 11. Cross-Org Collaboration

For organizations that work with partners, clients, or subsidiaries:

```
CrossOrgCollaboration {
  // Federated artifact sharing
  federation: {
    // Org A can share specific artifacts with Org B through a federation agreement
    // Shared artifacts are ALWAYS redacted to the maximum level
    // Both orgs must approve the federation
    
    agreement: {
      orgA:                 string
      orgB:                 string
      sharedArtifactScope:  ScopeConfig    // what can be shared
      redactionLevel:       'aggressive'   // always aggressive for cross-org
      expirationDays:       number         // auto-expire sharing
      auditRequired:        true           // always audited
    }
    
    // Shared artifacts appear as read-only in the receiving org
    // Receiving org's agents can read shared artifacts (redacted)
    // Receiving org's agents can propose changes via cross-org PR
    // Cross-org PRs require approval from BOTH org's admins
  }
  
  // Guest access
  guestAccess: {
    // External collaborators (contractors, consultants) get a limited Lurk account
    // They can only see artifacts explicitly shared with them
    // Their captured artifacts are owned by the inviting org
    // No agent access to guest artifacts without explicit policy
    role: 'guest'
    capabilities: ['view_shared', 'capture_to_host_org']
    restrictions: ['no_agents', 'no_migration', 'no_admin']
  }
}
```

---

## 12. Notification and Connector System

### 12.1 Notification Types

```
NotificationType =
  | 'pr_opened'              // an agent opened a PR on your artifact
  | 'pr_auto_merged'         // a PR was auto-merged (YOLO) — FYI
  | 'conflict_detected'      // your artifact conflicts with another
  | 'review_requested'       // another user's agent wants your input
  | 'agent_error'            // your agent encountered an error
  | 'policy_violation'       // your artifact triggered a policy violation
  | 'customer_event'         // a customer-related event needs attention
  | 'customer_health_alert'  // customer health score dropped
  | 'calendar_recommendation'// calendar agent suggests cancellation
  | 'meeting_summary_ready'  // meeting transcript processed, summary available
  | 'migration_complete'     // migration batch finished
  | 'migration_error'        // migration encountered an error
  | 'digest'                 // scheduled summary of agent activity
  | 'voice_summary'          // audio narration of PR/meeting summary (iOS)
```

### 12.2 Notification Delivery

```
NotificationConnector {
  connectors: [
    { id: 'in_app',     type: 'lurk_sidebar_and_app', always_enabled: true },
    { id: 'apns',       type: 'apple_push',           always_enabled: true },  // iOS + Mac
    { id: 'email',      type: 'email',                requires_setup: true },
    { id: 'webhook',    type: 'webhook',               requires_setup: true },
    { id: 'slack',      type: 'slack_webhook',         requires_setup: true },  // pragmatic bridge
  ]
  
  // Voice narration (iOS)
  voiceNarration: {
    // For PR summaries and meeting recaps, generate TTS audio via OpenAI
    // Attach to iOS push notification as rich media
    // User can listen without opening the app
    engine: 'openai_tts_1_hd'
    maxLength: 4096  // characters
    voice: 'nova'    // configurable
    triggers: ['pr_opened', 'meeting_summary_ready']
  }
  
  routing: {
    userPreferences: {
      channels: ['in_app', 'apns'],
      digestSchedule: 'daily_9am',
      urgentOnly: false,
      muteAgentTypes: [],
      voiceNarrationEnabled: true,     // receive audio summaries
    }
    
    orgPolicy: {
      mandatoryNotifications: ['policy_violation', 'agent_error', 'customer_health_alert'],
      maxNotificationsPerDay: 20,
      quietHours: { start: '22:00', end: '07:00', timezone: 'user' },
      redactedPayloads: true,
    }
  }
}
```

---

## 13. User Experience

### 13.1 Mac Menu Bar App

The menu bar app is the always-on presence. It shows:

- **Status indicator:** green (active), yellow (syncing), red (error), gray (paused)
- **Click to expand:** Quick view of pending PRs, recent agent activity, meeting capture status
- **Meeting indicator:** When a meeting is being captured, show a recording indicator
- **Quick actions:** Pause capture, toggle YOLO, open full sidebar, open admin console
- **Keyboard shortcut:** ⌘⇧L to open Lurk sidebar overlay on any app

### 13.2 Chrome Extension Sidebar

Tabs:

1. **Inbox** — PRs awaiting review, swipe/click to approve/reject
2. **Activity** — Recent agent activity timeline
3. **Ledger** — Artifact history and branch view
4. **Agents** — Agent status, YOLO toggle, budgets
5. **Privacy** — What data left the device, redaction level, local-only toggle

### 13.3 iOS App

- **PR Review:** Full diff view optimized for mobile, swipe gestures for approve/reject
- **Voice Memos:** Record → transcribe → artifact in one tap
- **Agent Dashboard:** View and manage agents, toggle YOLO
- **Listen Mode:** Audio summaries of PRs and meeting recaps via OpenAI TTS
- **Notifications:** Rich push with inline actions (approve PR from notification)

### 13.4 Web Admin Console

Sections:

1. **Dashboard** — Org-wide metrics, agent performance, artifact volume
2. **Policies** — Privacy, agent, group, YOLO policies (versioned)
3. **Agents** — Create/edit/disable agents, marketplace, custom builder
4. **Teams & Access** — Team management, roles, tiers, domain lists
5. **Artifacts** — Explorer with relationship graph, quality heatmap
6. **Audit** — Full audit log, compliance reports, exports
7. **Migration** — Configure and monitor migrations from Slack/Drive/Notion/etc.
8. **Connectors** — Notification and integration configuration
9. **Customer Health** — Org-wide customer health dashboard (from customer health agent)
10. **Analytics** — Artifact quality, staleness, coverage analytics (from analytics agent)
11. **Kill Switches** — Emergency controls

---

## 14. Versioned Ledger System (Lurk-Native)

Lurk's ledger is **not git**. It borrows git's conceptual model because those abstractions are correct for versioned, branching, collaborative work — but the implementation is purpose-built for Lurk's needs.

### 14.1 Why Not Just Use Git

| Git assumes... | Lurk needs... |
|----------------|--------------|
| Files on a filesystem | Multi-type artifacts (text, audio metadata, structured data, screenshots) |
| Full content in every clone | Privacy-layered content (different viewers see different content) |
| Human authors with GPG keys | Agent authors with org-scoped signing keys |
| Local-first with remote sync | Cloud-first with local cache |
| Line-based diffs | Semantic diffs (section-level for docs, field-level for structured data) |
| Merge conflicts as text markers | Agent-mediated conflict resolution |
| Repository per project | Ledger per user, cross-ledger forks |

### 14.2 Ledger Operations

```
LedgerService {
  // Core operations
  commit(ledgerId, artifact, message) → CommitEntry
  branch(ledgerId, name, fromCommit?) → Branch
  merge(sourceBranch, targetBranch, strategy) → MergeResult
  revert(ledgerId, commitHash) → CommitEntry
  log(ledgerId, options?) → CommitEntry[]
  diff(commitA, commitB) → Diff
  
  // Cross-ledger operations
  fork(sourceLedgerId, sourceArtifactId, targetLedgerId) → Fork
  openPR(forkId, title, description) → PullRequest
  reviewPR(prId, action, comment?) → ReviewResult
  mergePR(prId) → MergeResult
  closePR(prId, reason) → void
  
  // Query
  getArtifact(ledgerId, artifactId, version?) → Artifact
  getHistory(artifactId) → CommitEntry[]
  search(query, scope) → Artifact[]
  getRelated(artifactId) → RelationRef[]
  
  // Sync (Mac/iOS ↔ Cloud)
  push(ledgerId) → SyncResult       // local → cloud
  pull(ledgerId) → SyncResult       // cloud → local
  syncStatus(ledgerId) → SyncState
}
```

### 14.3 Merge Strategies

```
MergeStrategy =
  | 'fast_forward'    // no divergence, move pointer
  | 'three_way'       // standard three-way merge for text
  | 'semantic_merge'  // use Claude to merge structured content intelligently
  | 'agent_resolve'   // use an agent to resolve conflicts
  | 'manual'          // flag for human resolution
  | 'theirs'          // accept incoming changes (YOLO default)
  | 'ours'            // keep current version (reject)
```

### 14.4 Storage Implementation

```
LedgerStorage {
  // Local (Mac/iOS)
  local: {
    metadataStore: 'SQLite'          // commit graph, artifact metadata, indexes
    contentStore: 'filesystem'       // ~/Library/Application Support/Lurk/
    encryption: 'FileVault-aware'    // leverages macOS encryption
    indexing: 'FTS5'                 // SQLite full-text search for local queries
  }
  
  // Cloud
  cloud: {
    metadataStore: 'Firestore'       // commit graph, artifact metadata
    contentStore: 'GCS'              // redacted content, feature bundles
    indexing: 'Firestore indexes'    // for queries
    auditStore: 'BigQuery'           // append-only audit log
  }
  
  // Sync protocol
  sync: {
    protocol: 'delta_sync'          // only sync changed commits
    conflictResolution: 'cloud_wins' // cloud is source of truth for metadata
    offlineQueue: true               // queue local commits when offline
    compression: 'zstd'             // compress sync payloads
  }
}
```

---

## 15. API Surface

### 15.1 Client → Cloud APIs

```
// Artifact operations
POST   /v1/artifacts/commit          // commit artifact to ledger
POST   /v1/artifacts/sync            // batch sync
GET    /v1/artifacts/:id             // get artifact (access-controlled)
GET    /v1/artifacts/:id/diff        // diff between versions
GET    /v1/artifacts/:id/history     // version history
GET    /v1/artifacts/search          // search artifacts

// PR operations
GET    /v1/prs/inbox                 // pending PRs for current user
GET    /v1/prs/:id                   // PR detail with diff
POST   /v1/prs/:id/review           // submit review action

// Ledger operations
GET    /v1/ledger/:id/log            // commit log
GET    /v1/ledger/:id/branches       // active branches
POST   /v1/ledger/:id/sync          // sync local ↔ cloud
GET    /v1/ledger/:id/status         // sync status

// Policy
GET    /v1/policy/bundle             // current policy bundle

// Feedback
POST   /v1/feedback                  // submit feedback on agent/PR

// Meeting
POST   /v1/meetings/transcript       // submit meeting transcript
GET    /v1/meetings/:id/summary      // get meeting summary artifact

// Notifications
GET    /v1/notifications             // get notifications
POST   /v1/notifications/:id/read   // mark as read
GET    /v1/notifications/preferences // get notification preferences
PUT    /v1/notifications/preferences // update preferences
```

### 15.2 Agent → Cloud APIs (service-authenticated)

```
POST   /v1/agent/fork                // create fork
POST   /v1/agent/commit              // commit to fork
POST   /v1/agent/pr/open             // open PR
POST   /v1/agent/synthesize          // create meta artifact
GET    /v1/agent/scope               // resolve accessible artifacts
POST   /v1/agent/customer-health     // submit customer health score
POST   /v1/agent/calendar-review     // submit calendar recommendations
POST   /v1/agent/analytics-report    // submit analytics report
```

### 15.3 Migration APIs

```
POST   /v1/migration/plan            // create migration plan
GET    /v1/migration/plan/:id        // get migration plan status
POST   /v1/migration/plan/:id/approve// approve migration plan
POST   /v1/migration/execute         // start migration execution
GET    /v1/migration/status/:id      // migration batch status
POST   /v1/migration/rollback/:id    // rollback a migration batch
GET    /v1/migration/report/:id      // get migration report
```

### 15.4 Admin APIs

```
// CRUD for all admin resources
/v1/admin/org
/v1/admin/teams
/v1/admin/agents
/v1/admin/agent-marketplace
/v1/admin/agent-builder
/v1/admin/policies
/v1/admin/connectors
/v1/admin/audit
/v1/admin/artifacts
/v1/admin/users
/v1/admin/federation           // cross-org collaboration
/v1/admin/migration            // migration management
/v1/admin/customer-health      // customer health dashboard
/v1/admin/analytics            // artifact analytics
/v1/admin/kill-switches
```

---

## 16. Data Model (Firestore Collections)

```
organizations/{orgId}
  name, domain, privacyPolicy, featureFlags, killSwitches,
  defaultPoliciesRef, connectorDefaults, federationAgreements[],
  billingConfig, createdAt, updatedAt

users/{userId}
  orgId, email, displayName, teams[], roles[], accessTier,
  ledgerId, agentPreferences, notificationPreferences,
  yoloConfig, platform ('mac' | 'ios' | 'chrome_standalone'),
  lastSeenAt, createdAt

teams/{teamId}
  orgId, name, members[], admins[], groupPolicy,
  agentIds[], projectScopes[], createdAt, updatedAt

ledgers/{ledgerId}
  userId, orgId, head, branches[], artifactCount,
  lastCommitAt, yoloConfig, syncState, createdAt

artifacts/{artifactId}
  ledgerId, orgId, type, title, sourceUrl, sourceApp, captureMethod,
  contentHash, redactedContent?, featureBundle, metadata,
  tags[], customerFacing, customerRefs[], sensitivity,
  customerHealth?, qualityScore?, stalenessScore?, coverageGaps[],
  authorId, ownerIds[], teamIds[], version, parentVersion,
  commitHash, branchId, accessTier, aclOverrides[],
  forkedFrom?, relatedArtifacts[], capturedAt, committedAt

commits/{commitHash}
  ledgerId, artifactId, version, parentHash, message,
  authorId, authorType, timestamp, signature, policyVersion

forks/{forkId}
  orgId, upstreamArtifactId, upstreamVersion, upstreamLedgerId,
  forkLedgerId, forkBranchId, artifactId, agentId, agentType,
  reason, confidence, status, createdAt, updatedAt

pullRequests/{prId}
  orgId, forkId, sourceArtifactId, targetArtifactId, targetLedgerId,
  title, description, diff, changeSummary, voiceNarrationUrl?,
  agentId, agentType, confidence, justification, sourceRefs[],
  status, reviewerId, reviewAction, reviewComment, reviewedAt,
  autoMergeEligible, autoMergedAt, createdAt, mergedAt, closedAt

agents/{agentId}
  orgId, name, type, description, ownerId, ownerType,
  templateId?, customPrompts[],
  readScope, writeScope, actionBudget, triggers[], capabilities[],
  modelConfig, status, lastRunAt, totalActions, acceptanceRate, createdAt

agentTemplates/{templateId}
  name, type, description, defaultModel, defaultTriggers[],
  defaultCapabilities[], defaultScope, customizablePrompts[],
  category, isBuiltIn, createdBy, createdAt

policies/{policyId}
  orgId, type, version, rules[], defaultAction, enabled,
  groupOverrides[], createdBy, createdAt

migrations/{migrationId}
  orgId, sourcePlatform, mode, scope, status,
  plan, approvedBy, executionLog[], artifactsImported,
  errors[], report?, createdBy, createdAt, completedAt

customerHealth/{customerId}
  orgId, customerId, customerName,
  healthScore, trend, signals[], recommendations[],
  alertLevel, lastUpdatedAt, agentId

audits/{auditId}
  orgId, actorId, actorType, action, targetRef, targetType,
  metadata{}, policyVersion, engineVersion, redactionState, createdAt

notifications/{notificationId}
  orgId, userId, type, title, body, sourceRef,
  voiceNarrationUrl?, channel, status, sentAt, readAt

feedback/{feedbackId}
  orgId, userId, targetId, targetType, reason, comment,
  status, resolution, resolvedBy, createdAt, updatedAt

federations/{federationId}
  orgAId, orgBId, sharedScope, redactionLevel,
  expirationDate, status, approvedByA, approvedByB, createdAt
```

---

## 17. Feature Flags and Operational Controls

### Feature Flags

```
// Platform
mac_app_enabled
ios_app_enabled
chrome_extension_enabled
chrome_standalone_mode_enabled     // extension without Mac app

// Capture
artifact_capture_enabled
capture_gdocs_enabled
capture_gmail_enabled
capture_calendar_enabled
capture_github_enabled
capture_figma_enabled
capture_crm_enabled
capture_media_enabled              // meeting capture
capture_filesystem_enabled
capture_ide_enabled

// Meeting capture
meeting_capture_enabled
meeting_local_transcription_enabled
meeting_cloud_transcription_fallback
meeting_auto_summary_enabled
meeting_voice_narration_enabled    // OpenAI TTS for meeting summaries

// Agent system
agents_enabled
personal_agents_enabled
team_agents_enabled
org_agents_enabled
function_agents_enabled
voice_agents_enabled
calendar_agents_enabled
customer_health_agents_enabled
analytics_agents_enabled
yolo_mode_enabled

// PR system
pr_system_enabled
auto_merge_enabled
cross_ledger_forks_enabled
pr_voice_narration_enabled         // OpenAI TTS for PR summaries

// Agent marketplace and builder
agent_marketplace_enabled
custom_agent_builder_enabled

// Migration
migration_enabled
migration_api_import_enabled
migration_agentic_crawl_enabled    // Browserbase
migration_file_upload_enabled
migration_slack_enabled
migration_gdrive_enabled
migration_notion_enabled
migration_gmail_enabled
migration_jira_enabled
migration_github_enabled

// Cross-org
federation_enabled
guest_access_enabled

// Privacy
local_embeddings_enabled
server_pii_validation_enabled
redacted_content_storage_enabled

// Connectors
email_connector_enabled
slack_connector_enabled
webhook_connector_enabled
apns_connector_enabled

// Analytics
artifact_analytics_enabled
customer_health_dashboard_enabled

// Admin
admin_console_enabled
audit_bigquery_export_enabled
```

### Kill Switches

```
org_global_kill                     // stop everything
org_agent_kill                      // stop all agents
org_capture_kill                    // stop all capture
org_meeting_capture_kill            // stop meeting capture
org_migration_kill                  // stop all migration
team_kill:{teamId}
agent_kill:{agentId}
artifact_type_kill:{type}
user_kill:{userId}
federation_kill:{federationId}
```

---

## 18. Core Stack Summary

| Layer | Technology | Notes |
|-------|-----------|-------|
| macOS App | Swift/SwiftUI, CoreAudio, Core ML, SQLite | Menu bar agent, meeting capture, local ledger |
| iOS App | SwiftUI, Speech framework, Core ML | PR review, voice memos, push notifications |
| Chrome Extension | Manifest V3, React, Shadow DOM | Browser capture, sidebar UI, Native Messaging to Mac |
| Web Admin | Next.js 15, React, Tailwind | Admin console |
| API Gateway | Node.js on Cloud Run | Auth, routing, rate limiting |
| Ledger Service | Node.js + Firestore | Versioning operations |
| Agent Orchestrator | Python on Cloud Run | Agent execution, Claude API calls |
| LLM Gateway | Python, Anthropic SDK | Centralized Claude access, token metering |
| PII Service | Python + Presidio + custom rules | Server-side defense-in-depth |
| Migration Service | Python + Browserbase SDK | Migration orchestration |
| Notification Service | Node.js, APNs, SendGrid | Routing and dispatch |
| TTS Service | Python, OpenAI SDK | Voice narration generation |
| Audit Service | Node.js + BigQuery | Append-only audit log |
| Artifact Store | Firestore (metadata) + GCS (content) | Cloud storage |
| Local Store | SQLite + filesystem | Mac/iOS local ledger |
| Auth | Firebase Auth + custom claims | Google SSO, org/team/role claims |
| Secrets | Google Secret Manager | API keys, signing keys |
| Queue | Cloud Tasks + Pub/Sub | Agent tasks, event fanout |
| CDN | Cloud CDN | Voice narration audio files |

---

## 19. Repository Layout

```
/apps
  /mac                    # macOS menu bar app (Swift/SwiftUI)
    /LurkApp              # main app target
    /LurkAudioCapture     # CoreAudio meeting capture
    /LurkNativeHost       # Chrome Native Messaging host
  /ios                    # iOS app (SwiftUI)
    /LurkMobile           # main app target
    /LurkVoiceMemo        # voice memo capture
    /LurkWidgets          # iOS widgets (PR count, agent status)
  /extension              # Chrome extension (MV3, React)
  /web                    # Admin console (Next.js)

/services
  /api-gateway            # Cloud Run: auth, routing, rate limiting
  /ledger-service         # Cloud Run: versioning operations
  /agent-orchestrator     # Cloud Run (Python): agent execution
  /llm-gateway            # Cloud Run (Python): centralized Claude/OpenAI access
  /pii-service            # Cloud Run (Python): server-side PII validation
  /migration-service      # Cloud Run (Python): migration orchestration + Browserbase
  /notification-service   # Cloud Run: notification routing (APNs, email, webhook)
  /tts-service            # Cloud Run (Python): OpenAI TTS generation
  /audit-service          # Cloud Run: audit log ingestion, BigQuery export

/packages
  /shared-types           # TypeScript types shared across services
  /policy-engine          # Policy evaluation library
  /diff-engine            # Artifact diffing and merge logic
  /acl-resolver           # Access control resolution
  /agent-sdk              # Agent development SDK
  /ui-web                 # Shared React components (extension + admin)

/packages-swift           # Swift packages (shared Mac + iOS)
  /LurkCore               # Types, models, serialization
  /LurkPII                # PII detection (Swift native + Core ML)
  /LurkLedger             # Local ledger operations (SQLite)
  /LurkSync               # Cloud sync protocol
  /LurkUI                 # Shared SwiftUI components
  /LurkTranscription      # Whisper.cpp wrapper

/infra
  /terraform              # GCP infrastructure
  /firebase               # Firestore rules, indexes, auth
  /ci                     # GitHub Actions workflows
  /browserbase            # Browserbase session configs for migration

/prompts                  # Versioned prompt templates
  /artifact_analysis
  /conflict_detection
  /meeting_summary
  /pr_description
  /customer_health
  /calendar_review
  /migration_classify
  /quality_score
  /agent_builder
```

---

## 20. Testing Requirements

### 20.1 Unit Tests
- PII detection accuracy per entity type (target: >95% recall, >90% precision)
- PII detection parity: Swift (Mac/iOS) output matches WASM (Chrome) output
- Redaction engine: no raw content leaks
- ACL resolver: correct access outcomes for all tier combinations
- Policy engine: correct evaluation
- Diff engine: correct diffs for text, structured, and multimodal artifacts
- Merge strategies: correct results
- Agent budget enforcement
- YOLO eligibility evaluation
- Commit hash computation: deterministic, collision-resistant
- Sync protocol: correct delta computation

### 20.2 Integration Tests
- Mac capture pipeline: CoreAudio → buffer → transcribe → classify → redact → commit → sync
- Chrome capture pipeline: DOM observer → Native Messaging → Mac app → commit → sync
- iOS voice memo: record → transcribe → classify → redact → commit → sync
- Agent execution loop: trigger → scope → analyze (Claude API) → gate → execute → audit
- PR lifecycle: fork → commit → open PR → review → merge/reject
- Cross-ledger fork: agent reads artifact from another ledger, forks, opens PR
- Meeting capture: detect meeting → record → transcribe → summary → PRs on affected artifacts
- Migration: plan → authenticate → extract → classify → redact → preview → commit → verify
- Notification: event → notification → APNs → iOS push → inline action
- Voice narration: PR summary → OpenAI TTS → audio file → CDN → push notification attachment
- Calendar agent: schedule trigger → calendar API → artifact cross-reference → recommendations

### 20.3 End-to-End Tests
- User installs Mac app + Chrome extension → captures Google Doc → artifact in ledger
- Meeting captured via Mac system audio → transcript → summary → action items → PRs
- Personal agent detects stale reference → fork → PR → user approves on iOS → merged
- Team agent detects conflict → meta:conflict artifact → both authors notified
- YOLO auto-merge → rollback within window
- Local-only mode → zero outbound bytes (verified by network monitor)
- Kill switch → all activity stops immediately
- Migration from Slack → artifacts appear in ledgers → relationships preserved
- Agentic crawl via Browserbase → content classified and imported
- Customer health agent → scores computed → alert sent → PR on customer artifact
- Calendar agent → recommends cancellation → user cancels from iOS
- Cross-org federation → shared artifacts visible (redacted) → cross-org PR
- Custom agent builder → natural language → agent config → test run → deploy

### 20.4 Privacy Regression Tests
- No raw text in any API request payload
- No raw text in Firestore documents
- No raw text in GCS objects
- No raw text in Cloud Run logs
- No raw text in BigQuery audit logs
- No raw audio transmitted (only transcripts, redacted)
- No entity maps transmitted
- Local-only mode = zero outbound bytes
- Server PII re-detection catches any leaks from client
- Migration imports are PII-scrubbed before commit
- Cross-org shared artifacts have aggressive redaction applied
- Customer health scores contain no raw customer data

### 20.5 Agent Safety Tests
- Agent cannot exceed action budget
- Agent cannot access artifacts outside its scope
- Agent cascade depth enforced (max 3)
- Circuit breaker on high error rate
- Circuit breaker on high rejection rate
- YOLO rollback works within window
- Agent cannot bypass PII redaction
- Migration agent respects scope limits (maxPagesPerSession, timeout)
- Cross-org agents cannot access unshared artifacts

---

## 21. Metrics

### Primary (product-market fit)
- **Artifact capture rate:** per user per day
- **PR acceptance rate:** target >60%
- **Time-to-merge:** median time from PR opened to merged
- **YOLO adoption rate:** % of users enabling YOLO
- **Communication reduction:** change in Slack messages/meetings
- **Meeting capture rate:** % of meetings automatically captured
- **Migration completion rate:** % of orgs completing full migration
- **Agent utility score:** user rating of agent PRs (1-5)

### Secondary (system health)
- PII detection recall/precision
- Agent error rate and circuit breaker activations
- Cross-team artifact linkage rate
- Notification-to-action conversion
- False-positive feedback rate
- Transcription accuracy (WER)
- Customer health score accuracy (validated against actual churn)
- Migration data integrity (source count vs imported count)

### Impact (business)
- Customer-facing artifact freshness
- Cross-team conflict resolution time
- Reduction in calendar meeting hours
- Customer satisfaction correlation with artifact quality
- Time-to-productivity for new hires (onboarding agent impact)
- Revenue retention correlation with customer health scores

---

## 22. Definition of Done

Lurk is ready for closed beta when:

1. Mac menu bar app installs, captures system audio from Zoom/Google Meet, and transcribes locally.
2. Chrome extension captures artifacts from Google Docs and Gmail, delegates to Mac app via Native Messaging.
3. iOS app displays PRs, supports swipe-to-approve, and delivers push notifications.
4. Captured artifacts are PII-scrubbed on-device, committed to ledger, and synced to cloud.
5. Personal agent reads ledger, detects stale references, forks, and opens PRs using Claude Sonnet 4.6.
6. Org agent performs deep analysis using Claude Opus 4.6.
7. Voice agent transcribes meetings, generates summaries, and opens PRs on affected artifacts.
8. Calendar agent reviews upcoming meetings and suggests cancellations.
9. Customer health agent computes health scores from cross-functional artifacts.
10. YOLO mode auto-merges PRs meeting configurable criteria.
11. PR voice narration works via OpenAI TTS on iOS.
12. Migration from Slack works via API import and agentic Browserbase crawl.
13. Agent marketplace offers 7+ built-in templates; custom agent builder works.
14. Local-only mode stops all network traffic immediately.
15. Kill switches work at all levels (org, team, agent, user, migration, meeting).
16. Privacy regression tests confirm no raw text or audio leaves the device.
17. PII detection achieves >95% recall.
18. Cross-org federation works with aggressive redaction.
19. Audit logs capture all actions with full lineage.
20. System handles 100 concurrent users with <500ms P95 for PR review.

---

## 23. Appendix: Comparison with Slack

| Dimension | Slack | Lurk |
|-----------|-------|------|
| Primary primitive | Message | Artifact |
| Communication model | Synchronous, human-to-human | Asynchronous, agent-mediated |
| Platform | Web/Electron, all platforms | Mac/iOS first, Chrome extension |
| Knowledge organization | Channels (conversation) | Ledgers (work product) |
| Cross-team coordination | @mentions, threads | Agent forks and PRs |
| Versioning | None (messages are immutable) | Full commit/branch/fork/merge ledger |
| Meeting integration | Huddles (live audio) | Zero-effort capture + transcription + auto-summarization |
| Status updates | Standup bots, status emoji | Auto-generated status artifacts |
| Review workflow | "hey can you look at this?" | Agents fork and PR automatically |
| Privacy model | All content stored centrally | Content on-device; redacted features centralized |
| AI integration | Bolt-on copilots | Claude agents are the core product |
| LLM stack | Mixed / third-party | Anthropic (Sonnet 4.6 + Opus 4.6), OpenAI TTS only |
| Notification philosophy | Everything, all the time | Action-required only, with voice narration |
| Migration from Slack | N/A | API import + agentic browser crawl |
| Customer intelligence | None | Customer health scoring from all touchpoints |
| Calendar intelligence | None | Meeting cancellation recommendations |
| Adoption friction | New app, new habits | Works in your existing Mac + browser |
