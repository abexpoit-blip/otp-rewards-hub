import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Nexus SMS — Auth Context
 * ------------------------
 * Backend বসবে user-এর নিজের VPS এ। API base URL `.env` থেকে আসবে:
 *   VITE_API_BASE=https://v2.nexus-x.site/api
 *
 * Endpoints (VPS এ implement করতে হবে):
 *   POST {API_BASE}/auth/login   { email, password }      -> { token, user }
 *   POST {API_BASE}/auth/signup  { name, email, phone, password } -> { token, user }
 *   POST {API_BASE}/auth/forgot  { email }                -> { ok: true }
 *
 * এই file কোনো third-party (Supabase/Cloud) ব্যবহার করে না।
 */

export type AuthUser = {
  id: string;
  email: string;
  name?: string;
  phone?: string;
};

type AuthState = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: { name: string; email: string; phone: string; password: string }) => Promise<void>;
  logout: () => void;
};

const AuthCtx = createContext<AuthState | null>(null);
const STORAGE_KEY = "nexus.auth.v1";
const API_BASE =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE) || "/api";

function readStored(): { token: string; user: AuthUser } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      msg = j.message || j.error || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = readStored();
    if (stored) {
      setUser(stored.user);
      setToken(stored.token);
    }
    setLoading(false);
  }, []);

  const persist = (t: string, u: AuthUser) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: t, user: u }));
    setToken(t);
    setUser(u);
  };

  const login = async (email: string, password: string) => {
    const r = await apiPost<{ token: string; user: AuthUser }>("/auth/login", { email, password });
    persist(r.token, r.user);
  };

  const signup: AuthState["signup"] = async (data) => {
    const r = await apiPost<{ token: string; user: AuthUser }>("/auth/signup", data);
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
