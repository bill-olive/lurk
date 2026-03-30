"use client";

import { useState } from "react";
import {
  Shield,
  Eye,
  EyeOff,
  Lock,
  FileWarning,
  History,
  ChevronRight,
  Save,
  RotateCcw,
  CheckCircle2,
  Info,
  Video,
  ArrowLeftRight,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabPanel } from "@/components/ui/tabs";

// ── Types ────────────────────────────────────

interface PolicyVersion {
  version: string;
  changedBy: string;
  changedAt: string;
  summary: string;
}

// ── Mock Data ────────────────────────────────

const policyHistory: PolicyVersion[] = [
  {
    version: "v3.2",
    changedBy: "Sarah Chen",
    changedAt: "2026-03-28 14:30",
    summary: "Increased redaction level for financial documents",
  },
  {
    version: "v3.1",
    changedBy: "Mike Johnson",
    changedAt: "2026-03-25 09:15",
    summary: "Added HIPAA compliance rules for health data",
  },
  {
    version: "v3.0",
    changedBy: "Sarah Chen",
    changedAt: "2026-03-20 11:00",
    summary: "Major policy overhaul: unified content access model",
  },
  {
    version: "v2.8",
    changedBy: "Alex Rivera",
    changedAt: "2026-03-15 16:45",
    summary: "Updated recording consent requirements",
  },
  {
    version: "v2.7",
    changedBy: "Sarah Chen",
    changedAt: "2026-03-10 10:20",
    summary: "Restricted migration scope for external docs",
  },
];

// ── Components ───────────────────────────────

function PolicySection({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="mb-4">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-clay-100 flex items-center justify-center shrink-0 mt-0.5">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-ink-700">{title}</h3>
          <p className="text-xs text-ink-300 mt-0.5 mb-4">{description}</p>
          {children}
        </div>
      </div>
    </Card>
  );
}

function RadioOption({
  name,
  value,
  label,
  description,
  checked,
  onChange,
}: {
  name: string;
  value: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <label
      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
        checked
          ? "border-clay-500/40 bg-clay-50"
          : "border-ink-100 hover:border-ink-200 hover:bg-ink-50"
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="mt-1 accent-clay-500"
      />
      <div>
        <div className="text-sm font-medium text-ink-700">{label}</div>
        <div className="text-xs text-ink-300 mt-0.5">{description}</div>
      </div>
    </label>
  );
}

function ToggleSwitch({
  enabled,
  onToggle,
  label,
  description,
}: {
  enabled: boolean;
  onToggle: () => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <div className="text-sm text-ink-600">{label}</div>
        {description && (
          <div className="text-xs text-ink-300 mt-0.5">{description}</div>
        )}
      </div>
      <button
        onClick={onToggle}
        className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
          enabled ? "bg-clay-500" : "bg-ink-200"
        }`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
            enabled ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

// ── Page ─────────────────────────────────────

export default function PoliciesPage() {
  const [activeTab, setActiveTab] = useState("policies");
  const [redactionLevel, setRedactionLevel] = useState("standard");
  const [contentAccess, setContentAccess] = useState("team_based");
  const [customerDataPolicy, setCustomerDataPolicy] = useState("anonymized");
  const [recordingConsent, setRecordingConsent] = useState(true);
  const [autoTranscribe, setAutoTranscribe] = useState(true);
  const [meetingRetention, setMeetingRetention] = useState("90");
  const [migrationApproval, setMigrationApproval] = useState(true);
  const [migrationRedaction, setMigrationRedaction] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  const markChanged = () => setHasChanges(true);

  const tabs = [
    { id: "policies", label: "Policy Configuration", icon: <Shield className="w-3.5 h-3.5" /> },
    { id: "history", label: "Version History", icon: <History className="w-3.5 h-3.5" />, count: policyHistory.length },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-800 tracking-tight flex items-center gap-2">
            <Shield className="w-5 h-5 text-clay-500" />
            Privacy & Agent Policies
          </h1>
          <p className="text-sm text-ink-300 mt-1">
            Configure data privacy, content access, and agent behavior policies
          </p>
        </div>
        {hasChanges && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              icon={<RotateCcw className="w-3.5 h-3.5" />}
              onClick={() => setHasChanges(false)}
            >
              Discard
            </Button>
            <Button
              size="sm"
              icon={<Save className="w-3.5 h-3.5" />}
              onClick={() => setHasChanges(false)}
            >
              Save Changes
            </Button>
          </div>
        )}
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <TabPanel id="policies" activeTab={activeTab}>
        <div className="space-y-4 mt-6">
          {/* Redaction Level */}
          <PolicySection
            icon={<EyeOff className="w-5 h-5 text-clay-500" />}
            title="Redaction Level"
            description="Control how sensitive information is handled across artifacts"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <RadioOption
                name="redaction"
                value="minimal"
                label="Minimal"
                description="Only PII is redacted (SSN, CC numbers)"
                checked={redactionLevel === "minimal"}
                onChange={(v) => { setRedactionLevel(v); markChanged(); }}
              />
              <RadioOption
                name="redaction"
                value="standard"
                label="Standard"
                description="PII + financial data + internal IDs"
                checked={redactionLevel === "standard"}
                onChange={(v) => { setRedactionLevel(v); markChanged(); }}
              />
              <RadioOption
                name="redaction"
                value="strict"
                label="Strict"
                description="All identifiable info + org names + emails"
                checked={redactionLevel === "strict"}
                onChange={(v) => { setRedactionLevel(v); markChanged(); }}
              />
            </div>
          </PolicySection>

          {/* Content Access */}
          <PolicySection
            icon={<Lock className="w-5 h-5 text-clay-500" />}
            title="Content Access Controls"
            description="Define how content is shared and accessed within the organization"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <RadioOption
                name="access"
                value="open"
                label="Open Access"
                description="All members can view all artifacts"
                checked={contentAccess === "open"}
                onChange={(v) => { setContentAccess(v); markChanged(); }}
              />
              <RadioOption
                name="access"
                value="team_based"
                label="Team-Based"
                description="Artifacts scoped to team visibility"
                checked={contentAccess === "team_based"}
                onChange={(v) => { setContentAccess(v); markChanged(); }}
              />
              <RadioOption
                name="access"
                value="strict"
                label="Need-to-Know"
                description="Explicit access grants per artifact"
                checked={contentAccess === "strict"}
                onChange={(v) => { setContentAccess(v); markChanged(); }}
              />
            </div>
          </PolicySection>

          {/* Customer Data */}
          <PolicySection
            icon={<FileWarning className="w-5 h-5 text-clay-500" />}
            title="Customer Data Policy"
            description="How customer-related information is processed by agents"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <RadioOption
                name="customer"
                value="full"
                label="Full Access"
                description="Agents can access customer data as-is"
                checked={customerDataPolicy === "full"}
                onChange={(v) => { setCustomerDataPolicy(v); markChanged(); }}
              />
              <RadioOption
                name="customer"
                value="anonymized"
                label="Anonymized"
                description="Customer names replaced with tokens"
                checked={customerDataPolicy === "anonymized"}
                onChange={(v) => { setCustomerDataPolicy(v); markChanged(); }}
              />
              <RadioOption
                name="customer"
                value="restricted"
                label="Restricted"
                description="No customer data in agent context"
                checked={customerDataPolicy === "restricted"}
                onChange={(v) => { setCustomerDataPolicy(v); markChanged(); }}
              />
            </div>
          </PolicySection>

          {/* Recording Policy */}
          <PolicySection
            icon={<Video className="w-5 h-5 text-clay-500" />}
            title="Recording Policy"
            description="Manage how meetings and conversations are captured"
          >
            <div className="space-y-3">
              <ToggleSwitch
                enabled={recordingConsent}
                onToggle={() => { setRecordingConsent(!recordingConsent); markChanged(); }}
                label="Require explicit consent before recording"
                description="Participants must opt-in before capture begins"
              />
              <ToggleSwitch
                enabled={autoTranscribe}
                onToggle={() => { setAutoTranscribe(!autoTranscribe); markChanged(); }}
                label="Auto-transcribe captured meetings"
                description="Automatically generate transcripts from recordings"
              />
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-sm text-ink-600">Retention period</div>
                  <div className="text-xs text-ink-300 mt-0.5">
                    How long recordings are kept before auto-deletion
                  </div>
                </div>
                <select
                  value={meetingRetention}
                  onChange={(e) => { setMeetingRetention(e.target.value); markChanged(); }}
                  className="input-base w-32"
                >
                  <option value="30">30 days</option>
                  <option value="60">60 days</option>
                  <option value="90">90 days</option>
                  <option value="180">180 days</option>
                  <option value="365">1 year</option>
                  <option value="0">Indefinite</option>
                </select>
              </div>
            </div>
          </PolicySection>

          {/* Migration Policy */}
          <PolicySection
            icon={<ArrowLeftRight className="w-5 h-5 text-clay-500" />}
            title="Migration Policy"
            description="Controls for data migration and import processes"
          >
            <div className="space-y-3">
              <ToggleSwitch
                enabled={migrationApproval}
                onToggle={() => { setMigrationApproval(!migrationApproval); markChanged(); }}
                label="Require admin approval for migrations"
                description="All migration jobs must be manually approved"
              />
              <ToggleSwitch
                enabled={migrationRedaction}
                onToggle={() => { setMigrationRedaction(!migrationRedaction); markChanged(); }}
                label="Apply redaction during migration"
                description="Sensitive data is redacted as it is imported"
              />
            </div>
          </PolicySection>
        </div>
      </TabPanel>

      <TabPanel id="history" activeTab={activeTab}>
        <div className="mt-6 space-y-2">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-4 h-4 text-ink-300" />
            <span className="text-xs text-ink-300">
              All policy changes are logged and can be rolled back
            </span>
          </div>
          {policyHistory.map((entry, idx) => (
            <div
              key={entry.version}
              className="flex items-start gap-4 p-4 rounded-xl bg-white border border-ink-100 hover:border-ink-200 transition-colors"
            >
              <div className="flex flex-col items-center gap-1">
                <Badge variant={idx === 0 ? "success" : "default"} size="sm">
                  {entry.version}
                </Badge>
                {idx === 0 && (
                  <span className="text-2xs text-olive-600">Current</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink-700">{entry.summary}</p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-ink-300">
                  <span>{entry.changedBy}</span>
                  <span>&middot;</span>
                  <span>{entry.changedAt}</span>
                </div>
              </div>
              {idx > 0 && (
                <Button variant="ghost" size="xs">
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Rollback
                </Button>
              )}
            </div>
          ))}
        </div>
      </TabPanel>
    </div>
  );
}
