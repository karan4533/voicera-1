import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Bell } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getOrgFromFirestore } from "../lib/rbac";
import {
  makeUsageNotification,
  markAllRead,
  relativeTime,
  subscribeNotifications,
  type AppNotification,
} from "../lib/notifications";

export function NotificationBell({ variant }: { variant: "admin" | "customer" }) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [auditItems, setAuditItems] = useState<AppNotification[]>([]);
  const [usageItem, setUsageItem] = useState<AppNotification | null>(null);
  const [loading, setLoading] = useState(true);

  const email = session?.user.email || "";
  const orgId = session?.user.orgId;
  const isAdmin = variant === "admin";

  useEffect(() => {
    if (!email) return;
    setLoading(true);
    const unsub = subscribeNotifications({
      isAdmin,
      orgId,
      email,
      onUpdate: (list) => {
        setAuditItems(list);
        setLoading(false);
      },
    });
    return unsub;
  }, [email, orgId, isAdmin]);

  useEffect(() => {
    if (isAdmin || !orgId || !email) return;
    let cancelled = false;
    (async () => {
      const org = await getOrgFromFirestore(orgId);
      if (!org || cancelled || org.creditsLimit <= 0) return;
      const pct = Math.round((org.totalCalls / org.creditsLimit) * 100);
      if (pct < 80) return;
      setUsageItem(makeUsageNotification(orgId, org.plan || "Starter", pct, email));
    })();
    return () => { cancelled = true; };
  }, [isAdmin, orgId, email]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items = usageItem ? [usageItem, ...auditItems.filter((n) => n.id !== usageItem.id)] : auditItems;
  const unread = items.filter((n) => !n.read).length;

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (next && email) {
        const marked = markAllRead(email, [
          ...(usageItem ? [usageItem] : []),
          ...auditItems,
        ]);
        setUsageItem((cur) => (cur ? { ...cur, read: true } : cur));
        setAuditItems(marked.filter((n) => n.action !== "usage_warning"));
      }
      return next;
    });
  }, [email, usageItem, auditItems]);

  const openItem = (item: AppNotification) => {
    setOpen(false);
    navigate(item.href);
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border cursor-pointer transition-colors ${
          variant === "admin"
            ? "hover:bg-gray-50"
            : "bg-white hover:border-[#C9B99E]"
        }`}
        style={{
          borderColor: variant === "admin" ? "#E7DFC8" : "#E2DDD5",
          backgroundColor: variant === "admin" ? "transparent" : "#FFFFFF",
        }}
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell size={15} color={variant === "admin" ? "#6B645B" : undefined} className={variant === "customer" ? "text-[#7A746C]" : undefined} />
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
            style={{ backgroundColor: "#D9534F" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+8px)] z-[80] w-[340px] max-w-[calc(100vw-24px)] rounded-xl border bg-white shadow-xl overflow-hidden"
          style={{ borderColor: "#E7DFC8" }}
          role="dialog"
          aria-label="Notifications"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#E7DFC8", backgroundColor: "#F7F4EF" }}>
            <span className="text-[13px] font-bold" style={{ color: "#1E1A16" }}>Notifications</span>
            <span className="text-[11px]" style={{ color: "#6B645B" }}>
              {unread > 0 ? `${unread} new` : "All caught up"}
            </span>
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="px-4 py-8 text-[13px] text-center m-0" style={{ color: "#6B645B" }}>
                Loading…
              </p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-[13px] text-center m-0" style={{ color: "#6B645B" }}>
                No notifications yet.
              </p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openItem(item)}
                  className="w-full text-left px-4 py-3 border-b last:border-0 cursor-pointer transition-colors hover:bg-[#F7F4EF]"
                  style={{ borderColor: "#E7DFC8", backgroundColor: item.read ? "#FFFFFF" : "#F7F4EF" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[13px] font-bold" style={{ color: "#1E1A16" }}>{item.title}</span>
                    <span className="text-[10px] shrink-0" style={{ color: "#6B645B" }}>{relativeTime(item.createdAtMs)}</span>
                  </div>
                  <p className="m-0 mt-0.5 text-[12px] leading-snug" style={{ color: "#6B645B" }}>{item.body}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
