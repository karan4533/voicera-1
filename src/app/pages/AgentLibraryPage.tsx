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

function TemplateIcon({ name, size = 22 }: { name: string; size?: number }) {
  const Icon = ICON_MAP[name] ?? Bot;
  return <Icon size={size} />;
}

/**
 * Agent Library — catalog of templates grouped by use case.
 * Selecting a template opens Configure & Launch (CustomizePage).
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

  const grouped = useMemo(() => {
    const map = new Map<string, typeof templates>();
    for (const t of templates) {
      const list = map.get(t.category) ?? [];
      list.push(t);
      map.set(t.category, list);
    }
    return Array.from(map.entries());
  }, [templates]);

  const openConfigure = (type: AgentType) => {
    navigate(`/dashboard/configure?template=${type}`);
  };

  return (
    <div>
      <PageHeader
        title="Agent Library"
        subtitle="Catalog of agent templates by use case — select one to configure and launch"
      />

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9E9890]" />
        <input
          type="text"
          placeholder="Search templates by name or category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 h-10 text-[13px] border border-[#E2DDD5] rounded-lg bg-white focus:outline-none focus:border-[#C9B99E] focus:ring-1 focus:ring-[#C9B99E]"
        />
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-xl border border-[#E2DDD5] bg-white py-16 text-center text-[#9E9890]">
          <Bot size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-[14px] font-medium m-0">No templates match your search</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {grouped.map(([category, items]) => (
            <section key={category}>
              <h2 className="m-0 mb-3 text-[12px] font-bold uppercase tracking-wider text-[#9E9890]">
                {category}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {items.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => openConfigure(t.id as AgentType)}
                    className="text-left bg-white border border-[#E2DDD5] rounded-xl p-5 hover:border-[#C9B99E] hover:shadow-sm transition-all cursor-pointer"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div
                        className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${t.color}15`, color: t.color, border: `1px solid ${t.color}30` }}
                      >
                        <TemplateIcon name={t.icon} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-[14px] text-[#1E1A14] leading-snug">{t.label}</div>
                        <div className="text-[11px] text-[#9E9890] mt-0.5">{t.category}</div>
                      </div>
                    </div>
                    <p className="m-0 mb-4 text-[13px] text-[#7A746C] leading-relaxed line-clamp-2">
                      {t.description}
                    </p>
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#50381F]">
                      <Rocket size={13} />
                      Configure &amp; Launch
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
