import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { dashboardStatsFn } from "@/lib/stex.functions";
import {
  Activity, ArrowDownRight, ArrowUpRight, Crown, Globe2, MessageSquare,
  ShieldCheck, Wallet, Zap,
} from "lucide-react";
import {
  Area, AreaChart, Line, LineChart, ResponsiveContainer, Tooltip,
} from "recharts";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Nexus SMS" },
      { name: "description", content: "Live OTP traffic, top performers and earnings at a glance." },
    ],
  }),
  component: () => (<Protected><Dashboard /></Protected>),
});

const TREND_COLORS = ["#2563eb", "#16a34a", "#94a3b8", "#0ea5e9", "#a855f7", "#64748b", "#ec4899", "#f59e0b"];

function Dashboard() {
  const { user, token } = useAuth();
  const displayName = user?.name || user?.email?.split("@")[0] || "Operator";
  const balance = user ? Number(user.balance).toFixed(2) : "0.00";

  const callStats = useServerFn(dashboardStatsFn);
  const { data } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => callStats({ data: { token: token! } }),
    enabled: !!token,
    refetchInterval: 15000,
  });

  // Build 24h hourly series, zero-fill missing hours
  const hourlyData = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const h of data?.hourly || []) {
      const k = new Date(h.bucket).toISOString().slice(0, 13);
      buckets.set(k, h.success);
    }
    const out: { hour: string; value: number }[] = [];
    const now = new Date();
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 3600_000);
      const k = d.toISOString().slice(0, 13);
      out.push({ hour: `${String(d.getHours()).padStart(2, "0")}:00`, value: buckets.get(k) || 0 });
    }
    return out;
  }, [data]);

  const todayEarn = Number(data?.today?.earned || 0);
  const yestEarn = Number(data?.yest?.earned || 0);
  const todayTotal = data?.today?.total || 0;
  const todaySuccess = data?.today?.success || 0;
  const yestTotal = data?.yest?.total || 0;
  const yestSuccess = data?.yest?.success || 0;
  const pct = yestEarn > 0 ? ((todayEarn - yestEarn) / yestEarn) * 100 : (todayEarn > 0 ? 100 : 0);
  const successRate = todayTotal ? Math.round((todaySuccess / todayTotal) * 100) : 0;
  const topService = (data?.trending || [])[0]?.sid || "—";

  return (
    <AppShell>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Welcome back, <span className="accent-gradient-text">{displayName}</span>
          </h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Everything is running smoothly today.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white/70 px-4 py-2 text-right shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Balance</p>
            <p className="text-lg font-bold tracking-tight accent-text" data-mask>${balance}</p>
          </div>
        </div>
      </header>

      <div className="glass-panel mb-6 flex items-start gap-3 p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-400/15 text-amber-600">📣</span>
        <div className="space-y-1 text-sm">
          <p className="text-foreground">
            <span className="font-bold">Nexus SMS V2 is live</span> — Real-time OTP panel with per-service payouts and instant withdrawals.
          </p>
          <p className="text-muted-foreground">
            Telegram: <span className="accent-text font-mono font-semibold">@nexussupport</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <div className="glass-panel-strong relative overflow-hidden p-7 md:col-span-2">
          <div className="relative z-10 flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Today's Revenue</p>
              <h2 className="mt-1 text-5xl font-bold tracking-tighter text-foreground" data-mask>
                ${todayEarn.toFixed(2)}
              </h2>
              <div className={`mt-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${pct >= 0 ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600" : "border-rose-500/20 bg-rose-500/10 text-rose-600"}`}>
                {pct >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                {pct >= 0 ? "+" : ""}{pct.toFixed(1)}% vs yesterday
              </div>
            </div>
            <div className="hidden h-24 w-48 items-end gap-1.5 sm:flex">
              {hourlyData.slice(-6).map((h, i) => {
                const max = Math.max(1, ...hourlyData.map((x) => x.value));
                const pctH = (h.value / max) * 100;
                return (
                  <div key={i} className="w-full rounded-t-lg bg-gradient-to-t from-primary/60 to-primary"
                    style={{ height: `${Math.max(10, pctH)}%`, opacity: 0.3 + (i / 6) * 0.7 }} />
                );
              })}
            </div>
          </div>
        </div>

        <StatTile label="Today OTPs" value={String(todaySuccess)} hint={`Success rate ${successRate}%`} icon={<MessageSquare className="size-5" />} accent="blue" />
        <StatTile label="Active Numbers" value={String(data?.active ?? 0)} hint="Currently pending" icon={<Activity className="size-5" />} accent="indigo" />
        <StatTile label="Yesterday Revenue" value={`$${yestEarn.toFixed(2)}`} hint={`${yestSuccess}/${yestTotal} success`} icon={<Wallet className="size-5" />} accent="purple" />
        <StatTile label="Yesterday OTPs" value={String(yestSuccess)} hint="Completed verifications" icon={<ShieldCheck className="size-5" />} accent="sky" />
        <StatTile label="Latency" value="42ms" hint="Ultra-low response" icon={<Zap className="size-5" />} accent="indigo" />
        <StatTile label="Top Service" value={topService} hint={topService === "—" ? "No traffic yet" : "Last 24h"} icon={<Crown className="size-5" />} accent="amber" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="glass-panel-strong p-6 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold tracking-tight text-foreground">Hourly Traffic</h3>
              <p className="text-xs text-muted-foreground">Your successful OTPs in the last 24h</p>
            </div>
            <LiveBadge />
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="hourlyFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--accent-hsl))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--accent-hsl))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip contentStyle={{ background: "white", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }} />
                <Area type="monotone" dataKey="value" stroke="hsl(var(--accent-hsl))" strokeWidth={2.5} fill="url(#hourlyFill)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel-strong p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe2 className="size-4 accent-text" />
              <h3 className="font-bold tracking-tight text-foreground">Global Trending</h3>
            </div>
            <LiveBadge />
          </div>
          {(!data?.trending || data.trending.length === 0) ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No traffic in the last 24h yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {data.trending.map((t: any, i: number) => (
                <li key={t.sid} className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-white/60">
                  <span className={`grid size-6 place-items-center rounded-md text-[11px] font-bold ${
                    i === 0 ? "bg-amber-400 text-amber-950" : i === 1 ? "bg-slate-300 text-slate-800" : i === 2 ? "bg-orange-400 text-orange-950" : "bg-slate-100 text-slate-500"
                  }`}>{i + 1}</span>
                  <MessageSquare className="size-3.5" style={{ color: TREND_COLORS[i % TREND_COLORS.length] }} />
                  <span className="flex-1 text-sm font-medium text-foreground">{t.sid}</span>
                  <span className="text-xs font-mono text-muted-foreground">{t.success}/{t.total}</span>
                  <Sparkline color={TREND_COLORS[i % TREND_COLORS.length]} seed={i} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function StatTile({ label, value, hint, icon, accent }: {
  label: string; value: string; hint: string; icon: React.ReactNode;
  accent: "blue" | "indigo" | "purple" | "sky" | "amber";
}) {
  const palette: Record<typeof accent, string> = {
    blue: "bg-blue-500/10 text-blue-600", indigo: "bg-indigo-500/10 text-indigo-600",
    purple: "bg-purple-500/10 text-purple-600", sky: "bg-sky-500/10 text-sky-600",
    amber: "bg-amber-500/10 text-amber-600",
  };
  return (
    <div className="glass-panel p-6 transition hover:-translate-y-0.5 hover:shadow-xl">
      <div className="mb-4 flex items-center justify-between">
        <div className={`grid size-11 place-items-center rounded-2xl ${palette[accent]}`}>{icon}</div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      </div>
      <p className="text-3xl font-bold tracking-tight text-foreground" data-mask>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
        <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
      </span>
      Live
    </span>
  );
}

function Sparkline({ color, seed }: { color: string; seed: number }) {
  const data = Array.from({ length: 14 }, (_, i) => ({
    x: i, y: 30 + Math.abs(Math.sin((i + seed) / 2.3)) * 40,
  }));
  return (
    <div className="h-6 w-20">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="y" stroke={color} strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
