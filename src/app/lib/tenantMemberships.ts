/**
 * tenantMemberships.ts — email → purchased tenant memberships (demo / MVP seed)
 *
 * Production resolves memberships from Firebase Auth + Firestore.
 * Demo mode uses this map so login mirrors invite-only / purchased access:
 *   - Unknown emails cannot enter a workspace
 *   - Single-tenant users auto-enter their org
 *   - Multi-tenant users see a picker of *their* orgs only
 */

import type { AgentType } from "./types";
import { PLATFORM_ADMIN_EMAILS, getSubscribedAgents } from "./rbac";

export interface TenantInfo {
  id: string;
  name: string;
  detail: string;
  primaryAgent: AgentType;
}

/** Catalog of demo customer tenants (purchased workspaces). */
export const DEMO_TENANT_CATALOG: Record<string, TenantInfo> = {
  "org-example-com": {
    id: "org-example-com",
    name: "Spice Garden Restaurants",
    detail: "Restaurant Ordering agents",
    primaryAgent: "restaurant",
  },
  "org-finance-corp-com": {
    id: "org-finance-corp-com",
    name: "Swift Finance Corp",
    detail: "Loan / EMI follow-up agents",
    primaryAgent: "loan",
  },
};

/**
 * Provisioned demo users → org ids they belong to.
 * Platform admins are handled separately via PLATFORM_ADMIN_EMAILS.
 */
const DEMO_USER_MEMBERSHIPS: Record<string, string[]> = {
  "demo@spicegarden.com": ["org-example-com"],
  "admin@spicegarden.com": ["org-example-com"],
  "demo@swiftfinance.com": ["org-finance-corp-com"],
  "admin@swiftfinance.com": ["org-finance-corp-com"],
  // Multi-tenant consultant / partner account
  "multi@heuristiclabs.ai": ["org-example-com", "org-finance-corp-com"],
  "m1karan2004@gmail.com": ["org-example-com", "org-finance-corp-com"],
  // Demo Google SSO identity (AuthContext loginWithGoogle)
  "demo.sso@spicegarden.com": ["org-example-com"],
};

/** Accounts shown on the login demo banner. */
export const DEMO_LOGIN_ACCOUNTS = [
  { email: "demo@spicegarden.com", unlocks: "Spice Garden — Restaurant Ordering" },
  { email: "demo@swiftfinance.com", unlocks: "Swift Finance — Loan Collection" },
  { email: "multi@heuristiclabs.ai", unlocks: "Both tenants (workspace picker)" },
  { email: "admin@voicera.ai", unlocks: "Platform Admin console" },
] as const;

export function isPlatformAdminEmail(email: string): boolean {
  return PLATFORM_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

/** Org ids the user is provisioned into (empty for unknown / unprovisioned). */
export function getMembershipOrgIds(email: string): string[] {
  const normalized = email.trim().toLowerCase();
  if (isPlatformAdminEmail(normalized)) return [];
  return DEMO_USER_MEMBERSHIPS[normalized] ?? [];
}

/** Full tenant records for the picker / auto-enter (only orgs the user belongs to). */
export function listUserTenants(email: string): TenantInfo[] {
  return getMembershipOrgIds(email)
    .map((id) => DEMO_TENANT_CATALOG[id])
    .filter((t): t is TenantInfo => Boolean(t));
}

export function getTenantInfo(orgId: string): TenantInfo | undefined {
  return DEMO_TENANT_CATALOG[orgId];
}

/** Whether this email may switch into the given org. */
export function canAccessTenant(email: string, orgId: string): boolean {
  if (isPlatformAdminEmail(email)) return false;
  return getMembershipOrgIds(email).includes(orgId);
}

/**
 * Primary org for session bootstrap:
 * - 1 membership → that org
 * - many → null until picker (caller should not assume agents yet)
 * - none / platform admin → undefined
 */
export function resolvePrimaryOrgId(email: string): string | undefined {
  const orgs = getMembershipOrgIds(email);
  if (orgs.length === 1) return orgs[0];
  return undefined;
}

export function agentsForOrg(orgId: string): AgentType[] {
  return getSubscribedAgents(orgId) ?? [];
}
