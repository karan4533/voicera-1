import { useEffect, useRef, useState } from "react";
import {
  BookOpen, Upload, Trash2, RefreshCw, FileText, Search,
} from "lucide-react";
import { PageHeader } from "../components/shared/PageHeader";
import { useAgent } from "../context/AgentContext";
import {
  getKnowledgeFiles,
  uploadKnowledgeFile,
  deleteKnowledgeFile,
  reindexKnowledgeFile,
} from "../lib/api";
import type { KnowledgeFile } from "../lib/types";

function StatusPill({ status }: { status: KnowledgeFile["status"] }) {
  const map: Record<KnowledgeFile["status"], { label: string; color: string; bg: string }> = {
    indexed:  { label: "Indexed",  color: "#15803D", bg: "#DCFCE7" },
    indexing: { label: "Indexing", color: "#2563EB", bg: "#DBEAFE" },
    pending:  { label: "Pending",  color: "#92400E", bg: "#FEF3C7" },
    error:    { label: "Error",    color: "#B91C1C", bg: "#FEE2E2" },
  };
  const s = map[status] ?? map.pending;
  return (
    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ color: s.color, backgroundColor: s.bg }}>
      {s.label}
    </span>
  );
}

/** Agent-scoped knowledge base — part of Agent Workspace */
export function KnowledgePage() {
  const { agentLabel } = useAgent();
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"menu" | "faq">("faq");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const reload = () => {
    getKnowledgeFiles().then((data) => {
      setFiles(data);
      setLoading(false);
    });
  };

  useEffect(() => {
    reload();
    const id = setInterval(reload, 4000);
    return () => clearInterval(id);
  }, []);

  const filtered = files.filter((f) => {
    const q = search.toLowerCase();
    return !q || f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q);
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const created = await uploadKnowledgeFile(file, category);
      setFiles((prev) => [created, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteKnowledgeFile(id);
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleReindex = async (id: string) => {
    await reindexKnowledgeFile(id);
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status: "indexing" } : f)));
  };

  return (
    <div>
      <PageHeader
        title="Knowledge"
        subtitle={`Documents and FAQs for ${agentLabel} — indexed for voice answers in this agent workspace`}
        action={
          <div className="flex items-center gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as "menu" | "faq")}
              className="h-9 px-3 text-[13px] border border-[#E2DDD5] rounded-lg bg-white"
            >
              <option value="faq">FAQ / Policy</option>
              <option value="menu">Menu / Catalog</option>
            </select>
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border-none bg-[#50381F] text-white text-[13px] font-semibold cursor-pointer hover:bg-[#3D2914] disabled:opacity-60"
            >
              <Upload size={14} />
              {uploading ? "Uploading…" : "Upload"}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt,.csv,.xlsx"
              className="hidden"
              onChange={handleUpload}
            />
          </div>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg border border-[#FECACA] bg-[#FEE2E2] px-3 py-2 text-[13px] text-[#DC2626]">
          {error}
        </div>
      )}

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9E9890]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search knowledge files…"
          className="w-full h-10 pl-9 pr-3 text-[13px] border border-[#E2DDD5] rounded-lg bg-white focus:outline-none focus:border-[#C9B99E]"
        />
      </div>

      <div className="rounded-xl border border-[#E2DDD5] bg-white overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-[13px] text-[#9E9890]">Loading knowledge base…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-[#9E9890]">
            <BookOpen size={36} className="mx-auto mb-3 opacity-30" />
            <p className="m-0 text-[14px] font-medium">No documents yet for this agent</p>
            <p className="m-0 mt-1 text-[12px]">Upload PDF, DOCX, TXT, CSV, or XLSX to start indexing</p>
          </div>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead className="bg-[#F7F4EF]">
              <tr className="border-b border-[#E2DDD5]">
                <th className="text-left text-[11px] font-bold text-[#7A746C] uppercase tracking-wider px-5 py-3">File</th>
                <th className="text-left text-[11px] font-bold text-[#7A746C] uppercase tracking-wider px-4 py-3">Category</th>
                <th className="text-left text-[11px] font-bold text-[#7A746C] uppercase tracking-wider px-4 py-3">Size</th>
                <th className="text-left text-[11px] font-bold text-[#7A746C] uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-left text-[11px] font-bold text-[#7A746C] uppercase tracking-wider px-4 py-3">Uploaded</th>
                <th className="w-28 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((f, i) => (
                <tr key={f.id} className={i < filtered.length - 1 ? "border-b border-[#F0EDE8]" : ""}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-[#EDE4D8] flex items-center justify-center">
                        <FileText size={14} className="text-[#50381F]" />
                      </div>
                      <div>
                        <div className="font-semibold text-[#1E1A14]">{f.name}</div>
                        <div className="text-[11px] text-[#9E9890] font-mono">{f.format}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 capitalize text-[#4A453E]">{f.category}</td>
                  <td className="px-4 py-3.5 text-[#7A746C]">{f.size}</td>
                  <td className="px-4 py-3.5"><StatusPill status={f.status} /></td>
                  <td className="px-4 py-3.5 text-[#9E9890]">{f.uploadedAt}</td>
                  <td className="px-3 py-3.5">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        type="button"
                        title="Reindex"
                        onClick={() => handleReindex(f.id)}
                        className="h-8 w-8 flex items-center justify-center rounded-lg border-none bg-transparent hover:bg-[#F0EDE8] cursor-pointer"
                      >
                        <RefreshCw size={14} className="text-[#7A746C]" />
                      </button>
                      <button
                        type="button"
                        title="Delete"
                        onClick={() => handleDelete(f.id)}
                        className="h-8 w-8 flex items-center justify-center rounded-lg border-none bg-transparent hover:bg-[#FEE2E2] cursor-pointer"
                      >
                        <Trash2 size={14} className="text-[#DC2626]" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
