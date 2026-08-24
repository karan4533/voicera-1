import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
  onIdTokenChanged,
  sendPasswordResetEmail,
  getMultiFactorResolver,
  TotpMultiFactorGenerator,
  type User,
  type MultiFactorError,
  type MultiFactorResolver,
} from "firebase/auth";
import { auth as firebaseAuth, isFirebaseConfigured } from "../lib/firebase";
import { setCachedSession } from "../lib/auth";
import type { AuthSession } from "../lib/auth";
import type { AgentType } from "../lib/types";
import {
  getRoleFromTokenResult,
  getOrgIdFromTokenResult,
  getSubscribedAgents,
  getOrgFromFirestore,
  getOrgByEmailFromFirestore,
} from "../lib/rbac";
import {
  isPlatformAdminEmail,
  getMembershipOrgIds,
  resolvePrimaryOrgId,
  listUserTenants,
  canAccessTenant,
  agentsForOrg,
  type TenantInfo,
} from "../lib/tenantMemberships";
import { recordAuditEvent, revokeMySessions } from "../lib/adminApi";
import { safeLog } from "../lib/safeLog";

const DEMO_SESSION_KEY = "voicera_demo_session";

interface AuthContextValue {
  session: AuthSession | null;
  /** true while Firebase resolves the initial auth state on cold load */
  loading: boolean;
  /** true when Firebase keys are missing and local demo login is active */
  demoMode: boolean;
  /** Purchased tenants the signed-in user may enter (demo memberships / empty until Firestore) */
  userTenants: TenantInfo[];
  login: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  completeMfaLogin: (resolver: MultiFactorResolver, code: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  /** Switch active tenant workspace (org + subscribed agents) for this session */
  switchTenant: (orgId: string) => void;
  /** Kept synchronous at the call-site; Firebase signOut is fire-and-forget */
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export class MfaRequiredError extends Error {
  readonly resolver: MultiFactorResolver;
  constructor(resolver: MultiFactorResolver) {
    super("MFA_REQUIRED");
    this.name = "MfaRequiredError";
    this.resolver = resolver;
  }
}

export function isMfaRequiredError(err: unknown): err is MfaRequiredError {
  return err instanceof MfaRequiredError;
}

function asAuthCode(err: unknown): string {
  if (err && typeof err === "object" && "code" in err) {
    return String((err as { code: unknown }).code);
  }
  return "";
}

function buildDemoSession(email: string): AuthSession {
  const normalized = email.trim().toLowerCase();
  const isAdmin = isPlatformAdminEmail(normalized);

  if (isAdmin) {
    return {
      token: "demo-token",
      user: {
        email: normalized,
        name: displayNameFromEmail(normalized),
        role: "platform_admin",
        orgId: undefined,
        subscribedAgents: undefined,
        orgStatus: undefined,
      },
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
    };
  }

  const memberships = getMembershipOrgIds(normalized);
  if (memberships.length === 0) {
    throw new Error(
      "No workspace assigned to this account. Contact your admin or Heuristic Labs sales.",
    );
  }

  // Single tenant → bind immediately. Multi → wait for picker (empty agents until switch).
  const orgId = resolvePrimaryOrgId(normalized);
  const subscribedAgents: AgentType[] = orgId ? agentsForOrg(orgId) : [];

  return {
    token: "demo-token",
    user: {
      email: normalized,
      name: displayNameFromEmail(normalized),
      role: "customer_admin",
      orgId,
      subscribedAgents,
      orgStatus: "active",
    },
    expiresAt: Date.now() + 8 * 60 * 60 * 1000,
  };
}

function displayNameFromEmail(email: string): string {
  return email
    .split("@")[0]
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function buildSession(user: User): Promise<AuthSession> {
  const tokenResult = await user.getIdTokenResult();
  const email = user.email ?? "";

  const role  = getRoleFromTokenResult(tokenResult, email);
  const orgId = getOrgIdFromTokenResult(tokenResult, email);

  let subscribedAgents: AgentType[] | undefined;
  let orgStatus: AuthSession["user"]["orgStatus"];
  if (role === "platform_admin") {
    subscribedAgents = undefined;
    orgStatus = undefined;
  } else if (orgId) {
    let org = await getOrgFromFirestore(orgId);
    if (!org && email) {
      const byEmail = await getOrgByEmailFromFirestore(email);
      if (byEmail) {
        org = {
          subscribedAgents: byEmail.subscribedAgents,
          status: byEmail.status,
          name: byEmail.name,
          plan: byEmail.plan,
          totalCalls: byEmail.totalCalls,
          creditsLimit: byEmail.creditsLimit,
        };
      }
    }
    if (org) {
      subscribedAgents = org.subscribedAgents;
      orgStatus = org.status;
    } else {
      subscribedAgents = getSubscribedAgents(orgId) ?? [];
      orgStatus = "active";
    }
  } else {
    subscribedAgents = [];
    orgStatus = undefined;
  }

  return {
    token: tokenResult.token,
    user: {
      email,
      name:
        user.displayName ??
        (email
          ? email
              .split("@")[0]
              .replace(/[._]/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase())
          : "User"),
      role,
      orgId,
      subscribedAgents,
      orgStatus,
    },
    expiresAt: Date.now() + 60 * 60 * 1000,
  };
}

function clearClientSessionStorage() {
  try {
    const remembered = localStorage.getItem("remembered_email");
    sessionStorage.clear();
    localStorage.clear();
    if (remembered) localStorage.setItem("remembered_email", remembered);
  } catch {
    // ignore quota / private-mode failures
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const demoMode = !isFirebaseConfigured || !firebaseAuth;

  useEffect(() => {
    if (demoMode) {
      try {
        const raw = localStorage.getItem(DEMO_SESSION_KEY);
        if (raw) {
          const s = JSON.parse(raw) as AuthSession;
          if (s?.user?.email && (s.expiresAt ?? 0) > Date.now()) {
            setCachedSession(s);
            setSession(s);
          } else {
            localStorage.removeItem(DEMO_SESSION_KEY);
          }
        }
      } catch {
        localStorage.removeItem(DEMO_SESSION_KEY);
      }
      setLoading(false);
      return;
    }

    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        setLoading(false);
      }
    };

    // Safety net: never leave the UI on a blank loading state if Auth hangs
    const timeout = window.setTimeout(finish, 4000);

    const unsubscribe = onIdTokenChanged(firebaseAuth!, async (user) => {
      try {
        if (user) {
          const s = await buildSession(user);
          setCachedSession(s);
          setSession(s);
        } else {
          setCachedSession(null);
          setSession(null);
        }
      } catch (err) {
        safeLog.warn("Failed to build auth session", err);
        setCachedSession(null);
        setSession(null);
      } finally {
        finish();
      }
    });

    return () => {
      window.clearTimeout(timeout);
      unsubscribe();
    };
  }, [demoMode]);

  const login = useCallback(
    async (email: string, password: string, rememberMe: boolean) => {
      if (demoMode) {
        if (!password.trim()) throw new Error("Password is required.");
        const s = buildDemoSession(email);
        setCachedSession(s);
        setSession(s);
        localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(s));
        if (rememberMe) localStorage.setItem("remembered_email", email.trim().toLowerCase());
        return;
      }

      await setPersistence(
        firebaseAuth!,
        rememberMe ? browserLocalPersistence : browserSessionPersistence,
      );
      try {
        await signInWithEmailAndPassword(firebaseAuth!, email, password);
        await recordAuditEvent({ action: "login", detail: "Password sign-in" });
      } catch (err) {
        if (asAuthCode(err) === "auth/multi-factor-auth-required") {
          throw new MfaRequiredError(
            getMultiFactorResolver(firebaseAuth!, err as MultiFactorError),
          );
        }
        throw err;
      }
    },
    [demoMode],
  );

  const completeMfaLogin = useCallback(
    async (resolver: MultiFactorResolver, code: string) => {
      if (demoMode) throw new Error("MFA is not available in demo mode.");
      const hint = resolver.hints[0];
      if (!hint) throw new Error("No authenticator is enrolled on this account.");
      const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code.trim());
      await resolver.resolveSignIn(assertion);
      await recordAuditEvent({ action: "login", detail: "MFA sign-in" });
    },
    [demoMode],
  );

  const loginWithGoogle = useCallback(async () => {
    if (demoMode) {
      // Demo Google SSO — simulates Google Workspace sign-in without Firebase
      const s = buildDemoSession("demo.sso@spicegarden.com");
      setCachedSession(s);
      setSession(s);
      localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(s));
      return;
    }
    await setPersistence(firebaseAuth!, browserLocalPersistence);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(firebaseAuth!, provider);
      await recordAuditEvent({ action: "login", detail: "Google SSO sign-in" });
    } catch (err) {
      if (asAuthCode(err) === "auth/multi-factor-auth-required") {
        throw new MfaRequiredError(
          getMultiFactorResolver(firebaseAuth!, err as MultiFactorError),
        );
      }
      throw err;
    }
  }, [demoMode]);

  const resetPassword = useCallback(async (email: string) => {
    if (demoMode) {
      throw new Error("Password reset needs Firebase. Any password works in demo mode.");
    }
    await sendPasswordResetEmail(firebaseAuth!, email);
  }, [demoMode]);

  const switchTenant = useCallback((orgId: string) => {
    setSession((prev) => {
      if (!prev) return prev;
      if (!canAccessTenant(prev.user.email, orgId)) {
        safeLog.warn("Blocked tenant switch — org not in user memberships", {
          email: prev.user.email,
          orgId,
        });
        return prev;
      }
      const subscribedAgents = agentsForOrg(orgId);
      const next: AuthSession = {
        ...prev,
        user: {
          ...prev.user,
          orgId,
          subscribedAgents,
          orgStatus: prev.user.orgStatus ?? "active",
        },
      };
      setCachedSession(next);
      if (demoMode) {
        try {
          localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(next));
        } catch {
          // ignore quota / private-mode failures
        }
      }
      return next;
    });
  }, [demoMode]);

  const logout = useCallback(() => {
    void (async () => {
      if (demoMode) {
        localStorage.removeItem(DEMO_SESSION_KEY);
        try {
          sessionStorage.removeItem("voicera_need_tenant");
          sessionStorage.removeItem("voicera_active_tenant");
          sessionStorage.removeItem("voicera_active_tenant_name");
          sessionStorage.removeItem("vocera_selected_agent");
        } catch {
          // ignore
        }
        setCachedSession(null);
        setSession(null);
        return;
      }
      try {
        await recordAuditEvent({ action: "logout", detail: "User signed out" });
      } catch (err) {
        safeLog.warn("logout audit failed", err);
      }
      try {
        await revokeMySessions();
      } catch (err) {
        safeLog.warn("session revoke on logout failed", err);
      }
      clearClientSessionStorage();
      await signOut(firebaseAuth!);
    })();
  }, [demoMode]);

  const userTenants = useMemo(() => {
    if (!session?.user.email || session.user.role === "platform_admin") return [];
    return listUserTenants(session.user.email);
  }, [session?.user.email, session?.user.role]);

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        demoMode,
        userTenants,
        login,
        completeMfaLogin,
        loginWithGoogle,
        resetPassword,
        switchTenant,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
