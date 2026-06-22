import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { loginFn, signupFn, meFn, type AuthUserDTO } from "./auth.functions";

export type AuthUser = AuthUserDTO;

type AuthState = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  impersonating: { adminEmail: string } | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: { name: string; email: string; phone: string; password: string; agent_email: string }) => Promise<{ pending: true; message: string }>;
  logout: () => void;
  /** Swap into another user's session. Backs up admin token so we can exit later. */
  enterImpersonation: (token: string, user: AuthUser) => void;
  /** Restore the original admin session. */
  exitImpersonation: () => void;
};

const AuthCtx = createContext<AuthState | null>(null);
const STORAGE_KEY = "nexus.auth.v2";
const IMP_BACKUP = "nexus.auth.v2.admin_backup"; // { token, email }

function readStored<T = string>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try { const v = localStorage.getItem(key); return v ? (v as any) : null; } catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [impersonating, setImpersonating] = useState<{ adminEmail: string } | null>(null);

  const callLogin = useServerFn(loginFn);
  const callSignup = useServerFn(signupFn);
  const callMe = useServerFn(meFn);

  useEffect(() => {
    const stored = readStored<string>(STORAGE_KEY);
    const backupRaw = readStored<string>(IMP_BACKUP);
    if (backupRaw) {
      try { setImpersonating({ adminEmail: JSON.parse(backupRaw).email }); } catch { /* ignore */ }
    }
    if (!stored) { setLoading(false); return; }
    setToken(stored);
    callMe({ data: { token: stored } })
      .then((u) => setUser(u))
      .catch(() => {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(IMP_BACKUP);
        setToken(null);
        setImpersonating(null);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = (t: string, u: AuthUser) => {
    localStorage.setItem(STORAGE_KEY, t);
    setToken(t);
    setUser(u);
  };

  const login: AuthState["login"] = async (email, password) => {
    const r = await callLogin({ data: { email, password } });
    // Clear any prior impersonation when explicitly logging in
    localStorage.removeItem(IMP_BACKUP);
    setImpersonating(null);
    persist(r.token, r.user);
  };

  const signup: AuthState["signup"] = async (data) => {
    const r = await callSignup({ data });
    // Signup is now pending-approval — do NOT auto-login.
    return { pending: true as const, message: r.message };
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(IMP_BACKUP);
    setToken(null);
    setUser(null);
    setImpersonating(null);
  };

  const enterImpersonation: AuthState["enterImpersonation"] = (newToken, newUser) => {
    if (!token || !user) return;
    // Don't nest impersonations — keep the original admin backup if one exists already
    if (!readStored<string>(IMP_BACKUP)) {
      localStorage.setItem(IMP_BACKUP, JSON.stringify({ token, email: user.email }));
    }
    setImpersonating({ adminEmail: user.email });
    persist(newToken, newUser);
  };

  const exitImpersonation: AuthState["exitImpersonation"] = () => {
    const raw = readStored<string>(IMP_BACKUP);
    if (!raw) return;
    try {
      const { token: adminTok } = JSON.parse(raw);
      localStorage.removeItem(IMP_BACKUP);
      setImpersonating(null);
      // Revalidate the restored admin token via meFn
      localStorage.setItem(STORAGE_KEY, adminTok);
      setToken(adminTok);
      callMe({ data: { token: adminTok } })
        .then((u) => setUser(u))
        .catch(() => logout());
    } catch { logout(); }
  };

  return (
    <AuthCtx.Provider value={{ user, token, loading, impersonating, login, signup, logout, enterImpersonation, exitImpersonation }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

