"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/hooks";
import { getGoogleToken, clearGoogleToken } from "@/lib/google";
import { signInWithGoogle } from "@/lib/firebase";
import {
  Mail,
  HardDrive,
  FileText,
  CheckCircle2,
  XCircle,
  ExternalLink,
  RefreshCw,
  User,
  Plug,
  Brain,
  Loader2,
  Sparkles,
} from "lucide-react";

interface Connector {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  scope: string;
  connected: boolean;
}

function useConnectors() {
  const { user } = useAuth();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(getGoogleToken());
  }, [user]);

  const hasToken = !!token;

  const connectors: Connector[] = [
    {
      id: "gmail",
      name: "Gmail",
      description: "Import email threads as artifacts. Read-only access to your inbox.",
      icon: Mail,
      scope: "gmail.readonly",
      connected: hasToken,
    },
    {
      id: "google-drive",
      name: "Google Drive",
      description: "Sync files and folders from Drive. Read-only access to your files.",
      icon: HardDrive,
      scope: "drive.readonly",
      connected: hasToken,
    },
    {
      id: "google-docs",
      name: "Google Docs",
      description: "Track document revisions as artifact versions. Read-only access.",
      icon: FileText,
      scope: "documents.readonly",
      connected: hasToken,
    },
  ];

  return { connectors, hasToken, refresh: () => setToken(getGoogleToken()) };
}

function ConnectorCard({ connector, onConnect, onReconnect }: { connector: Connector; onConnect: () => void; onReconnect: () => void }) {
  const Icon = connector.icon;

  return (
    <div className="flex items-start gap-4 p-5 bg-white border border-ink-100 rounded-editorial hover:border-ink-200 transition-colors">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
        connector.connected ? "bg-clay-50" : "bg-ink-50"
      }`}>
        <Icon className={`w-5 h-5 ${connector.connected ? "text-clay-500" : "text-ink-300"}`} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-body-sm font-semibold text-ink-800">{connector.name}</h3>
          {connector.connected ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium bg-green-50 text-green-700">
              <CheckCircle2 className="w-3 h-3" />
              Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium bg-ink-50 text-ink-400">
              <XCircle className="w-3 h-3" />
              Not connected
            </span>
          )}
        </div>
        <p className="text-2xs text-ink-400 mb-3">{connector.description}</p>
        <div className="flex items-center gap-2">
          {connector.connected ? (
            <>
              <span className="text-2xs text-ink-300">
                Scope: <code className="px-1 py-0.5 bg-ink-50 rounded text-2xs">{connector.scope}</code>
              </span>
              <button
                onClick={onReconnect}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-2xs font-medium text-ink-400 hover:text-ink-600 border border-ink-100 hover:border-ink-200 rounded-lg transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Reconnect
              </button>
            </>
          ) : (
            <button
              onClick={onConnect}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-2xs font-medium text-white bg-clay-500 hover:bg-clay-600 rounded-lg transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Connect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { connectors, hasToken, refresh } = useConnectors();
  const [activeTab, setActiveTab] = useState<"profile" | "connectors" | "voice">("connectors");

  async function handleConnect() {
    try {
      await signInWithGoogle();
      refresh();
    } catch (err) {
      console.error("Failed to connect:", err);
    }
  }

  async function handleReconnect() {
    clearGoogleToken();
    await handleConnect();
  }

  const tabs = [
    { id: "profile" as const, label: "Profile" },
    { id: "connectors" as const, label: "Connectors" },
    { id: "voice" as const, label: "Voice Profile" },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-editorial-h2 font-serif text-ink-800 mb-1">Settings</h1>
        <p className="text-body-sm text-ink-400">
          Manage your account and connected services.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-ink-100 mb-8">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-body-sm font-medium transition-colors relative ${
              activeTab === tab.id
                ? "text-clay-600"
                : "text-ink-400 hover:text-ink-600"
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-clay-500" />
            )}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === "profile" && (
        <div className="space-y-6">
          <div className="flex items-center gap-4 p-5 bg-white border border-ink-100 rounded-editorial">
            <div className="w-14 h-14 rounded-full bg-ink-100 flex items-center justify-center overflow-hidden shrink-0">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="w-6 h-6 text-ink-400" />
              )}
            </div>
            <div>
              <div className="text-body-sm font-semibold text-ink-800">
                {user?.displayName || "Admin User"}
              </div>
              <div className="text-2xs text-ink-400">{user?.email || "admin@lurk.dev"}</div>
            </div>
          </div>
        </div>
      )}

      {/* Connectors Tab */}
      {activeTab === "connectors" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-body-sm font-semibold text-ink-700 flex items-center gap-2">
                <Plug className="w-4 h-4 text-ink-400" />
                Google Workspace
              </h2>
              <p className="text-2xs text-ink-400 mt-0.5">
                Connect your Google account to import artifacts from these services.
              </p>
            </div>
            {hasToken && (
              <button
                onClick={refresh}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-2xs font-medium text-ink-400 hover:text-ink-600 border border-ink-100 hover:border-ink-200 rounded-lg transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Refresh status
              </button>
            )}
          </div>

          <div className="space-y-3">
            {connectors.map((connector) => (
              <ConnectorCard
                key={connector.id}
                connector={connector}
                onConnect={handleConnect}
                onReconnect={handleReconnect}
              />
            ))}
          </div>

          {hasToken && (
            <div className="p-4 bg-green-50 border border-green-100 rounded-editorial">
              <p className="text-2xs text-green-700">
                All connectors share a single Google OAuth session. Scopes were granted at sign-in.
                To revoke access, visit your{" "}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                >
                  Google Account permissions
                </a>.
              </p>
            </div>
          )}

          {!hasToken && (
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-editorial">
              <p className="text-2xs text-amber-700">
                No Google session found. Sign in with Google to enable all connectors at once.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Voice Profile Tab */}
      {activeTab === "voice" && <VoiceProfileTab />}
    </div>
  );
}

// ---- Voice Profile Tab Component -------------------------------------------

function VoiceProfileTab() {
  const [analyzing, setAnalyzing] = useState(false);
  const [hasProfile] = useState(false);

  // Mock style dimensions (replace with Firestore data)
  const dimensions = [
    { label: "Vocabulary Complexity", value: 0.65 },
    { label: "Formality Level", value: 0.55 },
    { label: "Technical Depth", value: 0.78 },
    { label: "Conciseness", value: 0.72 },
    { label: "Emotional Expressiveness", value: 0.35 },
  ];

  const toneDescriptors = ["direct", "data-driven", "pragmatic"];
  const communicationPatterns = [
    "Leads with context before requests",
    "Uses bullet points for complex ideas",
    "Prefers active voice over passive",
  ];
  const avoidedPatterns = [
    "Rarely uses exclamation marks",
    "Avoids corporate jargon without context",
    "Never starts with 'I hope this finds you well'",
  ];

  const handleAnalyze = async () => {
    setAnalyzing(true);
    // This would call POST /v1/voice-profile/extract in production
    await new Promise((r) => setTimeout(r, 3000));
    setAnalyzing(false);
  };

  return (
    <div className="space-y-8">
      {/* Header + Confidence */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-body-sm font-semibold text-ink-700 flex items-center gap-2">
            <Brain className="w-4 h-4 text-ink-400" />
            Digital Twin
          </h2>
          <p className="text-2xs text-ink-400 mt-0.5">
            How Lurk understands your writing style, tone, and reasoning patterns.
          </p>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-2xs font-medium text-white bg-clay-500 hover:bg-clay-600 disabled:opacity-50 rounded-lg transition-colors"
        >
          {analyzing ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Sparkles className="w-3 h-3" />
          )}
          {analyzing ? "Analyzing..." : "Analyze My Writing"}
        </button>
      </div>

      {/* Confidence Score */}
      <div className="p-5 bg-white border border-ink-100 rounded-editorial">
        <div className="flex items-center justify-between mb-3">
          <span className="text-2xs font-medium text-ink-500">Profile Confidence</span>
          <span className="text-sm font-bold text-ink-800 font-serif">
            {hasProfile ? "73%" : "—"}
          </span>
        </div>
        <div className="w-full h-2 bg-ink-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-clay-500 rounded-full transition-all duration-1000"
            style={{ width: hasProfile ? "73%" : "0%" }}
          />
        </div>
        <p className="mt-2 text-2xs text-ink-400">
          {hasProfile
            ? "Lurk knows you at 73%. More email samples would improve tone accuracy."
            : "Click \"Analyze My Writing\" to build your voice profile from connected artifacts."}
        </p>
      </div>

      {/* Style Dimensions */}
      <div className="p-5 bg-white border border-ink-100 rounded-editorial">
        <h3 className="text-xs font-semibold text-ink-700 mb-4">Style Dimensions</h3>
        <div className="space-y-3">
          {dimensions.map((dim) => (
            <div key={dim.label} className="flex items-center gap-3">
              <span className="text-2xs text-ink-500 w-44 shrink-0">{dim.label}</span>
              <div className="flex-1 h-1.5 bg-ink-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-clay-400 rounded-full transition-all duration-500"
                  style={{ width: hasProfile ? `${dim.value * 100}%` : "0%" }}
                />
              </div>
              <span className="text-2xs font-medium text-ink-600 w-8 text-right">
                {hasProfile ? (dim.value * 100).toFixed(0) : "—"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Qualitative Patterns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-ink-100 rounded-editorial">
          <h4 className="text-2xs font-semibold text-ink-600 mb-2">Tone</h4>
          <div className="flex flex-wrap gap-1.5">
            {toneDescriptors.map((t) => (
              <span key={t} className={`px-2 py-0.5 rounded-full text-2xs font-medium ${
                hasProfile ? "bg-clay-50 text-clay-600 border border-clay-200" : "bg-ink-50 text-ink-300 border border-ink-100"
              }`}>
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="p-4 bg-white border border-ink-100 rounded-editorial">
          <h4 className="text-2xs font-semibold text-ink-600 mb-2">Patterns</h4>
          <ul className="space-y-1">
            {communicationPatterns.map((p) => (
              <li key={p} className={`text-2xs ${hasProfile ? "text-ink-500" : "text-ink-300"}`}>
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div className="p-4 bg-white border border-ink-100 rounded-editorial">
          <h4 className="text-2xs font-semibold text-ink-600 mb-2">Never Does</h4>
          <ul className="space-y-1">
            {avoidedPatterns.map((p) => (
              <li key={p} className={`text-2xs ${hasProfile ? "text-ink-500" : "text-ink-300"}`}>
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Training Sources */}
      <div className="p-4 bg-ivory border border-ink-100 rounded-editorial">
        <p className="text-2xs text-ink-400">
          <span className="font-medium text-ink-500">Training sources:</span>{" "}
          Voice profiles are built from your Google Docs, Gmail threads, and local files
          tracked by the desktop daemon. Only your own writing is analyzed — never shared content.
        </p>
      </div>
    </div>
  );
}
