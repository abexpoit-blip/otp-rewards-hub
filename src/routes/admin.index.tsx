import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
  PieChart, Pie, Cell, Bar, BarChart, CartesianGrid,
} from "recharts";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { adminDashboardStatsFn } from "@/lib/admin.functions";
import {
  ShieldCheck, Users, Hash, Wallet, TrendingUp, AlertTriangle,
  Activity, CheckCircle2, Clock, XCircle, DollarSign, Crown,
  ArrowUpRight, Sparkles, Zap, Trophy,
} from "lucide-react";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin Dashboard — Nexus X" }] }),
  component: () => (<Protected><AdminHome /></Protected>),
});

const fmt = (v: string | number) => {
  const n = Number(v ?? 0);
  return n.toLocaleString("en-BD", { maximumFractionDigits: 2 });
};
const bdt = (v: string | number) => `৳${fmt(v)}`;

// ────────────────────────────────────────────────────────────────────────────
// Premium gradient hero KPI card with optional sparkline
// ────────────────────────────────────────────────────────────────────────────
function HeroKpi({
  label, value, delta, icon, gradient, spark,
}: {
  label: string;
  value: string;
  delta?: string;
  icon: React.ReactNode;
  gradient: string;
  spark?: number[];
}) {
  const points = spark && spark.length > 1 ? spark : null;
  const max = points ? Math.max(...points, 1) : 1;
  const path = points
    ? points.map((v, i) => {
        const x = (i / (points.length - 1)) * 100;
        const y = 40 - (v / max) * 35;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(" ")
    : null;

  return (
    <div className={`relative overflow-hidden rounded-3xl p-5 text-white shadow-xl ${gradient}`}>
      <div className="absolute -right-8 -top-8 size-32 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -bottom-10 -left-6 size-28 rounded-full bg-white/10 blur-2xl" />

      <div className="relative flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/80">
            {icon}
            <span>{label}</span>
          </div>
          <div className="mt-2 text-3xl font-extrabold tracking-tight">{value}</div>
          {delta && (
            <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold backdrop-blur">
              <ArrowUpRight className="size-3" /> {delta}
            </div>
          )}
        </div>
      </div>

      {path && (
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="relative mt-3 h-12 w-full">
          <defs>
            <linearGradient id={`sg-${label}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.6)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
          </defs>
          <path d={`${path} L100,40 L0,40 Z`} fill={`url(#sg-${label})`} />
          <path d={path} fill="none" stroke="rgba(255,255,255,0.95)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Compact stat tile (secondary metrics)
// ────────────────────────────────────────────────────────────────────────────
function StatTile({
  label, value, icon, tone = "default",
}: {
  label: string; value: string; icon: React.ReactNode;
  tone?: "default" | "success" | "warn" | "danger";
}) {
  const tones = {
    default: "from-slate-50 to-white border-slate-200/70 text-slate-700",
    success: "from-emerald-50 to-white border-emerald-200/70 text-emerald-700",
    warn:    "from-amber-50 to-white border-amber-200/70 text-amber-700",
    danger:  "from-red-50 to-white border-red-200/70 text-red-700",
  }[tone];
  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-4 shadow-sm ${tones}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</span>
        <span className="opacity-80">{icon}</span>
      </div>
      <div className="mt-1.5 text-xl font-extrabold tracking-tight">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    success: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
    pending: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
    expired: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
    failed:  "bg-red-100 text-red-700 ring-1 ring-red-200",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${map[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status}
    </span>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const styles = [
    "bg-gradient-to-br from-amber-300 to-yellow-500 text-yellow-900 shadow-lg shadow-amber-300/50",
    "bg-gradient-to-br from-slate-300 to-slate-400 text-slate-800 shadow-md",
    "bg-gradient-to-br from-orange-300 to-amber-600 text-orange-900 shadow-md",
  ];
  const cls = rank < 3 ? styles[rank] : "bg-slate-100 text-slate-500";
  return (
    <span className={`inline-flex size-7 items-center justify-center rounded-full text-xs font-extrabold ${cls}`}>
      {rank === 0 ? <Trophy className="size-3.5" /> : rank + 1}
    </span>
  );
}

function AdminHome() {
  const { user, token } = useAuth();
  const isAdmin = user?.roles?.includes("admin");

  const stats = useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: () => adminDashboardStatsFn({ data: { token: token! } }),
    enabled: !!token && !!isAdmin,
    refetchInterval: 30_000,
  });

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="glass-panel-strong p-12 text-center">
          <AlertTriangle className="mx-auto size-10 text-destructive" />
          <h2 className="mt-3 text-xl font-bold">Admin only</h2>
          <p className="mt-1 text-sm text-muted-foreground">You don't have permission to view this area.</p>
        </div>
      </AppShell>
    );
  }

  const d = stats.data;

  // Sparkline data
  const trendTotal   = d?.trend_7d.map((x) => x.total)   ?? [];
  const trendSuccess = d?.trend_7d.map((x) => x.success) ?? [];
  const trendEarned  = d?.trend_7d.map((x) => x.earned)  ?? [];

  // Donut data
  const donutData = d ? [
    { name: "Success", value: d.otps.success, color: "#10b981" },
    { name: "Pending", value: d.otps.pending, color: "#f59e0b" },
    { name: "Expired", value: d.otps.expired, color: "#94a3b8" },
  ] : [];
  const totalAll = donutData.reduce((s, x) => s + x.value, 0);
  const successRate = totalAll > 0 ? Math.round((d!.otps.success / totalAll) * 100) : 0;

  const maxRangeCount = Math.max(1, ...(d?.top_ranges.map((r) => r.count) ?? []));

  return (
    <AppShell>
      <PageHeader
        icon={<ShieldCheck className="size-6" />}
        title="Admin Command Center"
        subtitle="Live operations overview — users, allocations, earnings, and trends."
      />

      {stats.isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-3xl bg-slate-100" />
          ))}
        </div>
      )}

      {stats.error && (
        <div className="glass-panel-strong p-6 text-sm text-destructive">
          Failed to load: {(stats.error as Error).message}
        </div>
      )}

      {d && (
        <>
          {/* ═══ HERO KPIs — gradient cards with sparklines ═══ */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <HeroKpi
              label="Total Users"
              value={fmt(d.users.total)}
              delta={`+${d.users.new_7d} this week`}
              icon={<Users className="size-3.5" />}
              gradient="bg-gradient-to-br from-indigo-500 via-blue-600 to-sky-600"
            />
            <HeroKpi
              label="OTPs Today"
              value={fmt(d.otps.today)}
              delta={`${d.otps.success_today} success`}
              icon={<Zap className="size-3.5" />}
              gradient="bg-gradient-to-br from-violet-500 via-purple-600 to-fuchsia-600"
              spark={trendTotal}
            />
            <HeroKpi
              label="Earned Today"
              value={bdt(d.money.earned_today)}
              delta={`${bdt(d.money.total_earned)} lifetime`}
              icon={<Sparkles className="size-3.5" />}
              gradient="bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-600"
              spark={trendEarned}
            />
            <HeroKpi
              label="Pending Payout"
              value={bdt(d.money.pending_withdraw)}
              delta={`${bdt(d.money.paid_withdraw)} paid`}
              icon={<Wallet className="size-3.5" />}
              gradient="bg-gradient-to-br from-orange-500 via-rose-600 to-pink-600"
            />
          </div>

          {/* ═══ CHARTS row: Area + Donut ═══ */}
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* 7-day Area chart */}
            <div className="glass-panel-strong overflow-hidden lg:col-span-2">
              <div className="flex items-center justify-between border-b border-border/50 p-4">
                <div>
                  <h3 className="font-bold">OTP Activity — Last 7 days</h3>
                  <p className="text-xs text-muted-foreground">Total vs successful allocations per day</p>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-semibold">
                  <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-indigo-500" /> Total</span>
                  <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-500" /> Success</span>
                </div>
              </div>
              <div className="h-64 w-full p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={d.trend_7d} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradSuccess" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="day"
                      stroke="#94a3b8"
                      fontSize={11}
                      tickFormatter={(v) => new Date(v).toLocaleDateString("en-BD", { day: "numeric", month: "short" })}
                    />
                    <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(15, 23, 42, 0.95)",
                        border: "none",
                        borderRadius: "12px",
                        color: "white",
                        fontSize: "12px",
                        boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
                      }}
                      labelFormatter={(v) => new Date(v as string).toLocaleDateString("en-BD", { weekday: "short", day: "numeric", month: "short" })}
                    />
                    <Area type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2.5} fill="url(#gradTotal)" />
                    <Area type="monotone" dataKey="success" stroke="#10b981" strokeWidth={2.5} fill="url(#gradSuccess)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Donut + success rate */}
            <div className="glass-panel-strong overflow-hidden">
              <div className="border-b border-border/50 p-4">
                <h3 className="font-bold">Status Mix</h3>
                <p className="text-xs text-muted-foreground">All-time distribution</p>
              </div>
              <div className="relative h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData.length ? donutData : [{ name: "—", value: 1, color: "#e2e8f0" }]}
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {(donutData.length ? donutData : [{ color: "#e2e8f0" }]).map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "rgba(15, 23, 42, 0.95)",
                        border: "none",
                        borderRadius: "10px",
                        color: "white",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-3xl font-extrabold accent-text">{successRate}%</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Success Rate</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 px-4 pb-4 text-center">
                {donutData.map((dd) => (
                  <div key={dd.name} className="rounded-xl bg-muted/40 p-2">
                    <div className="mx-auto size-2 rounded-full" style={{ background: dd.color }} />
                    <div className="mt-1 text-sm font-bold">{fmt(dd.value)}</div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{dd.name}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ═══ Secondary stat tiles ═══ */}
          <h3 className="mb-3 mt-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">User Health</h3>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Active" value={fmt(d.users.active)} icon={<CheckCircle2 className="size-4" />} tone="success" />
            <StatTile label="Blocked" value={fmt(d.users.blocked)} icon={<XCircle className="size-4" />} tone="danger" />
            <StatTile label="Suspended" value={fmt(d.users.suspended)} icon={<Clock className="size-4" />} tone="warn" />
            <StatTile label="New Today" value={fmt(d.users.new_today)} icon={<TrendingUp className="size-4" />} />
          </div>

          <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Allocations</h3>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Total OTPs" value={fmt(d.otps.total)} icon={<Hash className="size-4" />} />
            <StatTile label="Success" value={fmt(d.otps.success)} icon={<CheckCircle2 className="size-4" />} tone="success" />
            <StatTile label="Pending" value={fmt(d.otps.pending)} icon={<Clock className="size-4" />} tone="warn" />
            <StatTile label="Wallet Balance" value={bdt(d.money.total_balance)} icon={<DollarSign className="size-4" />} />
          </div>

          {/* ═══ Top Earners (premium leaderboard) + Recent Users ═══ */}
          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="glass-panel-strong overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border/50 p-4">
                <Crown className="size-4 text-amber-500" />
                <h3 className="font-bold">Top Earners</h3>
                <Link to="/admin/users" className="ml-auto text-[11px] accent-text hover:underline">All users →</Link>
              </div>
              <div className="divide-y divide-border/30">
                {d.top_users.length === 0 && (
                  <div className="p-8 text-center text-sm text-muted-foreground">No earners yet.</div>
                )}
                {d.top_users.slice(0, 8).map((u, i) => {
                  const successPct = u.total_count > 0 ? Math.round((u.success_count / u.total_count) * 100) : 0;
                  return (
                    <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                      <RankBadge rank={i} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{u.name || u.email.split("@")[0]}</div>
                        <div className="truncate text-[11px] text-muted-foreground">{u.email}</div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all"
                            style={{ width: `${successPct}%` }}
                          />
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span>{u.success_count}/{u.total_count} OTP</span>
                          <span>•</span>
                          <span>{successPct}% success</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-extrabold accent-text">{bdt(u.lifetime_earning)}</div>
                        <div className="text-[10px] text-muted-foreground">bal: {bdt(u.balance)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Ranges with horizontal bars */}
            <div className="glass-panel-strong overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border/50 p-4">
                <TrendingUp className="size-4 accent-text" />
                <h3 className="font-bold">Top Ranges</h3>
                <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">last 30 days</span>
              </div>
              <div className="space-y-3 p-4">
                {d.top_ranges.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground">No allocations in 30 days.</div>
                )}
                {d.top_ranges.slice(0, 8).map((r, i) => {
                  const rate = r.count > 0 ? Math.round((r.success / r.count) * 100) : 0;
                  const width = (r.count / maxRangeCount) * 100;
                  return (
                    <div key={i}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-semibold">{r.range_label}</span>
                        <span className="font-mono text-muted-foreground">
                          <span className="font-bold text-foreground">{r.count}</span> · {rate}% ✓
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-violet-500 to-fuchsia-500 transition-all duration-500"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ═══ Recent OTPs + Recently Joined ═══ */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="glass-panel-strong overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border/50 p-4">
                <Activity className="size-4 accent-text" />
                <h3 className="font-bold">Recent OTPs</h3>
                <span className="relative ml-2 flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                <Link to="/admin/allocations" className="ml-auto text-[11px] accent-text hover:underline">View all →</Link>
              </div>
              <div className="max-h-[420px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white/80 text-[10px] uppercase tracking-wider text-muted-foreground backdrop-blur">
                    <tr>
                      <th className="px-3 py-2 text-left">Number</th>
                      <th className="px-3 py-2 text-left">User</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-right">Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.recent_otps.length === 0 && (
                      <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No OTPs yet.</td></tr>
                    )}
                    {d.recent_otps.map((a) => (
                      <tr key={a.id} className="border-t border-border/30 transition-colors hover:bg-slate-50/50">
                        <td className="px-3 py-2 font-mono text-xs">{a.full_number}</td>
                        <td className="px-3 py-2 text-[11px] text-muted-foreground">{a.user_email}</td>
                        <td className="px-3 py-2"><StatusBadge status={a.status} /></td>
                        <td className="px-3 py-2 text-right font-mono">{a.status === "success" ? bdt(a.payout_amount) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="glass-panel-strong overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border/50 p-4">
                <Users className="size-4 accent-text" />
                <h3 className="font-bold">Recently Joined</h3>
              </div>
              <div className="divide-y divide-border/30">
                {d.recent_users.length === 0 && (
                  <div className="p-8 text-center text-sm text-muted-foreground">No users yet.</div>
                )}
                {d.recent_users.map((u) => {
                  const initial = (u.name || u.email).charAt(0).toUpperCase();
                  return (
                    <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-600 text-sm font-bold text-white shadow-md">
                        {initial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{u.name || u.email.split("@")[0]}</div>
                        <div className="truncate text-[11px] text-muted-foreground">{u.email}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-xs font-bold">{u.total_count} OTP</div>
                        <div className="text-[10px] text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString("en-BD", { day: "numeric", month: "short" })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
