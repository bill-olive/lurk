"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  Wand2,
  Settings,
  Target,
  Zap,
  ShieldCheck,
  Play,
  Save,
  ChevronRight,
  AlertTriangle,
  Check,
  Plus,
  X,
  Sparkles,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ── Types ────────────────────────────────────

type BuilderStep = "describe" | "configure" | "scope" | "triggers" | "guardrails" | "preview";

const steps: { id: BuilderStep; label: string; icon: React.ReactNode }[] = [
  { id: "describe", label: "Describe", icon: <Wand2 className="w-4 h-4" /> },
  { id: "configure", label: "Configure", icon: <Settings className="w-4 h-4" /> },
  { id: "scope", label: "Scope", icon: <Target className="w-4 h-4" /> },
  { id: "triggers", label: "Triggers", icon: <Zap className="w-4 h-4" /> },
  { id: "guardrails", label: "Guardrails", icon: <ShieldCheck className="w-4 h-4" /> },
  { id: "preview", label: "Preview", icon: <Play className="w-4 h-4" /> },
];

const agentTypes = [
  { id: "reviewer", label: "Reviewer", description: "Reviews and suggests changes to artifacts" },
  { id: "updater", label: "Updater", description: "Automatically updates stale content" },
  { id: "monitor", label: "Monitor", description: "Watches for issues and alerts" },
  { id: "generator", label: "Generator", description: "Creates new artifacts from templates" },
];

const artifactTypeOptions = [
  "Documents", "Snippets", "Presentations", "Spreadsheets",
  "Code Snippets", "Meeting Notes", "Emails", "API Specs",
  "Policies", "Runbooks", "RFCs",
];

const teamOptions = ["Engineering", "Sales", "Marketing", "Product", "Legal", "HR", "Customer Success", "Security"];

const sensitivityOptions = [
  { id: "public", label: "Public", description: "Non-sensitive content" },
  { id: "internal", label: "Internal", description: "Company internal only" },
  { id: "confidential", label: "Confidential", description: "Restricted access" },
  { id: "restricted", label: "Restricted", description: "Highest sensitivity" },
];

const triggerOptions = [
  { id: "on_create", label: "Artifact Created", description: "When a new artifact is added" },
  { id: "on_update", label: "Artifact Updated", description: "When an artifact is modified" },
  { id: "on_stale", label: "Staleness Detected", description: "When content becomes stale" },
  { id: "scheduled", label: "Scheduled", description: "On a recurring schedule" },
  { id: "on_request", label: "Manual Request", description: "When explicitly triggered" },
];

// ── Page ─────────────────────────────────────

export default function AgentBuilderPage() {
  const [currentStep, setCurrentStep] = useState<BuilderStep>("describe");
  const [description, setDescription] = useState("");
  const [agentName, setAgentName] = useState("");
  const [agentType, setAgentType] = useState("reviewer");
  const [model, setModel] = useState("claude-sonnet-4-20250514");
  const [selectedArtifactTypes, setSelectedArtifactTypes] = useState<string[]>(["Documents"]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [maxSensitivity, setMaxSensitivity] = useState("internal");
  const [selectedTriggers, setSelectedTriggers] = useState<string[]>(["on_update"]);
  const [cronSchedule, setCronSchedule] = useState("0 9 * * 1");
  const [budgetLimit, setBudgetLimit] = useState("50");
  const [confidenceThreshold, setConfidenceThreshold] = useState("0.85");
  const [yoloEnabled, setYoloEnabled] = useState(false);
  const [yoloThreshold, setYoloThreshold] = useState("0.95");
  const [maxPrsPerDay, setMaxPrsPerDay] = useState("10");
  const [testOutput, setTestOutput] = useState("");
  const [testing, setTesting] = useState(false);

  const stepIdx = steps.findIndex((s) => s.id === currentStep);

  const toggleArrayItem = (arr: string[], item: string, setter: (v: string[]) => void) => {
    setter(arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item]);
  };

  const runTest = () => {
    setTesting(true);
    setTestOutput("");
    setTimeout(() => {
      setTestOutput(
        `Agent "${agentName || "custom_agent"}" initialized successfully.

Configuration Summary:
- Type: ${agentType}
- Model: ${model}
- Artifact Scopes: ${selectedArtifactTypes.join(", ")}
- Team Scopes: ${selectedTeams.length > 0 ? selectedTeams.join(", ") : "All teams"}
- Triggers: ${selectedTriggers.join(", ")}
- Budget Limit: $${budgetLimit}/month
- Confidence Threshold: ${confidenceThreshold}
- YOLO Mode: ${yoloEnabled ? `Enabled (threshold: ${yoloThreshold})` : "Disabled"}

Test Run Results:
- Scanned 3 sample artifacts
- Found 2 potential improvements
- Generated 1 draft PR suggestion
- Estimated monthly cost: $12.40
- All guardrails passed

Ready for deployment.`
      );
      setTesting(false);
    }, 2500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/agents"
          className="inline-flex items-center gap-1 text-xs text-ink-300 hover:text-ink-700 transition-colors mb-2"
        >
          <ArrowLeft className="w-3 h-3" />
          Back to Agents
        </Link>
        <h1 className="text-xl font-bold text-ink-800 tracking-tight flex items-center gap-2">
          <Bot className="w-5 h-5 text-clay-500" />
          Custom Agent Builder
        </h1>
        <p className="text-sm text-ink-300 mt-1">
          Build a custom knowledge agent tailored to your needs
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-1 p-1 bg-white rounded-xl border border-ink-100">
        {steps.map((step, idx) => (
          <button
            key={step.id}
            onClick={() => setCurrentStep(step.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${
              currentStep === step.id
                ? "bg-clay-100 text-clay-500 border border-clay-500/30"
                : idx < stepIdx
                ? "text-olive-600 hover:bg-ink-50"
                : "text-ink-300 hover:bg-ink-50 hover:text-ink-700"
            }`}
          >
            {idx < stepIdx ? (
              <Check className="w-4 h-4" />
            ) : (
              step.icon
            )}
            <span className="hidden lg:inline">{step.label}</span>
          </button>
        ))}
      </div>

      {/* Step Content */}
      <div className="max-w-3xl">
        {/* Step 1: Describe */}
        {currentStep === "describe" && (
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Describe Your Agent</CardTitle>
                <CardDescription>
                  Tell us what you want your agent to do in natural language
                </CardDescription>
              </div>
            </CardHeader>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-ink-400 mb-1.5 block">
                  Agent Name
                </label>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="e.g., api_doc_reviewer"
                  className="input-base w-full font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-400 mb-1.5 block">
                  What should this agent do?
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what your agent should do in plain English. For example: 'Review all API documentation weekly and flag endpoints that have changed in code but not in docs. Suggest updates and open PRs for review.'"
                  rows={5}
                  className="input-base w-full resize-none"
                />
              </div>
              {description.length > 20 && (
                <div className="p-3 rounded-lg bg-clay-50 border border-clay-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-clay-500" />
                    <span className="text-xs font-medium text-clay-500">AI Suggestion</span>
                  </div>
                  <p className="text-xs text-ink-400">
                    Based on your description, we recommend the <strong className="text-ink-600">Reviewer</strong> agent type with <strong className="text-ink-600">Documents</strong> and <strong className="text-ink-600">API Specs</strong> artifact scopes. You can customize these in the next steps.
                  </p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Step 2: Configure */}
        {currentStep === "configure" && (
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Agent Configuration</CardTitle>
                <CardDescription>
                  Select the agent type and model
                </CardDescription>
              </div>
            </CardHeader>
            <div className="space-y-6">
              <div>
                <label className="text-xs font-medium text-ink-400 mb-3 block">Agent Type</label>
                <div className="grid grid-cols-2 gap-3">
                  {agentTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setAgentType(type.id)}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        agentType === type.id
                          ? "border-clay-500/40 bg-clay-50"
                          : "border-ink-100 hover:border-ink-200 hover:bg-ink-50/30"
                      }`}
                    >
                      <div className="text-sm font-medium text-ink-700">{type.label}</div>
                      <div className="text-xs text-ink-300 mt-1">{type.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-ink-400 mb-1.5 block">Model</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="input-base w-full"
                >
                  <option value="claude-sonnet-4-20250514">Claude Sonnet 4 (Recommended)</option>
                  <option value="claude-haiku-4-20250514">Claude Haiku 4 (Faster, cheaper)</option>
                  <option value="claude-opus-4-20250514">Claude Opus 4 (Most capable)</option>
                </select>
              </div>
            </div>
          </Card>
        )}

        {/* Step 3: Scope */}
        {currentStep === "scope" && (
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Scope Configuration</CardTitle>
                <CardDescription>
                  Define what this agent has access to
                </CardDescription>
              </div>
            </CardHeader>
            <div className="space-y-6">
              <div>
                <label className="text-xs font-medium text-ink-400 mb-3 block">Artifact Types</label>
                <div className="flex flex-wrap gap-2">
                  {artifactTypeOptions.map((type) => (
                    <button
                      key={type}
                      onClick={() => toggleArrayItem(selectedArtifactTypes, type, setSelectedArtifactTypes)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                        selectedArtifactTypes.includes(type)
                          ? "border-clay-500/40 bg-clay-50 text-clay-500"
                          : "border-ink-200 text-ink-300 hover:text-ink-700 hover:bg-ink-50"
                      }`}
                    >
                      {selectedArtifactTypes.includes(type) && <Check className="w-3 h-3 inline mr-1" />}
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-ink-400 mb-3 block">Team Scope</label>
                <div className="flex flex-wrap gap-2">
                  {teamOptions.map((team) => (
                    <button
                      key={team}
                      onClick={() => toggleArrayItem(selectedTeams, team, setSelectedTeams)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                        selectedTeams.includes(team)
                          ? "border-clay-500/40 bg-clay-50 text-clay-500"
                          : "border-ink-200 text-ink-300 hover:text-ink-700 hover:bg-ink-50"
                      }`}
                    >
                      {selectedTeams.includes(team) && <Check className="w-3 h-3 inline mr-1" />}
                      {team}
                    </button>
                  ))}
                </div>
                {selectedTeams.length === 0 && (
                  <p className="text-2xs text-ink-300 mt-2">No teams selected = all teams</p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-ink-400 mb-3 block">
                  Maximum Sensitivity Level
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {sensitivityOptions.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setMaxSensitivity(opt.id)}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        maxSensitivity === opt.id
                          ? "border-clay-500/40 bg-clay-50"
                          : "border-ink-100 hover:border-ink-200"
                      }`}
                    >
                      <div className="text-xs font-medium text-ink-700">{opt.label}</div>
                      <div className="text-2xs text-ink-300 mt-0.5">{opt.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Step 4: Triggers */}
        {currentStep === "triggers" && (
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Trigger Configuration</CardTitle>
                <CardDescription>
                  When should this agent run?
                </CardDescription>
              </div>
            </CardHeader>
            <div className="space-y-6">
              <div className="space-y-2">
                {triggerOptions.map((trigger) => (
                  <label
                    key={trigger.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedTriggers.includes(trigger.id)
                        ? "border-clay-500/40 bg-clay-50"
                        : "border-ink-100 hover:border-ink-200"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTriggers.includes(trigger.id)}
                      onChange={() => toggleArrayItem(selectedTriggers, trigger.id, setSelectedTriggers)}
                      className="mt-0.5 accent-clay-500"
                    />
                    <div>
                      <div className="text-sm font-medium text-ink-700">{trigger.label}</div>
                      <div className="text-xs text-ink-300 mt-0.5">{trigger.description}</div>
                    </div>
                  </label>
                ))}
              </div>

              {selectedTriggers.includes("scheduled") && (
                <div>
                  <label className="text-xs font-medium text-ink-400 mb-1.5 block">
                    Cron Schedule
                  </label>
                  <input
                    type="text"
                    value={cronSchedule}
                    onChange={(e) => setCronSchedule(e.target.value)}
                    className="input-base w-full font-mono"
                    placeholder="0 9 * * 1"
                  />
                  <p className="text-2xs text-ink-300 mt-1">
                    Current: Every Monday at 9:00 AM
                  </p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Step 5: Guardrails */}
        {currentStep === "guardrails" && (
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Guardrails</CardTitle>
                <CardDescription>
                  Set safety limits and thresholds
                </CardDescription>
              </div>
            </CardHeader>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-ink-400 mb-1.5 block">
                    Monthly Budget Limit ($)
                  </label>
                  <input
                    type="number"
                    value={budgetLimit}
                    onChange={(e) => setBudgetLimit(e.target.value)}
                    className="input-base w-full"
                    min="1"
                    max="10000"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-ink-400 mb-1.5 block">
                    Confidence Threshold
                  </label>
                  <input
                    type="number"
                    value={confidenceThreshold}
                    onChange={(e) => setConfidenceThreshold(e.target.value)}
                    className="input-base w-full"
                    min="0"
                    max="1"
                    step="0.05"
                  />
                  <p className="text-2xs text-ink-300 mt-1">
                    Agent must be at least {(parseFloat(confidenceThreshold) * 100).toFixed(0)}% confident to act
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-ink-400 mb-1.5 block">
                  Max PRs Per Day
                </label>
                <input
                  type="number"
                  value={maxPrsPerDay}
                  onChange={(e) => setMaxPrsPerDay(e.target.value)}
                  className="input-base w-40"
                  min="1"
                  max="100"
                />
              </div>

              <div className="p-4 rounded-xl border border-ink-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-ink-700 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-accent-yellow" />
                      YOLO Mode
                    </div>
                    <div className="text-xs text-ink-300 mt-0.5">
                      Auto-merge PRs above the confidence threshold
                    </div>
                  </div>
                  <button
                    onClick={() => setYoloEnabled(!yoloEnabled)}
                    className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
                      yoloEnabled ? "bg-yellow-500" : "bg-ink-200"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                        yoloEnabled ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>

                {yoloEnabled && (
                  <div>
                    <label className="text-xs font-medium text-ink-400 mb-1.5 block">
                      YOLO Confidence Threshold
                    </label>
                    <input
                      type="number"
                      value={yoloThreshold}
                      onChange={(e) => setYoloThreshold(e.target.value)}
                      className="input-base w-40"
                      min="0.8"
                      max="1"
                      step="0.01"
                    />
                    <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-yellow-50 border border-yellow-200">
                      <AlertTriangle className="w-3.5 h-3.5 text-accent-yellow shrink-0" />
                      <p className="text-2xs text-accent-yellow">
                        YOLO mode will auto-merge without human review. Use with caution.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Step 6: Preview */}
        {currentStep === "preview" && (
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Test Sandbox Preview</CardTitle>
                <CardDescription>
                  Test your agent configuration before deploying
                </CardDescription>
              </div>
            </CardHeader>
            <div className="space-y-6">
              {/* Config Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-2xs text-ink-300">Name</label>
                    <p className="text-sm text-ink-700 font-mono">{agentName || "custom_agent"}</p>
                  </div>
                  <div>
                    <label className="text-2xs text-ink-300">Type</label>
                    <p className="text-sm text-ink-700 capitalize">{agentType}</p>
                  </div>
                  <div>
                    <label className="text-2xs text-ink-300">Model</label>
                    <p className="text-sm text-ink-700 font-mono">{model}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-2xs text-ink-300">Artifact Types</label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedArtifactTypes.map((t) => (
                        <Badge key={t} variant="outline" size="sm">{t}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-2xs text-ink-300">Triggers</label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedTriggers.map((t) => (
                        <Badge key={t} variant="info" size="sm">{t}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Test Area */}
              <div className="border-t border-ink-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-ink-700">Sandbox Test</h4>
                  <Button
                    size="sm"
                    icon={<Play className="w-3.5 h-3.5" />}
                    loading={testing}
                    onClick={runTest}
                  >
                    Run Test
                  </Button>
                </div>
                {testOutput ? (
                  <pre className="p-4 rounded-lg bg-ink-50 border border-ink-100 text-xs text-ink-600 font-mono whitespace-pre-wrap overflow-x-auto">
                    {testOutput}
                  </pre>
                ) : (
                  <div className="p-8 rounded-lg bg-ink-50 border border-ink-100 text-center">
                    <p className="text-sm text-ink-300">
                      Click &quot;Run Test&quot; to preview your agent on sample data
                    </p>
                  </div>
                )}
              </div>

              {/* Deploy */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-ink-100">
                <Button variant="secondary" icon={<Save className="w-3.5 h-3.5" />}>
                  Save Draft
                </Button>
                <Button icon={<Sparkles className="w-3.5 h-3.5" />}>
                  Deploy Agent
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Step Navigation */}
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="ghost"
            size="sm"
            disabled={stepIdx === 0}
            onClick={() => setCurrentStep(steps[stepIdx - 1]?.id ?? "describe")}
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Previous
          </Button>
          {stepIdx < steps.length - 1 && (
            <Button
              size="sm"
              onClick={() => setCurrentStep(steps[stepIdx + 1]?.id ?? "preview")}
              iconRight={<ChevronRight className="w-3.5 h-3.5" />}
            >
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
