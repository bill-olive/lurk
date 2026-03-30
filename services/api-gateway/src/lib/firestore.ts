import { getFirestore, type Firestore, type CollectionReference, type DocumentData } from 'firebase-admin/firestore';

// ---------------------------------------------------------------------------
// Typed Firestore collection references for every PRD Section 16 collection
// ---------------------------------------------------------------------------

export interface Organization {
  name: string;
  domain: string;
  privacyPolicy: string;
  featureFlags: Record<string, boolean>;
  killSwitches: Record<string, boolean>;
  defaultPoliciesRef: string;
  connectorDefaults: Record<string, unknown>;
  federationAgreements: string[];
  billingConfig: Record<string, unknown>;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

export interface User {
  orgId: string;
  email: string;
  displayName: string;
  teams: string[];
  roles: string[];
  accessTier: string;
  ledgerId: string;
  agentPreferences: Record<string, unknown>;
  notificationPreferences: Record<string, unknown>;
  yoloConfig: YoloConfig;
  platform: 'mac' | 'ios' | 'chrome_standalone';
  lastSeenAt: FirebaseFirestore.Timestamp;
  createdAt: FirebaseFirestore.Timestamp;
}

export interface YoloConfig {
  enabled: boolean;
  allowedAgentTypes: string[];
  allowedAgentIds?: string[];
  allowedCategories: string[];
  minConfidence: number;
  maxDiffSize: number;
  maxSensitivity: string;
  excludeCustomerFacing: boolean;
  excludeTags: string[];
  cooldownAfterReject: number;
  dailyAutoMergeCap: number;
  requireSecondAgent: boolean;
  rollbackWindow: number;
}

export interface Team {
  orgId: string;
  name: string;
  members: string[];
  admins: string[];
  groupPolicy: string;
  agentIds: string[];
  projectScopes: string[];
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

export interface Ledger {
  userId: string;
  orgId: string;
  head: string;
  branches: Branch[];
  artifactCount: number;
  lastCommitAt: FirebaseFirestore.Timestamp;
  yoloConfig: YoloConfig;
  syncState: SyncState;
  createdAt: FirebaseFirestore.Timestamp;
}

export interface Branch {
  id: string;
  name: string;
  head: string;
  createdAt: FirebaseFirestore.Timestamp;
}

export interface SyncState {
  status: 'synced' | 'syncing' | 'conflict' | 'offline';
  lastSyncAt: FirebaseFirestore.Timestamp;
  pendingChanges: number;
}

export interface Artifact {
  ledgerId: string;
  orgId: string;
  type: string;
  title: string;
  sourceUrl: string;
  sourceApp: string;
  captureMethod: string;
  contentHash: string;
  redactedContent?: string;
  featureBundle: Record<string, unknown>;
  metadata: Record<string, unknown>;
  tags: string[];
  customerFacing: boolean;
  customerRefs: string[];
  sensitivity: string;
  customerHealth?: Record<string, unknown>;
  qualityScore?: number;
  stalenessScore?: number;
  coverageGaps?: string[];
  authorId: string;
  ownerIds: string[];
  teamIds: string[];
  version: number;
  parentVersion: number | null;
  commitHash: string;
  branchId: string;
  accessTier: string;
  aclOverrides: AclOverride[];
  forkedFrom?: string;
  relatedArtifacts: string[];
  capturedAt: FirebaseFirestore.Timestamp;
  committedAt: FirebaseFirestore.Timestamp;
}

export interface AclOverride {
  principalId: string;
  principalType: 'user' | 'team' | 'agent';
  permission: 'read' | 'write' | 'none';
}

export interface Commit {
  ledgerId: string;
  artifactId: string;
  version: number;
  parentHash: string | null;
  message: string;
  authorId: string;
  authorType: 'user' | 'agent';
  timestamp: FirebaseFirestore.Timestamp;
  signature: string;
  policyVersion: string;
}

export interface Fork {
  orgId: string;
  upstreamArtifactId: string;
  upstreamVersion: number;
  upstreamLedgerId: string;
  forkLedgerId: string;
  forkBranchId: string;
  artifactId: string;
  agentId: string;
  agentType: string;
  reason: string;
  confidence: number;
  status: 'open' | 'merged' | 'closed';
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

export interface PullRequest {
  orgId: string;
  forkId: string;
  sourceArtifactId: string;
  targetArtifactId: string;
  targetLedgerId: string;
  title: string;
  description: string;
  diff: string;
  changeSummary: string;
  voiceNarrationUrl?: string;
  agentId: string;
  agentType: string;
  confidence: number;
  justification: string;
  sourceRefs: string[];
  status: 'open' | 'approved' | 'rejected' | 'merged' | 'closed';
  reviewerId: string | null;
  reviewAction: string | null;
  reviewComment: string | null;
  reviewedAt: FirebaseFirestore.Timestamp | null;
  autoMergeEligible: boolean;
  autoMergedAt: FirebaseFirestore.Timestamp | null;
  createdAt: FirebaseFirestore.Timestamp;
  mergedAt: FirebaseFirestore.Timestamp | null;
  closedAt: FirebaseFirestore.Timestamp | null;
}

export interface Agent {
  orgId: string;
  name: string;
  type: string;
  description: string;
  ownerId: string;
  ownerType: string;
  templateId?: string;
  customPrompts: string[];
  readScope: Record<string, unknown>;
  writeScope: Record<string, unknown>;
  actionBudget: Record<string, unknown>;
  triggers: Record<string, unknown>[];
  capabilities: string[];
  modelConfig: Record<string, unknown>;
  status: 'active' | 'paused' | 'disabled';
  lastRunAt: FirebaseFirestore.Timestamp | null;
  totalActions: number;
  acceptanceRate: number;
  createdAt: FirebaseFirestore.Timestamp;
}

export interface AgentTemplate {
  name: string;
  type: string;
  description: string;
  defaultModel: string;
  defaultTriggers: Record<string, unknown>[];
  defaultCapabilities: string[];
  defaultScope: Record<string, unknown>;
  customizablePrompts: string[];
  category: string;
  isBuiltIn: boolean;
  createdBy: string;
  createdAt: FirebaseFirestore.Timestamp;
}

export interface Policy {
  orgId: string;
  type: string;
  version: string;
  rules: PolicyRule[];
  defaultAction: string;
  enabled: boolean;
  groupOverrides: Record<string, unknown>[];
  createdBy: string;
  createdAt: FirebaseFirestore.Timestamp;
}

export interface PolicyRule {
  id: string;
  condition: Record<string, unknown>;
  action: string;
  priority: number;
}

export interface Migration {
  orgId: string;
  sourcePlatform: string;
  mode: string;
  scope: Record<string, unknown>;
  status: 'draft' | 'planned' | 'approved' | 'running' | 'completed' | 'failed' | 'rolled_back';
  plan: Record<string, unknown>;
  approvedBy: string | null;
  executionLog: Record<string, unknown>[];
  artifactsImported: number;
  errors: Record<string, unknown>[];
  report?: Record<string, unknown>;
  createdBy: string;
  createdAt: FirebaseFirestore.Timestamp;
  completedAt: FirebaseFirestore.Timestamp | null;
}

export interface CustomerHealth {
  orgId: string;
  customerId: string;
  customerName: string;
  healthScore: number;
  trend: 'improving' | 'stable' | 'declining';
  signals: Record<string, unknown>[];
  recommendations: string[];
  alertLevel: 'green' | 'yellow' | 'red';
  lastUpdatedAt: FirebaseFirestore.Timestamp;
  agentId: string;
}

export interface Audit {
  orgId: string;
  actorId: string;
  actorType: 'user' | 'agent' | 'system';
  action: string;
  targetRef: string;
  targetType: string;
  metadata: Record<string, unknown>;
  policyVersion: string;
  engineVersion: string;
  redactionState: string;
  createdAt: FirebaseFirestore.Timestamp;
}

export interface Notification {
  orgId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  sourceRef: string;
  voiceNarrationUrl?: string;
  channel: string;
  status: 'unread' | 'read' | 'dismissed';
  sentAt: FirebaseFirestore.Timestamp;
  readAt: FirebaseFirestore.Timestamp | null;
}

export interface Feedback {
  orgId: string;
  userId: string;
  targetId: string;
  targetType: 'agent' | 'pr' | 'artifact';
  reason: string;
  comment: string;
  status: 'open' | 'acknowledged' | 'resolved';
  resolution: string | null;
  resolvedBy: string | null;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

export interface Federation {
  orgAId: string;
  orgBId: string;
  sharedScope: Record<string, unknown>;
  redactionLevel: string;
  expirationDate: FirebaseFirestore.Timestamp;
  status: 'pending' | 'active' | 'expired' | 'revoked';
  approvedByA: boolean;
  approvedByB: boolean;
  createdAt: FirebaseFirestore.Timestamp;
}

// ---------------------------------------------------------------------------
// Collection helper — returns typed CollectionReference
// ---------------------------------------------------------------------------

function typedCollection<T extends DocumentData>(db: Firestore, path: string): CollectionReference<T> {
  return db.collection(path) as CollectionReference<T>;
}

let _db: Firestore | null = null;

export function db(): Firestore {
  if (!_db) {
    _db = getFirestore();
  }
  return _db;
}

export const collections = {
  organizations: () => typedCollection<Organization>(db(), 'organizations'),
  users: () => typedCollection<User>(db(), 'users'),
  teams: () => typedCollection<Team>(db(), 'teams'),
  ledgers: () => typedCollection<Ledger>(db(), 'ledgers'),
  artifacts: () => typedCollection<Artifact>(db(), 'artifacts'),
  commits: () => typedCollection<Commit>(db(), 'commits'),
  forks: () => typedCollection<Fork>(db(), 'forks'),
  pullRequests: () => typedCollection<PullRequest>(db(), 'pullRequests'),
  agents: () => typedCollection<Agent>(db(), 'agents'),
  agentTemplates: () => typedCollection<AgentTemplate>(db(), 'agentTemplates'),
  policies: () => typedCollection<Policy>(db(), 'policies'),
  migrations: () => typedCollection<Migration>(db(), 'migrations'),
  customerHealth: () => typedCollection<CustomerHealth>(db(), 'customerHealth'),
  audits: () => typedCollection<Audit>(db(), 'audits'),
  notifications: () => typedCollection<Notification>(db(), 'notifications'),
  feedback: () => typedCollection<Feedback>(db(), 'feedback'),
  federations: () => typedCollection<Federation>(db(), 'federations'),
};
