"use client";

import { useState } from "react";
import {
  Power,
  AlertTriangle,
  Shield,
  Bot,
  Camera,
  Video,
  ArrowLeftRight,
  Users,
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  History,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";

// ── Types ────────────────────────────────────

interface KillSwitch {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  scope: "global" | "feature" | "team" | "agent";
  lastToggled: string;
  toggledBy: string;
  affectedSystems: string[];
  severity: "critical" | "high" | "medium";
}

// ── Mock Data ────────────────────────────────

const killSwitchesData: KillSwitch[] = [
  {
    id: "ks_global",
    name: "Global Kill Switch",
    description: "Immediately halts ALL Lurk operations including agents, capture, migration, and processing. Emergency use only.",
    icon: <Power className="w-6 h-6" />,
    enabled: false,
    scope: "global",
    lastToggled: "Never activated",
    toggledBy: "N/A",
    affectedSystems: ["All agents", "Capture pipeline", "Migration jobs", "API processing", "Notifications"],
    severity: "critical",
  },
  {
    id: "ks_agents",
    name: "Agent Kill Switch",
    description: "Suspends all agent operations. Agents will not process any artifacts, open PRs, or make changes.",
    icon: <Bot className="w-6 h-6" />,
    enabled: false,
    scope: "feature",
    lastToggled: "2026-03-15 14:30",
    toggledBy: "Sarah Chen",
    affectedSystems: ["All agents", "PR processing", "YOLO merges"],
    severity: "high",
  },
  {
    id: "ks_capture",
    name: "Capture Kill Switch",
    description: "Stops all data capture including screen, clipboard, and browser activity monitoring.",
    icon: <Camera className="w-6 h-6" />,
    enabled: false,
    scope: "feature",
    lastToggled: "2026-03-20 09:15",
    toggledBy: "Mike Johnson",
    affectedSystems: ["Screen capture", "Clipboard monitoring", "Browser extension", "Desktop app"],
    severity: "high",
  },
  {
    id: "ks_meeting",
    name: "Meeting Capture Kill",
    description: "Disables all meeting recording, transcription, and note generation.",
    icon: <Video className="w-6 h-6" />,
    enabled: true,
    scope: "feature",
    lastToggled: "2026-03-29 09:05",
    toggledBy: "Sarah Chen",
    affectedSystems: ["Meeting recorder", "Transcription service", "Meeting note generator"],
    severity: "medium",
  },
  {
    id: "ks_migration",
    name: "Migration Kill Switch",
    description: "Pauses all active and queued migration jobs. Data already imported is not affected.",
    icon: <ArrowLeftRight className="w-6 h-6" />,
    enabled: false,
    scope: "feature",
    lastToggled: "2026-03-10 16:45",
    toggledBy: "Alex Rivera",
    affectedSystems: ["Migration pipeline", "API importers", "Agentic crawlers", "File processors"],
    severity: "medium",
  },
];

const perTeamSwitches = [
  { id: "ts_1", team: "Engineering", agentsPaused: false, capturePaused: false },
  { id: "ts_2", team: "Sales", agentsPaused: false, capturePaused: false },
  { id: "ts_3", team: "Marketing", agentsPaused: true, capturePaused: false },
  { id: "ts_4", team: "Legal", agentsPaused: false, capturePaused: false },
  { id: "ts_5", team: "Customer Success", agentsPaused: false, capturePaused: false },
  { id: "ts_6", team: "Product", agentsPaused: false, capturePaused: true },
];

const perAgentSwitches = [
  { id: "as_1", agent: "sales_ops", paused: false },
  { id: "as_2", agent: "compliance", paused: false },
  { id: "as_3", agent: "brand_consistency", paused: false },
  { id: "as_4", agent: "security", paused: false },
  { id: "as_5", agent: "customer_success", paused: false },
  { id: "as_6", agent: "onboarding", paused: true },
  { id: "as_7", agent: "eng_standards", paused: true },
];

const recentActivity = [
  { time: "2026-03-29 09:05", action: "Meeting Capture Kill activated", by: "Sarah Chen", type: "activate" as const },
  { time: "2026-03-28 14:30", action: "Marketing agents paused", by: "Jordan Lee", type: "activate" as const },
  { time: "2026-03-27 11:00", action: "Product capture paused", by: "Pat Morgan", type: "activate" as const },
  { time: "2026-03-25 16:45", action: "Migration kill switch deactivated", by: "Alex Rivera", type: "deactivate" as const },
  { time: "2026-03-22 09:15", action: "Onboarding agent paused", by: "Sarah Chen", type: "activate" as const },
  { time: "2026-03-20 09:15", action: "Capture kill switch test (deactivated)", by: "Mike Johnson", type: "deactivate" as const },
];

const severityColors = {
  critical: "bg-red-500/20 text-accent-red border-red-500/30",
  high: "bg-orange-500/20 text-orange-600 border-orange-500/30",
  medium: "bg-yellow-500/20 text-accent-yellow border-yellow-500/30",
};

const severityBadge = {
  critical: "danger" as const,
  high: "warning" as const,
  medium: "default" as const,
};

// ── Page ─────────────────────────────────────

export default function KillSwitchesPage() {
  const [switches, setSwitches] = useState(killSwitchesData);
  const [teamSwitches, setTeamSwitches] = useState(perTeamSwitches);
  const [agentSwitches, setAgentSwitches] = useState(perAgentSwitches);
  const [confirmModal, setConfirmModal] = useState<{
    switchId: string;
    name: string;
    enabling: boolean;
    severity: string;
  } | null>(null);

  const handleToggle = (id: string, name: string, currentState: boolean, severity: string) => {
    setConfirmModal({
      switchId: id,
      name,
      enabling: !currentState,
      severity,
    });
  };

  const confirmToggle = () => {
    if (!confirmModal) return;
    setSwitches((prev) =>
      prev.map((s) =>
        s.id === confirmModal.switchId ? { ...s, enabled: !s.enabled } : s
      )
    );
    setConfirmModal(null);
  };

  const toggleTeamSwitch = (id: string, field: "agentsPaused" | "capturePaused") => {
    setTeamSwitches((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: !s[field] } : s))
    );
  };

  const toggleAgentSwitch = (id: string) => {
    setAgentSwitches((prev) =>
      prev.map((s) => (s.id === id ? { ...s, paused: !s.paused } : s))
    );
  };

  const activeCount = switches.filter((s) => s.enabled).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-800 tracking-tight flex items-center gap-2">
            <Power className="w-5 h-5 text-clay-400" />
            Kill Switches
          </h1>
          <p className="text-sm text-ink-300 mt-1">
            Emergency controls to disable Lurk features and operations
          </p>
        </div>
        {activeCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="w-4 h-4 text-accent-red" />
            <span className="text-sm font-medium text-accent-red">
              {activeCount} kill switch{activeCount > 1 ? "es" : ""} active
            </span>
          </div>
        )}
      </div>

      {/* Warning Banner */}
      <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-accent-yellow shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-yellow-700">
            Kill switches are emergency controls
          </p>
          <p className="text-xs text-yellow-600/70 mt-0.5">
            Activating a kill switch immediately halts the affected systems. All changes are logged in the audit trail.
            Ensure you have a recovery plan before activating global or feature-level switches.
          </p>
        </div>
      </div>

      {/* Main Kill Switches */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-600 flex items-center gap-2">
          <Shield className="w-4 h-4 text-ink-300" />
          System Kill Switches
        </h2>
        {switches.map((ks) => (
          <Card
            key={ks.id}
            className={ks.enabled ? "border-red-500/30 bg-red-500/5" : ""}
          >
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  ks.enabled
                    ? "bg-red-500/20 text-accent-red"
                    : "bg-ink-50 text-ink-300"
                }`}
              >
                {ks.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-ink-700">{ks.name}</h3>
                  <Badge variant={severityBadge[ks.severity]} size="sm">
                    {ks.severity}
                  </Badge>
                  {ks.enabled && (
                    <Badge variant="danger" dot size="sm">ACTIVE</Badge>
                  )}
                </div>
                <p className="text-xs text-ink-300">{ks.description}</p>
                <div className="flex items-center gap-4 mt-2 text-2xs text-ink-300">
                  <span>Last: {ks.lastToggled}</span>
                  <span>By: {ks.toggledBy}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {ks.affectedSystems.map((sys) => (
                    <Badge key={sys} variant="outline" size="sm">{sys}</Badge>
                  ))}
                </div>
              </div>
              <div className="shrink-0">
                <button
                  onClick={() => handleToggle(ks.id, ks.name, ks.enabled, ks.severity)}
                  className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${
                    ks.enabled
                      ? "bg-red-500"
                      : "bg-ink-200 hover:bg-ink-100"
                  }`}
                >
                  <span
                    className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-lg transition-transform duration-300 ${
                      ks.enabled ? "translate-x-7" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Per-Team Switches */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-600 flex items-center gap-2">
          <Users className="w-4 h-4 text-ink-300" />
          Per-Team Controls
        </h2>
        <Card padding="none">
          <div className="divide-y divide-ink-100">
            <div className="grid grid-cols-3 gap-4 px-5 py-3 bg-ink-50/30">
              <span className="text-xs font-medium text-ink-300 uppercase tracking-wider">Team</span>
              <span className="text-xs font-medium text-ink-300 uppercase tracking-wider text-center">Agents Paused</span>
              <span className="text-xs font-medium text-ink-300 uppercase tracking-wider text-center">Capture Paused</span>
            </div>
            {teamSwitches.map((ts) => (
              <div key={ts.id} className="grid grid-cols-3 gap-4 px-5 py-3 items-center hover:bg-ink-50/20 transition-colors">
                <span className="text-sm text-ink-600 font-medium">{ts.team}</span>
                <div className="flex justify-center">
                  <button
                    onClick={() => toggleTeamSwitch(ts.id, "agentsPaused")}
                    className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
                      ts.agentsPaused ? "bg-red-500" : "bg-ink-200"
                    }`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                      ts.agentsPaused ? "translate-x-5" : "translate-x-0.5"
                    }`} />
                  </button>
                </div>
                <div className="flex justify-center">
                  <button
                    onClick={() => toggleTeamSwitch(ts.id, "capturePaused")}
                    className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
                      ts.capturePaused ? "bg-red-500" : "bg-ink-200"
                    }`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                      ts.capturePaused ? "translate-x-5" : "translate-x-0.5"
                    }`} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Per-Agent Switches */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-600 flex items-center gap-2">
          <Bot className="w-4 h-4 text-ink-300" />
          Per-Agent Controls
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {agentSwitches.map((as) => (
            <div
              key={as.id}
              className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                as.paused
                  ? "border-red-500/30 bg-red-500/5"
                  : "border-ink-100 bg-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <Bot className={`w-4 h-4 ${as.paused ? "text-accent-red" : "text-clay-400"}`} />
                <div>
                  <span className="text-sm font-medium text-ink-700">{as.agent}</span>
                  {as.paused && (
                    <div className="text-2xs text-accent-red mt-0.5">Paused</div>
                  )}
                </div>
              </div>
              <button
                onClick={() => toggleAgentSwitch(as.id)}
                className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
                  as.paused ? "bg-red-500" : "bg-ink-200"
                }`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                  as.paused ? "translate-x-5" : "translate-x-0.5"
                }`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-600 flex items-center gap-2">
          <History className="w-4 h-4 text-ink-300" />
          Recent Kill Switch Activity
        </h2>
        <Card padding="none">
          <div className="divide-y divide-ink-100">
            {recentActivity.map((entry, idx) => (
              <div key={idx} className="flex items-center gap-4 px-5 py-3 hover:bg-ink-50/20 transition-colors">
                <div className="shrink-0">
                  {entry.type === "activate" ? (
                    <XCircle className="w-4 h-4 text-accent-red" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-olive-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-ink-600">{entry.action}</span>
                </div>
                <span className="text-xs text-ink-300">{entry.by}</span>
                <span className="text-2xs text-ink-300 font-mono">{entry.time}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Confirmation Modal */}
      {confirmModal && (
        <Modal
          open={!!confirmModal}
          onClose={() => setConfirmModal(null)}
          title={
            confirmModal.enabling
              ? `Activate ${confirmModal.name}?`
              : `Deactivate ${confirmModal.name}?`
          }
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmModal(null)}>
                Cancel
              </Button>
              <Button
                variant={confirmModal.enabling ? "danger" : "primary"}
                onClick={confirmToggle}
              >
                {confirmModal.enabling ? "Activate Kill Switch" : "Deactivate Kill Switch"}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            {confirmModal.enabling ? (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-accent-red shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-700">
                      This will immediately halt affected systems
                    </p>
                    <p className="text-xs text-red-600/70 mt-1">
                      All in-progress operations will be interrupted. This action is logged in the audit trail.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-olive-50 border border-olive-200">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-olive-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-olive-700">
                      This will resume affected systems
                    </p>
                    <p className="text-xs text-olive-600/70 mt-1">
                      Operations will resume normally. Previously interrupted jobs may need to be restarted.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-ink-400 mb-1.5 block">
                Type &quot;CONFIRM&quot; to proceed
              </label>
              <input
                type="text"
                placeholder="CONFIRM"
                className="input-base w-full"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
