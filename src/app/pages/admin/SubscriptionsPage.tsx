import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router";
import {
  Search, Plus, X, Check, Package,
  ChevronDown, AlertCircle, Loader2,
} from "lucide-react";
import { fetchOrganizationsFromFirestore, type MockOrganisation } from "../../lib/rbac";
import { AGENT_TYPES } from "../../context/AgentContext";
import type { AgentType } from "../../lib/types";
import { CreateAccountModal } from "./CreateAccountModal";
import { adminUpdateOrganization } from "../../lib/adminApi";
import { safeLog } from "../../lib/safeLog";

// ── Agent checkbox in the assignment modal ─────────────────────────────────────

function AgentCheckbox({
  agentType, checked, onChange,
}: {
  agentType: typeof AGENT_TYPES[number]; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
        checked ? "bg-[#F7F4EF]" : "bg-[#FFFFFF]"
      }`}
      style={{ borderColor: checked ? "#50381F" : "#E7DFC8" }}
    >
      <div
        className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${agentType.color}15`, color: agentType.color }}
      >
        <Package size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-bold truncate" style={{ color: "#1E1A16" }}>{agentType.label}</div>
        <div className="text-[10px]" style={{ color: "#6B645B" }}>{agentType.category}</div>
      </div>
      <div
        className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0`}
        style={{
          borderColor: checked ? "#50381F" : "#E7DFC8",
          backgroundColor: checked ? "#50381F" : "#FFFFFF",
        }}
      >
        {checked && <Check size={10} color="white" strokeWidth={3} />}
      </div>
    </button>
  );
}

// ── Assignment Modal ───────────────────────────────────────────────────────────

function AssignModal({
  org, onClose, onSaved,
}: {
  org: MockOrganisation;
  onClose: () => void;
  onSaved: (orgId: string, agents: AgentType[]) => void;
}) {
  const [selected, setSelected] = useState<Set<AgentType>>(
    new Set(org.subscribedAgents),
  );
  const [isSaving, setIsSaving] = useState(false);

  const toggle = (id: AgentType, val: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      val ? next.add(id) : next.delete(id);
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const agents = Array.from(selected);
      await adminUpdateOrganization({ orgId: org.id, subscribedAgents: agents });
      onSaved(org.id, agents);
    } catch (err) {
      safeLog.error("Failed to update subscriptions", err);
      alert("Failed to save changes. Deploy Cloud Functions if this persists.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[560px] mx-4 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: "#E7DFC8" }}>
          <div>
            <div className="font-bold text-[16px]" style={{ color: "#1E1A16" }}>Manage Agent Access</div>
            <div className="text-[12px] mt-0.5" style={{ color: "#6B645B" }}>{org.name}</div>
          </div>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[#F7F4EF] cursor-pointer border-none bg-transparent transition-colors">
            <X size={16} color="#6B645B" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <p className="text-[12px] mb-3" style={{ color: "#6B645B" }}>Select which AI agents this organisation can access:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {AGENT_TYPES.map((at) => (
              <AgentCheckbox
                key={at.id}
                agentType={at}
                checked={selected.has(at.id as AgentType)}
                onChange={(v) => toggle(at.id as AgentType, v)}
              />
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t shrink-0 flex items-center justify-between" style={{ borderColor: "#E7DFC8" }}>
          <span className="text-[12px]" style={{ color: "#6B645B" }}>
            <strong style={{ color: "#1E1A16" }}>{selected.size}</strong> agent{selected.size !== 1 ? "s" : ""} selected
          </span>
          <div className="flex gap-3">
            <button onClick={onClose} className="h-9 px-4 rounded-lg border text-[13px] font-bold cursor-pointer transition-colors" style={{ borderColor: "#E7DFC8", backgroundColor: "#FFFFFF", color: "#1E1A16" }}>
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`h-9 px-4 rounded-lg border-none text-[13px] font-bold text-white cursor-pointer transition-colors ${isSaving ? "opacity-70" : ""}`}
              style={{ backgroundColor: "#50381F" }}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function SubscriptionsPage() {
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [orgs, setOrgs] = useState<MockOrganisation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [assignOrg, setAssignOrg] = useState<MockOrganisation | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const loadOrgs = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const live = await fetchOrganizationsFromFirestore();
      live.sort((a, b) => a.name.localeCompare(b.name));
      setOrgs(live);
    } catch (err) {
      safeLog.error("Failed to load organizations", err);
      setLoadError("Could not load organisations from Firestore. Check your connection and permissions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  // Open assign modal when navigated from Customer Accounts → Manage Subscriptions
  useEffect(() => {
    const assignOrgId = (location.state as { assignOrgId?: string } | null)?.assignOrgId;
    if (!assignOrgId || orgs.length === 0) return;
    const target = orgs.find((o) => o.id === assignOrgId);
    if (target) setAssignOrg(target);
  }, [location.state, orgs]);

  const filtered = orgs.filter((o) => {
    const q = search.toLowerCase();
    const matchQ = !q || o.name.toLowerCase().includes(q) || o.email.toLowerCase().includes(q);
    const matchP = planFilter === "all" || o.plan.toLowerCase() === planFilter;
    return matchQ && matchP;
  });

  const handleAgentsSaved = (orgId: string, agents: AgentType[]) => {
    setOrgs((prev) =>
      prev.map((o) => (o.id === orgId ? { ...o, subscribedAgents: agents } : o)),
    );
    setAssignOrg(null);
  };

  const handleCreateClose = () => {
    setShowCreate(false);
    loadOrgs();
  };

  return (
    <>
      <div className="mb-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-[20px] sm:text-[22px] font-bold m-0 mb-1" style={{ color: "#1E1A16" }}>Subscriptions</h1>
            <p className="text-[13px] m-0" style={{ color: "#6B645B" }}>Assign and manage agent access per customer organisation.</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center justify-center gap-2 h-9 px-4 rounded-lg text-[13px] font-bold text-white cursor-pointer border-none transition-colors shadow-sm shrink-0 self-start"
            style={{ backgroundColor: "#50381F" }}
          >
            <Plus size={14} />
            <span className="sm:hidden">New Subscription</span>
            <span className="hidden sm:inline">New Subscription / Account</span>
          </button>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border p-3 mb-5" style={{ backgroundColor: "#ECE6D9", borderColor: "#E7DFC8" }}>
        <AlertCircle size={14} className="shrink-0 mt-0.5" style={{ color: "#50381F" }} />
        <p className="text-[12px] m-0" style={{ color: "#1E1A16" }}>
          Each organisation can only access agents listed in their subscription. Changes are written to Firestore and take effect on the customer&apos;s next login.
        </p>
      </div>

      {loadError && (
        <div className="flex items-start gap-2.5 rounded-xl border p-3 mb-5" style={{ backgroundColor: "#D9534F22", borderColor: "#D9534F" }}>
          <AlertCircle size={14} className="shrink-0 mt-0.5" style={{ color: "#D9534F" }} />
          <p className="text-[12px] m-0" style={{ color: "#D9534F" }}>{loadError}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#6B645B" }} />
          <input
            type="text"
            placeholder="Search organisation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 h-9 text-[13px] border rounded-lg focus:outline-none transition-colors"
            style={{ borderColor: "#E7DFC8", backgroundColor: "#FFFFFF", color: "#1E1A16", outlineColor: "#50381F" }}
          />
        </div>
        <div className="relative">
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="appearance-none h-9 pl-3 pr-8 text-[13px] border rounded-lg focus:outline-none cursor-pointer"
            style={{ borderColor: "#E7DFC8", backgroundColor: "#FFFFFF", color: "#1E1A16" }}
          >
            <option value="all">All Plans</option>
            <option value="starter">Starter</option>
            <option value="growth">Growth</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#6B645B" }} />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16" style={{ color: "#6B645B" }}>
          <Loader2 size={18} className="animate-spin" />
          <span className="text-[13px]">Loading organisations…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border p-10 text-center" style={{ borderColor: "#E7DFC8", backgroundColor: "#FFFFFF" }}>
          <Package size={28} className="mx-auto mb-3" style={{ color: "#6B645B" }} />
          <p className="text-[14px] font-bold m-0 mb-1" style={{ color: "#1E1A16" }}>
            {orgs.length === 0 ? "No organisations yet" : "No matches"}
          </p>
          <p className="text-[12px] m-0 mb-4" style={{ color: "#6B645B" }}>
            {orgs.length === 0
              ? "Create a customer account to provision their first agents."
              : "Try a different search or plan filter."}
          </p>
          {orgs.length === 0 && (
            <button onClick={() => setShowCreate(true)} className="h-9 px-4 rounded-lg text-[13px] font-bold text-white cursor-pointer border-none" style={{ backgroundColor: "#50381F" }}>
              <Plus size={14} className="inline mr-1" /> New Subscription / Account
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((org) => (
            <div
              key={org.id}
              className="bg-[#FFFFFF] rounded-xl border overflow-hidden"
              style={{ borderColor: "#E7DFC8" }}
            >
              <div className="flex items-start justify-between px-5 py-4 border-b" style={{ borderColor: "#E7DFC8" }}>
                <div>
                  <div className="font-bold" style={{ color: "#1E1A16" }}>{org.name}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: "#6B645B" }}>{org.email}</div>
                  <div className="text-[10px] mt-0.5 font-mono" style={{ color: "#6B645B" }}>{org.id}</div>
                </div>
                <span
                  className="text-[11px] font-bold px-2 py-0.5 rounded-md shrink-0"
                  style={{
                    backgroundColor: { Starter: "#F7F4EF", Growth: "#ECE6D9", Enterprise: "#4CAF5022" }[org.plan],
                    color: { Starter: "#50381F", Growth: "#1E1A16", Enterprise: "#4CAF50" }[org.plan],
                  }}
                >
                  {org.plan}
                </span>
                {org.status === "suspended" && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md ml-2" style={{ backgroundColor: "#D9534F22", color: "#D9534F" }}>
                    Suspended
                  </span>
                )}
              </div>

              <div className="px-5 py-4">
                <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: "#6B645B" }}>
                  Subscribed Agents ({org.subscribedAgents.length})
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {org.subscribedAgents.length === 0 ? (
                    <span className="text-[11px]" style={{ color: "#6B645B" }}>No agents assigned</span>
                  ) : (
                    org.subscribedAgents.map((agentId) => {
                      const def = AGENT_TYPES.find((a) => a.id === agentId);
                      if (!def) return null;
                      return (
                        <span
                          key={agentId}
                          className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border"
                          style={{ color: "#1E1A16", backgroundColor: "#ECE6D9", borderColor: "#E7DFC8" }}
                        >
                          <Check size={10} strokeWidth={3} />
                          {def.label.replace(" Agent", "")}
                        </span>
                      );
                    })
                  )}
                </div>

                <button
                  onClick={() => setAssignOrg(org)}
                  className="flex items-center gap-2 h-8 px-3 rounded-lg text-[12px] font-bold cursor-pointer border transition-colors"
                  style={{ color: "#1E1A16", borderColor: "#E7DFC8", backgroundColor: "#F7F4EF" }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#ECE6D9")}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#F7F4EF")}
                >
                  <Package size={12} /> Manage Agent Access
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {assignOrg && (
        <AssignModal
          org={assignOrg}
          onClose={() => setAssignOrg(null)}
          onSaved={handleAgentsSaved}
        />
      )}
      {showCreate && (
        <CreateAccountModal onClose={handleCreateClose} />
      )}
    </>
  );
}
