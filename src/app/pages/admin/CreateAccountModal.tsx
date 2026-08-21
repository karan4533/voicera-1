import { useState } from "react";
import {
  UserPlus, Check, AlertCircle, Building2, Mail, EyeOff, Eye, Package,
  CheckCircle2, Copy, Send, X
} from "lucide-react";
import { type MockOrganisation } from "../../lib/rbac";
import { AGENT_TYPES } from "../../context/AgentContext";
import type { AgentType } from "../../lib/types";
import { functions } from "../../lib/firebase";
import { httpsCallable } from "firebase/functions";
import { isValidEmail, sanitizePlainText, passwordMeetsPolicy } from "../../lib/validate";
import { allowAttempt } from "../../lib/rateLimit";
import { safeLog } from "../../lib/safeLog";

type CreateStep = "form" | "agents" | "confirm" | "success";

export function CreateAccountModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<CreateStep>("form");
  const [showPass, setShowPass] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form fields
  const [orgName, setOrgName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [plan, setPlan] = useState<MockOrganisation["plan"]>("Starter");
  const [selectedAgents, setSelectedAgents] = useState<Set<AgentType>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [wasExistingAccount, setWasExistingAccount] = useState(false);

  const toggleAgent = (id: AgentType) => {
    setSelectedAgents((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const validateForm = () => {
    const e: Record<string, string> = {};
    const name = sanitizePlainText(orgName, 120);
    const contact = sanitizePlainText(contactName, 80);
    setOrgName(name);
    setContactName(contact);
    if (!name) e.orgName = "Organisation name is required";
    if (!contact) e.contactName = "Contact name is required";
    if (!email.trim()) e.email = "Email is required";
    else if (!isValidEmail(email)) e.email = "Enter a valid email address";
    if (!passwordMeetsPolicy(password)) {
      e.password = "Password must be at least 12 characters and include a letter and a number";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const createViaCloudFunction = async (agents: AgentType[]) => {
    if (!functions) throw new Error("Firebase is not configured. Add VITE_FIREBASE_* to .env.local.");
    const createCustomerAccount = httpsCallable(functions, "createCustomerAccount");
    const result = await createCustomerAccount({
      email: email.trim().toLowerCase(),
      password,
      orgName,
      contactName,
      plan,
      agents,
    });
    const data = result.data as { existingUser?: boolean };
    setWasExistingAccount(!!data.existingUser);
  };

  const handleCreateAccount = async () => {
    setCreationError(null);
    if (!allowAttempt(`create-account:${email.trim().toLowerCase()}`, 3, 60_000)) {
      setCreationError("Please wait a minute before trying again.");
      return;
    }
    setIsCreating(true);
    try {
      // Production: Cloud Function only — never create Auth users or write orgs from the browser.
      await createViaCloudFunction(Array.from(selectedAgents));
      setStep("success");
    } catch (err: unknown) {
      safeLog.error("Account creation failed", err);
      const fbErr = err as { code?: string; message?: string };
      if (fbErr.code === "functions/unauthenticated") {
        setCreationError("You must be signed in as a Platform Admin.");
      } else if (fbErr.code === "functions/permission-denied") {
        setCreationError("Only Platform Admins can create customer accounts.");
      } else if (fbErr.code === "functions/invalid-argument") {
        setCreationError(fbErr.message || "Invalid account details.");
      } else if (fbErr.code === "functions/already-exists") {
        setCreationError("This email already has an account. Use Manage Agent Access to update agents.");
      } else if (fbErr.code === "unavailable" || fbErr.message?.includes("offline")) {
        setCreationError("Cannot reach Firebase. Check your connection and try again.");
      } else {
        setCreationError("Failed to create account. Please try again or contact support.");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`Email: ${email}\nPassword: ${password}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendEmail = () => {
    const agentList = Array.from(selectedAgents)
      .map((id) => {
        const def = AGENT_TYPES.find((a) => a.id === id);
        return def ? `  • ${def.label}` : `  • ${id}`;
      })
      .join("\n");

    const subject = encodeURIComponent(`Welcome to Voicera – Your Account is Ready, ${contactName}!`);
    const body = encodeURIComponent(
`Hi ${contactName},

Great news! Your Voicera workspace has been set up and is ready to use. 🎉

You have successfully purchased the following AI agents:
${agentList}

──────────────────────────
Your Login Credentials
──────────────────────────
Login URL  : https://voicera.ai/login
Email      : ${email}
Password   : ${password}
──────────────────────────

Simply go to the login URL above and sign in with your credentials. Your agents will be available in your dashboard right away.

If you have any questions, feel free to reply to this email.

Welcome aboard!
The Voicera Team`
    );

    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  const steps = ["Account Details", "Assign Agents", "Review & Create"];
  const stepIndex = step === "form" ? 0 : step === "agents" ? 1 : step === "confirm" ? 2 : 3;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-[#FFFFFF] rounded-2xl shadow-2xl w-full max-w-[560px] mx-4 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {step !== "success" && (
          <>
            <div className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#F7F4EF" }}>
                  <UserPlus size={16} color="#50381F" />
                </div>
                <div>
                  <div className="font-bold text-[16px]" style={{ color: "#1E1A16" }}>Create Customer Account</div>
                  <div className="text-[12px] mt-0.5" style={{ color: "#6B645B" }}>Set up a new tenant workspace</div>
                </div>
              </div>
              <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer border-none bg-transparent">
                <X size={16} color="#6B645B" />
              </button>
            </div>

            <div className="flex items-center gap-0 px-6 pb-4 shrink-0">
              {steps.map((s, i) => (
                <div key={s} className="flex items-center flex-1">
                  <div className={`flex items-center gap-2 ${i <= stepIndex ? "font-bold" : "font-semibold"}`} style={{ color: i <= stepIndex ? "#50381F" : "#6B645B" }}>
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0`} style={{
                      backgroundColor: i < stepIndex ? "#50381F" : i === stepIndex ? "#ECE6D9" : "#F7F4EF",
                      color: i < stepIndex ? "#FFFFFF" : i === stepIndex ? "#50381F" : "#6B645B",
                      border: i === stepIndex ? "2px solid #50381F" : "none"
                    }}>
                      {i < stepIndex ? <Check size={11} strokeWidth={3} /> : i + 1}
                    </div>
                    <span className="text-[11px] hidden sm:inline">{s}</span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className="flex-1 h-0.5 mx-2" style={{ backgroundColor: i < stepIndex ? "#50381F" : "#E7DFC8" }} />
                  )}
                </div>
              ))}
            </div>
            <div className="border-t mx-0 shrink-0" style={{ borderColor: "#E7DFC8" }} />
          </>
        )}

        {step === "form" && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
              <div className="flex items-start gap-2.5 rounded-xl border p-3" style={{ backgroundColor: "#ECE6D9", borderColor: "#E7DFC8" }}>
                <AlertCircle size={14} className="shrink-0 mt-0.5" style={{ color: "#50381F" }} />
                <div className="text-[12px] leading-relaxed" style={{ color: "#1E1A16" }}>
                  <strong>How it works:</strong> You set the customer's login credentials here. They will use this email &amp; password to sign in at the same login page as you. They are automatically routed to their own workspace.
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "#6B645B" }}>
                  <Building2 size={10} className="inline mr-1" />Organisation Name *
                </label>
                <input
                  type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. Spice Garden Restaurants"
                  className="w-full h-10 px-3 text-[13px] border rounded-lg focus:outline-none focus:ring-2 transition-colors"
                  style={{ borderColor: errors.orgName ? "#D9534F" : "#E7DFC8", outlineColor: "#50381F" }}
                />
                {errors.orgName && <p className="text-[11px] mt-1" style={{ color: "#D9534F" }}>{errors.orgName}</p>}
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "#6B645B" }}>
                  Contact Person Name *
                </label>
                <input
                  type="text" value={contactName} onChange={(e) => setContactName(e.target.value)}
                  placeholder="e.g. Priya Mehta"
                  className="w-full h-10 px-3 text-[13px] border rounded-lg focus:outline-none focus:ring-2 transition-colors"
                  style={{ borderColor: errors.contactName ? "#D9534F" : "#E7DFC8", outlineColor: "#50381F" }}
                />
                {errors.contactName && <p className="text-[11px] mt-1" style={{ color: "#D9534F" }}>{errors.contactName}</p>}
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "#6B645B" }}>
                  <Mail size={10} className="inline mr-1" />Customer Login Email *
                </label>
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="ops@restaurant.com"
                  className="w-full h-10 px-3 text-[13px] border rounded-lg focus:outline-none focus:ring-2 transition-colors"
                  style={{ borderColor: errors.email ? "#D9534F" : "#E7DFC8", outlineColor: "#50381F" }}
                />
                {errors.email && <p className="text-[11px] mt-1" style={{ color: "#D9534F" }}>{errors.email}</p>}
                <p className="text-[11px] mt-1" style={{ color: "#6B645B" }}>This is the email they will use to log in to Voicera.</p>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "#6B645B" }}>
                  Temporary Password *
                </label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"} value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 12 characters"
                    className="w-full h-10 px-3 pr-10 text-[13px] border rounded-lg focus:outline-none focus:ring-2 transition-colors"
                    style={{ borderColor: errors.password ? "#D9534F" : "#E7DFC8", outlineColor: "#50381F" }}
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 border-none bg-transparent cursor-pointer p-0" style={{ color: "#6B645B" }}>
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {errors.password && <p className="text-[11px] mt-1" style={{ color: "#D9534F" }}>{errors.password}</p>}
                <p className="text-[11px] mt-1" style={{ color: "#6B645B" }}>Share this with the customer. They can change it after first login.</p>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider block mb-2" style={{ color: "#6B645B" }}>Subscription Plan</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["Starter", "Growth", "Enterprise"] as const).map((p) => (
                    <button
                      key={p} type="button"
                      onClick={() => setPlan(p)}
                      className="rounded-xl border p-3 text-left transition-all cursor-pointer"
                      style={{ 
                        borderColor: plan === p ? "#50381F" : "#E7DFC8", 
                        backgroundColor: plan === p ? "#F7F4EF" : "#FFFFFF"
                      }}
                    >
                      <div className="text-[12px] font-bold" style={{ color: "#1E1A16" }}>{p}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: "#6B645B" }}>
                        {p === "Starter" ? "Up to 2 agents" : p === "Growth" ? "Up to 5 agents" : "Unlimited"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="shrink-0 border-t px-6 py-4 flex justify-end gap-3" style={{ borderColor: "#E7DFC8" }}>
              <button onClick={onClose} className="h-9 px-4 rounded-lg border text-[13px] font-bold cursor-pointer transition-colors" style={{ borderColor: "#E7DFC8", backgroundColor: "#FFFFFF", color: "#1E1A16" }}>Cancel</button>
              <button
                onClick={() => { if (validateForm()) setStep("agents"); }}
                className="h-9 px-4 rounded-lg border-none text-[13px] font-bold text-white cursor-pointer transition-colors"
                style={{ backgroundColor: "#50381F" }}
              >
                Next: Assign Agents →
              </button>
            </div>
          </>
        )}

        {step === "agents" && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <p className="text-[13px] mb-1" style={{ color: "#6B645B" }}>
                Select which AI agents <strong style={{ color: "#1E1A16" }}>{orgName}</strong> can access.
              </p>
              <p className="text-[12px] mb-4" style={{ color: "#6B645B" }}>
                Only these agents will appear in the customer's workspace. They can't see any other agent.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {AGENT_TYPES.map((at) => {
                  const checked = selectedAgents.has(at.id as AgentType);
                  return (
                    <button
                      key={at.id} type="button"
                      onClick={() => toggleAgent(at.id as AgentType)}
                      className="flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer"
                      style={{ 
                        borderColor: checked ? "#50381F" : "#E7DFC8", 
                        backgroundColor: checked ? "#F7F4EF" : "#FFFFFF"
                      }}
                    >
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${at.color}15`, color: at.color }}>
                        <Package size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-bold truncate" style={{ color: "#1E1A16" }}>{at.label}</div>
                        <div className="text-[10px]" style={{ color: "#6B645B" }}>{at.category}</div>
                      </div>
                      <div className="h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0" style={{ borderColor: checked ? "#50381F" : "#E7DFC8", backgroundColor: checked ? "#50381F" : "#FFFFFF" }}>
                        {checked && <Check size={10} color="white" strokeWidth={3} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="shrink-0 border-t px-6 py-4 flex items-center justify-between" style={{ borderColor: "#E7DFC8" }}>
              <span className="text-[12px]" style={{ color: "#6B645B" }}>
                <strong style={{ color: "#1E1A16" }}>{selectedAgents.size}</strong> agent{selectedAgents.size !== 1 ? "s" : ""} selected
              </span>
              <div className="flex gap-3">
                <button onClick={() => setStep("form")} className="h-9 px-4 rounded-lg border text-[13px] font-bold cursor-pointer transition-colors" style={{ borderColor: "#E7DFC8", backgroundColor: "#FFFFFF", color: "#1E1A16" }}>← Back</button>
                <button
                  onClick={() => { if (selectedAgents.size > 0) setStep("confirm"); }}
                  disabled={selectedAgents.size === 0}
                  className="h-9 px-4 rounded-lg border-none text-[13px] font-bold text-white cursor-pointer transition-colors"
                  style={{ backgroundColor: selectedAgents.size > 0 ? "#50381F" : "#E7DFC8" }}
                >
                  Next: Review →
                </button>
              </div>
            </div>
          </>
        )}

        {step === "confirm" && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#E7DFC8" }}>
                <div className="px-4 py-3 border-b text-[11px] font-bold uppercase tracking-wider" style={{ borderColor: "#E7DFC8", backgroundColor: "#F7F4EF", color: "#6B645B" }}>
                  Account Summary
                </div>
                <div className="px-4 py-3 flex flex-col gap-3">
                  {[
                    { label: "Organisation", value: orgName },
                    { label: "Contact Person", value: contactName },
                    { label: "Login Email", value: email },
                    { label: "Temporary Password", value: "••••••••" },
                    { label: "Plan", value: plan },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-[13px]">
                      <span style={{ color: "#6B645B" }}>{label}</span>
                      <span className="font-bold" style={{ color: "#1E1A16" }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "#6B645B" }}>Assigned Agents ({selectedAgents.size})</p>
                <div className="flex flex-wrap gap-2">
                  {Array.from(selectedAgents).map((id) => {
                    const def = AGENT_TYPES.find((a) => a.id === id);
                    if (!def) return null;
                    return (
                      <span key={id} className="inline-flex items-center gap-1.5 text-[12px] font-bold px-3 py-1 rounded-full border"
                        style={{ color: "#1E1A16", backgroundColor: "#ECE6D9", borderColor: "#E7DFC8" }}>
                        <Check size={11} strokeWidth={3} />{def.label}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-xl border p-3 mb-4" style={{ backgroundColor: "#4CAF5022", borderColor: "#4CAF50" }}>
                <CheckCircle2 size={14} className="shrink-0 mt-0.5" style={{ color: "#4CAF50" }} />
                <div className="text-[12px]" style={{ color: "#4CAF50" }}>
                  After creation, the customer can log in at <strong>voicera.ai/login</strong> using the email &amp; password above. They will be automatically taken to their dedicated workspace.
                </div>
              </div>

              {creationError && (
                <div className="flex items-start gap-2.5 rounded-xl border p-3" style={{ backgroundColor: "#D9534F22", borderColor: "#D9534F" }}>
                  <AlertCircle size={14} className="shrink-0 mt-0.5" style={{ color: "#D9534F" }} />
                  <div className="text-[12px]" style={{ color: "#D9534F" }}>{creationError}</div>
                </div>
              )}
            </div>
            <div className="shrink-0 border-t px-6 py-4 flex items-center justify-between" style={{ borderColor: "#E7DFC8" }}>
              <button onClick={() => setStep("agents")} disabled={isCreating} className="h-9 px-4 rounded-lg border text-[13px] font-bold cursor-pointer transition-colors disabled:opacity-50" style={{ borderColor: "#E7DFC8", backgroundColor: "#FFFFFF", color: "#1E1A16" }}>← Back</button>
              <button
                onClick={handleCreateAccount}
                disabled={isCreating}
                className="h-9 px-5 rounded-lg border-none text-[13px] font-bold text-white cursor-pointer transition-colors flex items-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: isCreating ? "#E7DFC8" : "#50381F" }}
              >
                {isCreating ? (
                  <>Creating Account...</>
                ) : (
                  <><UserPlus size={14} /> Create Account</>
                )}
              </button>
            </div>
          </>
        )}

        {step === "success" && (
          <div className="p-8 flex flex-col items-center text-center">
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: "#4CAF5022" }}>
              <CheckCircle2 size={32} style={{ color: "#4CAF50" }} />
            </div>
            <h2 className="text-[20px] font-bold mb-2" style={{ color: "#1E1A16" }}>
              {wasExistingAccount ? "Subscription Updated!" : "Account Created!"}
            </h2>
            <p className="text-[13px] mb-6 max-w-xs" style={{ color: "#6B645B" }}>
              {wasExistingAccount ? (
                <>
                  <strong style={{ color: "#1E1A16" }}>{orgName}</strong> already had an account — their agent access has been updated to your selection.
                </>
              ) : (
                <>
                  <strong style={{ color: "#1E1A16" }}>{orgName}</strong> can now log in to their dedicated workspace.
                </>
              )}
            </p>

            <div className="w-full rounded-xl border p-4 mb-4 text-left" style={{ backgroundColor: "#F7F4EF", borderColor: "#E7DFC8" }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#50381F" }}>Login Credentials to Share</span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-[11px] font-bold cursor-pointer border-none bg-transparent transition-colors"
                  style={{ color: "#50381F" }}
                >
                  {copied ? <Check size={11} strokeWidth={3} /> : <Copy size={11} />}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-[13px]">
                  <span style={{ color: "#6B645B" }}>Login URL</span>
                  <span className="font-mono font-bold text-[12px]" style={{ color: "#1E1A16" }}>voicera.ai/login</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span style={{ color: "#6B645B" }}>Email</span>
                  <span className="font-mono font-bold text-[12px]" style={{ color: "#1E1A16" }}>{email}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span style={{ color: "#6B645B" }}>Password</span>
                  <span className="font-mono font-bold text-[12px]" style={{ color: "#1E1A16" }}>{password}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span style={{ color: "#6B645B" }}>Agents Assigned</span>
                  <span className="font-bold" style={{ color: "#1E1A16" }}>{selectedAgents.size} agent(s)</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 w-full">
              <button
                onClick={handleCopy}
                className="flex-1 h-10 rounded-lg border text-[13px] font-bold cursor-pointer transition-colors flex items-center justify-center gap-2"
                style={{ borderColor: "#E7DFC8", backgroundColor: "#FFFFFF", color: "#1E1A16" }}
              >
                <Copy size={13} /> Copy Credentials
              </button>
              <button
                onClick={handleSendEmail}
                className="flex-1 h-10 rounded-lg border-none text-[13px] font-bold text-white cursor-pointer transition-colors flex items-center justify-center gap-2"
                style={{ backgroundColor: "#50381F" }}
              >
                <Send size={13} /> Send via Email
              </button>
            </div>
            <button onClick={onClose} className="mt-3 text-[12px] cursor-pointer border-none bg-transparent transition-colors" style={{ color: "#6B645B" }}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
