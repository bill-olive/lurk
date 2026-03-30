"use client";

import { useState } from "react";
import {
  Users,
  Plus,
  Search,
  Settings,
  Shield,
  UserPlus,
  MoreVertical,
  Mail,
  Crown,
  X,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from "@/components/ui/table";
import { Tabs, TabPanel } from "@/components/ui/tabs";

// ── Types ────────────────────────────────────

interface Team {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  policy: string;
  agents: string[];
  createdAt: string;
}

interface Member {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member" | "viewer";
  teams: string[];
  lastActive: string;
  avatarUrl?: string;
}

// ── Mock Data ────────────────────────────────

const teams: Team[] = [
  {
    id: "team_1",
    name: "Engineering",
    description: "Core product engineering team",
    memberCount: 18,
    policy: "Standard access + code artifacts",
    agents: ["eng_standards", "security"],
    createdAt: "2025-06-15",
  },
  {
    id: "team_2",
    name: "Sales",
    description: "Sales and business development",
    memberCount: 12,
    policy: "Customer data access + CRM integration",
    agents: ["sales_ops", "customer_success"],
    createdAt: "2025-06-15",
  },
  {
    id: "team_3",
    name: "Marketing",
    description: "Brand, content, and growth marketing",
    memberCount: 8,
    policy: "Public content + brand guidelines",
    agents: ["brand_consistency"],
    createdAt: "2025-07-02",
  },
  {
    id: "team_4",
    name: "Legal & Compliance",
    description: "Legal, compliance, and regulatory affairs",
    memberCount: 4,
    policy: "Full access + audit trail",
    agents: ["compliance"],
    createdAt: "2025-08-10",
  },
  {
    id: "team_5",
    name: "Customer Success",
    description: "Account management and customer support",
    memberCount: 9,
    policy: "Customer data + support artifacts",
    agents: ["customer_success"],
    createdAt: "2025-09-01",
  },
  {
    id: "team_6",
    name: "Product",
    description: "Product management and design",
    memberCount: 6,
    policy: "Standard access",
    agents: [],
    createdAt: "2025-09-20",
  },
];

const members: Member[] = [
  { id: "m1", name: "Sarah Chen", email: "sarah@acme.com", role: "owner", teams: ["Engineering", "Product"], lastActive: "2 min ago" },
  { id: "m2", name: "Mike Johnson", email: "mike@acme.com", role: "admin", teams: ["Engineering"], lastActive: "15 min ago" },
  { id: "m3", name: "Alex Rivera", email: "alex@acme.com", role: "admin", teams: ["Sales", "Customer Success"], lastActive: "1 hr ago" },
  { id: "m4", name: "Jordan Lee", email: "jordan@acme.com", role: "member", teams: ["Marketing"], lastActive: "3 hr ago" },
  { id: "m5", name: "Casey Taylor", email: "casey@acme.com", role: "member", teams: ["Legal & Compliance"], lastActive: "30 min ago" },
  { id: "m6", name: "Pat Morgan", email: "pat@acme.com", role: "member", teams: ["Engineering", "Product"], lastActive: "1 day ago" },
  { id: "m7", name: "Sam Williams", email: "sam@acme.com", role: "viewer", teams: ["Sales"], lastActive: "2 days ago" },
  { id: "m8", name: "Drew Kim", email: "drew@acme.com", role: "member", teams: ["Customer Success"], lastActive: "5 hr ago" },
];

const roleColors = {
  owner: "danger" as const,
  admin: "warning" as const,
  member: "info" as const,
  viewer: "default" as const,
};

// ── Page ─────────────────────────────────────

export default function TeamsPage() {
  const [activeTab, setActiveTab] = useState("teams");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDesc, setNewTeamDesc] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteTeam, setInviteTeam] = useState("");

  const filteredMembers = members.filter(
    (m) =>
      !searchQuery ||
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tabs = [
    { id: "teams", label: "Teams", count: teams.length },
    { id: "members", label: "Members", count: members.length },
    { id: "policies", label: "Group Policies" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-800 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-clay-500" />
            Teams & Access
          </h1>
          <p className="text-sm text-ink-300 mt-1">
            Manage teams, members, and access policies
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<UserPlus className="w-3.5 h-3.5" />}
            onClick={() => setShowInvite(true)}
          >
            Invite Member
          </Button>
          <Button
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setShowCreateTeam(true)}
          >
            Create Team
          </Button>
        </div>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Teams Tab */}
      <TabPanel id="teams" activeTab={activeTab}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-6">
          {teams.map((team) => (
            <Card key={team.id} hover>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-ink-700">
                    {team.name}
                  </h3>
                  <p className="text-xs text-ink-300 mt-0.5">
                    {team.description}
                  </p>
                </div>
                <button className="p-1 rounded hover:bg-ink-50 text-ink-300 transition-colors">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-300">Members</span>
                  <span className="text-ink-600 font-medium">{team.memberCount}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-300">Policy</span>
                  <span className="text-ink-600">{team.policy}</span>
                </div>
              </div>

              {team.agents.length > 0 && (
                <div className="pt-3 border-t border-ink-100">
                  <span className="text-2xs text-ink-300 uppercase tracking-wider">
                    Active Agents
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {team.agents.map((agent) => (
                      <Badge key={agent} variant="purple" size="sm">
                        {agent}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      </TabPanel>

      {/* Members Tab */}
      <TabPanel id="members" activeTab={activeTab}>
        <div className="mt-6">
          <div className="relative max-w-sm mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" />
            <input
              type="text"
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-base pl-9 w-full"
            />
          </div>

          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>Member</TableHeaderCell>
                <TableHeaderCell>Role</TableHeaderCell>
                <TableHeaderCell>Teams</TableHeaderCell>
                <TableHeaderCell>Last Active</TableHeaderCell>
                <TableHeaderCell className="w-12"></TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {filteredMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-clay-100 flex items-center justify-center text-xs font-medium text-clay-500">
                        {member.name.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-ink-700">
                          {member.name}
                        </div>
                        <div className="text-xs text-ink-300">{member.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={roleColors[member.role]} size="sm">
                      {member.role === "owner" && <Crown className="w-3 h-3 mr-0.5" />}
                      {member.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {member.teams.map((t) => (
                        <Badge key={t} variant="outline" size="sm">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-ink-300">{member.lastActive}</span>
                  </TableCell>
                  <TableCell>
                    <button className="p-1 rounded hover:bg-ink-50 text-ink-300 transition-colors">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </TabPanel>

      {/* Group Policies Tab */}
      <TabPanel id="policies" activeTab={activeTab}>
        <div className="mt-6 space-y-4">
          {teams.map((team) => (
            <Card key={team.id}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-ink-50 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-clay-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-ink-700">
                      {team.name}
                    </h3>
                    <p className="text-xs text-ink-300">{team.policy}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" icon={<Settings className="w-3.5 h-3.5" />}>
                  Configure
                </Button>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div className="p-3 rounded-lg bg-ink-50">
                  <div className="text-2xs text-ink-300 mb-1">Content Access</div>
                  <div className="text-sm text-ink-600">Team-scoped</div>
                </div>
                <div className="p-3 rounded-lg bg-ink-50">
                  <div className="text-2xs text-ink-300 mb-1">Redaction Level</div>
                  <div className="text-sm text-ink-600">Standard</div>
                </div>
                <div className="p-3 rounded-lg bg-ink-50">
                  <div className="text-2xs text-ink-300 mb-1">Agent Permissions</div>
                  <div className="text-sm text-ink-600">
                    {team.agents.length > 0 ? `${team.agents.length} active` : "None assigned"}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </TabPanel>

      {/* Create Team Modal */}
      <Modal
        open={showCreateTeam}
        onClose={() => setShowCreateTeam(false)}
        title="Create New Team"
        description="Teams organize members and set shared policies"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreateTeam(false)}>Cancel</Button>
            <Button onClick={() => setShowCreateTeam(false)}>Create Team</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-ink-400 mb-1.5 block">Team Name</label>
            <input
              type="text"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="e.g., Data Science"
              className="input-base w-full"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-400 mb-1.5 block">Description</label>
            <textarea
              value={newTeamDesc}
              onChange={(e) => setNewTeamDesc(e.target.value)}
              placeholder="What does this team do?"
              rows={3}
              className="input-base w-full resize-none"
            />
          </div>
        </div>
      </Modal>

      {/* Invite Modal */}
      <Modal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        title="Invite Member"
        description="Send an invitation to join the organization"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowInvite(false)}>Cancel</Button>
            <Button icon={<Mail className="w-3.5 h-3.5" />} onClick={() => setShowInvite(false)}>
              Send Invite
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-ink-400 mb-1.5 block">Email Address</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              className="input-base w-full"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-400 mb-1.5 block">Role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="input-base w-full"
            >
              <option value="viewer">Viewer</option>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-ink-400 mb-1.5 block">Assign to Team</label>
            <select
              value={inviteTeam}
              onChange={(e) => setInviteTeam(e.target.value)}
              className="input-base w-full"
            >
              <option value="">No team (assign later)</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
