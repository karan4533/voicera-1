/**
 * Vocera PRD — Core User Flow
 *
 * Login → Dashboard → Agent Library → Configure & Launch → My Agents
 * Live Calls Monitor ↔ Call Analytics ↔ Outbound Campaign
 * Team & User Management — admin-only, tenant-wide
 */
export const CORE_SETUP_NAV = [
  { id: "dashboard",  label: "Dashboard",          path: "/dashboard",           adminOnly: false },
  { id: "library",    label: "Agent Library",      path: "/dashboard/library",   adminOnly: false },
  { id: "configure",  label: "Configure & Launch", path: "/dashboard/configure", adminOnly: true },
  { id: "agents",     label: "My Agents",          path: "/dashboard/agents",    adminOnly: false },
] as const;

export const OPERATIONS_NAV = [
  { id: "live",       label: "Live Calls",         path: "/dashboard/live-calls", adminOnly: false },
  { id: "analytics",  label: "Call Analytics",     path: "/dashboard/analytics",  adminOnly: false },
  { id: "campaigns",  label: "Outbound Campaign",  path: "/dashboard/campaigns",  adminOnly: true },
] as const;

export const TENANT_ADMIN_NAV = [
  { id: "team",  label: "Team & Users",    path: "/dashboard/team",  adminOnly: true },
  { id: "usage", label: "Usage & credits", path: "/dashboard/usage", adminOnly: false },
] as const;

/** @deprecated — use CORE_SETUP_NAV / OPERATIONS_NAV */
export const TENANT_NAV = CORE_SETUP_NAV;
export const AGENT_WORKSPACE_NAV = OPERATIONS_NAV;
export const WORKFLOW_STEPS = [
  ...CORE_SETUP_NAV.map((s, i) => ({ ...s, n: i + 2, inNav: true })),
] as const;
