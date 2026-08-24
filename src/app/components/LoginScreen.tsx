import { useState } from "react";
import { Eye, EyeOff, Shield, Mail } from "lucide-react";
import { useNavigate } from "react-router";
import type { MultiFactorResolver } from "firebase/auth";
import { useAuth, isMfaRequiredError } from "../context/AuthContext";
import { getSession } from "../lib/auth";
import { getFriendlyAuthErrorMessage } from "../lib/authErrors";
import { isValidEmail } from "../lib/validate";
import { allowAttempt } from "../lib/rateLimit";
import {
  isPlatformAdminEmail,
  listUserTenants,
} from "../lib/tenantMemberships";
import heuristicLabsLogo from "../../assets/heuristic-labs-logo.png";
import heuristicLabsLogoLight from "../../assets/heuristic-labs-logo-light.png";

// Helper to get post-login destination from a session role
function roleHome(role?: string) {
  return role === "platform_admin" ? "/admin" : "/dashboard";
}

// ── Brand tokens ───────────────────────────────────────────────────────────────
const ACCENT   = "#50381F";
const ACCENT_H = "#3D2914";
const BG       = "#F7F4EF";
const SURFACE  = "#ECE6D9";
const TEXT     = "#1E1A16";
const MUTED    = "#7A746C";
const BORDER   = "#D6CFC4";



// ── Page ──────────────────────────────────────────────────────────────────────
export function LoginScreen() {
  const { login, completeMfaLogin, resetPassword, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<"login" | "forgot" | "forgot-success" | "mfa">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState(() => localStorage.getItem("remembered_email") || "");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(null);
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem("remembered_email"));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const rememberEmail = (value: string) => {
    if (rememberMe) localStorage.setItem("remembered_email", value);
    else localStorage.removeItem("remembered_email");
  };

  /** After auth: picker only for multi-tenant memberships; single-tenant auto-enters. */
  const finishLogin = (emailAddr: string, role?: string) => {
    const normalized = emailAddr.trim().toLowerCase();
    sessionStorage.removeItem("vocera_selected_agent");

    if (role === "platform_admin" || isPlatformAdminEmail(normalized)) {
      sessionStorage.removeItem("voicera_need_tenant");
      navigate("/admin", { replace: true });
      return;
    }

    const tenants = listUserTenants(normalized);
    if (tenants.length > 1) {
      sessionStorage.setItem("voicera_need_tenant", "1");
    } else if (tenants.length === 1) {
      sessionStorage.removeItem("voicera_need_tenant");
      sessionStorage.setItem("voicera_active_tenant", tenants[0].id);
      sessionStorage.setItem("voicera_active_tenant_name", tenants[0].name);
    } else {
      sessionStorage.removeItem("voicera_need_tenant");
    }
    navigate(roleHome(role), { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) { setError("Email is required."); return; }
    if (!isValidEmail(trimmed)) { setError("Please enter a valid email address."); return; }
    if (!password) { setError("Password is required."); return; }
    if (!allowAttempt(`login:${trimmed}`, 5, 60_000)) {
      setError("Too many attempts. Please wait a minute and try again.");
      return;
    }
    setLoading(true);
    try {
      await login(trimmed, password, rememberMe);
      rememberEmail(trimmed);
      const s = getSession();
      finishLogin(s?.user.email ?? trimmed, s?.user.role);
    } catch (err) {
      if (isMfaRequiredError(err)) {
        setMfaResolver(err.resolver);
        setMfaCode("");
        setMode("mfa");
        setError("");
      } else {
        setError(getFriendlyAuthErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    setLoading(true);
    try {
      await loginWithGoogle();
      const s = getSession();
      finishLogin(s?.user.email ?? "demo.sso@spicegarden.com", s?.user.role);
    } catch (err) {
      setError(getFriendlyAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!mfaResolver) { setMode("login"); return; }
    if (mfaCode.trim().length < 6) { setError("Enter the 6-digit authenticator code."); return; }
    if (!allowAttempt(`mfa:${email.trim().toLowerCase()}`, 5, 60_000)) {
      setError("Too many attempts. Please wait a minute and try again.");
      return;
    }
    setLoading(true);
    try {
      await completeMfaLogin(mfaResolver, mfaCode);
      rememberEmail(email.trim().toLowerCase());
      const s = getSession();
      finishLogin(s?.user.email ?? email.trim().toLowerCase(), s?.user.role);
    } catch (err) {
      setError(getFriendlyAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) { setError("Email is required."); return; }
    if (!isValidEmail(email.trim())) { setError("Please enter a valid email address."); return; }
    if (!allowAttempt(`reset:${email.trim().toLowerCase()}`, 3, 60_000)) {
      setError("Too many reset requests. Please wait a minute.");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setMode("forgot-success");
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && err.code === "auth/user-not-found") {
        setMode("forgot-success");
      } else {
        setError(getFriendlyAuthErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };



  return (
    <div style={{ display: "flex", minHeight: "100vh", width: "100%", fontFamily: "Inter, sans-serif", backgroundColor: BG }}>

      {/* ── Left Panel ──────────────────────────────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col relative overflow-hidden shrink-0"
        style={{ width: "42%", minWidth: 400, backgroundColor: ACCENT }}
      >
        {/* Subtle texture overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 80% 20%, rgba(255,255,255,0.06) 0%, transparent 60%)" }} />

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "32px 40px" }}>
          <img
            src={heuristicLabsLogoLight}
            alt="Heuristic Labs"
            style={{ width: 48, height: 48, objectFit: "contain" }}
          />
          <span style={{ fontWeight: 700, fontSize: 20, color: "rgba(255,255,255,0.9)", letterSpacing: "-0.01em" }}>
            Heuristic Labs
          </span>
        </div>

        {/* Center content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 48px 80px", position: "relative", zIndex: 1 }}>
          <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
            Welcome to
          </p>
          <h1 style={{ margin: "0 0 16px", fontSize: 76, fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.04em", lineHeight: 1.05 }}>
            Voicera
          </h1>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 400, color: "rgba(255,255,255,0.65)", maxWidth: 300, lineHeight: 1.55 }}>
            - AI Voice Platform for smarter conversations.
          </p>


        </div>

        {/* Bottom decorative lines */}
        <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
          <svg viewBox="0 0 500 120" fill="none" style={{ width: "100%", display: "block" }}>
            {[1, 1.5, 2, 1.5, 1].map((w, i) => (
              <path
                key={i}
                d={`M-10 ${90 + i * 7} C 120 ${80 + i * 7}, 240 ${60 + i * 7}, 320 ${72 + i * 7} C 400 ${84 + i * 7}, 450 ${90 + i * 7}, 520 ${88 + i * 7}`}
                stroke="white" strokeWidth={w} strokeOpacity={0.06 + i * 0.02} strokeLinecap="round"
              />
            ))}
          </svg>
        </div>
      </div>

      {/* ── Right Panel ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: BG, padding: "48px 24px" }}>

        {/* Mobile branding */}
        <div className="lg:hidden flex flex-col items-center gap-3 mb-10">
          <img src={heuristicLabsLogo} alt="Heuristic Labs" style={{ width: 56, height: 56, objectFit: "contain" }} />
          <h1 style={{ margin: 0, fontSize: 44, fontWeight: 800, color: TEXT, letterSpacing: "-0.03em" }}>Voicera</h1>
        </div>

        {/* Form card */}
        <div style={{ width: "100%", maxWidth: 400, backgroundColor: SURFACE, borderRadius: 16, border: `1px solid ${BORDER}`, padding: "36px 36px", boxShadow: "0 4px 24px rgba(80,56,31,0.08)" }}>

          {mode === "mfa" ? (
            <>
              <h2 style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 22, color: TEXT, letterSpacing: "-0.01em" }}>
                Authenticator code
              </h2>
              <p style={{ margin: "0 0 28px", fontSize: 13, color: MUTED }}>
                Enter the 6-digit code from your authenticator app to finish signing in.
              </p>
              {error && (
                <div style={{ backgroundColor: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#DC2626", marginBottom: 18 }} role="alert">
                  {error}
                </div>
              )}
              <form onSubmit={handleMfaSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label htmlFor="mfa-code" style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em" }}>Code</label>
                  <input
                    id="mfa-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    placeholder="123456"
                    disabled={loading}
                    style={{ height: 40, border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: "0 12px", fontSize: 16, letterSpacing: "0.2em", color: TEXT, outline: "none", width: "100%", boxSizing: "border-box", backgroundColor: "#fff" }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || mfaCode.length < 6}
                  style={{ width: "100%", height: 44, backgroundColor: loading ? "#7A5C3C" : ACCENT, borderRadius: 8, border: "none", color: "#fff", fontWeight: 600, fontSize: 14, cursor: loading ? "not-allowed" : "pointer" }}
                >
                  {loading ? "Verifying…" : "Verify and continue"}
                </button>
                <button
                  type="button"
                  onClick={() => { setMode("login"); setMfaResolver(null); setMfaCode(""); setError(""); }}
                  style={{ background: "none", border: "none", fontSize: 13, color: ACCENT, cursor: "pointer", fontWeight: 500 }}
                >
                  Back to login
                </button>
              </form>
            </>
          ) : mode === "forgot-success" ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", backgroundColor: "#DCFCE7", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                <Mail size={26} style={{ color: "#16A34A" }} />
              </div>
              <h2 style={{ margin: "0 0 10px", fontWeight: 700, fontSize: 22, color: TEXT }}>Check your email</h2>
              <p style={{ margin: "0 0 24px", fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
                We sent a reset link to <strong style={{ color: TEXT }}>{email}</strong>
              </p>
              <button
                onClick={() => { setMode("login"); setEmail(""); setPassword(""); }}
                style={{ width: "100%", height: 44, backgroundColor: ACCENT, borderRadius: 8, border: "none", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", transition: "background 0.15s" }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = ACCENT_H}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ACCENT}
              >
                Back to login
              </button>
              <button onClick={() => setMode("forgot")} style={{ marginTop: 16, background: "none", border: "none", fontSize: 13, color: ACCENT, cursor: "pointer", fontWeight: 500 }}>
                Resend email
              </button>
            </div>

          ) : (
            <>
              {/* Heading */}
              <h2 style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 22, color: TEXT, letterSpacing: "-0.01em" }}>
                {mode === "login" ? "Sign in to Voicera" : "Reset your password"}
              </h2>
              <p style={{ margin: "0 0 28px", fontSize: 13, color: MUTED }}>
                {mode === "login"
                  ? "Use your company account. Access is limited to your organization’s purchased agents."
                  : "We'll send a recovery link to your email"}
              </p>



              {/* Error */}
              {error && (
                <div style={{ backgroundColor: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#DC2626", marginBottom: 18 }} role="alert">
                  {error}
                </div>
              )}

              {/* Form */}
              <form onSubmit={mode === "login" ? handleSubmit : handleForgotSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Email */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label htmlFor="email" style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em" }}>Email</label>
                  <input
                    id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com" autoComplete="email" disabled={loading}
                    style={{ height: 40, border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: "0 12px", fontSize: 13, color: TEXT, outline: "none", width: "100%", boxSizing: "border-box", backgroundColor: "#fff", transition: "border-color 0.15s", opacity: loading ? 0.6 : 1 }}
                    onFocus={(e) => e.target.style.borderColor = ACCENT}
                    onBlur={(e) => e.target.style.borderColor = BORDER}
                  />
                </div>

                {/* Password */}
                {mode === "login" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label htmlFor="password" style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em" }}>Password</label>
                    <div style={{ position: "relative" }}>
                      <input
                        id="password" type={showPassword ? "text" : "password"} value={password}
                        onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                        autoComplete="current-password" disabled={loading}
                        style={{ height: 40, border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: "0 40px 0 12px", fontSize: 13, color: TEXT, outline: "none", width: "100%", boxSizing: "border-box", backgroundColor: "#fff", transition: "border-color 0.15s", opacity: loading ? 0.6 : 1 }}
                        onFocus={(e) => e.target.style.borderColor = ACCENT}
                        onBlur={(e) => e.target.style.borderColor = BORDER}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#9E9890", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Remember / Forgot */}
                {mode === "login" ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
                      <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} style={{ width: 14, height: 14, accentColor: ACCENT, cursor: "pointer" }} />
                      <span style={{ fontSize: 13, color: TEXT }}>Remember me</span>
                    </label>
                    <button type="button" onClick={() => { setMode("forgot"); setError(""); }} style={{ fontSize: 13, color: ACCENT, background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 500 }}>
                      Forgot password?
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button type="button" onClick={() => { setMode("login"); setError(""); }} style={{ fontSize: 13, color: ACCENT, background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 500 }}>
                      Back to login
                    </button>
                  </div>
                )}

                {/* Submit */}
                <button
                  id={mode === "login" ? "login-submit" : "forgot-submit"}
                  type="submit"
                  disabled={loading}
                  style={{ width: "100%", height: 44, backgroundColor: loading ? "#7A5C3C" : ACCENT, borderRadius: 8, border: "none", color: "#fff", fontWeight: 600, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", transition: "background-color 0.15s", marginTop: 4 }}
                  onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = ACCENT_H; }}
                  onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = ACCENT; }}
                >
                  {loading ? (mode === "login" ? "Signing in…" : "Sending link…") : (mode === "login" ? "Sign In" : "Send Reset Link")}
                </button>

                {mode === "login" && (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "4px 0" }}>
                      <div style={{ flex: 1, height: 1, background: BORDER }} />
                      <span style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>SSO</span>
                      <div style={{ flex: 1, height: 1, background: BORDER }} />
                    </div>
                    <button
                      type="button"
                      id="google-sso-login"
                      onClick={handleGoogle}
                      disabled={loading}
                      aria-label="Sign in with Google SSO"
                      style={{
                        width: "100%", height: 44, backgroundColor: "#fff", borderRadius: 8,
                        border: `1.5px solid ${BORDER}`, color: TEXT, fontWeight: 600, fontSize: 14,
                        cursor: loading ? "not-allowed" : "pointer", display: "flex",
                        alignItems: "center", justifyContent: "center", gap: 10,
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                      </svg>
                      Sign in with Google SSO
                    </button>
                    <p style={{ margin: 0, fontSize: 11, color: MUTED, textAlign: "center", lineHeight: 1.4 }}>
                      No public registration. Accounts are provisioned after purchase.
                      If you belong to multiple tenants, you will pick a workspace after sign-in.
                    </p>
                  </>
                )}
              </form>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 24 }}>
          <p style={{ margin: 0, fontSize: 12, color: MUTED, textAlign: "center" }}>
            Need access?{" "}
            <a href="mailto:sales@heuristiclabs.ai" style={{ color: ACCENT, fontWeight: 600, textDecoration: "none" }}>
              Contact your admin or Heuristic Labs sales
            </a>
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Shield size={12} style={{ color: "#9E9890" }} />
            <span style={{ fontSize: 12, color: "#9E9890" }}>Secured by Firebase Authentication</span>
          </div>
        </div>
      </div>
    </div>
  );
}
