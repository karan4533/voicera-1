import { useAgent } from "../context/AgentContext";

/** Displays the currently selected agent — read-only (no switcher). */
export function AgentSwitcher() {
  const { agent, agentDefs } = useAgent();
  const activeDef = agentDefs.find((d) => d.type === agent);

  if (agentDefs.length === 0) {
    return (
      <span className="text-[12px] font-medium text-[#9E9890]">No agents assigned</span>
    );
  }

  return (
    <span className="text-[13px] font-semibold text-[#1E1A14]">
      {activeDef?.name ?? "Agent"}
    </span>
  );
}
