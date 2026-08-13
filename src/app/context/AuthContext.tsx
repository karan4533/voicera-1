import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
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
import { auth as firebaseAuth } from "../lib/firebase";
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
import { recordAuditEvent, revokeMySessions } from "../lib/adminApi";
import { safeLog } from "../lib/safeLog";

interface AuthContextValue {
  session: AuthSession | null;
  /** true while Firebase resolves the initial auth state on cold load */
  loading: boolean;
  login: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  completeMfaLogin: (resolver: MultiFactorResolver, code: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
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

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(firebaseAuth, async (user) => {
      if (user) {
        const s = await buildSession(user);
        setCachedSession(s);
        setSession(s);
      } else {
        setCachedSession(null);
        setSession(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = useCallback(
    async (email: string, password: string, rememberMe: boolean) => {
      await setPersistence(
        firebaseAuth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence,
      );
      try {
        await signInWithEmailAndPassword(firebaseAuth, email, password);
        await recordAuditEvent({ action: "login", detail: "Password sign-in" });
      } catch (err) {
        if (asAuthCode(err) === "auth/multi-factor-auth-required") {
          throw new MfaRequiredError(
            getMultiFactorResolver(firebaseAuth, err as MultiFactorError),
          );
        }
        throw err;
      }
    },
    [],
  );

  const completeMfaLogin = useCallback(
    async (resolver: MultiFactorResolver, code: string) => {
      const hint = resolver.hints[0];
      if (!hint) throw new Error("No authenticator is enrolled on this account.");
      const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code.trim());
      await resolver.resolveSignIn(assertion);
      await recordAuditEvent({ action: "login", detail: "MFA sign-in" });
    },
    [],
  );

  const loginWithGoogle = useCallback(async () => {
    await setPersistence(firebaseAuth, browserLocalPersistence);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(firebaseAuth, provider);
      await recordAuditEvent({ action: "login", detail: "Google sign-in" });
    } catch (err) {
      if (asAuthCode(err) === "auth/multi-factor-auth-required") {
        throw new MfaRequiredError(
          getMultiFactorResolver(firebaseAuth, err as MultiFactorError),
        );
      }
      throw err;
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(firebaseAuth, email);
  }, []);

  const logout = useCallback(() => {
    void (async () => {
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
      await signOut(firebaseAuth);
    })();
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, loading, login, completeMfaLogin, loginWithGoogle, resetPassword, logout }}
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
