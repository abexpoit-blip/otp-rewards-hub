import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import nexusLogo from "@/assets/nexus-logo.png";

/**
 * Geist Glass Bento auth shell — light, airy, frosted glass.
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
    <div className="relative min-h-screen overflow-hidden mesh-canvas text-foreground">
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-[520px] w-[520px] rounded-full bg-primary/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-[560px] w-[560px] rounded-full bg-chart-2/20 blur-[120px]" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-3/15 blur-[100px]" />

      <div className="relative z-10 mx-auto grid min-h-screen max-w-7xl grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
        {/* Left brand panel */}
        <aside className="hidden flex-col justify-between p-12 lg:flex">
          <Link to="/" className="flex items-center">
            <img src={nexusLogo} alt="Nexus 2.0" className="h-28 w-auto object-contain" />
          </Link>

          <div className="space-y-6">
            <h1 className="text-5xl font-bold leading-[1.05] tracking-tighter text-foreground">
              Real-time OTP <br />
              <span className="accent-gradient-text">infrastructure, beautifully done.</span>
            </h1>
            <p className="max-w-md text-base leading-relaxed text-muted-foreground">
              Allocate number ranges, watch live SMS streams, monitor carrier health and
              withdraw earnings — all from a single command surface.
            </p>

            <div className="grid max-w-md grid-cols-3 gap-3 pt-4">
              {[
                ["98.4%", "Uptime"],
                ["14ms", "Latency"],
                ["24/7", "Stream"],
              ].map(([v, l]) => (
                <div key={l} className="glass-panel p-4">
                  <p className="text-2xl font-bold tracking-tight text-foreground">{v}</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {l}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
            ENGINE_STATUS: ONLINE · v2.4.11
          </div>
        </aside>

        {/* Right form */}
        <main className="flex items-center justify-center px-4 py-8 sm:px-6 sm:py-12 lg:p-12">
          <div className="w-full max-w-md">
            <Link to="/" className="mb-6 flex justify-center sm:mb-8 sm:justify-start lg:hidden">
              <img src={nexusLogo} alt="Nexus 2.0" className="h-16 w-auto object-contain sm:h-20" />
            </Link>

            <div className="glass-panel-strong relative p-5 sm:p-8">
              <div className="mb-2 flex items-center gap-2">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{title}</h2>
              </div>
              <p className="mb-6 text-sm text-muted-foreground sm:mb-7">{subtitle}</p>
              {children}
            </div>

            <div className="mt-6 text-center text-xs text-muted-foreground">{footer}</div>
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
        <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
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
        "w-full rounded-2xl border border-border bg-white/60 px-5 py-3 text-sm font-medium text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/20 " +
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
        "relative w-full rounded-2xl bg-foreground py-4 text-sm font-bold text-background shadow-lg shadow-foreground/10 transition-all hover:bg-foreground/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 " +
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
    <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
      {children}
    </div>
  );
}

export function useFormState<T extends Record<string, string>>(initial: T) {
  const [state, setState] = useState<T>(initial);
  const set =
    (k: keyof T) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setState((s) => ({ ...s, [k]: e.target.value }));
  return [state, set, setState] as const;
}
