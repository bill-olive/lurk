"use client";

import { useState } from "react";
import {
  Plug,
  Mail,
  MessageSquare,
  Webhook,
  Smartphone,
  Plus,
  Check,
  Settings,
  Trash2,
  TestTube,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";

// ── Types ────────────────────────────────────

interface Connector {
  id: string;
  type: "email" | "slack" | "webhook" | "apns";
  name: string;
  description: string;
  status: "active" | "inactive" | "error";
  config: Record<string, string>;
  lastUsed: string;
  events: string[];
}

// ── Mock Data ────────────────────────────────

const connectors: Connector[] = [
  {
    id: "conn_1",
    type: "email",
    name: "Team Email Notifications",
    description: "Send notifications to team leads for important events",
    status: "active",
    config: { recipients: "team-leads@acme.com", format: "HTML" },
    lastUsed: "5 min ago",
    events: ["agent.alert", "policy.changed", "kill_switch.activated"],
  },
  {
    id: "conn_2",
    type: "slack",
    name: "Slack #lurk-alerts",
    description: "Post alerts to the Lurk monitoring channel",
    status: "active",
    config: { channel: "#lurk-alerts", webhookUrl: "https://hooks.slack.com/..." },
    lastUsed: "2 min ago",
    events: ["agent.pr_opened", "agent.alert", "migration.completed", "migration.failed"],
  },
  {
    id: "conn_3",
    type: "webhook",
    name: "PagerDuty Integration",
    description: "Critical alerts sent to PagerDuty on-call",
    status: "active",
    config: { url: "https://events.pagerduty.com/v2/enqueue", method: "POST" },
    lastUsed: "1 day ago",
    events: ["kill_switch.activated", "agent.error", "security.alert"],
  },
  {
    id: "conn_4",
    type: "slack",
    name: "Slack #engineering",
    description: "Engineering-specific agent activity",
    status: "active",
    config: { channel: "#engineering", webhookUrl: "https://hooks.slack.com/..." },
    lastUsed: "15 min ago",
    events: ["agent.pr_opened", "artifact.stale"],
  },
  {
    id: "conn_5",
    type: "apns",
    name: "Mobile Push Notifications",
    description: "Push notifications to admin mobile app",
    status: "inactive",
    config: { bundleId: "com.lurk.admin", environment: "production" },
    lastUsed: "Never",
    events: ["kill_switch.activated", "security.alert"],
  },
  {
    id: "conn_6",
    type: "webhook",
    name: "Custom Analytics Webhook",
    description: "Forward events to internal analytics pipeline",
    status: "error",
    config: { url: "https://analytics.internal.acme.com/events", method: "POST" },
    lastUsed: "3 days ago",
    events: ["agent.pr_opened", "agent.pr_merged", "artifact.created", "artifact.updated"],
  },
];

const connectorTypeConfig = {
  email: {
    icon: <Mail className="w-5 h-5 text-blue-400" />,
    bg: "bg-blue-500/15",
    label: "Email",
  },
  slack: {
    icon: <MessageSquare className="w-5 h-5 text-purple-400" />,
    bg: "bg-purple-500/15",
    label: "Slack Webhook",
  },
  webhook: {
    icon: <Webhook className="w-5 h-5 text-orange-400" />,
    bg: "bg-orange-500/15",
    label: "Custom Webhook",
  },
  apns: {
    icon: <Smartphone className="w-5 h-5 text-green-400" />,
    bg: "bg-green-500/15",
    label: "APNs (Push)",
  },
};

const statusColors = {
  active: "success" as const,
  inactive: "default" as const,
  error: "danger" as const,
};

const availableEvents = [
  "agent.pr_opened",
  "agent.pr_merged",
  "agent.alert",
  "agent.error",
  "artifact.created",
  "artifact.updated",
  "artifact.stale",
  "policy.changed",
  "migration.completed",
  "migration.failed",
  "kill_switch.activated",
  "security.alert",
  "access.changed",
];

// ── Page ─────────────────────────────────────

export default function ConnectorsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [showConfig, setShowConfig] = useState<Connector | null>(null);
  const [newType, setNewType] = useState<"email" | "slack" | "webhook" | "apns">("slack");
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<string | null>(null);

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  const handleTest = (connector: Connector) => {
    setTestResult(null);
    setTimeout(() => {
      setTestResult(`Test notification sent successfully to ${connector.name}`);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100 tracking-tight flex items-center gap-2">
            <Plug className="w-5 h-5 text-lurk-400" />
            Notification Connectors
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure how Lurk sends notifications and alerts
          </p>
        </div>
        <Button
          size="sm"
          icon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => setShowCreate(true)}
        >
          Add Connector
        </Button>
      </div>

      {/* Connector Summary */}
      <div className="grid grid-cols-4 gap-4">
        {(["email", "slack", "webhook", "apns"] as const).map((type) => {
          const config = connectorTypeConfig[type];
          const count = connectors.filter((c) => c.type === type).length;
          const active = connectors.filter((c) => c.type === type && c.status === "active").length;
          return (
            <div
              key={type}
              className="bg-surface-100 border border-gray-800/60 rounded-xl p-4 flex items-center gap-3"
            >
              <div className={`w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center`}>
                {config.icon}
              </div>
              <div>
                <div className="text-sm font-medium text-gray-200">{config.label}</div>
                <div className="text-xs text-gray-500">
                  {count} configured, {active} active
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Connector List */}
      <div className="space-y-3">
        {connectors.map((connector) => {
          const typeConfig = connectorTypeConfig[connector.type];
          return (
            <Card key={connector.id}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-lg ${typeConfig.bg} flex items-center justify-center shrink-0`}>
                    {typeConfig.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-200">{connector.name}</h3>
                      <Badge variant={statusColors[connector.status]} dot size="sm">
                        {connector.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{connector.description}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {connector.events.map((event) => (
                        <Badge key={event} variant="outline" size="sm">
                          {event}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-2xs text-gray-600 mt-2">
                      Last used: {connector.lastUsed}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="xs"
                    icon={<TestTube className="w-3 h-3" />}
                    onClick={() => handleTest(connector)}
                  >
                    Test
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    icon={<Settings className="w-3 h-3" />}
                    onClick={() => setShowConfig(connector)}
                  >
                    Configure
                  </Button>
                </div>
              </div>

              {/* Error state */}
              {connector.status === "error" && (
                <div className="mt-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span className="text-xs text-red-400">
                    Connection failed. Check endpoint URL and credentials.
                  </span>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Test Result Toast */}
      {testResult && (
        <div className="fixed bottom-6 right-6 bg-surface-100 border border-emerald-500/30 rounded-xl p-4 shadow-2xl flex items-center gap-3 animate-slide-in z-50">
          <Check className="w-4 h-4 text-emerald-400" />
          <span className="text-sm text-gray-200">{testResult}</span>
          <button
            onClick={() => setTestResult(null)}
            className="text-gray-500 hover:text-gray-300 ml-2"
          >
            &times;
          </button>
        </div>
      )}

      {/* Create Connector Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Add Notification Connector"
        description="Configure a new notification endpoint"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => setShowCreate(false)}>Create Connector</Button>
          </>
        }
      >
        <div className="space-y-6">
          {/* Type */}
          <div>
            <label className="text-xs font-medium text-gray-400 mb-3 block">Connector Type</label>
            <div className="grid grid-cols-4 gap-3">
              {(["email", "slack", "webhook", "apns"] as const).map((type) => {
                const config = connectorTypeConfig[type];
                return (
                  <button
                    key={type}
                    onClick={() => setNewType(type)}
                    className={`p-4 rounded-xl border text-center transition-all ${
                      newType === type
                        ? "border-lurk-500/40 bg-lurk-950/30"
                        : "border-gray-800/60 hover:border-gray-700"
                    }`}
                  >
                    <div className="flex justify-center mb-2">{config.icon}</div>
                    <div className="text-xs font-medium text-gray-200">{config.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-xs font-medium text-gray-400 mb-1.5 block">Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., Slack #alerts"
              className="input-base w-full"
            />
          </div>

          {/* URL */}
          {(newType === "slack" || newType === "webhook") && (
            <div>
              <label className="text-xs font-medium text-gray-400 mb-1.5 block">
                {newType === "slack" ? "Webhook URL" : "Endpoint URL"}
              </label>
              <input
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder={newType === "slack" ? "https://hooks.slack.com/services/..." : "https://your-endpoint.com/webhook"}
                className="input-base w-full font-mono text-xs"
              />
            </div>
          )}

          {/* Events */}
          <div>
            <label className="text-xs font-medium text-gray-400 mb-3 block">Subscribe to Events</label>
            <div className="grid grid-cols-2 gap-2">
              {availableEvents.map((event) => (
                <label
                  key={event}
                  className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                    selectedEvents.includes(event)
                      ? "border-lurk-500/40 bg-lurk-950/30"
                      : "border-gray-800/60 hover:border-gray-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes(event)}
                    onChange={() => toggleEvent(event)}
                    className="accent-lurk-500"
                  />
                  <code className="text-xs text-gray-400">{event}</code>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Configure Connector Modal */}
      {showConfig && (
        <Modal
          open={!!showConfig}
          onClose={() => setShowConfig(null)}
          title={`Configure: ${showConfig.name}`}
          description={connectorTypeConfig[showConfig.type].label}
          footer={
            <>
              <Button variant="danger" size="sm" icon={<Trash2 className="w-3.5 h-3.5" />}>
                Delete
              </Button>
              <div className="flex-1" />
              <Button variant="ghost" onClick={() => setShowConfig(null)}>Cancel</Button>
              <Button onClick={() => setShowConfig(null)}>Save Changes</Button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-400 mb-1.5 block">Configuration</label>
              <pre className="p-3 rounded-lg bg-surface-200/50 border border-gray-800/60 text-xs text-gray-400 font-mono">
                {JSON.stringify(showConfig.config, null, 2)}
              </pre>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400 mb-2 block">Subscribed Events</label>
              <div className="flex flex-wrap gap-1.5">
                {showConfig.events.map((e) => (
                  <Badge key={e} variant="outline" size="sm">{e}</Badge>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
