import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeMode = "dark" | "light";
export type Density = "comfortable" | "compact";
export type Privacy = "show" | "hide";
export type SidebarPref = "expanded" | "collapsed";

export type AccentKey =
  | "mint"
  | "purple"
  | "pink"
  | "orange"
  | "blue"
  | "yellow"
  | "rainbow";

export const ACCENTS: Record<AccentKey, { label: string; h: number; s: number; l: number; swatch: string }> = {
  mint:    { label: "Mint",    h: 160, s: 84, l: 55, swatch: "linear-gradient(135deg,#34e0a8,#10b981)" },
  purple:  { label: "Purple",  h: 265, s: 78, l: 65, swatch: "linear-gradient(135deg,#a78bfa,#8b5cf6)" },
  pink:    { label: "Pink",    h: 340, s: 82, l: 65, swatch: "linear-gradient(135deg,#f472b6,#ec4899)" },
  orange:  { label: "Orange",  h: 28,  s: 92, l: 60, swatch: "linear-gradient(135deg,#fb923c,#f97316)" },
  blue:    { label: "Blue",    h: 215, s: 90, l: 62, swatch: "linear-gradient(135deg,#60a5fa,#3b82f6)" },
  yellow:  { label: "Yellow",  h: 50,  s: 95, l: 60, swatch: "linear-gradient(135deg,#fde047,#facc15)" },
  rainbow: { label: "Rainbow", h: 280, s: 80, l: 62, swatch: "conic-gradient(from 0deg,#f43f5e,#f97316,#facc15,#10b981,#3b82f6,#8b5cf6,#f43f5e)" },
};

type TweaksState = {
  theme: ThemeMode;
  accent: AccentKey;
  density: Density;
  sidebar: SidebarPref;
  privacy: Privacy;
};

type TweaksContextValue = TweaksState & {
  setTheme: (v: ThemeMode) => void;
  setAccent: (v: AccentKey) => void;
  setDensity: (v: Density) => void;
  setSidebar: (v: SidebarPref) => void;
  setPrivacy: (v: Privacy) => void;
};

const DEFAULT: TweaksState = {
  theme: "light",
  accent: "mint",
  density: "comfortable",
  sidebar: "expanded",
  privacy: "show",
};

const STORAGE_KEY = "nexus.tweaks.v2";

const TweaksContext = createContext<TweaksContextValue | null>(null);

function load(): TweaksState {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...(JSON.parse(raw) as Partial<TweaksState>) };
  } catch {
    return DEFAULT;
  }
}

export function TweaksProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TweaksState>(DEFAULT);

  // Hydrate from localStorage on the client only
  useEffect(() => {
    setState(load());
  }, []);

  // Apply to <html> + persist
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;

    if (state.theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");

    const a = ACCENTS[state.accent];
    root.style.setProperty("--accent-h", String(a.h));
    root.style.setProperty("--accent-s", `${a.s}%`);
    root.style.setProperty("--accent-l", `${a.l}%`);

    root.dataset.density = state.density;
    root.dataset.privacy = state.privacy;

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  const value = useMemo<TweaksContextValue>(
    () => ({
      ...state,
      setTheme: (theme) => setState((s) => ({ ...s, theme })),
      setAccent: (accent) => setState((s) => ({ ...s, accent })),
      setDensity: (density) => setState((s) => ({ ...s, density })),
      setSidebar: (sidebar) => setState((s) => ({ ...s, sidebar })),
      setPrivacy: (privacy) => setState((s) => ({ ...s, privacy })),
    }),
    [state],
  );

  return <TweaksContext.Provider value={value}>{children}</TweaksContext.Provider>;
}

export function useTweaks() {
  const ctx = useContext(TweaksContext);
  if (!ctx) throw new Error("useTweaks must be used within TweaksProvider");
  return ctx;
}
