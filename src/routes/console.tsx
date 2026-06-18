import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { consoleFeedFn } from "@/lib/stex.functions";
import { TerminalSquare, Search, RefreshCw, Smartphone, Radio, Activity, TrendingUp } from "lucide-react";
import {
  Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { SkeletonFeedRows } from "@/components/Skeleton";

export const Route = createFileRoute("/console")({
  head: () => ({ meta: [{ title: "Console — Nexus SMS" }] }),
  component: () => (<Protected><ConsolePage /></Protected>),
});

// Indigo-led palette aligned with --primary / --chart-* tokens (oklch).
const PALETTE = [
  "hsl(221 83% 53%)",   // indigo (primary)
  "oklch(0.65 0.2 277)",// violet
  "oklch(0.7 0.18 195)",// cyan
  "oklch(0.78 0.17 75)",// amber
  "oklch(0.65 0.22 25)",// rose
  "oklch(0.7 0.15 155)",// emerald
  "oklch(0.6 0.18 320)",// magenta
  "oklch(0.55 0.04 257)" // slate
];
const REFRESH_MS = 5000;

function ConsolePage() {
  const { token } = useAuth();
  const callConsole = useServerFn(consoleFeedFn);
  const [q, setQ] = useState("");
  const [tick, setTick] = useState(0);

  const { data, isLoading, isFetching, dataUpdatedAt, refetch } = useQuery({
    queryKey: ["stex-console"],
    queryFn: () => callConsole({ data: { token: token! } }),
    enabled: !!token,
    refetchInterval: REFRESH_MS,
  });

  // 1-second tick for countdown
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const hits = data?.hits || [];
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return hits;
    return hits.filter((h) =>
      h.sid.toLowerCase().includes(s) ||
      h.range.toLowerCase().includes(s) ||
      h.message.toLowerCase().includes(s)
    );
  }, [hits, q]);

  const topApps = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of hits) m.set(h.sid, (m.get(h.sid) || 0) + 1);
    const total = hits.length || 1;
    return Array.from(m.entries())
      .map(([sid, count]) => ({ sid, count, pct: (count / total) * 100 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [hits]);

  // Carrier proxy: use the country-code prefix from the range
  const carriers = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of hits) {
      const m1 = h.range.match(/^(\d{1,3})/);
      const key = m1 ? `+${m1[1]}` : "other";
      m.set(key, (m.get(key) || 0) + 1);
    }
    const total = hits.length || 1;
    return Array.from(m.entries())
      .map(([name, value]) => ({ name, value, pct: (value / total) * 100 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [hits]);

  const totalHits = hits.length;
  const secsSinceUpdate = dataUpdatedAt ? Math.max(0, Math.round((Date.now() - dataUpdatedAt) / 1000)) : 0;
  const nextUpdateIn = Math.max(0, Math.ceil(REFRESH_MS / 1000) - secsSinceUpdate);

  return (
    <AppShell>
      <PageHeader icon={<TerminalSquare className="size-6" />} title="Live Console" subtitle="Streaming OTP messages with carrier and app distribution charts." />

      {/* ===== Premium command strip ===== */}
      <div className="relative mb-4 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/8 via-background/40 to-background/60 backdrop-blur-xl p-4">
        <div className="absolute -top-12 -right-12 size-48 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="absolute inset-0 rounded-full bg-emerald-500 blur-md opacity-60 animate-pulse" />
              <span className="relative size-2.5 block rounded-full bg-emerald-500 ring-2 ring-emerald-500/30" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Stream Status</div>
              <div className="text-sm font-bold flex items-center gap-2">Live <span className="text-muted-foreground/60">·</span> <span className="font-mono tabular-nums text-primary">{totalHits}</span> events</div>
            </div>
          </div>
          <StatPill label="Apps Tracked" value={topApps.length} />
          <StatPill label="Carriers" value={carriers.length} />
          <StatPill label="Next Sync" value={`${nextUpdateIn}s`} mono />
          <button onClick={() => refetch()} disabled={isFetching} aria-busy={isFetching} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-background/60 hover:bg-accent text-xs font-semibold disabled:opacity-60">
            <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} /> {isFetching ? "Syncing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* ===== Stats grid ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Top Apps */}
        <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/70 backdrop-blur-xl p-5 shadow-[0_8px_30px_-12px_oklch(0.21_0.034_264/0.15)]">
          <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Smartphone className="size-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight">Top Apps</h3>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Sender distribution</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-primary/80">
              <TrendingUp className="size-3" /> Ranked
            </span>
          </div>
          <div className="h-[180px] -mx-2">
            {topApps.length === 0 ? <EmptyState label="No app data yet" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topApps} margin={{ top: 12, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    {topApps.map((_, i) => (
                      <linearGradient key={i} id={`barGrad-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={1} />
                        <stop offset="100%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0.55} />
                      </linearGradient>
                    ))}
                  </defs>
                  <XAxis dataKey="sid" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                  <Tooltip cursor={{ fill: "hsl(221 83% 53% / 0.06)" }} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, boxShadow: "0 10px 30px -10px rgba(0,0,0,0.15)" }} />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                    {topApps.map((_, i) => <Cell key={i} fill={`url(#barGrad-${i})`} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-4 space-y-2 pt-3 border-t border-border/60">
            {topApps.map((a, i) => (
              <LegendRow key={a.sid} color={PALETTE[i % PALETTE.length]} label={a.sid} value={a.count} pct={a.pct} />
            ))}
          </div>
        </div>

        {/* Carrier distribution */}
        <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/70 backdrop-blur-xl p-5 shadow-[0_8px_30px_-12px_oklch(0.21_0.034_264/0.15)]">
          <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Radio className="size-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight">Carrier Distribution</h3>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Country code routing</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-primary/80">
              <Activity className="size-3" /> Global
            </span>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative size-[180px] flex-shrink-0">
              {carriers.length === 0 ? <EmptyState label="No carriers" /> : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={carriers} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86} paddingAngle={3} stroke="var(--card)" strokeWidth={2} cornerRadius={4}>
                        {carriers.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, boxShadow: "0 10px 30px -10px rgba(0,0,0,0.15)" }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Total</div>
                    <div className="text-3xl font-bold tabular-nums font-mono bg-gradient-to-br from-primary to-primary/60 bg-clip-text text-transparent leading-none mt-0.5">{totalHits}</div>
                    <div className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1">OTP Hits</div>
                  </div>
                </>
              )}
            </div>
            <div className="flex-1 w-full space-y-1.5 min-w-0">
              {carriers.slice(0, 6).map((c, i) => (
                <LegendRow key={c.name} color={PALETTE[i % PALETTE.length]} label={c.name} value={c.value} pct={c.pct} compact />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ===== Feed header bar ===== */}
      <div className="glass-panel-strong p-3 mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold flex items-center gap-2"><TerminalSquare className="size-4 text-primary" /> Event Feed</span>
          <span className="text-[10px] text-muted-foreground font-mono">{filtered.length} / 50 logs</span>
        </div>
        <div className="flex items-center gap-1.5 bg-background border border-border rounded-md px-2 py-1.5 text-xs">
          <Search className="size-3 text-muted-foreground" />
          <input
            placeholder="Filter logs (sender, range, msg)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="bg-transparent outline-none w-48"
          />
        </div>
      </div>

      {/* ===== Feed rows ===== */}
      <div className="glass-panel-strong p-4">
        {isLoading ? (
          <SkeletonFeedRows rows={6} />
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-16 text-center">No hits match.</p>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filtered.map((h, i) => {
              const m = h.range.match(/^(\d{1,3})/);
              const cc = m ? `+${m[1]}` : "—";
              return (
                <div key={i} className="border border-border rounded-lg p-3 bg-background/40 hover:bg-accent/20">
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                    <span className="font-mono text-foreground/70">{new Date(h.time).toLocaleTimeString()}</span>
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 font-bold">{cc}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-bold accent-text">{h.sid}</span>
                    <span className="text-muted-foreground">::</span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted">{h.range}</span>
                  </div>
                  <div className="mt-1.5 text-sm break-words text-foreground/80">
                    <span className="text-emerald-500 font-bold mr-1">➜</span>{h.message}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function StatPill({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="hidden md:flex flex-col px-3 py-1.5 rounded-lg border border-border/60 bg-background/60 backdrop-blur min-w-[90px]">
      <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground font-bold">{label}</span>
      <span className={`text-sm font-bold leading-tight ${mono ? "font-mono tabular-nums" : ""}`}>{value}</span>
    </div>
  );
}

function LegendRow({ color, label, value, pct, compact }: { color: string; label: string; value: number; pct: number; compact?: boolean }) {
  return (
    <div className="group/row flex items-center gap-3 text-xs">
      <span className={`${compact ? "size-2" : "size-2.5"} rounded-sm flex-shrink-0 shadow-sm`} style={{ background: color }} />
      <span className="font-medium truncate flex-shrink-0 max-w-[120px]">{label}</span>
      <div className="flex-1 h-1 rounded-full bg-muted/60 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="font-mono font-semibold tabular-nums w-8 text-right">{value}</span>
      <span className="text-muted-foreground font-mono tabular-nums w-10 text-right text-[10px]">{pct.toFixed(0)}%</span>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">{label}</div>
  );
}
