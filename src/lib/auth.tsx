import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { loginFn, signupFn, meFn, type AuthUserDTO } from "./auth.functions";

/**
 * Nexus SMS — Auth Context (self-hosted backend on VPS)
 * --------------------------------------------------------
 * Uses TanStack Start server functions → Postgres (nexus_db, db: nexus_v2).
 * JWT stored in localStorage; revalidated via meFn on mount.
 */

export type AuthUser = AuthUserDTO;

type AuthState = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: { name: string; email: string; phone: string; password: string }) => Promise<void>;
  logout: () => void;
};

const AuthCtx = createContext<AuthState | null>(null);
const STORAGE_KEY = "nexus.auth.v2";

function readStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const callLogin = useServerFn(loginFn);
  const callSignup = useServerFn(signupFn);
  const callMe = useServerFn(meFn);

  // Bootstrap: validate stored token
  useEffect(() => {
    const stored = readStoredToken();
    if (!stored) {
      setLoading(false);
      return;
    }
    setToken(stored);
    callMe({ data: { token: stored } })
      .then((u) => setUser(u))
      .catch(() => {
        localStorage.removeItem(STORAGE_KEY);
        setToken(null);
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
    persist(r.token, r.user);
  };

  const signup: AuthState["signup"] = async (data) => {
    const r = await callSignup({ data });
    persist(r.token, r.user);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, token, loading, login, signup, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
