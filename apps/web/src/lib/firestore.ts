import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  addDoc,
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
