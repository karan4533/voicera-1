import { useEffect, useState } from "react";
import { CreditCard, Phone, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getOrgFromFirestore } from "../lib/rbac";
import { recordAuditEvent } from "../lib/adminApi";
import { safeLog } from "../lib/safeLog";

const PLAN_CREDITS: Record<string, number> = {
  Starter: 5000,
  Growth: 20000,
  Enterprise: 100000,
};

export function UsagePage() {
  const { session } = useAuth();
  const orgId = session?.user.orgId;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState({
    name: "",
    plan: "Starter",
    totalCalls: 0,
    creditsLimit: 5000,
  });

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      setError("No organisation is linked to this login.");
      return;
    }
    (async () => {
      try {
        const org = await getOrgFromFirestore(orgId);
        if (!org) {
          setError("Could not load your organisation usage.");
          return;
        }
        setUsage({
          name: org.name || session?.user.name || "Your organisation",
          plan: org.plan || "Starter",
          totalCalls: org.totalCalls,
          creditsLimit: org.creditsLimit || PLAN_CREDITS[org.plan || "Starter"] || 5000,
        });
        await recordAuditEvent({ action: "view_usage", orgId, detail: "Opened usage page" });
      } catch (err) {
        safeLog.warn("usage load failed", err);
        setError("Could not load usage for your organisation.");
      } finally {
        setLoading(false);
      }
    })();
  }, [orgId, session?.user.name]);

  const used = usage.totalCalls;
  const limit = usage.creditsLimit;
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return (
    <div>
      <h1 className="text-[22px] font-bold m-0 mb-1" style={{ color: "#1E1A16" }}>Usage & credits</h1>
      <p className="text-[13px] m-0 mb-5" style={{ color: "#6B645B" }}>
        Only your organisation’s numbers are shown.
      </p>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border p-3 mb-4" style={{ borderColor: "#D9534F", backgroundColor: "#D9534F22" }}>
          <AlertCircle size={14} className="shrink-0 mt-0.5" color="#D9534F" />
          <p className="text-[12px] m-0" style={{ color: "#D9534F" }}>{error}</p>
        </div>
      )}

      {loading ? (
        <p className="text-[13px]" style={{ color: "#6B645B" }}>Loading usage…</p>
      ) : !error && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border rounded-xl p-4" style={{ borderColor: "#E2DDD5" }}>
            <div className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "#6B645B" }}>Plan</div>
            <div className="text-[20px] font-bold" style={{ color: "#1E1A16" }}>{usage.plan}</div>
            <div className="text-[12px] mt-1" style={{ color: "#6B645B" }}>{usage.name}</div>
          </div>
          <div className="bg-white border rounded-xl p-4" style={{ borderColor: "#E2DDD5" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#6B645B" }}>Calls used</span>
              <Phone size={14} color="#50381F" />
            </div>
            <div className="text-[20px] font-bold" style={{ color: "#1E1A16" }}>{used.toLocaleString()}</div>
          </div>
          <div className="bg-white border rounded-xl p-4" style={{ borderColor: "#E2DDD5" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#6B645B" }}>Credit limit</span>
              <CreditCard size={14} color="#50381F" />
            </div>
            <div className="text-[20px] font-bold" style={{ color: "#1E1A16" }}>{limit.toLocaleString()}</div>
            <div className="text-[12px] mt-1" style={{ color: "#6B645B" }}>{pct}% used</div>
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white border rounded-xl p-5" style={{ borderColor: "#E2DDD5" }}>
          <div className="flex justify-between text-[12px] mb-2" style={{ color: "#6B645B" }}>
            <span>Credits consumed (1 call = 1 credit)</span>
            <span>{used.toLocaleString()} / {limit.toLocaleString()}</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: "#ECE6D9" }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: pct > 90 ? "#D9534F" : "#50381F" }} />
          </div>
        </div>
      )}
    </div>
  );
}
