import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "./firebase";

// ── Types ────────────────────────────────────

export interface PolicyConfig {
  redactionLevel: "minimal" | "standard" | "strict";
  contentAccess: "open" | "team_based" | "strict";
  customerDataPolicy: "full" | "anonymized" | "restricted";
  recordingConsent: boolean;
  autoTranscribe: boolean;
  meetingRetention: string;
  migrationApproval: boolean;
  migrationRedaction: boolean;
  updatedAt: string;
  updatedBy: string;
}

export interface AgentConfig {
  id: string;
  name: string;
  displayName: string;
  status: "active" | "paused" | "disabled" | "error";
  model: string;
  prompt: string;
  description: string;
  scopes: string[];
  updatedAt: string;
}

// ── Policy Helpers ──────────────────────────

/** Merge partial policy config into organizations/{orgId}/policies/current */
export async function savePolicyConfig(
  orgId: string,
  config: Partial<PolicyConfig>,
): Promise<void> {
  const db = getFirebaseDb();
  const ref = doc(db, "organizations", orgId, "policies", "current");
  await setDoc(ref, { ...config, _serverTs: serverTimestamp() }, { merge: true });
}

/** Read the current policy config for an organization */
export async function loadPolicyConfig(
  orgId: string,
): Promise<PolicyConfig | null> {
  const db = getFirebaseDb();
  const ref = doc(db, "organizations", orgId, "policies", "current");
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as PolicyConfig;
}

// ── Agent Helpers ───────────────────────────

/** Write (or overwrite) an agent config document */
export async function saveAgentConfig(
  orgId: string,
  agent: AgentConfig,
): Promise<void> {
  const db = getFirebaseDb();
  const ref = doc(db, "organizations", orgId, "agents", agent.id);
  await setDoc(ref, agent);
}

/** Load all agent configs for an organization */
export async function loadAgentConfigs(
  orgId: string,
): Promise<AgentConfig[]> {
  const db = getFirebaseDb();
  const col = collection(db, "organizations", orgId, "agents");
  const snap = await getDocs(col);
  return snap.docs.map((d) => d.data() as AgentConfig);
}

// ── Policy History ──────────────────────────

/** Append a version entry to the policy history subcollection */
export async function savePolicyVersion(
  orgId: string,
  version: { version: string; changedBy: string; summary: string },
): Promise<void> {
  const db = getFirebaseDb();
  const col = collection(db, "organizations", orgId, "policyHistory");
  await addDoc(col, { ...version, createdAt: serverTimestamp() });
}

// ── Dashboard Stats ────────────────────────

export interface DashboardSnapshot {
  date: string;            // ISO date e.g. "2026-03-26"
  totalArtifacts: number;
  docs: number;
  snippets: number;
  meetings: number;
  activeAgents: number;
  openPRs: number;
  yoloMergeRate: number;
  prAccepted: number;
  prRejected: number;
  prPending: number;
}

export interface DashboardStats {
  current: DashboardSnapshot;
  history: DashboardSnapshot[];
}

/** Write a daily dashboard snapshot */
export async function saveDashboardSnapshot(
  orgId: string,
  snapshot: DashboardSnapshot,
): Promise<void> {
  const db = getFirebaseDb();
  const ref = doc(db, "organizations", orgId, "dashboardStats", snapshot.date);
  await setDoc(ref, { ...snapshot, _serverTs: serverTimestamp() });
}

/** Write the "current" summary doc */
export async function saveDashboardCurrent(
  orgId: string,
  snapshot: DashboardSnapshot,
): Promise<void> {
  const db = getFirebaseDb();
  const ref = doc(db, "organizations", orgId, "dashboardStats", "current");
  await setDoc(ref, { ...snapshot, _serverTs: serverTimestamp() });
}

/** Load all dashboard snapshots (ordered by date) */
export async function loadDashboardStats(
  orgId: string,
): Promise<DashboardStats | null> {
  const db = getFirebaseDb();
  const col = collection(db, "organizations", orgId, "dashboardStats");
  const q = query(col, orderBy("date", "asc"));
  const snap = await getDocs(q);

  let current: DashboardSnapshot | null = null;
  const history: DashboardSnapshot[] = [];

  for (const d of snap.docs) {
    if (d.id === "current") {
      current = d.data() as DashboardSnapshot;
    } else {
      history.push(d.data() as DashboardSnapshot);
    }
  }

  if (!current && history.length > 0) {
    current = history[history.length - 1];
  }
  if (!current) return null;

  return { current, history };
}

/** Seed exponential growth data: ~11k → 168,872+ over 7 days */
export async function seedDashboardStats(orgId: string): Promise<void> {
  // Exponential curve: starts at ~11,400, ends at ~168,872
  // Using formula: base * e^(k*day) where k = ln(168872/11400) / 6 ≈ 0.394
  const base = 11400;
  const target = 168872;
  const days = 7;
  const k = Math.log(target / base) / (days - 1);

  const startDate = new Date("2026-03-26");

  const snapshots: DashboardSnapshot[] = [];

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split("T")[0];

    const artifacts = Math.round(base * Math.exp(k * i));
    // Breakdown: docs ~55%, snippets ~30%, meetings ~15%
    const docs = Math.round(artifacts * 0.55);
    const snippets = Math.round(artifacts * 0.30);
    const meetings = artifacts - docs - snippets;

    // Agents and PRs scale up too
    const activeAgents = Math.min(7 + Math.floor(i * 1.5), 14);
    const openPRs = Math.round(12 + (artifacts / 5000));
    const yoloRate = Math.min(22 + i * 4.5, 48);

    // PR acceptance improves over the week
    const prAccepted = 82 + Math.round(i * 2.1);
    const prRejected = Math.max(14 - Math.round(i * 1.5), 3);
    const prPending = Math.max(4 - Math.floor(i * 0.4), 1);

    snapshots.push({
      date: dateStr,
      totalArtifacts: artifacts,
      docs,
      snippets,
      meetings,
      activeAgents,
      openPRs,
      yoloMergeRate: Math.round(yoloRate),
      prAccepted,
      prRejected,
      prPending,
    });
  }

  // Write all snapshots to Firestore
  for (const snap of snapshots) {
    await saveDashboardSnapshot(orgId, snap);
  }
  // Set current to the latest
  await saveDashboardCurrent(orgId, snapshots[snapshots.length - 1]);
}
