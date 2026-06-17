import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";

/**
 * Premium auth shell (Cyan + Indigo Fintech direction).
 * Used by /login and /signup. Pure presentation — no backend coupling here.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050608] text-slate-200">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 size-[640px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 size-[420px] rounded-full bg-indigo-600/15 blur-[120px]" />
      {/* Grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      <div className="relative z-10 mx-auto grid min-h-screen max-w-7xl grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
        {/* Left brand panel */}
        <aside className="hidden flex-col justify-between p-12 lg:flex">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl border border-cyan-500/40 bg-cyan-500/10 shadow-[0_0_24px_rgba(34,211,238,0.25)]">
              <div className="size-3 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight text-white">NEXUS SMS</p>
              <p className="font-mono text-[10px] tracking-widest text-cyan-400/80">V2 PANEL</p>
            </div>
          </div>

          <div className="space-y-6">
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white">
              Real-time OTP <br />
              <span className="bg-gradient-to-r from-cyan-300 to-indigo-400 bg-clip-text text-transparent">
                infrastructure terminal.
              </span>
            </h1>
            <p className="max-w-md text-sm leading-relaxed text-slate-400">
              Allocate number ranges, watch live SMS streams, monitor carrier health and withdraw
              earnings — all from a single high-density command surface.
            </p>

            <div className="grid max-w-md grid-cols-3 gap-3 pt-4">
              {[
                ["98.4%", "Uptime"],
                ["14ms", "Latency"],
                ["24/7", "Stream"],
              ].map(([v, l]) => (
                <div
                  key={l}
                  className="rounded-xl border border-white/5 bg-white/[0.02] p-3"
                >
                  <p className="font-mono text-lg font-bold text-white">{v}</p>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">{l}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
            ENGINE_STATUS: ONLINE · v2.4.11
          </div>
        </aside>

        {/* Right form */}
        <main className="flex items-center justify-center px-6 py-12 lg:p-12">
          <div className="w-full max-w-md">
            {/* Mobile logo */}
            <Link to="/" className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="grid size-9 place-items-center rounded-lg border border-cyan-500/40 bg-cyan-500/10">
                <div className="size-2.5 rounded-full bg-cyan-400" />
              </div>
              <span className="text-sm font-bold tracking-tight text-white">NEXUS SMS</span>
            </Link>

            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0a0b0e]/80 p-8 shadow-2xl backdrop-blur-xl">
              <div className="absolute -right-16 -top-16 size-40 rounded-full bg-cyan-500/10 blur-3xl" />
              <div className="relative">
                <div className="mb-6 flex items-center gap-2">
                  <span className="size-1.5 animate-pulse rounded-full bg-cyan-400" />
                  <h2 className="text-xl font-bold text-white">{title}</h2>
                </div>
                <p className="mb-6 text-xs text-slate-500">{subtitle}</p>
                {children}
              </div>
            </div>

            <div className="mt-6 text-center text-[11px] text-slate-600">{footer}</div>
          </div>
        </main>
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {label}
        </label>
        {hint}
      </div>
      {children}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        "w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-700 outline-none transition-all focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/40 " +
        (props.className ?? "")
      }
    />
  );
}

export function PrimaryButton({
  children,
  loading,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={loading || rest.disabled}
      className={
        "relative w-full rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-400 py-3 text-sm font-bold text-black shadow-[0_8px_28px_-8px_rgba(34,211,238,0.6)] transition-all hover:from-cyan-400 hover:to-cyan-300 disabled:cursor-not-allowed disabled:opacity-60 " +
        (rest.className ?? "")
      }
    >
      {loading ? "Working…" : children}
    </button>
  );
}

export function ErrorBox({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
      {children}
    </div>
  );
}

/** Hook to manage simple sync state for forms */
export function useFormState<T extends Record<string, string>>(initial: T) {
  const [state, setState] = useState<T>(initial);
  const set =
    (k: keyof T) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setState((s) => ({ ...s, [k]: e.target.value }));
  return [state, set, setState] as const;
}
