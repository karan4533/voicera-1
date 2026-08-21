import { useState } from "react";
import { useNavigate } from "react-router";
import {
  Utensils, Landmark, ShoppingBag, Headphones, Stethoscope,
  Building2, Shield, Users, CreditCard, Cpu, Bot,
  Search, X, Globe, Mic, CheckCircle2, Pause, Play, Copy, Pencil, Archive,
} from "lucide-react";
import { PageHeader } from "../components/shared/PageHeader";
import { useAgent } from "../context/AgentContext";
import type { AgentDefinition, AgentStatus } from "../lib/types";

const ICON_MAP: Record<string, React.ElementType> = {
  Utensils, Landmark, ShoppingBag, HeadphonesIcon: Headphones,
  Stethoscope, Building2, Shield, Users, CreditCard, Cpu, Bot,
};

function AgentIcon({ name, size = 18 }: { name: string; size?: number }) {
  const Icon = ICON_MAP[name] ?? Bot;
  return <Icon size={size} />;
}

function StatusBadge({ status }: { status: AgentStatus }) {
  switch (status) {
    case "active":
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#15803D] bg-[#DCFCE7] px-2.5 py-1 rounded-full">
          <span className="w-1.5 h-1.5 bg-[#22C55E] rounded-full shadow-[0_0_4px_#22C55E]" /> Live
        </span>
      );
    case "paused":
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#92400E] bg-[#FEF3C7] px-2.5 py-1 rounded-full">
          <span className="w-1.5 h-1.5 bg-[#F59E0B] rounded-full" /> Paused
        </span>
      );
    case "draft":
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#4B5563] bg-[#F3F4F6] px-2.5 py-1 rounded-full">
          <span className="w-1.5 h-1.5 bg-[#6B7280] rounded-full" /> Draft
        </span>
      );
    case "archived":
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#B91C1C] bg-[#FEE2E2] px-2.5 py-1 rounded-full">
          <span className="w-1.5 h-1.5 bg-[#DC2626] rounded-full" /> Retired
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#4A453E] bg-[#F0EDE8] px-2.5 py-1 rounded-full">
          {status}
        </span>
      );
  }
}

/** My Agents — live/configured instances for the tenant (PRD sub-view of Library). */
export function AgentsPage() {
  const navigate = useNavigate();
  const { agent, setAgent, agentDefs, updateAgentStatus, cloneAgent } = useAgent();

  const [search, setSearch] = useState("");
  const [detailAgent, setDetailAgent] = useState<AgentDefinition | null>(null);

  const filtered = agentDefs.filter((a) => {
    const q = search.toLowerCase();
    return (
      !q ||
      a.name.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex h-full overflow-hidden relative">
      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${detailAgent ? "md:mr-[400px]" : ""}`}>
        <div className="shrink-0 mb-5">
          <PageHeader
            title="My Agents"
            subtitle="Live and configured instances for this tenant — edit, duplicate, pause, or retire"
            action={
              <button
                type="button"
                onClick={() => navigate("/dashboard/library")}
                className="h-9 px-4 rounded-lg border-none bg-[#50381F] text-white text-[13px] font-semibold cursor-pointer hover:bg-[#3D2914]"
              >
                Browse Agent Library
              </button>
            }
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4 shrink-0">
          <div className="relative flex-1 min-w-[240px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9E9890]" />
            <input
              type="text"
              placeholder="Search agents by name, category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 h-9 text-[13px] border border-[#E2DDD5] rounded-lg bg-white focus:outline-none focus:border-[#C9B99E] focus:ring-1 focus:ring-[#C9B99E]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto rounded-xl border border-[#E2DDD5] bg-white shadow-sm">
          <table className="w-full border-collapse text-[13px]">
            <thead className="sticky top-0 bg-[#F7F4EF] z-10">
              <tr className="border-b border-[#E2DDD5]">
                <th className="text-left text-[11px] font-bold text-[#7A746C] uppercase tracking-wider px-5 py-3">Agent</th>
                <th className="text-left text-[11px] font-bold text-[#7A746C] uppercase tracking-wider px-4 py-3">Template</th>
                <th className="text-left text-[11px] font-bold text-[#7A746C] uppercase tracking-wider px-4 py-3">Languages</th>
                <th className="text-left text-[11px] font-bold text-[#7A746C] uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-right text-[11px] font-bold text-[#7A746C] uppercase tracking-wider px-5 py-3">Performance</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-16 text-[#9E9890]">
                    <Bot size={36} className="mx-auto mb-3 opacity-30" />
                    <p className="text-[14px] font-medium m-0 mb-2">No agent instances yet</p>
                    <button
                      type="button"
                      onClick={() => navigate("/dashboard/library")}
                      className="text-[13px] font-semibold text-[#50381F] border-none bg-transparent cursor-pointer"
                    >
                      Launch one from the Agent Library →
                    </button>
                  </td>
                </tr>
              ) : (
                filtered.map((a, i) => (
                  <tr
                    key={a.id}
                    onClick={() => setDetailAgent(a)}
                    className={`hover:bg-[#FAFAF8] transition-colors cursor-pointer ${i < filtered.length - 1 ? "border-b border-[#F0EDE8]" : ""} ${detailAgent?.id === a.id ? "bg-[#FDF8F3]" : ""}`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${a.color}15`, color: a.color, border: `1px solid ${a.color}30` }}
                        >
                          <AgentIcon name={a.icon} size={16} />
                        </div>
                        <div>
                          <div className="font-bold text-[#1E1A14] flex items-center gap-2">
                            {a.name}
                            {agent === a.type && a.status === "active" && (
                              <span className="bg-[#50381F] text-white text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">
                                Current
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#7A746C] font-mono mt-0.5">{a.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-[11px] font-bold text-[#4A453E] bg-[#F7F4EF] border border-[#E2DDD5] px-2 py-1 rounded-md">
                        {a.category}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-[#4A453E] text-[12px]">
                      {a.languages?.length ? (
                        <div className="flex items-center gap-1.5 font-medium">
                          <Globe size={13} className="text-[#9E9890]" />
                          {a.languages.slice(0, 2).join(", ")}
                          {a.languages.length > 2 && (
                            <span className="text-[#9E9890] ml-1">+{a.languages.length - 2}</span>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {a.status === "active" || a.status === "paused" ? (
                        <div className="flex flex-col items-end">
                          <div className="text-[13px] font-bold text-[#1E1A14]">
                            {a.stats.callsToday}{" "}
                            <span className="text-[#9E9890] font-normal text-[11px]">calls</span>
                          </div>
                          <div className="text-[11px] text-[#16A34A] font-bold bg-[#DCFCE7] px-1.5 py-0.5 rounded mt-0.5">
                            {a.stats.resolutionRate}% res
                          </div>
                        </div>
                      ) : (
                        <span className="text-[#9E9890] text-[12px] italic">Not deployed</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detailAgent && (
        <div className="fixed right-0 top-0 h-full w-full md:w-[400px] max-w-[100vw] bg-white border-l border-[#E2DDD5] shadow-2xl flex flex-col z-30 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2DDD5] shrink-0 bg-[#FDFDFD]">
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: `${detailAgent.color}15`,
                  color: detailAgent.color,
                  border: `1px solid ${detailAgent.color}30`,
                }}
              >
                <AgentIcon name={detailAgent.icon} size={20} />
              </div>
              <div>
                <div className="font-bold text-[16px] text-[#1E1A14]">{detailAgent.name}</div>
                <div className="text-[11px] text-[#7A746C] font-mono mt-0.5">{detailAgent.id}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDetailAgent(null)}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[#F0EDE8] border-none bg-transparent cursor-pointer"
            >
              <X size={18} color="#7A746C" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-[#9E9890] uppercase tracking-wider">Status</span>
                <span className="text-[11px] font-medium text-[#9E9890]">Created {detailAgent.createdAt}</span>
              </div>
              <StatusBadge status={detailAgent.status} />
            </div>

            <div>
              <span className="text-[11px] font-bold text-[#9E9890] uppercase tracking-wider mb-2 block">
                Agent profile
              </span>
              <p className="text-[13px] text-[#4A453E] leading-relaxed bg-[#F7F4EF] p-4 rounded-xl border border-[#E2DDD5] m-0">
                {detailAgent.description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white border border-[#E2DDD5] rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#9E9890] uppercase tracking-wider mb-1">
                  <Mic size={13} /> Tone &amp; voice
                </div>
                <div className="text-[13px] font-bold text-[#1E1A14]">{detailAgent.tone || "Default"}</div>
              </div>
              <div className="bg-white border border-[#E2DDD5] rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#9E9890] uppercase tracking-wider mb-1">
                  <Globe size={13} /> Languages
                </div>
                <div className="text-[13px] font-bold text-[#1E1A14]">
                  {detailAgent.languages ? detailAgent.languages.length : 0} configured
                </div>
              </div>
            </div>

            {(detailAgent.status === "active" || detailAgent.status === "paused") && (
              <div>
                <span className="text-[11px] font-bold text-[#9E9890] uppercase tracking-wider mb-3 block">
                  Performance
                </span>
                <div className="grid grid-cols-3 gap-2 border border-[#E2DDD5] rounded-xl p-4">
                  <div className="text-center">
                    <p className="m-0 text-[11px] text-[#7A746C] mb-1">Calls today</p>
                    <p className="m-0 text-[18px] font-bold text-[#1E1A14]">{detailAgent.stats.callsToday}</p>
                  </div>
                  <div className="text-center border-x border-[#E2DDD5]">
                    <p className="m-0 text-[11px] text-[#7A746C] mb-1">Resolution</p>
                    <p className="m-0 text-[18px] font-bold text-[#16A34A]">{detailAgent.stats.resolutionRate}%</p>
                  </div>
                  <div className="text-center">
                    <p className="m-0 text-[11px] text-[#7A746C] mb-1">Avg dur</p>
                    <p className="m-0 text-[15px] font-bold text-[#1E1A14] mt-1">{detailAgent.stats.avgDuration}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-[#E2DDD5] p-5 bg-[#FDFDFD] flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setAgent(detailAgent.type);
                navigate(`/dashboard/configure?template=${detailAgent.type}`);
              }}
              className="flex items-center justify-center gap-2 w-full h-10 rounded-lg text-[13px] font-bold border border-[#E2DDD5] bg-white text-[#1E1A14] cursor-pointer hover:bg-[#F7F4EF]"
            >
              <Pencil size={14} /> Edit config
            </button>

            <div className="grid grid-cols-2 gap-2">
              {detailAgent.status === "active" ? (
                <button
                  type="button"
                  onClick={() => {
                    updateAgentStatus(detailAgent.id, "paused");
                    setDetailAgent({ ...detailAgent, status: "paused" });
                  }}
                  className="flex items-center justify-center gap-2 h-10 rounded-lg text-[13px] font-semibold border border-[#E2DDD5] bg-white cursor-pointer hover:bg-[#FEF3C7]"
                >
                  <Pause size={14} /> Pause
                </button>
              ) : detailAgent.status === "paused" || detailAgent.status === "draft" ? (
                <button
                  type="button"
                  onClick={() => {
                    updateAgentStatus(detailAgent.id, "active");
                    setDetailAgent({ ...detailAgent, status: "active" });
                    setAgent(detailAgent.type);
                  }}
                  className="flex items-center justify-center gap-2 h-10 rounded-lg text-[13px] font-semibold border border-transparent bg-[#50381F] text-white cursor-pointer hover:bg-[#3D2914]"
                >
                  <Play size={14} /> {detailAgent.status === "draft" ? "Launch" : "Resume"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="flex items-center justify-center gap-2 h-10 rounded-lg text-[13px] font-semibold border border-[#E2DDD5] bg-[#F7F4EF] text-[#9E9890] cursor-not-allowed"
                >
                  Retired
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  cloneAgent(detailAgent.id);
                  setDetailAgent(null);
                }}
                className="flex items-center justify-center gap-2 h-10 rounded-lg text-[13px] font-semibold border border-[#E2DDD5] bg-white cursor-pointer hover:bg-[#F7F4EF]"
              >
                <Copy size={14} /> Duplicate
              </button>
            </div>

            {detailAgent.status !== "archived" && (
              <button
                type="button"
                onClick={() => {
                  updateAgentStatus(detailAgent.id, "archived");
                  setDetailAgent({ ...detailAgent, status: "archived" });
                }}
                className="flex items-center justify-center gap-2 w-full h-9 rounded-lg text-[12px] font-medium border-none bg-transparent text-[#DC2626] cursor-pointer hover:bg-[#FEF2F2]"
              >
                <Archive size={13} /> Retire instance
              </button>
            )}

            {detailAgent.type === agent && detailAgent.status === "active" ? (
              <button
                type="button"
                onClick={() => navigate("/dashboard/live-calls")}
                className="flex items-center justify-center gap-2 w-full h-10 rounded-lg text-[13px] font-bold border-none bg-[#50381F] text-white cursor-pointer hover:bg-[#3D2914]"
              >
                Open agent workspace
              </button>
            ) : detailAgent.status === "active" ? (
              <button
                type="button"
                onClick={() => {
                  setAgent(detailAgent.type);
                  navigate("/dashboard/live-calls");
                }}
                className="flex items-center justify-center gap-2 w-full h-10 rounded-lg text-[13px] font-bold border-none bg-[#50381F] text-white cursor-pointer hover:bg-[#3D2914]"
              >
                Switch &amp; open workspace
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
