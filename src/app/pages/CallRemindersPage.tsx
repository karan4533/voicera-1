import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router";
import {
  Phone, Search, Plus, Upload, X, ChevronDown,
  CheckCircle2, Clock, PhoneOff, RefreshCw,
  User, MapPin, Tag, FileText, History, Download, Play, Pause,
} from "lucide-react";
import {
  getReminderContacts,
  addReminderContact,
  updateReminderStatus,
  bulkImportReminders,
  getCampaignStatus,
  setCampaignStatus,
  getCampaignEta,
} from "../lib/api";
import { parseCsv } from "../lib/csv";
import type { ReminderContact, ReminderDomain, ReminderStatus, CampaignState } from "../lib/types";
import { useAgent } from "../context/AgentContext";

// ── Constants ─────────────────────────────────────────────────────────────────

const DOMAIN_LABELS: Partial<Record<ReminderDomain, string>> = {
  restaurant: "Restaurant",
  loan: "AI Feedback",
};

const DOMAIN_COLORS: Partial<Record<ReminderDomain, string>> = {
  restaurant: "bg-orange-50 text-orange-700 border-orange-200",
  loan: "bg-blue-50 text-blue-700 border-blue-200",
};

const DOMAIN_FIELDS: Partial<Record<ReminderDomain, { key: string; label: string; type: "text" | "number" | "date" }[]>> = {
  restaurant: [
    { key: "visitCount", label: "Visit Count", type: "number" },
    { key: "lastVisitDate", label: "Last Visit Date", type: "date" },
    { key: "preferredFood", label: "Preferred Food", type: "text" },
    { key: "reservationHistory", label: "Reservation Notes", type: "text" },
  ],
  loan: [
    { key: "loanType", label: "Loan Type", type: "text" },
    { key: "loanAmount", label: "Loan Amount (₹)", type: "number" },
    { key: "emiStatus", label: "EMI Status", type: "text" },
    { key: "followUpDate", label: "Follow-up Date", type: "date" },
    { key: "leadSource", label: "Lead Source", type: "text" },
  ],
};

// Status config — only the 4 workflow states
const STATUS_STYLES: Record<Exclude<ReminderStatus, "skipped">, string> = {
  pending:     "bg-amber-50 text-amber-700 border-amber-200",
  calling:     "bg-green-50 text-green-700 border-green-200",
  completed:   "bg-gray-100 text-gray-500 border-gray-200",
  "no-answer": "bg-orange-50 text-orange-600 border-orange-200",
  rescheduled: "bg-blue-50 text-blue-600 border-blue-200",
};

const STATUS_LABELS: Record<Exclude<ReminderStatus, "skipped">, string> = {
  pending:     "Pending",
  calling:     "In Call",
  completed:   "Completed",
  "no-answer": "No Answer",
  rescheduled: "Rescheduled",
};

const STATUS_ICONS: Record<Exclude<ReminderStatus, "skipped">, React.ReactNode> = {
  pending:     <Clock size={10} />,
  calling:     <Phone size={10} />,
  completed:   <CheckCircle2 size={10} />,
  "no-answer": <PhoneOff size={10} />,
  rescheduled: <RefreshCw size={10} />,
};

// ── Helper: format attribute key to label ─────────────────────────────────────
function fmtKey(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}

// ── CSV Template download ─────────────────────────────────────────────────────
function downloadTemplate() {
  const csv = "name,phone,location,tags,notes,scheduled_at\nJohn Doe,9999999999,Mumbai,VIP|New,Call about renewal,2026-06-15T10:00:00Z";
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "scheduler_template.csv"; a.click();
  URL.revokeObjectURL(url);
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface AddFormData {
  name: string; phone: string; location: string;
  tags: string; notes: string;
  domain: ReminderDomain; scheduledAt: string;
  attributes: Record<string, string>;
}

const EMPTY_FORM: AddFormData = {
  name: "", phone: "", location: "",
  tags: "", notes: "", domain: "loan", scheduledAt: "",
  attributes: {},
};

// ── Main Component ────────────────────────────────────────────────────────────
export function CallRemindersPage() {
  const navigate = useNavigate();
  const { agent, agentLabel } = useAgent();
  const [contacts, setContacts] = useState<ReminderContact[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReminderStatus | "all">("all");

  // Panels
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [detailContact, setDetailContact] = useState<ReminderContact | null>(null);

  // Add form
  const [form, setForm] = useState<AddFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Campaign queue controls
  const [campaignState, setCampaignStateLocal] = useState<CampaignState>("idle");
  const [campaignEta, setCampaignEta] = useState("—");

  // Stats (needed for ETA + KPI strip)
  const total     = contacts.filter(c => c.domain === agent).length;
  const pending   = contacts.filter(c => c.domain === agent && (c.status === "pending" || c.status === "no-answer")).length;
  const completed = contacts.filter(c => c.domain === agent && c.status === "completed").length;
  const inCall    = contacts.filter(c => c.domain === agent && c.status === "calling").length;
  const attempted = completed + inCall + contacts.filter(c => c.domain === agent && c.status === "no-answer").length;
  const connectRate = attempted > 0 ? Math.round((completed / attempted) * 100) : 0;

  // Load
  useEffect(() => {
    getReminderContacts().then((data) => { setContacts(data); setLoading(false); });
    getCampaignStatus().then(setCampaignStateLocal);
  }, []);

  useEffect(() => {
    if (campaignState !== "running") {
      setCampaignEta(pending > 0 ? "Paused — start queue" : "—");
      return;
    }
    // Local ETA: ~45s per pending contact at concurrency 3
    const computeLocal = () => {
      if (pending === 0) return "Done";
      const mins = Math.max(1, Math.ceil((pending * 45) / (3 * 60)));
      return mins < 60 ? `~${mins} min` : `~${Math.floor(mins / 60)}h ${mins % 60}m`;
    };
    setCampaignEta(computeLocal());
    const tick = () => {
      getCampaignEta().then((eta) => {
        setCampaignEta(eta === "—" ? computeLocal() : eta);
      });
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => clearInterval(id);
  }, [campaignState, pending]);

  const handleCampaignToggle = async () => {
    if (campaignState === "running") {
      await setCampaignStatus("paused");
      setCampaignStateLocal("paused");
    } else {
      await setCampaignStatus("running");
      setCampaignStateLocal("running");
    }
  };

  // Filtered contacts
  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.name.toLowerCase().includes(q) || c.phone.includes(q);
    const matchDomain = c.domain === agent;
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchDomain && matchStatus;
  });

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleStatusUpdate = async (id: string, status: ReminderStatus) => {
    await updateReminderStatus(id, status);
    setContacts((prev) => prev.map((c) => c.id === id ? { ...c, status } : c));
    if (detailContact?.id === id) setDetailContact((prev) => prev ? { ...prev, status } : null);
  };

  /** Reschedule: move to now + 4 hours, no popup needed */
  const handleReschedule = async (c: ReminderContact) => {
    const newTime = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    await updateReminderStatus(c.id, "rescheduled");
    setContacts((prev) =>
      prev.map((x) => x.id === c.id ? { ...x, status: "rescheduled", scheduledAt: newTime } : x)
    );
    if (detailContact?.id === c.id)
      setDetailContact((prev) => prev ? { ...prev, status: "rescheduled", scheduledAt: newTime } : null);
  };

  /** Start Call → navigate to Live Calls, set status to "calling" (In Call) */
  const handleStartCall = async (c: ReminderContact) => {
    await updateReminderStatus(c.id, "calling");
    setContacts((prev) => prev.map((x) => x.id === c.id ? { ...x, status: "calling" } : x));
    navigate(`/dashboard/live-calls?start=${c.id}`);
  };

  /** End Call → status becomes "completed" */
  const handleEndCall = async (c: ReminderContact) => {
    await handleStatusUpdate(c.id, "completed");
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const newContact = await addReminderContact({
        name: form.name, phone: form.phone, location: form.location,
        priority: "Normal",
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        notes: form.notes, domain: agent as ReminderDomain,
        status: "pending",
        scheduledAt: form.scheduledAt || null,
        attributes: Object.fromEntries(
          Object.entries(form.attributes).filter(([, v]) => v !== "")
        ),
      });
      setContacts((prev) => [newContact, ...prev]);
      setDrawerOpen(false);
      setForm(EMPTY_FORM);
    } finally {
      setSaving(false);
    }
  };

  const handleFileSelect = async (file: File) => {
    setImportFile(file);
    const text = await file.text();
    const rows = parseCsv(text);
    setImportPreview(rows.slice(0, 5));
  };

  const handleImportConfirm = async () => {
    if (!importFile) return;
    setImporting(true);
    try {
      const imported = await bulkImportReminders(importFile, agent as ReminderDomain);
      setContacts((prev) => [...imported, ...prev]);
      setImportOpen(false);
      setImportFile(null);
      setImportPreview([]);
    } finally {
      setImporting(false);
    }
  };

  const setField = (key: keyof AddFormData, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));
  const setAttr = (key: string, val: string) =>
    setForm((f) => ({ ...f, attributes: { ...f.attributes, [key]: val } }));

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main content area */}
      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${detailContact ? "mr-[380px]" : ""}`}>

        {/* ── Header ── */}
        <div className="shrink-0 mb-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-bold text-[#1E1A14] tracking-tight">Outbound Campaign</h1>
              <p className="text-[13px] text-[#7A746C] mt-0.5">
                Upload contacts, start/pause the queue, monitor connect rate and queue remaining for {agentLabel}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCampaignToggle}
                className={`flex items-center gap-1.5 text-[13px] font-semibold px-3 py-2 rounded-lg border-none cursor-pointer transition-colors ${
                  campaignState === "running"
                    ? "bg-amber-500 text-white hover:bg-amber-600"
                    : "bg-[#16A34A] text-white hover:bg-[#15803D]"
                }`}
              >
                {campaignState === "running" ? <><Pause size={14} /> Pause queue</> : <><Play size={14} /> Start campaign</>}
              </button>
              <button
                onClick={() => setImportOpen(true)}
                className="flex items-center gap-1.5 text-[13px] font-medium px-3 py-2 rounded-lg border border-[#E2DDD5] bg-white text-[#4A453E] cursor-pointer hover:bg-[#F9F9F7] transition-colors"
              >
                <Upload size={14} /> Import CSV
              </button>
              <button
                onClick={() => setDrawerOpen(true)}
                className="flex items-center gap-1.5 text-[13px] font-semibold px-3 py-2 rounded-lg bg-[#50381F] text-white border-none cursor-pointer hover:bg-[#3D2914] transition-colors"
              >
                <Plus size={14} /> Add Customer
              </button>
            </div>
          </div>
        </div>

        {/* ── Stats strip ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5 shrink-0">
          {[
            { label: "Queue remaining", value: String(pending), color: "#D97706" },
            { label: "Connect rate", value: `${connectRate}%`, color: "#16A34A" },
            { label: "Completed", value: String(completed), color: "#1E1A14" },
            { label: "In call", value: String(inCall), color: "#2563EB" },
            { label: "Queue ETA", value: campaignEta, color: "#50381F" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-[#E2DDD5] px-4 py-3 shadow-sm">
              <div className="text-[10px] text-[#9E9890] uppercase tracking-wider mb-0.5">{s.label}</div>
              <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
        <div className="mb-4 text-[12px] text-[#7A746C]">
          Campaign status:{" "}
          <span className="font-semibold text-[#1E1A14] capitalize">{campaignState}</span>
          {" · "}
          {total} contacts in list
        </div>

        {/* ── Filter bar ── */}
        <div className="flex flex-wrap gap-2 mb-4 shrink-0">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-[13px] border border-[#E2DDD5] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#50381F]/30"
            />
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ReminderStatus | "all")}
              className="appearance-none pl-3 pr-7 py-2 text-[13px] border border-[#E2DDD5] rounded-lg bg-white cursor-pointer focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="calling">In Call</option>
              <option value="completed">Completed</option>
              <option value="rescheduled">Rescheduled</option>
            </select>
            <ChevronDown size={12} className="absolute right-2 top-3 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* ── Table ── */}
        <div className="flex-1 overflow-auto rounded-xl border border-[#E2DDD5] bg-white shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-[13px] text-[#9E9890]">Loading scheduled calls…</div>
          ) : (
            <table className="w-full border-collapse text-[13px]">
              <thead className="sticky top-0 bg-[#FDFDFD] z-10">
                <tr className="border-b border-[#E2DDD5]">
                  {["Customer Name", "Phone Number", "Location", "Tags", "Status", "Scheduled", "Actions"].map((h) => (
                    <th key={h} className="text-left text-[11px] font-semibold text-[#7A746C] uppercase tracking-wider px-4 py-3 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-[13px] text-[#9E9890]">
                      No scheduled calls match your filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((c, i) => (
                    <tr
                      key={c.id}
                      className={`hover:bg-[#F9F9F7] transition-colors cursor-pointer ${i < filtered.length - 1 ? "border-b border-[#F0EDE8]" : ""} ${detailContact?.id === c.id ? "bg-[#FDF8F3]" : ""}`}
                      onClick={() => setDetailContact(c)}
                    >
                      {/* Customer Name */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#1E1A14]">{c.name}</div>
                      </td>
                      {/* Phone Number */}
                      <td className="px-4 py-3 font-mono text-[12px] text-[#4A453E] whitespace-nowrap">{c.phone}</td>
                      {/* Location */}
                      <td className="px-4 py-3 text-[12px] text-[#7A746C]">{c.location || "—"}</td>
                      {/* Tags */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-[160px]">
                          {c.tags.slice(0, 2).map((t) => (
                            <span key={t} className="text-[10px] bg-[#F0EDE8] text-[#7A746C] px-1.5 py-0.5 rounded-full">{t}</span>
                          ))}
                          {c.tags.length > 2 && (
                            <span className="text-[10px] bg-[#F0EDE8] text-[#7A746C] px-1.5 py-0.5 rounded-full">+{c.tags.length - 2}</span>
                          )}
                        </div>
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[c.status]}`}>
                          {STATUS_ICONS[c.status]}{STATUS_LABELS[c.status]}
                        </span>
                      </td>
                      {/* Scheduled */}
                      <td className="px-4 py-3 text-[12px] text-[#7A746C] whitespace-nowrap">
                        {c.scheduledAt
                          ? new Date(c.scheduledAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                          : "—"}
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Start Call — for pending / rescheduled / no-answer */}
                          {(c.status === "pending" || c.status === "rescheduled" || c.status === "no-answer") && (
                            <button
                              onClick={() => handleStartCall(c)}
                              title="Start Call"
                              className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg bg-[#22C55E] text-white border-none cursor-pointer hover:bg-[#16A34A] transition-colors"
                            >
                              <Phone size={11} /> Start Call
                            </button>
                          )}
                          {/* End Call — only while In Call */}
                          {c.status === "calling" && (
                            <button
                              onClick={() => handleEndCall(c)}
                              title="End Call"
                              className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg bg-[#DC2626] text-white border-none cursor-pointer hover:bg-[#B91C1C] transition-colors"
                            >
                              <PhoneOff size={11} /> End Call
                            </button>
                          )}
                          {/* Reschedule — available for pending / no-answer */}
                          {(c.status === "pending" || c.status === "no-answer") && (
                            <button
                              onClick={() => handleReschedule(c)}
                              title="Reschedule (+4h)"
                              className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] cursor-pointer hover:bg-[#DBEAFE] transition-colors"
                            >
                              <RefreshCw size={11} /> Reschedule
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          DETAIL SIDE PANEL
      ══════════════════════════════════════════════════════════════ */}
      {detailContact && (
        <div className="fixed right-0 top-0 h-full w-full sm:w-[380px] max-w-[100vw] bg-white border-l border-[#E2DDD5] shadow-xl flex flex-col z-30 overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2DDD5] shrink-0 bg-[#FDFDFD]">
            <div>
              <div className="font-bold text-[15px] text-[#1E1A14]">{detailContact.name}</div>
              <div className="text-[12px] text-[#7A746C] font-mono">{detailContact.phone}</div>
            </div>
            <button
              onClick={() => setDetailContact(null)}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[#F0EDE8] transition-colors cursor-pointer border-none bg-transparent"
            >
              <X size={16} color="#7A746C" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${DOMAIN_COLORS[detailContact.domain] || "bg-gray-50 text-gray-700 border-gray-200"}`}>
                {DOMAIN_LABELS[detailContact.domain] || detailContact.domain}
              </span>
              <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${STATUS_STYLES[detailContact.status]}`}>
                {STATUS_ICONS[detailContact.status]} {STATUS_LABELS[detailContact.status]}
              </span>
            </div>

            {/* Quick info */}
            <div className="flex flex-col gap-2 text-[13px]">
              <div className="flex items-center gap-2 text-[#4A453E]">
                <MapPin size={13} className="text-[#9E9890] shrink-0" />
                <span>{detailContact.location || "—"}</span>
              </div>
              {detailContact.scheduledAt && (
                <div className="flex items-center gap-2 text-[#4A453E]">
                  <Clock size={13} className="text-[#9E9890] shrink-0" />
                  <span>
                    Scheduled:{" "}
                    {new Date(detailContact.scheduledAt).toLocaleString("en-IN", {
                      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-[#4A453E]">
                <User size={13} className="text-[#9E9890] shrink-0" />
                <span>Attempt {detailContact.attemptNumber} of {detailContact.totalAttempts}</span>
              </div>
            </div>

            {/* Tags */}
            {detailContact.tags.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#9E9890] uppercase tracking-wider mb-2">
                  <Tag size={11} /> Tags
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {detailContact.tags.map((t) => (
                    <span key={t} className="text-[11px] bg-[#F0EDE8] text-[#7A746C] px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {detailContact.notes && (
              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#9E9890] uppercase tracking-wider mb-2">
                  <FileText size={11} /> Notes
                </div>
                <p className="text-[13px] text-[#4A453E] leading-relaxed bg-[#F9F9F7] border border-[#E2DDD5] rounded-lg px-3 py-2">
                  {detailContact.notes}
                </p>
              </div>
            )}

            {/* Dynamic Attributes */}
            {Object.keys(detailContact.attributes).length > 0 && (
              <div>
                <div className="text-[11px] font-semibold text-[#9E9890] uppercase tracking-wider mb-2">
                  {DOMAIN_LABELS[detailContact.domain] || detailContact.domain} Details
                </div>
                <div className="rounded-lg border border-[#E2DDD5] overflow-hidden">
                  {Object.entries(detailContact.attributes).map(([key, val], i, arr) => (
                    <div
                      key={key}
                      className={`flex items-center justify-between px-3 py-2 text-[12px] ${i < arr.length - 1 ? "border-b border-[#F0EDE8]" : ""}`}
                    >
                      <span className="text-[#7A746C] font-medium">{fmtKey(key)}</span>
                      <span className="text-[#1E1A14] font-semibold text-right max-w-[180px] break-words">
                        {typeof val === "number" && key.toLowerCase().includes("amount")
                          ? `₹${val.toLocaleString("en-IN")}`
                          : String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Call History */}
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#9E9890] uppercase tracking-wider mb-2">
                <History size={11} /> Call History
              </div>
              {detailContact.callHistory.length === 0 ? (
                <p className="text-[12px] text-[#9E9890] italic">No calls made yet.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {detailContact.callHistory.map((h) => (
                    <div key={h.id} className="rounded-lg border border-[#E2DDD5] px-3 py-2.5 bg-[#FDFDFD]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold text-[#4A453E]">{h.calledAt}</span>
                        <span className="text-[11px] text-[#9E9890]">{h.duration}</span>
                      </div>
                      <div className="text-[11px] font-semibold text-[#1E1A14] mb-0.5">{h.outcome}</div>
                      <p className="text-[11px] text-[#7A746C] leading-relaxed">{h.summary}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Panel actions */}
          <div className="shrink-0 border-t border-[#E2DDD5] px-5 py-3 bg-[#FDFDFD] flex gap-2">
            {(detailContact.status === "pending" || detailContact.status === "no-answer" || detailContact.status === "rescheduled") && (
              <button
                onClick={() => { handleStartCall(detailContact); setDetailContact(null); }}
                className="flex-1 flex items-center justify-center gap-1.5 text-[13px] font-semibold py-2 rounded-lg bg-[#22C55E] text-white border-none cursor-pointer hover:bg-[#16A34A] transition-colors"
              >
                <Phone size={14} /> Start Call
              </button>
            )}
            {detailContact.status === "calling" && (
              <button
                onClick={() => handleEndCall(detailContact)}
                className="flex-1 flex items-center justify-center gap-1.5 text-[13px] font-semibold py-2 rounded-lg bg-[#DC2626] text-white border-none cursor-pointer hover:bg-[#B91C1C] transition-colors"
              >
                <PhoneOff size={14} /> End Call
              </button>
            )}
            {(detailContact.status === "pending" || detailContact.status === "no-answer" || detailContact.status === "rescheduled") && (
              <button
                onClick={() => handleReschedule(detailContact)}
                className="flex-1 flex items-center justify-center gap-1.5 text-[13px] font-medium py-2 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] cursor-pointer hover:bg-[#DBEAFE] transition-colors"
              >
                <RefreshCw size={14} /> Reschedule +4h
              </button>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          ADD CUSTOMER DRAWER
      ══════════════════════════════════════════════════════════════ */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/30" onClick={() => setDrawerOpen(false)} />
          <div className="w-full sm:w-[460px] max-w-[100vw] bg-white shadow-2xl flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2DDD5] shrink-0">
              <div>
                <div className="font-bold text-[15px] text-[#1E1A14]">Add Customer</div>
                <div className="text-[12px] text-[#7A746C]">Schedule a new outbound call</div>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[#F0EDE8] transition-colors cursor-pointer border-none bg-transparent"
              >
                <X size={16} color="#7A746C" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-[#4A453E] mb-1">Customer Name *</label>
                  <input required type="text" value={form.name} onChange={(e) => setField("name", e.target.value)}
                    placeholder="John Doe"
                    className="w-full px-3 py-2 text-[13px] border border-[#E2DDD5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#50381F]/30"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#4A453E] mb-1">Phone Number *</label>
                  <input required type="tel" value={form.phone} onChange={(e) => setField("phone", e.target.value)}
                    placeholder="+91 9999999999"
                    className="w-full px-3 py-2 text-[13px] border border-[#E2DDD5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#50381F]/30"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-[#4A453E] mb-1">Location</label>
                  <input type="text" value={form.location} onChange={(e) => setField("location", e.target.value)}
                    placeholder="City, State"
                    className="w-full px-3 py-2 text-[13px] border border-[#E2DDD5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#50381F]/30"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#4A453E] mb-1">Scheduled At</label>
                  <input type="datetime-local" value={form.scheduledAt} onChange={(e) => setField("scheduledAt", e.target.value)}
                    className="w-full px-3 py-2 text-[13px] border border-[#E2DDD5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#50381F]/30"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#4A453E] mb-1">Tags (comma separated)</label>
                <input type="text" value={form.tags} onChange={(e) => setField("tags", e.target.value)}
                  placeholder="VIP, New Lead"
                  className="w-full px-3 py-2 text-[13px] border border-[#E2DDD5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#50381F]/30"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#4A453E] mb-1">Notes</label>
                <textarea value={form.notes} onChange={(e) => setField("notes", e.target.value)}
                  rows={2} placeholder="Any relevant notes about this customer..."
                  className="w-full px-3 py-2 text-[13px] border border-[#E2DDD5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#50381F]/30 resize-none"
                />
              </div>

              {(DOMAIN_FIELDS[agent as ReminderDomain] || []).length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold text-[#9E9890] uppercase tracking-wider mb-2">
                    {DOMAIN_LABELS[agent as ReminderDomain] || agent} Details
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {(DOMAIN_FIELDS[agent as ReminderDomain] || []).map((f) => (
                      <div key={f.key}>
                        <label className="block text-[12px] font-semibold text-[#4A453E] mb-1">{f.label}</label>
                        <input
                          type={f.type}
                          value={(form.attributes[f.key] as string) || ""}
                          onChange={(e) => setAttr(f.key, e.target.value)}
                          className="w-full px-3 py-2 text-[13px] border border-[#E2DDD5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#50381F]/30"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </form>

            <div className="shrink-0 border-t border-[#E2DDD5] px-6 py-4 flex gap-3">
              <button type="button" onClick={() => setDrawerOpen(false)}
                className="flex-1 py-2 text-[13px] font-medium rounded-lg border border-[#E2DDD5] bg-white text-[#7A746C] cursor-pointer hover:bg-[#F9F9F7] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSubmit}
                disabled={saving || !form.name || !form.phone}
                className="flex-1 py-2 text-[13px] font-semibold rounded-lg bg-[#50381F] text-white border-none cursor-pointer hover:bg-[#3D2914] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? "Saving…" : "Add Customer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          CSV IMPORT MODAL
      ══════════════════════════════════════════════════════════════ */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full sm:w-[560px] max-w-[100vw] max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2DDD5] shrink-0">
              <div>
                <div className="font-bold text-[15px] text-[#1E1A14]">Bulk Import via CSV</div>
                <div className="text-[12px] text-[#7A746C]">Upload a CSV file to import multiple customers at once</div>
              </div>
              <button
                onClick={() => { setImportOpen(false); setImportFile(null); setImportPreview([]); }}
                className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[#F0EDE8] transition-colors cursor-pointer border-none bg-transparent"
              >
                <X size={16} color="#7A746C" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
              <div
                className="border-2 border-dashed border-[#E2DDD5] rounded-xl p-8 text-center cursor-pointer hover:border-[#50381F] hover:bg-[#FDF8F3] transition-all"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); }}
              >
                <input ref={fileRef} type="file" accept=".csv,.xlsx" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
                <Upload size={28} className="mx-auto mb-2 text-[#50381F]" />
                {importFile ? (
                  <div>
                    <div className="text-[13px] font-semibold text-[#1E1A14]">{importFile.name}</div>
                    <div className="text-[12px] text-[#7A746C]">{(importFile.size / 1024).toFixed(1)} KB · {importPreview.length} rows parsed</div>
                  </div>
                ) : (
                  <div>
                    <div className="text-[13px] font-semibold text-[#4A453E]">Drag & drop or click to upload</div>
                    <div className="text-[12px] text-[#9E9890] mt-0.5">Supports .csv files</div>
                  </div>
                )}
              </div>

              <button
                type="button" onClick={downloadTemplate}
                className="flex items-center gap-1.5 text-[12px] text-[#7A746C] hover:text-[#1E1A14] transition-colors cursor-pointer border-none bg-transparent self-start"
              >
                <Download size={13} /> Download CSV template
              </button>

              {importPreview.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold text-[#9E9890] uppercase tracking-wider mb-2">
                    Preview (first {importPreview.length} rows)
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-[#E2DDD5]">
                    <table className="w-full text-[11px] border-collapse">
                      <thead className="bg-[#FDFDFD]">
                        <tr>
                          {Object.keys(importPreview[0]).map((h) => (
                            <th key={h} className="text-left px-2 py-1.5 border-b border-[#E2DDD5] text-[#7A746C] font-semibold whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.map((row, i) => (
                          <tr key={i} className={i < importPreview.length - 1 ? "border-b border-[#F0EDE8]" : ""}>
                            {Object.values(row).map((val, j) => (
                              <td key={j} className="px-2 py-1.5 text-[#4A453E] whitespace-nowrap max-w-[120px] truncate">{val}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-[#E2DDD5] px-6 py-4 flex gap-3">
              <button
                onClick={() => { setImportOpen(false); setImportFile(null); setImportPreview([]); }}
                className="flex-1 py-2 text-[13px] font-medium rounded-lg border border-[#E2DDD5] bg-white text-[#7A746C] cursor-pointer hover:bg-[#F9F9F7] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImportConfirm}
                disabled={!importFile || importing}
                className="flex-1 py-2 text-[13px] font-semibold rounded-lg bg-[#50381F] text-white border-none cursor-pointer hover:bg-[#3D2914] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {importing ? "Importing…" : `Import ${importPreview.length > 0 ? `(${importPreview.length} rows)` : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
