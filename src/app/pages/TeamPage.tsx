import { useState } from "react";
import { Mail, MoreHorizontal, UserPlus, Shield, Eye, Pencil } from "lucide-react";
import { PageHeader } from "../components/shared/PageHeader";
import { useAgent } from "../context/AgentContext";

type TeamRole = "Admin" | "Editor" | "Viewer";
type InviteStatus = "active" | "pending";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  status: InviteStatus;
  agentAccess: string; // "All agents" or comma-separated names
  invitedAt: string;
}

const SEED: TeamMember[] = [
  {
    id: "u1",
    name: "Priya Mehta",
    email: "priya@spicegarden.com",
    role: "Admin",
    status: "active",
    agentAccess: "All agents",
    invitedAt: "Jan 12, 2026",
  },
  {
    id: "u2",
    name: "Arjun Kapoor",
    email: "arjun@spicegarden.com",
    role: "Editor",
    status: "active",
    agentAccess: "Restaurant Ordering",
    invitedAt: "Feb 3, 2026",
  },
  {
    id: "u3",
    name: "Neha Sharma",
    email: "neha@spicegarden.com",
    role: "Viewer",
    status: "active",
    agentAccess: "Restaurant Ordering, AI Feedback",
    invitedAt: "Mar 18, 2026",
  },
  {
    id: "u4",
    name: "Pending invite",
    email: "ops@spicegarden.com",
    role: "Editor",
    status: "pending",
    agentAccess: "All agents",
    invitedAt: "Aug 18, 2026",
  },
];

const ROLE_META: Record<TeamRole, { icon: typeof Shield; color: string; bg: string }> = {
  Admin:  { icon: Shield, color: "#50381F", bg: "#EDE4D8" },
  Editor: { icon: Pencil, color: "#2563EB", bg: "#DBEAFE" },
  Viewer: { icon: Eye,    color: "#7A746C", bg: "#F0EDE8" },
};

export function TeamPage() {
  const { agentDefs } = useAgent();
  const [members, setMembers] = useState<TeamMember[]>(SEED);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("Viewer");
  const [agentScope, setAgentScope] = useState<"all" | string>("all");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [auditLog, setAuditLog] = useState<{ id: string; at: string; text: string }[]>([
    { id: "a1", at: "Aug 18, 2026 10:12", text: "Invited ops@spicegarden.com as Editor" },
    { id: "a2", at: "Mar 18, 2026 14:02", text: "Set Neha Sharma role to Viewer" },
  ]);

  const pushAudit = (text: string) => {
    const at = new Date().toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
    setAuditLog((prev) => [{ id: `a-${Date.now()}`, at, text }, ...prev].slice(0, 20));
  };

  const handleInvite = () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) return;

    const access =
      agentScope === "all"
        ? "All agents"
        : agentDefs.find((a) => a.id === agentScope)?.name ?? "Selected agent";

    setMembers((prev) => [
      {
        id: `u-${Date.now()}`,
        name: "Pending invite",
        email: trimmed,
        role,
        status: "pending",
        agentAccess: access,
        invitedAt: new Date().toLocaleDateString("en-US", {
          month: "short", day: "numeric", year: "numeric",
        }),
      },
      ...prev,
    ]);
    pushAudit(`Invited ${trimmed} as ${role} (${access})`);
    setEmail("");
    setRole("Viewer");
    setAgentScope("all");
    setInviteOpen(false);
  };

  const setMemberRole = (id: string, next: TeamRole) => {
    const member = members.find((m) => m.id === id);
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role: next } : m)));
    if (member) pushAudit(`Changed ${member.email} role ${member.role} → ${next}`);
    setMenuId(null);
  };

  const deactivate = (id: string) => {
    const member = members.find((m) => m.id === id);
    setMembers((prev) => prev.filter((m) => m.id !== id));
    if (member) pushAudit(`Removed ${member.email}`);
    setMenuId(null);
  };

  return (
    <div>
      <PageHeader
        title="Team & User Management"
        subtitle="Invite users, assign roles, and restrict access to specific agents"
        action={
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border-none bg-[#50381F] text-white text-[13px] font-semibold cursor-pointer hover:bg-[#3D2914]"
          >
            <UserPlus size={14} />
            Invite user
          </button>
        }
      />

      <div className="rounded-xl border border-[#E2DDD5] bg-white overflow-hidden">
        <table className="w-full border-collapse text-[13px]">
          <thead className="bg-[#F7F4EF]">
            <tr className="border-b border-[#E2DDD5]">
              <th className="text-left text-[11px] font-bold text-[#7A746C] uppercase tracking-wider px-5 py-3">User</th>
              <th className="text-left text-[11px] font-bold text-[#7A746C] uppercase tracking-wider px-4 py-3">Role</th>
              <th className="text-left text-[11px] font-bold text-[#7A746C] uppercase tracking-wider px-4 py-3">Status</th>
              <th className="text-left text-[11px] font-bold text-[#7A746C] uppercase tracking-wider px-4 py-3">Agent access</th>
              <th className="text-left text-[11px] font-bold text-[#7A746C] uppercase tracking-wider px-4 py-3">Invited</th>
              <th className="w-10 px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => {
              const meta = ROLE_META[m.role];
              const RoleIcon = meta.icon;
              return (
                <tr
                  key={m.id}
                  className={i < members.length - 1 ? "border-b border-[#F0EDE8]" : ""}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-[#EDE4D8] flex items-center justify-center text-[11px] font-bold text-[#50381F] uppercase">
                        {m.status === "pending" ? <Mail size={13} /> : m.name[0]}
                      </div>
                      <div>
                        <div className="font-semibold text-[#1E1A14]">{m.name}</div>
                        <div className="text-[12px] text-[#9E9890]">{m.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full"
                      style={{ color: meta.color, backgroundColor: meta.bg }}
                    >
                      <RoleIcon size={11} />
                      {m.role}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    {m.status === "active" ? (
                      <span className="text-[11px] font-bold text-[#15803D] bg-[#DCFCE7] px-2.5 py-1 rounded-full">Active</span>
                    ) : (
                      <span className="text-[11px] font-bold text-[#92400E] bg-[#FEF3C7] px-2.5 py-1 rounded-full">Pending</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-[#4A453E] text-[12px] max-w-[200px] truncate">{m.agentAccess}</td>
                  <td className="px-4 py-3.5 text-[#9E9890] text-[12px]">{m.invitedAt}</td>
                  <td className="px-3 py-3.5 relative">
                    <button
                      type="button"
                      onClick={() => setMenuId(menuId === m.id ? null : m.id)}
                      className="h-8 w-8 flex items-center justify-center rounded-lg border-none bg-transparent hover:bg-[#F0EDE8] cursor-pointer"
                      aria-label="Member actions"
                    >
                      <MoreHorizontal size={16} color="#7A746C" />
                    </button>
                    {menuId === m.id && (
                      <div className="absolute right-3 top-10 z-20 w-44 rounded-lg border border-[#E2DDD5] bg-white shadow-lg py-1">
                        {(["Admin", "Editor", "Viewer"] as TeamRole[]).map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setMemberRole(m.id, r)}
                            className="w-full text-left px-3 py-2 text-[12px] text-[#1E1A14] hover:bg-[#F7F4EF] border-none bg-transparent cursor-pointer"
                          >
                            Set as {r}
                          </button>
                        ))}
                        <div className="border-t border-[#E2DDD5] my-1" />
                        <button
                          type="button"
                          onClick={() => deactivate(m.id)}
                          className="w-full text-left px-3 py-2 text-[12px] text-[#DC2626] hover:bg-[#FEF2F2] border-none bg-transparent cursor-pointer"
                        >
                          Remove user
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 mb-6 text-[12px] text-[#9E9890]">
        Role changes are audited for the tenant. Per-agent access restricts users to specific instances instead of the whole workspace.
      </p>

      <div className="rounded-xl border border-[#E2DDD5] bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2DDD5] bg-[#F7F4EF]">
          <h2 className="m-0 text-[14px] font-semibold text-[#1E1A14]">Role-change audit log</h2>
          <p className="m-0 text-[11px] text-[#9E9890]">Invites, role updates, and removals</p>
        </div>
        <div className="divide-y divide-[#F0EDE8] max-h-56 overflow-y-auto">
          {auditLog.map((row) => (
            <div key={row.id} className="px-5 py-3 flex items-start justify-between gap-4">
              <span className="text-[13px] text-[#1E1A14]">{row.text}</span>
              <span className="text-[11px] text-[#9E9890] whitespace-nowrap font-mono">{row.at}</span>
            </div>
          ))}
        </div>
      </div>

      {inviteOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40"
          onClick={() => setInviteOpen(false)}
        >
          <div
            className="w-[400px] max-w-[92vw] rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Invite user"
          >
            <h2 className="m-0 mb-1 text-base font-bold text-[#1E1A14]">Invite user</h2>
            <p className="m-0 mb-5 text-[13px] text-[#7A746C]">
              They receive an email invite. Assign a role and optional agent scope.
            </p>

            <label className="block text-[12px] font-medium text-[#7A746C] mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              className="w-full h-10 px-3 mb-4 text-[13px] border border-[#E2DDD5] rounded-lg focus:outline-none focus:border-[#C9B99E]"
            />

            <label className="block text-[12px] font-medium text-[#7A746C] mb-1.5">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as TeamRole)}
              className="w-full h-10 px-3 mb-4 text-[13px] border border-[#E2DDD5] rounded-lg bg-white focus:outline-none focus:border-[#C9B99E]"
            >
              <option value="Admin">Admin — full tenant access</option>
              <option value="Editor">Editor — configure &amp; launch</option>
              <option value="Viewer">Viewer — read-only</option>
            </select>

            <label className="block text-[12px] font-medium text-[#7A746C] mb-1.5">Agent access</label>
            <select
              value={agentScope}
              onChange={(e) => setAgentScope(e.target.value)}
              className="w-full h-10 px-3 mb-5 text-[13px] border border-[#E2DDD5] rounded-lg bg-white focus:outline-none focus:border-[#C9B99E]"
            >
              <option value="all">All agents</option>
              {agentDefs.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="h-9 px-4 rounded-lg border border-[#E2DDD5] bg-white text-[13px] font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInvite}
                className="h-9 px-4 rounded-lg border-none bg-[#50381F] text-white text-[13px] font-semibold cursor-pointer hover:bg-[#3D2914]"
              >
                Send invite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
