import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { safeLog } from "./safeLog";

export interface AppNotification {
  id: string;
  action: string;
  title: string;
  body: string;
  href: string;
  createdAtMs: number;
  read: boolean;
}

const MEANINGFUL = new Set([
  "create_account",
  "update_account",
  "suspend_account",
  "reactivate_account",
  "update_agents",
  "offboard_account",
  "revoke_sessions",
  "mfa_enroll",
]);

function readKey(email: string) {
  return `voicera_notif_read_${email.trim().toLowerCase()}`;
}

export function loadReadIds(email: string): Set<string> {
  try {
    const raw = localStorage.getItem(readKey(email));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? new Set(parsed.filter((x) => typeof x === "string")) : new Set();
  } catch {
    return new Set();
  }
}

export function saveReadIds(email: string, ids: Set<string>) {
  try {
    localStorage.setItem(readKey(email), JSON.stringify([...ids].slice(-200)));
  } catch {
    // ignore quota / private mode
  }
}

function formatAction(action: string, isAdmin: boolean): { title: string; href: string } {
  switch (action) {
    case "create_account":
      return { title: "New customer account", href: isAdmin ? "/admin/customers" : "/dashboard" };
    case "update_account":
      return { title: "Account updated", href: isAdmin ? "/admin/customers" : "/dashboard" };
    case "suspend_account":
      return { title: "Account suspended", href: isAdmin ? "/admin/customers" : "/dashboard" };
    case "reactivate_account":
      return { title: "Account reactivated", href: isAdmin ? "/admin/customers" : "/dashboard" };
    case "update_agents":
      return { title: "Agent access changed", href: isAdmin ? "/admin/subscriptions" : "/dashboard/agents" };
    case "offboard_account":
      return { title: "Customer offboarded", href: isAdmin ? "/admin/customers" : "/dashboard" };
    case "revoke_sessions":
      return { title: "Sessions revoked", href: isAdmin ? "/admin/security" : "/dashboard" };
    case "mfa_enroll":
      return { title: "MFA enrolled", href: isAdmin ? "/admin/security" : "/dashboard" };
    case "usage_warning":
      return { title: "Credits running low", href: "/dashboard/usage" };
    default:
      return { title: action.replace(/_/g, " "), href: isAdmin ? "/admin" : "/dashboard" };
  }
}

export function relativeTime(ms: number): string {
  if (!ms) return "";
  const diff = Math.max(0, Date.now() - ms);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
}

function toNotification(
  id: string,
  data: Record<string, unknown>,
  isAdmin: boolean,
  readIds: Set<string>,
): AppNotification | null {
  const action = String(data.action || "");
  if (!MEANINGFUL.has(action)) return null;
  const ts = data.createdAt as Timestamp | undefined;
  const createdAtMs = ts?.toMillis?.() ?? 0;
  const { title, href } = formatAction(action, isAdmin);
  const detail = String(data.detail || "").slice(0, 120);
  const target = String(data.targetEmail || "");
  const body = [target, detail].filter(Boolean).join(" · ") || title;
  return {
    id,
    action,
    title,
    body,
    href,
    createdAtMs,
    read: readIds.has(id),
  };
}

export function subscribeNotifications(opts: {
  isAdmin: boolean;
  orgId?: string;
  email: string;
  onUpdate: (items: AppNotification[]) => void;
}): () => void {
  if (!db) {
    opts.onUpdate([]);
    return () => {};
  }
  const col = collection(db, "audit_events");
  const q = opts.isAdmin
    ? query(col, orderBy("createdAt", "desc"), limit(30))
    : opts.orgId
      ? query(col, where("orgId", "==", opts.orgId), limit(40))
      : null;

  if (!q) {
    opts.onUpdate([]);
    return () => {};
  }

  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => toNotification(d.id, d.data() as Record<string, unknown>, opts.isAdmin, loadReadIds(opts.email)))
        .filter((n): n is AppNotification => n != null)
        .sort((a, b) => b.createdAtMs - a.createdAtMs)
        .slice(0, 20);
      opts.onUpdate(items);
    },
    (err) => {
      safeLog.warn("notifications subscribe failed", err);
      opts.onUpdate([]);
    },
  );
}

export function markAllRead(email: string, items: AppNotification[]): AppNotification[] {
  const ids = loadReadIds(email);
  for (const item of items) ids.add(item.id);
  saveReadIds(email, ids);
  return items.map((item) => ({ ...item, read: true }));
}

export function makeUsageNotification(orgId: string, plan: string, pct: number, email: string): AppNotification {
  const id = `usage-${orgId}`;
  return {
    id,
    action: "usage_warning",
    title: "Credits running low",
    body: `${pct}% of ${plan} plan credits used`,
    href: "/dashboard/usage",
    createdAtMs: Date.now(),
    read: loadReadIds(email).has(id),
  };
}
