import { useEffect, useState } from "react";
import { Shield, KeyRound, ScrollText, AlertCircle, Loader2 } from "lucide-react";
import {
  multiFactor,
  TotpMultiFactorGenerator,
  type TotpSecret,
} from "firebase/auth";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { recordAuditEvent, revokeMySessions } from "../../lib/adminApi";
import { safeLog } from "../../lib/safeLog";

interface AuditRow {
  id: string;
  action: string;
  actorEmail: string;
  orgId: string;
  targetEmail: string;
  detail: string;
  createdAt: string;
}

export function SecurityPage() {
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaMessage, setMfaMessage] = useState<string | null>(null);
  const [secret, setSecret] = useState<TotpSecret | null>(null);
  const [otpauth, setOtpauth] = useState("");
  const [code, setCode] = useState("");
  const [enrolled, setEnrolled] = useState(false);
  const [events, setEvents] = useState<AuditRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const user = auth?.currentUser;
    if (user) {
      setEnrolled(multiFactor(user).enrolledFactors.length > 0);
    }
    if (!db) {
      setLoadError("Firebase is not configured in this environment.");
      return;
    }
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "audit_events"), orderBy("createdAt", "desc"), limit(50)),
        );
        setEvents(snap.docs.map((d) => {
          const data = d.data();
          const ts = data.createdAt?.toDate?.() as Date | undefined;
          return {
            id: d.id,
            action: data.action || "",
            actorEmail: data.actorEmail || "",
            orgId: data.orgId || "",
            targetEmail: data.targetEmail || "",
            detail: data.detail || "",
            createdAt: ts ? ts.toLocaleString() : "—",
          };
        }));
      } catch (err) {
        safeLog.warn("audit list failed", err);
        setLoadError("Could not load audit log. Deploy Firestore rules first.");
      }
    })();
  }, []);

  const startEnroll = async () => {
    setMfaMessage(null);
    const user = auth?.currentUser;
    if (!user) return;
    setMfaBusy(true);
    try {
      const session = await multiFactor(user).getSession();
      const totpSecret = await TotpMultiFactorGenerator.generateSecret(session);
      setSecret(totpSecret);
      setOtpauth(totpSecret.generateQrCodeUrl(user.email || "admin", "Voicera"));
    } catch (err) {
      safeLog.warn("mfa enroll start failed", err);
      setMfaMessage(
        "MFA is not enabled on this Firebase project yet. In Firebase Console → Authentication → Sign-in method, enable Identity Platform multi-factor (TOTP), then retry.",
      );
    } finally {
      setMfaBusy(false);
    }
  };

  const confirmEnroll = async () => {
    const user = auth?.currentUser;
    if (!user || !secret || code.length < 6) return;
    setMfaBusy(true);
    setMfaMessage(null);
    try {
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, code.trim());
      await multiFactor(user).enroll(assertion, "Authenticator app");
      setEnrolled(true);
      setSecret(null);
      setCode("");
      await recordAuditEvent({ action: "mfa_enroll", detail: "TOTP authenticator" });
      setMfaMessage("Authenticator MFA is now on for this admin account.");
    } catch (err) {
      safeLog.warn("mfa enroll confirm failed", err);
      setMfaMessage("Invalid code or MFA not available. Try again.");
    } finally {
      setMfaBusy(false);
    }
  };

  const handleRevoke = async () => {
    if (!window.confirm("Sign out this account on all other devices?")) return;
    try {
      await revokeMySessions();
      setMfaMessage("Other device sessions were revoked. This browser stays signed in until you log out.");
    } catch (err) {
      safeLog.warn("revoke sessions failed", err);
      setMfaMessage("Could not revoke sessions. Deploy Cloud Functions first.");
    }
  };

  return (
    <div>
      <h1 className="text-[22px] font-bold m-0 mb-1" style={{ color: "#1E1A16" }}>Security</h1>
      <p className="text-[13px] m-0 mb-5" style={{ color: "#6B645B" }}>
        Admin MFA, session revoke, and audit log (HL-SEC-DEVBRIEF).
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border p-5 bg-white" style={{ borderColor: "#E7DFC8" }}>
          <div className="flex items-center gap-2 mb-3">
            <Shield size={16} color="#50381F" />
            <h2 className="m-0 text-[15px] font-bold" style={{ color: "#1E1A16" }}>Admin MFA</h2>
          </div>
          {enrolled ? (
            <p className="text-[13px] m-0 mb-3" style={{ color: "#4CAF50" }}>Authenticator MFA is enrolled on this account.</p>
          ) : (
            <p className="text-[13px] m-0 mb-3" style={{ color: "#6B645B" }}>
              Add an authenticator app (TOTP) for platform admin login.
            </p>
          )}
          {!enrolled && !secret && (
            <button
              type="button"
              onClick={startEnroll}
              disabled={mfaBusy}
              className="h-9 px-4 rounded-lg border-none text-[13px] font-bold text-white cursor-pointer"
              style={{ backgroundColor: "#50381F" }}
            >
              {mfaBusy ? "Starting…" : "Set up authenticator"}
            </button>
          )}
          {secret && (
            <div className="flex flex-col gap-2">
              <p className="text-[12px] m-0" style={{ color: "#6B645B" }}>
                Scan this URI in Google Authenticator / Authy, then enter the 6-digit code.
              </p>
              <code className="text-[11px] break-all p-2 rounded-lg" style={{ backgroundColor: "#F7F4EF", color: "#1E1A16" }}>
                {otpauth}
              </code>
              <p className="text-[12px] m-0" style={{ color: "#6B645B" }}>Secret: {secret.secretKey}</p>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="6-digit code"
                className="h-9 px-3 text-[13px] border rounded-lg"
                style={{ borderColor: "#E7DFC8" }}
              />
              <button
                type="button"
                onClick={confirmEnroll}
                disabled={mfaBusy || code.length < 6}
                className="h-9 px-4 rounded-lg border-none text-[13px] font-bold text-white cursor-pointer"
                style={{ backgroundColor: "#50381F" }}
              >
                Confirm MFA
              </button>
            </div>
          )}
        </div>

        <div className="rounded-xl border p-5 bg-white" style={{ borderColor: "#E7DFC8" }}>
          <div className="flex items-center gap-2 mb-3">
            <KeyRound size={16} color="#50381F" />
            <h2 className="m-0 text-[15px] font-bold" style={{ color: "#1E1A16" }}>Sessions</h2>
          </div>
          <p className="text-[13px] m-0 mb-3" style={{ color: "#6B645B" }}>
            Revoke refresh tokens on other devices after a suspected compromise.
          </p>
          <button
            type="button"
            onClick={handleRevoke}
            className="h-9 px-4 rounded-lg border text-[13px] font-bold cursor-pointer"
            style={{ borderColor: "#E7DFC8", backgroundColor: "#F7F4EF", color: "#1E1A16" }}
          >
            Sign out other devices
          </button>
        </div>
      </div>

      {mfaMessage && (
        <div className="flex items-start gap-2 rounded-xl border p-3 mb-4" style={{ borderColor: "#E7DFC8", backgroundColor: "#F7F4EF" }}>
          <AlertCircle size={14} className="shrink-0 mt-0.5" color="#50381F" />
          <p className="text-[12px] m-0" style={{ color: "#1E1A16" }}>{mfaMessage}</p>
        </div>
      )}

      <div className="rounded-xl border overflow-hidden bg-white" style={{ borderColor: "#E7DFC8" }}>
        <div className="flex items-center gap-2 px-5 py-3 border-b" style={{ borderColor: "#E7DFC8", backgroundColor: "#F7F4EF" }}>
          <ScrollText size={14} color="#50381F" />
          <span className="text-[13px] font-bold" style={{ color: "#1E1A16" }}>Audit log</span>
        </div>
        {loadError && <p className="px-5 py-3 text-[12px] m-0" style={{ color: "#D9534F" }}>{loadError}</p>}
        {!loadError && events.length === 0 && (
          <p className="px-5 py-8 text-[13px] m-0 text-center" style={{ color: "#6B645B" }}>
            <Loader2 size={14} className="inline mr-1" /> No audit events yet.
          </p>
        )}
        {events.length > 0 && (
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="border-b" style={{ borderColor: "#E7DFC8" }}>
                {["When", "Action", "Actor", "Org", "Target", "Detail"].map((h) => (
                  <th key={h} className="text-left px-3 py-2 font-bold" style={{ color: "#6B645B" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b last:border-0" style={{ borderColor: "#E7DFC8" }}>
                  <td className="px-3 py-2" style={{ color: "#6B645B" }}>{e.createdAt}</td>
                  <td className="px-3 py-2 font-bold" style={{ color: "#1E1A16" }}>{e.action}</td>
                  <td className="px-3 py-2" style={{ color: "#1E1A16" }}>{e.actorEmail}</td>
                  <td className="px-3 py-2 font-mono" style={{ color: "#6B645B" }}>{e.orgId || "—"}</td>
                  <td className="px-3 py-2" style={{ color: "#1E1A16" }}>{e.targetEmail || "—"}</td>
                  <td className="px-3 py-2" style={{ color: "#6B645B" }}>{e.detail || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
