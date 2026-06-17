import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { consoleFeedFn } from "@/lib/stex.functions";
import { TerminalSquare, Search, RefreshCw, Smartphone, Radio } from "lucide-react";
import {
  Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { SkeletonFeedRows, SkeletonRows } from "@/components/Skeleton";

export const Route = createFileRoute("/console")({
  head: () => ({ meta: [{ title: "Console — Nexus SMS" }] }),
  component: () => (<Protected><ConsolePage /></Protected>),
});

const PALETTE = ["#10b981", "#3b82f6", "#a855f7", "#f59e0b", "#ec4899", "#0ea5e9", "#64748b", "#dc2626"];
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

      {/* ===== Stats grid ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Top Apps */}
        <div className="glass-panel-strong p-5">
          <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><Smartphone className="size-4 text-emerald-500" /> Top Apps</h3>
          <div className="h-[200px]">
            {topApps.length === 0 ? <p className="text-xs text-muted-foreground">No data yet.</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topApps} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="sid" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {topApps.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-3 space-y-1.5">
            {topApps.map((a, i) => (
              <div key={a.sid} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="size-2.5 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
                  <span className="font-medium truncate">{a.sid}</span>
                </div>
                <div className="flex items-center gap-3 tabular-nums">
                  <span className="font-mono font-semibold">{a.count}</span>
                  <span className="text-muted-foreground w-10 text-right">{a.pct.toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Carrier distribution */}
        <div className="glass-panel-strong p-5">
          <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><Radio className="size-4 text-emerald-500" /> Carrier Distribution</h3>
          <div className="h-[200px] relative">
            {carriers.length === 0 ? <p className="text-xs text-muted-foreground">No data yet.</p> : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={carriers} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} stroke="none">
                      {carriers.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="text-2xl font-bold tabular-nums">{totalHits}</div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Total</div>
                </div>
              </>
            )}
          </div>
          <div className="mt-3 space-y-1.5">
            {carriers.map((c, i) => (
              <div key={c.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
                  <span className="font-medium">{c.name}</span>
                </div>
                <div className="flex items-center gap-3 tabular-nums">
                  <span className="font-mono font-semibold">{c.value}</span>
                  <span className="text-muted-foreground w-10 text-right">{c.pct.toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== Feed header bar ===== */}
      <div className="glass-panel-strong p-3 mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold flex items-center gap-2"><TerminalSquare className="size-4 text-emerald-500" /> Live Console</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 text-[10px] font-bold">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE
          </span>
          <span className="text-[10px] text-muted-foreground">Logs: {filtered.length} (Max 50)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-background border border-border rounded-md px-2 py-1.5 text-xs">
            <Search className="size-3 text-muted-foreground" />
            <input
              placeholder="Filter logs (sender, range, msg)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="bg-transparent outline-none w-48"
            />
          </div>
          <button onClick={() => refetch()} disabled={isFetching} className="flex items-center gap-1.5 bg-background border border-border rounded-md px-2.5 py-1.5 text-xs hover:bg-accent disabled:opacity-60 disabled:cursor-not-allowed">
            <RefreshCw className={`size-3 ${isFetching ? "animate-spin" : ""}`} />
            {isFetching ? "Refreshing…" : <>Next update: <span className="font-mono font-semibold">{nextUpdateIn}s</span></>}
          </button>
        </div>
      </div>

      {/* ===== Feed rows ===== */}
      <div className="glass-panel-strong p-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
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
