import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
  PieChart, Pie, Cell, CartesianGrid,
} from "recharts";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { adminDashboardStatsFn } from "@/lib/admin.functions";
import {
  ShieldCheck, Users, Hash, Wallet, TrendingUp, AlertTriangle,
  Activity, CheckCircle2, Clock, XCircle, DollarSign, Crown,
  ArrowUpRight, Sparkles, MessageSquare, Trophy,
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
// Theme-aware hero KPI — uses brand primary + chart tokens, no raw colors
// ────────────────────────────────────────────────────────────────────────────
function HeroKpi({
  label, value, delta, icon, accent = "primary", spark,
}: {
  label: string;
  value: string;
  delta?: string;
  icon: React.ReactNode;
  accent?: "primary" | "chart-2" | "chart-3" | "chart-4";
  spark?: number[];
}) {
  const accentVar = {
    primary: "var(--color-primary)",
    "chart-2": "var(--color-chart-2)",
    "chart-3": "var(--color-chart-3)",
    "chart-4": "var(--color-chart-4)",
  }[accent];

  const points = spark && spark.length > 1 ? spark : null;
  const max = points ? Math.max(...points, 1) : 1;
  const path = points
    ? points.map((v, i) => {
        const x = (i / (points.length - 1)) * 100;
        const y = 40 - (v / max) * 35;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(" ")
    : null;

  const gradId = `sg-${label.replace(/\s+/g, "-")}`;

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-sm"
      style={{
        backgroundImage: `linear-gradient(135deg, color-mix(in oklab, ${accentVar} 10%, transparent), transparent 60%)`,
      }}
    >
      <div
        className="absolute -right-10 -top-10 size-32 rounded-full opacity-30 blur-3xl"
        style={{ background: accentVar }}
      />
      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <span
              className="inline-flex size-6 items-center justify-center rounded-lg"
              style={{
                background: `color-mix(in oklab, ${accentVar} 15%, transparent)`,
                color: accentVar,
              }}
            >
              {icon}
            </span>
            <span>{label}</span>
          </div>
          <div className="mt-2 text-3xl font-extrabold tracking-tight text-foreground">{value}</div>
          {delta && (
            <div
              className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{
                background: `color-mix(in oklab, ${accentVar} 12%, transparent)`,
                color: accentVar,
              }}
            >
              <ArrowUpRight className="size-3" /> {delta}
            </div>
          )}
        </div>
      </div>

      {path && (
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="relative mt-3 h-12 w-full">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accentVar} stopOpacity={0.4} />
              <stop offset="100%" stopColor={accentVar} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={`${path} L100,40 L0,40 Z`} fill={`url(#${gradId})`} />
          <path d={path} fill="none" stroke={accentVar} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Compact stat tile (secondary metrics) — fully token-driven
// ────────────────────────────────────────────────────────────────────────────
function StatTile({
  label, value, icon, tone = "default",
}: {
  label: string; value: string; icon: React.ReactNode;
  tone?: "default" | "success" | "warn" | "danger" | "info";
}) {
  const tones: Record<string, string> = {
    default: "border-border bg-card text-foreground",
    success: "border-[color:color-mix(in_oklab,var(--color-success)_25%,transparent)] bg-[color:color-mix(in_oklab,var(--color-success)_8%,var(--color-card))] text-[color:var(--color-success)]",
    warn:    "border-[color:color-mix(in_oklab,var(--color-warning)_25%,transparent)] bg-[color:color-mix(in_oklab,var(--color-warning)_8%,var(--color-card))] text-[color:var(--color-warning)]",
    danger:  "border-[color:color-mix(in_oklab,var(--color-destructive)_25%,transparent)] bg-[color:color-mix(in_oklab,var(--color-destructive)_8%,var(--color-card))] text-[color:var(--color-destructive)]",
    info:    "border-[color:color-mix(in_oklab,var(--color-info)_25%,transparent)] bg-[color:color-mix(in_oklab,var(--color-info)_8%,var(--color-card))] text-[color:var(--color-info)]",
  };
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${tones[tone]}`}>
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
    success: "bg-[color:color-mix(in_oklab,var(--color-success)_15%,transparent)] text-[color:var(--color-success)] ring-1 ring-[color:color-mix(in_oklab,var(--color-success)_30%,transparent)]",
    pending: "bg-[color:color-mix(in_oklab,var(--color-warning)_15%,transparent)] text-[color:var(--color-warning)] ring-1 ring-[color:color-mix(in_oklab,var(--color-warning)_30%,transparent)]",
    expired: "bg-muted text-muted-foreground ring-1 ring-border",
    failed:  "bg-[color:color-mix(in_oklab,var(--color-destructive)_15%,transparent)] text-[color:var(--color-destructive)] ring-1 ring-[color:color-mix(in_oklab,var(--color-destructive)_30%,transparent)]",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${map[status] ?? "bg-muted text-muted-foreground"}`}>
      {status}
    </span>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 0) return (
    <span className="inline-flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-yellow-500 text-yellow-900 shadow-lg shadow-amber-300/40">
      <Trophy className="size-3.5" />
    </span>
  );
  const styles = [
    "bg-gradient-to-br from-slate-300 to-slate-400 text-slate-800 shadow-md",
    "bg-gradient-to-br from-orange-300 to-amber-600 text-orange-900 shadow-md",
  ];
  const cls = rank < 3 ? styles[rank - 1] : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex size-7 items-center justify-center rounded-full text-xs font-extrabold ${cls}`}>
      {rank + 1}
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

  const trendTotal   = d?.trend_7d.map((x) => x.total)   ?? [];
  const trendSuccess = d?.trend_7d.map((x) => x.success) ?? [];
  const trendEarned  = d?.trend_7d.map((x) => x.earned)  ?? [];

  const donutData = d ? [
    { name: "Success", value: d.numbers.success, color: "var(--color-success)" },
    { name: "Pending", value: d.numbers.pending, color: "var(--color-warning)" },
    { name: "Expired", value: d.numbers.expired, color: "var(--color-muted-foreground)" },
  ] : [];
  const totalAll = donutData.reduce((s, x) => s + x.value, 0);
  const successRate = totalAll > 0 ? Math.round((d!.numbers.success / totalAll) * 100) : 0;

  const maxRangeCount = Math.max(1, ...(d?.top_ranges.map((r) => r.count) ?? []));

  return (
    <AppShell>
      <PageHeader
        icon={<ShieldCheck className="size-6" />}
        title="Admin Command Center"
        subtitle="Live operations — users, numbers (allocations), OTP messages, and earnings."
      />

      {stats.isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-3xl bg-muted" />
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
          {/* ═══ HERO KPIs ═══ */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <HeroKpi
              label="Total Users"
              value={fmt(d.users.total)}
              delta={`+${d.users.new_7d} this week`}
              icon={<Users className="size-3.5" />}
              accent="primary"
              spark={trendSuccess}
            />
            <HeroKpi
              label="Numbers Today"
              value={fmt(d.numbers.today)}
              delta={`${d.numbers.success_today} success`}
              icon={<Hash className="size-3.5" />}
              accent="chart-2"
              spark={trendTotal}
            />
            <HeroKpi
              label="OTPs Received"
              value={fmt(d.otps_received.today)}
              delta={`${fmt(d.otps_received.total)} all-time`}
              icon={<MessageSquare className="size-3.5" />}
              accent="chart-3"
            />
            <HeroKpi
              label="Earned Today"
              value={bdt(d.money.earned_today)}
              delta={`${bdt(d.money.total_earned)} lifetime`}
              icon={<Sparkles className="size-3.5" />}
              accent="chart-4"
              spark={trendEarned}
            />
          </div>

          {/* ═══ CHARTS row ═══ */}
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="glass-panel-strong overflow-hidden lg:col-span-2">
              <div className="flex items-center justify-between border-b border-border/50 p-4">
                <div>
                  <h3 className="font-bold">Number Activity — Last 7 days</h3>
                  <p className="text-xs text-muted-foreground">Total allocations vs successful (OTP delivered)</p>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-semibold">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ background: "var(--color-primary)" }} /> Total
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ background: "var(--color-success)" }} /> Success
                  </span>
                </div>
              </div>
              <div className="h-64 w-full p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={d.trend_7d} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradSuccess" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-success)" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="var(--color-success)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis
                      dataKey="day"
                      stroke="var(--color-muted-foreground)"
                      fontSize={11}
                      tickFormatter={(v) => new Date(v).toLocaleDateString("en-BD", { day: "numeric", month: "short" })}
                    />
                    <YAxis stroke="var(--color-muted-foreground)" fontSize={11} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "12px",
                        color: "var(--color-popover-foreground)",
                        fontSize: "12px",
                        boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
                      }}
                      labelFormatter={(v) => new Date(v as string).toLocaleDateString("en-BD", { weekday: "short", day: "numeric", month: "short" })}
                    />
                    <Area type="monotone" dataKey="total" stroke="var(--color-primary)" strokeWidth={2.5} fill="url(#gradTotal)" />
                    <Area type="monotone" dataKey="success" stroke="var(--color-success)" strokeWidth={2.5} fill="url(#gradSuccess)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-panel-strong overflow-hidden">
              <div className="border-b border-border/50 p-4">
                <h3 className="font-bold">Status Mix</h3>
                <p className="text-xs text-muted-foreground">All-time allocation distribution</p>
              </div>
              <div className="relative h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={totalAll > 0 ? donutData : [{ name: "—", value: 1, color: "var(--color-muted)" }]}
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {(totalAll > 0 ? donutData : [{ color: "var(--color-muted)" }]).map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "10px",
                        color: "var(--color-popover-foreground)",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-3xl font-extrabold text-primary">{successRate}%</div>
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
            <StatTile label="New Today" value={fmt(d.users.new_today)} icon={<TrendingUp className="size-4" />} tone="info" />
          </div>

          <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Numbers &amp; OTPs</h3>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Total Numbers" value={fmt(d.numbers.total)} icon={<Hash className="size-4" />} />
            <StatTile label="Success" value={fmt(d.numbers.success)} icon={<CheckCircle2 className="size-4" />} tone="success" />
            <StatTile label="Pending (≤20m)" value={fmt(d.numbers.pending)} icon={<Clock className="size-4" />} tone="warn" />
            <StatTile label="Wallet Balance" value={bdt(d.money.total_balance)} icon={<DollarSign className="size-4" />} />
          </div>

          {/* ═══ Top Earners + Top Ranges ═══ */}
          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="glass-panel-strong overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border/50 p-4">
                <Crown className="size-4 text-amber-500" />
                <h3 className="font-bold">Top Earners</h3>
                <Link to="/admin/users" className="ml-auto text-[11px] text-primary hover:underline">All users →</Link>
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
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${successPct}%`,
                              background: "linear-gradient(90deg, color-mix(in oklab, var(--color-success) 70%, transparent), var(--color-success))",
                            }}
                          />
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span>{u.success_count}/{u.total_count} OTP</span>
                          <span>•</span>
                          <span>{successPct}% success</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-extrabold text-primary">{bdt(u.lifetime_earning)}</div>
                        <div className="text-[10px] text-muted-foreground">bal: {bdt(u.balance)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="glass-panel-strong overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border/50 p-4">
                <TrendingUp className="size-4 text-primary" />
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
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${width}%`,
                            background: "linear-gradient(90deg, color-mix(in oklab, var(--color-primary) 60%, transparent), var(--color-primary))",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ═══ Recent Numbers + Recently Joined ═══ */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="glass-panel-strong overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border/50 p-4">
                <Activity className="size-4 text-primary" />
                <h3 className="font-bold">Recent Numbers</h3>
                <span className="relative ml-2 flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: "var(--color-success)" }} />
                  <span className="relative inline-flex size-2 rounded-full" style={{ background: "var(--color-success)" }} />
                </span>
                <Link to="/admin/allocations" className="ml-auto text-[11px] text-primary hover:underline">View all →</Link>
              </div>
              <div className="max-h-[420px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card/90 text-[10px] uppercase tracking-wider text-muted-foreground backdrop-blur">
                    <tr>
                      <th className="px-3 py-2 text-left">Number</th>
                      <th className="px-3 py-2 text-left">User</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-right">Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.recent_otps.length === 0 && (
                      <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No numbers yet.</td></tr>
                    )}
                    {d.recent_otps.map((a) => (
                      <tr key={a.id} className="border-t border-border/30 transition-colors hover:bg-muted/40">
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
                <Users className="size-4 text-primary" />
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
                      <div
                        className="grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold text-primary-foreground shadow-md"
                        style={{ background: "linear-gradient(135deg, var(--color-primary), color-mix(in oklab, var(--color-primary) 60%, var(--color-chart-2)))" }}
                      >
                        {initial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{u.name || u.email.split("@")[0]}</div>
                        <div className="truncate text-[11px] text-muted-foreground">{u.email}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-xs font-bold">{u.total_count} numbers</div>
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
