/**
 * rbac.ts — Role-Based Access Control helpers
 *
 * ── Role Derivation (two-step) ────────────────────────────────────────────────
 *  1. Check Firebase Custom Claims (set server-side for production).
 *  2. Fall back to email-based list below for the MVP / demo phase.
 *
 * ── Permission Capability Matrix ─────────────────────────────────────────────
 *  Centralises what each role can do so guard components never hard-code role
 *  strings — they call `hasPermission(role, "capability")` instead.
 *
 * ── Agent Subscriptions ───────────────────────────────────────────────────────
 *  `getSubscribedAgentsFromFirestore(orgId)` reads from:
 *    Firestore: organizations/{orgId}.subscribedAgents
 *  This is written by the `createCustomerAccount` Cloud Function.
 *  The sync `getSubscribedAgents` fallback is kept only for the 6 demo orgs
 *  that use email-derived orgIds (no Firestore record).
 */

import type { UserRole } from "./auth";
import type { AgentType } from "./types";
import type { IdTokenResult } from "firebase/auth";
import { doc, getDoc, collection, getDocs, query, where, limit, Timestamp } from "firebase/firestore";
import { db } from "./firebase";
import { safeLog } from "./safeLog";

// ── Platform Admin email list (MVP/demo seed) ─────────────────────────────────
// Add / remove platform admin emails here. These are only used when Firebase
// Custom Claims are NOT present (i.e., during the demo phase).
// In production, set the `role` custom claim server-side and this list is ignored.

export const PLATFORM_ADMIN_EMAILS: string[] = [
  "admin@voicera.ai",
  "admin@vocera.ai",
  "platform@heuristiclabs.ai",
  "admin@heuristiclabs.ai",
];

// ── Role derivation ────────────────────────────────────────────────────────────

/**
 * Derives the user's role from a Firebase token result.
 *
 * Priority:
 *  1. Firebase Custom Claim `role` (set server-side — production path)
 *  2. Email in PLATFORM_ADMIN_EMAILS list (MVP / demo fallback)
 *  3. Default to `customer_admin`
 */
export function getRoleFromTokenResult(
  tokenResult: IdTokenResult,
  email: string
): UserRole {
  // 1. Custom Claims (production path)
  const claimRole = tokenResult.claims["role"] as string | undefined;
  if (claimRole === "platform_admin") return "platform_admin";
  if (claimRole === "customer_admin") return "customer_admin";
  if (claimRole === "customer_user")  return "customer_user";

  // 2. Email seed list (demo/MVP fallback)
  if (PLATFORM_ADMIN_EMAILS.includes(email.toLowerCase().trim())) {
    return "platform_admin";
  }

  // 3. Default
  return "customer_admin";
}

/**
 * Stable org document id for a Firebase Auth user — one org per account.
 */
export function orgIdFromOwnerUid(uid: string): string {
  return `org-${uid}`;
}

/**
 * Derives orgId from custom claims. Falls back to uid- or email-based slug.
 */
export function getOrgIdFromTokenResult(
  tokenResult: IdTokenResult,
  email: string
): string | undefined {
  const claimOrg = tokenResult.claims["orgId"] as string | undefined;
  if (claimOrg) return claimOrg;

  // For platform admins there is no tenant org
  const role = getRoleFromTokenResult(tokenResult, email);
  if (role === "platform_admin") return undefined;

  // Prefer uid when available (matches createCustomerAccount org ids)
  const uid = (tokenResult.claims["sub"] ?? tokenResult.claims["user_id"]) as string | undefined;
  if (uid) return orgIdFromOwnerUid(uid);

  // Legacy demo fallback: slug from full email (not domain — avoids collisions)
  const normalized = email.trim().toLowerCase();
  return `org-${normalized.replace(/@/g, "-at-").replace(/\./g, "-")}`;
}

// ── Permission Capability Matrix ───────────────────────────────────────────────

export type Permission =
  // Platform-level
  | "manage:accounts"          // create / suspend customer accounts
  | "manage:subscriptions"     // assign / revoke agents per tenant
  | "view:platform_analytics"  // see cross-tenant metrics
  | "view:system_health"       // see infra health panel
  // Customer-level
  | "view:customer_data"       // menus, transcripts, customer records
  | "manage:agents"            // configure and deploy agents
  | "manage:campaigns"         // create / edit outbound campaigns
  | "view:analytics"           // see call analytics for own org
  | "manage:knowledge_base"    // upload / edit KB documents
  // Shared
  | "view:live_calls";         // watch live call monitoring

const PERMISSIONS: Record<UserRole, Permission[]> = {
  platform_admin: [
    "manage:accounts",
    "manage:subscriptions",
    "view:platform_analytics",
    "view:system_health",
  ],
  customer_admin: [
    "view:customer_data",
    "manage:agents",
    "manage:campaigns",
    "view:analytics",
    "manage:knowledge_base",
    "view:live_calls",
  ],
  customer_user: [
    // Scaffolded — Customer Admin can grant subset of customer_admin permissions
    "view:customer_data",
    "view:analytics",
    "view:live_calls",
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return PERMISSIONS[role]?.includes(permission) ?? false;
}

// ── Agent Subscriptions ────────────────────────────────────────────────────────

/**
 * Demo seed map — only used for orgs whose orgId was derived from their email
 * domain (the 6 pre-existing demo accounts). New accounts created via the
 * Platform Admin console get their subscriptions from Firestore instead.
 */
const DEMO_ORG_SUBSCRIPTIONS: Record<string, AgentType[]> = {
  "org-example-com":       ["restaurant", "loan"],
  "org-restaurant-co-in":  ["restaurant"],
  "org-finance-corp-com":  ["loan", "banking"],
  "org-healthcare-in":     ["healthcare"],
  "org-realty-io":         ["real-estate"],
  "org-shopnow-com":       ["shop", "customer-support"],
};

/**
 * Sync fallback — resolves agent subscriptions for the 6 seeded demo orgs
 * whose orgIds are email-derived (no Firestore record). Returns `undefined`
 * for unknown orgs so the async Firestore path takes over.
 */
export function getSubscribedAgents(orgId: string | undefined): AgentType[] | undefined {
  if (!orgId) return undefined;
  return DEMO_ORG_SUBSCRIPTIONS[orgId]; // undefined → caller should use Firestore
}

const VALID_PLANS = ["Starter", "Growth", "Enterprise"] as const;
const VALID_STATUSES = ["active", "suspended", "trial"] as const;

export interface OrgRecord {
  subscribedAgents: AgentType[];
  status: MockOrganisation["status"];
  name?: string;
  plan?: MockOrganisation["plan"];
  totalCalls: number;
  creditsLimit: number;
}

function parseOrgData(data: Record<string, unknown>, fallbackId?: string): OrgRecord {
  const agents = data?.subscribedAgents;
  const status = VALID_STATUSES.includes(data?.status as MockOrganisation["status"])
    ? (data.status as MockOrganisation["status"])
    : "active";
  const plan = VALID_PLANS.includes(data?.plan as MockOrganisation["plan"])
    ? (data.plan as MockOrganisation["plan"])
    : "Starter";
  const totalCalls = typeof data.totalCalls === "number" ? data.totalCalls : 0;
  const creditsLimit =
    typeof data.creditsLimit === "number"
      ? data.creditsLimit
      : plan === "Enterprise"
        ? 100000
        : plan === "Growth"
          ? 20000
          : 5000;
  return {
    subscribedAgents: Array.isArray(agents) ? [...new Set(agents as AgentType[])] : [],
    status,
    name: String(data.orgName ?? data.name ?? fallbackId ?? ""),
    plan,
    totalCalls,
    creditsLimit,
  };
}

/**
 * Reads organisation subscription + status from Firestore.
 */
export async function getOrgFromFirestore(
  orgId: string
): Promise<OrgRecord | undefined> {
  if (!db) return undefined;
  try {
    const snap = await getDoc(doc(db, "organizations", orgId));
    if (!snap.exists()) return undefined;
    return parseOrgData(snap.data() as Record<string, unknown>, orgId);
  } catch (err) {
    safeLog.warn("Firestore org fetch failed, using demo fallback", err);
    return undefined;
  }
}

/** Finds an org by customer login email (fallback when token orgId is stale). */
export async function getOrgByEmailFromFirestore(
  email: string
): Promise<(OrgRecord & { orgId: string }) | undefined> {
  if (!db) return undefined;
  try {
    const normalized = email.trim().toLowerCase();
    const snap = await getDocs(
      query(collection(db, "organizations"), where("email", "==", normalized), limit(1)),
    );
    if (snap.empty) return undefined;
    const d = snap.docs[0];
    return { orgId: d.id, ...parseOrgData(d.data() as Record<string, unknown>, d.id) };
  } catch (err) {
    safeLog.warn("Firestore org-by-email fetch failed", err);
    return undefined;
  }
}

/**
 * PRIMARY path (production) — reads `organizations/{orgId}.subscribedAgents`
 * from Firestore. This document is written by the `createCustomerAccount`
 * Cloud Function when Platform Admin creates a new tenant.
 *
 * Returns:
 *  - `AgentType[]`  — list of subscribed agent types (may be empty)
 *  - `undefined`    — org document not found in Firestore (falls through to demo seed)
 */
export async function getSubscribedAgentsFromFirestore(
  orgId: string
): Promise<AgentType[] | undefined> {
  const org = await getOrgFromFirestore(orgId);
  return org?.subscribedAgents;
}

function formatOrgCreatedAt(createdAt: unknown): string {
  if (createdAt instanceof Timestamp) {
    return createdAt.toDate().toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  }
  if (typeof createdAt === "string" && createdAt) return createdAt;
  return "—";
}

/** Loads all tenant organisations from Firestore for the Admin console. */
export async function fetchOrganizationsFromFirestore(): Promise<MockOrganisation[]> {
  if (!db) return [];
  const snap = await getDocs(collection(db, "organizations"));
  return snap.docs.map((d) => {
    const data = d.data();
    const plan = VALID_PLANS.includes(data.plan) ? data.plan : "Starter";
    const status = VALID_STATUSES.includes(data.status) ? data.status : "active";
    return {
      id: d.id,
      name: (data.orgName ?? data.name ?? d.id) as string,
      email: (data.email ?? "") as string,
      plan,
      status,
      subscribedAgents: Array.isArray(data.subscribedAgents)
        ? [...new Set(data.subscribedAgents as AgentType[])]
        : [],
      totalCalls: typeof data.totalCalls === "number" ? data.totalCalls : 0,
      creditsLimit: typeof data.creditsLimit === "number" ? data.creditsLimit : undefined,
      createdAt: formatOrgCreatedAt(data.createdAt),
      contactName: (data.contactName ?? "") as string,
    };
  });
}

// ── Mock Organisation Catalog (for Admin Console) ─────────────────────────────

export interface MockOrganisation {
  id: string;
  name: string;
  email: string;
  plan: "Starter" | "Growth" | "Enterprise";
  status: "active" | "suspended" | "trial";
  subscribedAgents: AgentType[];
  totalCalls: number;
  creditsLimit?: number;
  createdAt: string;
  contactName: string;
}

export const MOCK_ORGANISATIONS: MockOrganisation[] = [
  {
    id: "org-spice-garden",
    name: "Spice Garden Restaurants",
    email: "ops@spicegarden.com",
    plan: "Growth",
    status: "active",
    subscribedAgents: ["restaurant"],
    totalCalls: 2847,
    createdAt: "Jan 12, 2026",
    contactName: "Priya Mehta",
  },
  {
    id: "org-swift-finance",
    name: "Swift Finance Corp",
    email: "tech@swiftfinance.in",
    plan: "Enterprise",
    status: "active",
    subscribedAgents: ["loan", "banking"],
    totalCalls: 12340,
    createdAt: "Feb 3, 2026",
    contactName: "Rahul Sharma",
  },
  {
    id: "org-medplus",
    name: "MedPlus Healthcare",
    email: "admin@medplus.in",
    plan: "Growth",
    status: "active",
    subscribedAgents: ["healthcare"],
    totalCalls: 5621,
    createdAt: "Mar 18, 2026",
    contactName: "Dr. Anita Rao",
  },
  {
    id: "org-homefinder",
    name: "HomeFinder Realty",
    email: "digital@homefinder.io",
    plan: "Starter",
    status: "trial",
    subscribedAgents: ["real-estate"],
    totalCalls: 483,
    createdAt: "May 30, 2026",
    contactName: "Suresh Nair",
  },
  {
    id: "org-trendy-shop",
    name: "Trendy Shop Online",
    email: "support@trendyshop.com",
    plan: "Growth",
    status: "active",
    subscribedAgents: ["shop", "customer-support"],
    totalCalls: 7892,
    createdAt: "Apr 7, 2026",
    contactName: "Kavya Iyer",
  },
  {
    id: "org-agro-credit",
    name: "AgroCredit Solutions",
    email: "info@agrocredit.in",
    plan: "Starter",
    status: "suspended",
    subscribedAgents: ["loan"],
    totalCalls: 1204,
    createdAt: "Mar 2, 2026",
    contactName: "Mohan Das",
  },
];
