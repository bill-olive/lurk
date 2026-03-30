"use client";

import { useState } from "react";
import {
  HeartPulse,
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Bell,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Eye,
  Lightbulb,
  Activity,
  Users,
  MessageSquare,
  Calendar,
  ArrowUpRight,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { StatCard } from "@/components/ui/stat-card";

// ── Types ────────────────────────────────────

interface Customer {
  id: string;
  name: string;
  healthScore: number;
  trend: "up" | "down" | "flat";
  trendDelta: number;
  alertLevel: "healthy" | "at_risk" | "critical" | "churned";
  arr: string;
  contacts: number;
  lastEngagement: string;
  renewalDate: string;
  signals: {
    engagement: number;
    adoption: number;
    satisfaction: number;
    support: number;
    expansion: number;
  };
  recommendations: string[];
}

interface Alert {
  id: string;
  customer: string;
  type: "churn_risk" | "engagement_drop" | "support_spike" | "expansion_signal" | "renewal_upcoming";
  message: string;
  severity: "high" | "medium" | "low";
  createdAt: string;
  acknowledged: boolean;
}

// ── Mock Data ────────────────────────────────

const customers: Customer[] = [
  {
    id: "cust_1", name: "Acme Corp", healthScore: 92, trend: "up", trendDelta: 5,
    alertLevel: "healthy", arr: "$240K", contacts: 12, lastEngagement: "Today",
    renewalDate: "2026-09-15",
    signals: { engagement: 95, adoption: 88, satisfaction: 90, support: 96, expansion: 85 },
    recommendations: ["Schedule QBR for Q2", "Introduce new analytics feature", "Expand to marketing team"],
  },
  {
    id: "cust_2", name: "TechStart Inc", healthScore: 78, trend: "down", trendDelta: -8,
    alertLevel: "at_risk", arr: "$120K", contacts: 6, lastEngagement: "3 days ago",
    renewalDate: "2026-06-30",
    signals: { engagement: 72, adoption: 65, satisfaction: 82, support: 88, expansion: 60 },
    recommendations: ["Urgent: Schedule check-in call", "Review onboarding completion", "Assign dedicated CSM"],
  },
  {
    id: "cust_3", name: "GlobalBank Ltd", healthScore: 85, trend: "up", trendDelta: 3,
    alertLevel: "healthy", arr: "$480K", contacts: 28, lastEngagement: "Yesterday",
    renewalDate: "2026-12-01",
    signals: { engagement: 88, adoption: 80, satisfaction: 85, support: 92, expansion: 78 },
    recommendations: ["Propose enterprise tier upgrade", "Compliance feature demo", "Expand to APAC offices"],
  },
  {
    id: "cust_4", name: "Retail Plus", healthScore: 45, trend: "down", trendDelta: -18,
    alertLevel: "critical", arr: "$90K", contacts: 4, lastEngagement: "2 weeks ago",
    renewalDate: "2026-05-01",
    signals: { engagement: 30, adoption: 42, satisfaction: 55, support: 48, expansion: 20 },
    recommendations: ["CRITICAL: Executive escalation needed", "Offer extended trial of premium features", "Schedule emergency health review"],
  },
  {
    id: "cust_5", name: "MedTech Solutions", healthScore: 88, trend: "flat", trendDelta: 0,
    alertLevel: "healthy", arr: "$200K", contacts: 15, lastEngagement: "Today",
    renewalDate: "2026-11-01",
    signals: { engagement: 90, adoption: 85, satisfaction: 88, support: 94, expansion: 82 },
    recommendations: ["Introduce HIPAA compliance module", "Schedule product feedback session"],
  },
  {
    id: "cust_6", name: "EduLearn Co", healthScore: 62, trend: "down", trendDelta: -5,
    alertLevel: "at_risk", arr: "$60K", contacts: 3, lastEngagement: "1 week ago",
    renewalDate: "2026-07-15",
    signals: { engagement: 58, adoption: 55, satisfaction: 70, support: 65, expansion: 45 },
    recommendations: ["Review usage patterns", "Offer training sessions", "Connect with decision maker"],
  },
  {
    id: "cust_7", name: "CloudOps Ltd", healthScore: 95, trend: "up", trendDelta: 2,
    alertLevel: "healthy", arr: "$360K", contacts: 20, lastEngagement: "Today",
    renewalDate: "2027-01-15",
    signals: { engagement: 98, adoption: 92, satisfaction: 95, support: 97, expansion: 90 },
    recommendations: ["Explore strategic partnership", "Invite to customer advisory board"],
  },
  {
    id: "cust_8", name: "FinServ Group", healthScore: 15, trend: "down", trendDelta: -25,
    alertLevel: "churned", arr: "$0", contacts: 1, lastEngagement: "45 days ago",
    renewalDate: "2026-03-01",
    signals: { engagement: 5, adoption: 10, satisfaction: 20, support: 15, expansion: 0 },
    recommendations: ["Win-back campaign", "Post-mortem analysis", "Document lessons learned"],
  },
];

const alerts: Alert[] = [
  { id: "al1", customer: "Retail Plus", type: "churn_risk", message: "Health score dropped 18 points in 2 weeks. No engagement in 14 days.", severity: "high", createdAt: "2 hours ago", acknowledged: false },
  { id: "al2", customer: "TechStart Inc", type: "engagement_drop", message: "Active users decreased 40% month-over-month.", severity: "high", createdAt: "6 hours ago", acknowledged: false },
  { id: "al3", customer: "EduLearn Co", type: "renewal_upcoming", message: "Renewal in 108 days. Health score below target (62/80).", severity: "medium", createdAt: "1 day ago", acknowledged: true },
  { id: "al4", customer: "CloudOps Ltd", type: "expansion_signal", message: "Usage increased 35%. Multiple new team invites detected.", severity: "low", createdAt: "1 day ago", acknowledged: false },
  { id: "al5", customer: "Acme Corp", type: "expansion_signal", message: "Requested API access for marketing team.", severity: "low", createdAt: "2 days ago", acknowledged: true },
];

const alertLevelColors = {
  healthy: "success" as const,
  at_risk: "warning" as const,
  critical: "danger" as const,
  churned: "default" as const,
};

const trendIcons = {
  up: <TrendingUp className="w-3.5 h-3.5 text-olive-600" />,
  down: <TrendingDown className="w-3.5 h-3.5 text-accent-red" />,
  flat: <Minus className="w-3.5 h-3.5 text-ink-400" />,
};

const alertTypeIcons = {
  churn_risk: <XCircle className="w-4 h-4 text-accent-red" />,
  engagement_drop: <TrendingDown className="w-4 h-4 text-accent-yellow" />,
  support_spike: <AlertTriangle className="w-4 h-4 text-orange-600" />,
  expansion_signal: <ArrowUpRight className="w-4 h-4 text-olive-600" />,
  renewal_upcoming: <Calendar className="w-4 h-4 text-accent-blue" />,
};

const healthHistory = [
  { month: "Oct", score: 78 },
  { month: "Nov", score: 80 },
  { month: "Dec", score: 82 },
  { month: "Jan", score: 79 },
  { month: "Feb", score: 83 },
  { month: "Mar", score: 85 },
];

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload) return null;
  return (
    <div className="bg-white border border-ink-200 rounded-lg px-3 py-2 shadow-warm text-xs">
      <p className="text-ink-400">{label}</p>
      <p className="text-ink-700 font-medium">Score: {payload[0].value}</p>
    </div>
  );
}

// ── Page ─────────────────────────────────────

export default function CustomerHealthPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [alertFilter, setAlertFilter] = useState("all");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showAlerts, setShowAlerts] = useState(false);

  const healthy = customers.filter((c) => c.alertLevel === "healthy").length;
  const atRisk = customers.filter((c) => c.alertLevel === "at_risk").length;
  const critical = customers.filter((c) => c.alertLevel === "critical").length;
  const unacknowledgedAlerts = alerts.filter((a) => !a.acknowledged).length;

  const filteredCustomers = customers.filter((c) => {
    if (alertFilter !== "all" && c.alertLevel !== alertFilter) return false;
    if (searchQuery) return c.name.toLowerCase().includes(searchQuery.toLowerCase());
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-800 tracking-tight flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-clay-400" />
            Customer Health
          </h1>
          <p className="text-sm text-ink-300 mt-1">
            Monitor customer health scores, trends, and risk signals
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<Bell className="w-3.5 h-3.5" />}
          onClick={() => setShowAlerts(true)}
        >
          Alerts
          {unacknowledgedAlerts > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-2xs">
              {unacknowledgedAlerts}
            </span>
          )}
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="Avg Health Score"
          value={Math.round(customers.reduce((s, c) => s + c.healthScore, 0) / customers.length)}
          trend="up"
          trendValue="+3.2"
          icon={<HeartPulse className="w-4 h-4" />}
        />
        <StatCard
          label="Healthy"
          value={healthy}
          icon={<CheckCircle2 className="w-4 h-4" />}
          variant="success"
        />
        <StatCard
          label="At Risk"
          value={atRisk}
          icon={<AlertTriangle className="w-4 h-4" />}
          variant="warning"
        />
        <StatCard
          label="Critical"
          value={critical}
          icon={<XCircle className="w-4 h-4" />}
          variant="danger"
        />
        <StatCard
          label="Total ARR"
          value="$1.55M"
          trend="up"
          trendValue="+12%"
          icon={<Activity className="w-4 h-4" />}
        />
      </div>

      {/* Health Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Health Trend</CardTitle>
          <span className="text-xs text-ink-300">Last 6 months</span>
        </CardHeader>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={healthHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e28" />
              <XAxis dataKey="month" tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis domain={[60, 100]} tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} dot={{ fill: "#6366f1", r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Customer List */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" />
            <input
              type="text"
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-base pl-9 w-full"
            />
          </div>
          <select value={alertFilter} onChange={(e) => setAlertFilter(e.target.value)} className="input-base">
            <option value="all">All Levels</option>
            <option value="healthy">Healthy</option>
            <option value="at_risk">At Risk</option>
            <option value="critical">Critical</option>
            <option value="churned">Churned</option>
          </select>
        </div>

        <div className="space-y-2">
          {filteredCustomers.map((customer) => (
            <Card
              key={customer.id}
              hover
              onClick={() => setSelectedCustomer(customer)}
              padding="sm"
            >
              <div className="flex items-center gap-4 p-2">
                {/* Health Score */}
                <div className="w-14 h-14 rounded-xl bg-ink-50 flex flex-col items-center justify-center shrink-0">
                  <span
                    className={`text-lg font-bold ${
                      customer.healthScore >= 80
                        ? "text-olive-600"
                        : customer.healthScore >= 60
                        ? "text-accent-yellow"
                        : customer.healthScore >= 30
                        ? "text-accent-red"
                        : "text-ink-300"
                    }`}
                  >
                    {customer.healthScore}
                  </span>
                  <span className="text-2xs text-ink-300">score</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-ink-700">{customer.name}</h3>
                    <Badge variant={alertLevelColors[customer.alertLevel]} dot size="sm">
                      {customer.alertLevel.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-ink-300">
                    <span>ARR: {customer.arr}</span>
                    <span>{customer.contacts} contacts</span>
                    <span>Last engaged: {customer.lastEngagement}</span>
                    <span>Renewal: {customer.renewalDate}</span>
                  </div>
                </div>

                {/* Trend */}
                <div className="flex items-center gap-2 shrink-0">
                  {trendIcons[customer.trend]}
                  <span
                    className={`text-xs font-medium ${
                      customer.trendDelta > 0
                        ? "text-olive-600"
                        : customer.trendDelta < 0
                        ? "text-accent-red"
                        : "text-ink-400"
                    }`}
                  >
                    {customer.trendDelta > 0 ? "+" : ""}{customer.trendDelta}
                  </span>
                  <ChevronRight className="w-4 h-4 text-ink-300" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <Modal
          open={!!selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          title={selectedCustomer.name}
          description={`Health Score: ${selectedCustomer.healthScore} / 100`}
          size="lg"
          footer={
            <Button variant="ghost" onClick={() => setSelectedCustomer(null)}>Close</Button>
          }
        >
          <div className="space-y-6">
            {/* Signal Breakdown */}
            <div>
              <h4 className="text-xs font-semibold text-ink-300 uppercase tracking-wider mb-3">
                Signal Breakdown
              </h4>
              <div className="space-y-3">
                {Object.entries(selectedCustomer.signals).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-xs text-ink-400 w-24 capitalize">{key}</span>
                    <div className="flex-1 h-2 rounded-full bg-ink-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          value >= 80 ? "bg-olive-500" : value >= 60 ? "bg-accent-yellow" : "bg-accent-red"
                        }`}
                        style={{ width: `${value}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-ink-600 w-8 text-right">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-4 gap-4 pt-4 border-t border-ink-100">
              <div className="text-center p-3 rounded-lg bg-ink-50/50">
                <div className="text-lg font-bold text-ink-800">{selectedCustomer.arr}</div>
                <div className="text-2xs text-ink-300">ARR</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-ink-50/50">
                <div className="text-lg font-bold text-ink-800">{selectedCustomer.contacts}</div>
                <div className="text-2xs text-ink-300">Contacts</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-ink-50/50">
                <div className="text-lg font-bold text-ink-800">{selectedCustomer.lastEngagement}</div>
                <div className="text-2xs text-ink-300">Last Engaged</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-ink-50/50">
                <div className="text-lg font-bold text-ink-800">{selectedCustomer.renewalDate}</div>
                <div className="text-2xs text-ink-300">Renewal</div>
              </div>
            </div>

            {/* Recommendations */}
            <div className="pt-4 border-t border-ink-100">
              <h4 className="text-xs font-semibold text-ink-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Lightbulb className="w-3.5 h-3.5 text-accent-yellow" />
                Recommendations
              </h4>
              <div className="space-y-2">
                {selectedCustomer.recommendations.map((rec, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-ink-50/30">
                    <span className="text-xs text-clay-400 font-mono shrink-0">{idx + 1}.</span>
                    <span className="text-sm text-ink-600">{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Alerts Modal */}
      <Modal
        open={showAlerts}
        onClose={() => setShowAlerts(false)}
        title="Customer Alerts"
        description={`${unacknowledgedAlerts} unacknowledged alerts`}
        size="lg"
        footer={
          <Button variant="ghost" onClick={() => setShowAlerts(false)}>Close</Button>
        }
      >
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                alert.acknowledged
                  ? "border-ink-100/40 opacity-60"
                  : "border-ink-100 hover:bg-ink-50/30"
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {alertTypeIcons[alert.type]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink-700">{alert.customer}</span>
                  <Badge
                    variant={alert.severity === "high" ? "danger" : alert.severity === "medium" ? "warning" : "default"}
                    size="sm"
                  >
                    {alert.severity}
                  </Badge>
                  {alert.acknowledged && (
                    <Badge variant="default" size="sm">Acknowledged</Badge>
                  )}
                </div>
                <p className="text-xs text-ink-300 mt-0.5">{alert.message}</p>
                <span className="text-2xs text-ink-300 mt-1 block">{alert.createdAt}</span>
              </div>
              {!alert.acknowledged && (
                <Button variant="ghost" size="xs">Acknowledge</Button>
              )}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
