import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { X, TrendingUp, Phone, CheckCircle, Clock, ListTodo, Search, Download, ExternalLink } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { PageHeader } from "../components/shared/PageHeader";
import { getDashboardMetrics, getExtractedData, getCallDetails } from "../lib/api";
import { useAgent } from "../context/AgentContext";
import type { DashboardMetrics, ExtractedEntity, CallDetail } from "../lib/types";

const CALL_VOLUME_DATA = [
  { day: "Mon", calls: 124, resolved: 108 },
  { day: "Tue", calls: 98,  resolved: 89 },
  { day: "Wed", calls: 145, resolved: 131 },
  { day: "Thu", calls: 162, resolved: 144 },
  { day: "Fri", calls: 189, resolved: 170 },
  { day: "Sat", calls: 72,  resolved: 64 },
  { day: "Sun", calls: 51,  resolved: 45 },
];

const OUTCOME_BY_AGENT = [
  { agent: "Restaurant", qualified: 86, unresolved: 14 },
  { agent: "AI Feedback", qualified: 62, unresolved: 28 },
  { agent: "Support", qualified: 71, unresolved: 19 },
];

function KpiCard({
  icon: Icon, label, value, sub, iconColor,
}: { icon: typeof Phone; label: string; value: string; sub?: string; iconColor: string }) {
  return (
    <div className="bg-white border border-[#E2DDD5] rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-[#7A746C] uppercase tracking-wider">{label}</span>
        <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${iconColor}15` }}>
          <Icon size={15} style={{ color: iconColor }} />
        </div>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-[1.6rem] font-bold leading-none tracking-tight text-[#1E1A14]">{value}</span>
        {sub && <span className="text-[12px] text-[#9E9890] mb-0.5">{sub}</span>}
      </div>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#E2DDD5] rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#F0EDE8]">
        <h2 className="m-0 text-[14px] font-semibold text-[#1E1A14]">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case "Synced":
      return <span style={{ fontSize: 11, fontWeight: 600, color: "#15803D", backgroundColor: "#DCFCE7", padding: "2px 8px", borderRadius: 12 }}>Synced</span>;
    case "Action Required":
      return <span style={{ fontSize: 11, fontWeight: 600, color: "#DC2626", backgroundColor: "#FEE2E2", padding: "2px 8px", borderRadius: 12 }}>Action Required</span>;
    case "Pending":
      return <span style={{ fontSize: 11, fontWeight: 600, color: "#92400E", backgroundColor: "#FEF3C7", padding: "2px 8px", borderRadius: 12 }}>Pending</span>;
    default:
      return <span style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", backgroundColor: "#F3F4F6", padding: "2px 8px", borderRadius: 12 }}>{status}</span>;
  }
};

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name?: string; color?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid #E2DDD5", borderRadius: 8, padding: "8px 12px", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
      <p style={{ margin: "0 0 4px", fontWeight: 600, color: "#1E1A14" }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ margin: 0, color: p.color || "#50381F" }}>
          {p.name ? `${p.name}: ` : ""}<strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { agent } = useAgent();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedEntity[]>([]);
  const [actionItems, setActionItems] = useState<{ callId: string; caller: string; text: string }[]>([]);
  const [selectedCall, setSelectedCall] = useState<ExtractedEntity | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    getDashboardMetrics().then(setMetrics);
    getExtractedData().then(setExtractedData);
    getCallDetails({ search: "", agent: String(agent), language: "all", outcome: "all" }).then((calls: CallDetail[]) => {
      const open = calls.flatMap((c) =>
        c.actionItems
          .filter((a) => !a.done)
          .map((a) => ({ callId: c.id, caller: c.name, text: a.text })),
      );
      setActionItems(open.slice(0, 8));
    });
  }, [agent]);

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  const filtered = extractedData.filter((e) =>
    search === "" || e.customerName.toLowerCase().includes(search.toLowerCase()) || e.contact.includes(search)
  );

  const handleExportCSV = () => {
    const headers = ["Timestamp", "Agent", "Contact", "Type", "Status"];
    const rows = filtered.map((e) => [e.timestamp, e.type, e.contact, e.type, e.status]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `dashboard_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Tenant-wide performance across all agents — KPIs, trends, recent calls, and action items"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <KpiCard icon={Phone} label="Total calls" value={metrics ? metrics.totalCalls.toLocaleString() : "—"} sub={metrics ? `${metrics.todayCalls ?? 0} today` : undefined} iconColor="#50381F" />
        <KpiCard icon={Clock} label="Avg call duration" value={metrics?.avgDuration ?? "—"} iconColor="#2563EB" />
        <KpiCard icon={CheckCircle} label="Success / qualification" value={metrics ? `${metrics.resolutionRate ?? 0}%` : "—"} iconColor="#16A34A" />
        <KpiCard icon={TrendingUp} label="Connected calls" value={metrics ? (metrics.connectedCalls ?? 0).toLocaleString() : "—"} iconColor="#D97706" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <SectionCard title="Call volume trend">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={CALL_VOLUME_DATA} barSize={18} barCategoryGap="30%">
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#9E9890" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9E9890" }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="calls" name="Total" fill="#C9B99E" radius={[4, 4, 0, 0]} />
              <Bar dataKey="resolved" name="Resolved" fill="#50381F" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Outcome breakdown — per agent">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={OUTCOME_BY_AGENT} barSize={16} layout="vertical" margin={{ left: 8 }}>
              <XAxis type="number" tick={{ fontSize: 11, fill: "#9E9890" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="agent" width={88} tick={{ fontSize: 11, fill: "#7A746C" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="qualified" name="Qualified" fill="#50381F" stackId="a" />
              <Bar dataKey="unresolved" name="Unresolved" fill="#E2DDD5" stackId="a" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-3">
            <span className="flex items-center gap-1.5 text-[11px] text-[#7A746C]">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#50381F] inline-block" /> Qualified
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-[#7A746C]">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#E2DDD5] inline-block" /> Unresolved
            </span>
          </div>
        </SectionCard>
      </div>

      <div className="bg-white border border-[#E2DDD5] rounded-xl overflow-hidden mb-4">
        <div className="px-5 py-4 border-b border-[#F0EDE8] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListTodo size={15} className="text-[#50381F]" />
            <h2 className="m-0 text-[14px] font-semibold text-[#1E1A14]">Action items</h2>
          </div>
          <button
            type="button"
            onClick={() => navigate("/dashboard/analytics")}
            className="text-[12px] font-semibold text-[#50381F] border-none bg-transparent cursor-pointer"
          >
            Open Call Analytics →
          </button>
        </div>
        <div className="divide-y divide-[#F0EDE8]">
          {actionItems.length === 0 ? (
            <p className="m-0 px-5 py-6 text-[13px] text-[#9E9890]">No open action items from recent calls.</p>
          ) : (
            actionItems.map((item, i) => (
              <div key={`${item.callId}-${i}`} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="m-0 text-[13px] font-medium text-[#1E1A14] truncate">{item.text}</p>
                  <p className="m-0 text-[11px] text-[#9E9890] mt-0.5">{item.caller}</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/dashboard/analytics")}
                  className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-[#50381F] border border-[#E2DDD5] rounded-md px-2 py-1 bg-white cursor-pointer hover:bg-[#F7F4EF]"
                >
                  <ExternalLink size={11} /> Review
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-white border border-[#E2DDD5] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#F0EDE8] flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="m-0 text-[14px] font-semibold text-[#1E1A14]">Recent calls</h2>
            <p className="m-0 mt-0.5 text-[12px] text-[#9E9890]">Timestamp, agent, contact, outcome — open transcript in analytics</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9E9890]" />
              <input
                type="text"
                placeholder="Search calls..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 pr-3 rounded-lg border border-[#E2DDD5] bg-[#F7F4EF] text-[12px] text-[#1E1A14] outline-none focus:border-[#C9B99E] w-44"
              />
            </div>
            <button
              onClick={handleExportCSV}
              className="h-8 px-3 rounded-lg border border-[#E2DDD5] bg-white text-[12px] font-medium text-[#7A746C] cursor-pointer hover:bg-[#F7F4EF] flex items-center gap-1.5"
            >
              <Download size={12} /> Export
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#F7F4EF] border-b border-[#E2DDD5]">
                {["Timestamp", "Agent", "Contact", "Outcome", "Status", "Transcript"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-[#9E9890] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-b border-[#F0EDE8] last:border-0 hover:bg-[#F7F4EF]">
                  <td className="px-4 py-3.5 text-[12px] text-[#9E9890] whitespace-nowrap">{item.timestamp}</td>
                  <td className="px-4 py-3.5 text-[13px] font-semibold text-[#1E1A14]">{item.type}</td>
                  <td className="px-4 py-3.5">
                    <div className="text-[13px] font-medium text-[#1E1A14]">{item.customerName}</div>
                    <div className="text-[11px] text-[#9E9890] font-mono mt-0.5">{item.contact}</div>
                  </td>
                  <td className="px-4 py-3.5 text-[12px] text-[#4A453E]">
                    {item.summary ? item.summary.slice(0, 48) + (item.summary.length > 48 ? "…" : "") : "—"}
                  </td>
                  <td className="px-4 py-3.5">{getStatusBadge(item.status)}</td>
                  <td className="px-4 py-3.5">
                    <button type="button" onClick={() => setSelectedCall(item)} className="text-[12px] font-semibold text-[#50381F] border-none bg-transparent cursor-pointer hover:underline">
                      View
                    </button>
                    <button type="button" onClick={() => navigate("/dashboard/analytics")} className="ml-2 text-[12px] font-semibold text-[#7A746C] border-none bg-transparent cursor-pointer">
                      Analytics
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[13px] text-[#9E9890]">No call records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedCall !== null && (
        <div className="fixed right-0 top-0 h-full w-full sm:w-[400px] max-w-[100vw] bg-white border-l border-[#E2DDD5] shadow-2xl flex flex-col z-50">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2DDD5] shrink-0 bg-[#F7F4EF]">
            <div>
              <div className="font-bold text-[15px] text-[#1E1A14]">{selectedCall.customerName}</div>
              <div className="text-[12px] text-[#7A746C] font-mono">{selectedCall.contact}</div>
            </div>
            <button onClick={() => setSelectedCall(null)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[#E2DDD5] cursor-pointer border-none bg-transparent">
              <X size={16} className="text-[#7A746C]" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold text-[#1E1A14]">{selectedCall.type}</span>
              {getStatusBadge(selectedCall.status)}
            </div>
            {selectedCall.summary && (
              <div>
                <h3 className="text-[11px] font-bold text-[#9E9890] uppercase tracking-wider mb-2">AI Summary</h3>
                <div className="bg-[#EDE4D8] border border-[#C9B99E] rounded-xl p-4 text-[13px] text-[#50381F] leading-relaxed">{selectedCall.summary}</div>
              </div>
            )}
            {selectedCall.transcript && (
              <div>
                <h3 className="text-[11px] font-bold text-[#9E9890] uppercase tracking-wider mb-2">Transcript</h3>
                <div className="bg-white border border-[#E2DDD5] rounded-xl p-4 max-h-[260px] overflow-y-auto flex flex-col gap-2">
                  {selectedCall.transcript.split("\n").map((line, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg text-[12px] leading-relaxed bg-[#F7F4EF] text-[#4A453E]">{line}</div>
                  ))}
                </div>
              </div>
            )}
            <button type="button" onClick={() => navigate("/dashboard/analytics")} className="h-10 rounded-lg border-none bg-[#50381F] text-white text-[13px] font-semibold cursor-pointer">
              Open in Call Analytics
            </button>
          </div>
        </div>
      )}
    </>
  );
}
