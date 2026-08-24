import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import type { AgentType, AgentDefinition, AgentStatus } from "../lib/types";

const AGENT_KEY = "vocera_selected_agent";

// ── Full Agent Catalog ─────────────────────────────────────────────────────────

export const AGENT_TYPES: { id: AgentType; label: string; category: string; icon: string; color: string; description: string }[] = [
  { id: "restaurant",       label: "Restaurant Agent",       category: "Food & Beverage",  icon: "Utensils",       color: "#16A34A", description: "Order taking, reservations, and delivery management" },
  { id: "loan",             label: "Loan Collection Agent",  category: "Finance",          icon: "Landmark",       color: "#2563EB", description: "EMI reminders, payment commitments, and follow-ups" },
  { id: "shop",             label: "Shop Agent",             category: "Retail",           icon: "ShoppingBag",    color: "#9333EA", description: "Product queries, orders, and customer support" },
  { id: "customer-support", label: "Customer Support Agent", category: "Support",          icon: "HeadphonesIcon", color: "#0891B2", description: "Issue resolution, escalation, and satisfaction" },
  { id: "healthcare",       label: "Healthcare Agent",       category: "Healthcare",       icon: "Stethoscope",    color: "#DC2626", description: "Appointment booking, reminders, and patient follow-up" },
  { id: "real-estate",      label: "Real Estate Agent",      category: "Real Estate",      icon: "Building2",      color: "#D97706", description: "Property enquiries, site visits, and lead nurturing" },
  { id: "insurance",        label: "Insurance Agent",        category: "Insurance",        icon: "Shield",         color: "#7C3AED", description: "Policy renewals, claims, and customer onboarding" },
  { id: "hr",               label: "HR Agent",               category: "Human Resources",  icon: "Users",          color: "#059669", description: "Candidate screening, scheduling, and HR queries" },
  { id: "banking",          label: "Banking Agent",          category: "Finance",          icon: "CreditCard",     color: "#1D4ED8", description: "Account services, fraud alerts, and support" },
  { id: "custom",           label: "Custom Agent",           category: "Enterprise",       icon: "Cpu",            color: "#50381F", description: "Fully configurable agent for any business domain" },
];

// ── Active deployed agents (displayed in sidebar agent switcher) ───────────────

export const AGENTS: { id: AgentType; label: string }[] = [
  { id: "restaurant", label: "Restaurant Ordering" },
  { id: "loan",       label: "Loan Collection" },
];

// ── Rich mock stats for the two pre-seeded demo agents ────────────────────────
//
// These give the demo orgs realistic performance numbers. Any other agent type
// that a new customer subscribes to starts with zeroed stats and "draft" status
// — the correct enterprise onboarding state before the agent is configured.

const SEEDED_AGENT_DEFS: Record<string, Omit<AgentDefinition, "id" | "type" | "category" | "icon" | "color" | "description">> = {
  restaurant: {
    name: "Restaurant Ordering",
    status: "active",
    stats: { callsToday: 48, resolutionRate: 94, avgDuration: "02:48" },
    tone: "Friendly & Warm",
    languages: ["English", "Hindi", "Tamil"],
    createdAt: "Jun 1, 2026",
  },
  loan: {
    name: "Loan Collection",
    status: "active",
    stats: { callsToday: 21, resolutionRate: 78, avgDuration: "06:10" },
    tone: "Professional & Empathetic",
    languages: ["English", "Hindi", "Gujarati"],
    createdAt: "Jun 5, 2026",
  },
};

// ── Agent Definition Builder ──────────────────────────────────────────────────
//
// Derives a full AgentDefinition[] from the customer's subscribedAgents list.
// For each subscribed agent type:
//   - If it has a seeded definition (the 2 demo agents), use that with rich stats.
//   - Otherwise, synthesise a fresh definition from the AGENT_TYPES catalog with
//     "draft" status and zero stats — the correct state for a newly provisioned agent.
//
// When subscribedAgents is undefined (platform_admin), returns definitions for
// ALL agent types (unchanged behaviour).

function buildAgentDefs(subscribedAgents: AgentType[] | undefined): AgentDefinition[] {
  const typesToBuild: AgentType[] = subscribedAgents ?? AGENT_TYPES.map((a) => a.id as AgentType);

  const now = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return typesToBuild.reduce<AgentDefinition[]>((acc, agentType) => {
    const catalog = AGENT_TYPES.find((a) => a.id === agentType);
    if (!catalog) return acc;

    const seeded = SEEDED_AGENT_DEFS[agentType];

    acc.push({
      id:          seeded ? `agent-${agentType}-1` : `agent-${agentType}-new`,
      type:        agentType,
      name:        seeded?.name        ?? catalog.label,
      category:    catalog.category,
      description: catalog.description,
      icon:        catalog.icon,
      color:       catalog.color,
      status:      (seeded?.status     ?? "draft") as AgentStatus,
      stats:       seeded?.stats       ?? { callsToday: 0, resolutionRate: 0, avgDuration: "00:00" },
      tone:        seeded?.tone,
      languages:   seeded?.languages,
      createdAt:   seeded?.createdAt   ?? now,
    });
    return acc;
  }, []);
}

// ── Context ────────────────────────────────────────────────────────────────────

interface AgentContextValue {
  agent: AgentType;
  agentLabel: string;
  setAgent: (agent: AgentType) => void;
  agentDefs: AgentDefinition[];
  addAgentDef: (def: Omit<AgentDefinition, "id" | "createdAt" | "stats">) => void;
  updateAgentStatus: (id: string, status: AgentStatus) => void;
  cloneAgent: (id: string) => void;
}

const AgentContext = createContext<AgentContextValue | null>(null);

export function AgentProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();

  // Memoised so buildAgentDefs only re-runs when subscribedAgents actually changes,
  // not on every parent re-render.
  const subscribedKey = session?.user.subscribedAgents?.join(",");
  const initialDefs = useMemo(
    () => buildAgentDefs(session?.user.subscribedAgents),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subscribedKey],
  );

  const [agent, setAgentState] = useState<AgentType>("restaurant");

  const [agentDefs, setAgentDefs] = useState<AgentDefinition[]>([]);

  // Re-build agentDefs whenever the session's subscribedAgents list changes.
  useEffect(() => {
    setAgentDefs(initialDefs);

    if (initialDefs.length === 0) return;

    const stored = sessionStorage.getItem(AGENT_KEY) as AgentType | null;
    const validStored = stored && initialDefs.some((d) => d.type === stored);
    const next = validStored ? stored : initialDefs[0].type;

    setAgentState(next);
    sessionStorage.setItem(AGENT_KEY, next);
  }, [initialDefs]);

  const setAgent = useCallback((a: AgentType) => {
    setAgentState(a);
    sessionStorage.setItem(AGENT_KEY, a);
  }, []);

  // Allows adding a brand-new custom agent definition at runtime (e.g. from the
  // Custom Agent builder flow). Not used in the admin provisioning path.
  const addAgentDef = useCallback((def: Omit<AgentDefinition, "id" | "createdAt" | "stats">) => {
    const newDef: AgentDefinition = {
      ...def,
      id: `agent-${def.type}-${Date.now()}`,
      createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      stats: { callsToday: 0, resolutionRate: 0, avgDuration: "00:00" },
    };
    setAgentDefs((prev) => [newDef, ...prev]);
  }, []);

  const updateAgentStatus = useCallback((id: string, status: AgentStatus) => {
    setAgentDefs((prev) => prev.map((d) => d.id === id ? { ...d, status } : d));
  }, []);

  const cloneAgent = useCallback((id: string) => {
    setAgentDefs((prev) => {
      const original = prev.find((d) => d.id === id);
      if (!original) return prev;
      const cloned: AgentDefinition = {
        ...original,
        id: `agent-${original.type}-${Date.now()}`,
        name: `${original.name} (Copy)`,
        status: "draft",
        createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        stats: { callsToday: 0, resolutionRate: 0, avgDuration: "00:00" },
      };
      return [cloned, ...prev];
    });
  }, []);

  const agentLabel = agentDefs.find((d) => d.type === agent)?.name ?? "Agent";

  return (
    <AgentContext.Provider value={{ agent, agentLabel, setAgent, agentDefs, addAgentDef, updateAgentStatus, cloneAgent }}>
      {children}
    </AgentContext.Provider>
  );
}

export function useAgent() {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error("useAgent must be used within AgentProvider");
  return ctx;
}
