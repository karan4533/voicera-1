import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  Utensils, Landmark, ShoppingBag, Headphones, Stethoscope,
  Building2, Shield, Users, CreditCard, Cpu, Bot, Search, Rocket,
} from "lucide-react";
import { PageHeader } from "../components/shared/PageHeader";
import { AGENT_TYPES } from "../context/AgentContext";
import { useAuth } from "../context/AuthContext";
import type { AgentType } from "../lib/types";

const ICON_MAP: Record<string, React.ElementType> = {
  Utensils, Landmark, ShoppingBag, HeadphonesIcon: Headphones,
  Stethoscope, Building2, Shield, Users, CreditCard, Cpu, Bot,
};

function TemplateIcon({ name, size = 16 }: { name: string; size?: number }) {
  const Icon = ICON_MAP[name] ?? Bot;
  return <Icon size={size} />;
}

/**
 * Agent Library — template catalog in tabular form.
 * Selecting Configure & Launch opens the configuration flow.
 */
export function AgentLibraryPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [search, setSearch] = useState("");

  const subscribed = session?.user.subscribedAgents;

  const templates = useMemo(() => {
    const q = search.toLowerCase().trim();
    return AGENT_TYPES.filter((t) => {
      if (subscribed && subscribed.length > 0 && !subscribed.includes(t.id as AgentType)) {
        return false;
      }
      if (!q) return true;
      return (
        t.label.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
      );
    });
  }, [search, subscribed]);

  const openConfigure = (type: AgentType) => {
    navigate(`/dashboard/configure?template=${type}`);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 mb-5">
        <PageHeader
          title="Agent Library"
          subtitle="Catalog of agent templates by use case — select one to configure and launch"
        />
      </div>

      <div className="relative mb-4 max-w-md shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9E9890]" />
        <input
          type="text"
          placeholder="Search templates by name or category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 h-10 text-[13px] border border-[#E2DDD5] rounded-lg bg-white focus:outline-none focus:border-[#C9B99E] focus:ring-1 focus:ring-[#C9B99E]"
        />
      </div>

      <div className="flex-1 overflow-auto rounded-xl border border-[#E2DDD5] bg-white shadow-sm">
        <table className="w-full border-collapse text-[13px]">
          <thead className="sticky top-0 bg-[#F7F4EF] z-10">
            <tr className="border-b border-[#E2DDD5]">
              <th className="text-left text-[11px] font-bold text-[#7A746C] uppercase tracking-wider px-5 py-3 whitespace-nowrap">
                Template
              </th>
              <th className="text-left text-[11px] font-bold text-[#7A746C] uppercase tracking-wider px-4 py-3 whitespace-nowrap">
                Category
              </th>
              <th className="text-left text-[11px] font-bold text-[#7A746C] uppercase tracking-wider px-4 py-3">
                Description
              </th>
              <th className="text-right text-[11px] font-bold text-[#7A746C] uppercase tracking-wider px-5 py-3 whitespace-nowrap">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {templates.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-16 text-[#9E9890]">
                  <Bot size={36} className="mx-auto mb-3 opacity-30" />
                  <p className="text-[14px] font-medium m-0">No templates match your search</p>
                </td>
              </tr>
            ) : (
              templates.map((t, i) => (
                <tr
                  key={t.id}
                  className={`hover:bg-[#FAFAF8] transition-colors ${
                    i < templates.length - 1 ? "border-b border-[#F0EDE8]" : ""
                  }`}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: `${t.color}15`,
                          color: t.color,
                          border: `1px solid ${t.color}30`,
                        }}
                      >
                        <TemplateIcon name={t.icon} />
                      </div>
                      <div>
                        <div className="font-bold text-[#1E1A14]">{t.label}</div>
                        <div className="text-[11px] text-[#7A746C] font-mono mt-0.5">{t.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-[11px] font-bold text-[#4A453E] bg-[#F7F4EF] border border-[#E2DDD5] px-2 py-1 rounded-md whitespace-nowrap">
                      {t.category}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-[#7A746C] max-w-md">
                    <span className="line-clamp-2">{t.description}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => openConfigure(t.id as AgentType)}
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border-none bg-[#50381F] text-white text-[12px] font-semibold cursor-pointer hover:bg-[#3D2914] transition-colors whitespace-nowrap"
                    >
                      <Rocket size={13} />
                      Configure &amp; Launch
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
