import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { adminDashboardStatsFn } from "@/lib/admin.functions";
import {
  ShieldCheck, Users, Hash, Wallet, TrendingUp, AlertTriangle,
  Activity, CheckCircle2, Clock, XCircle, DollarSign, Crown,
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

function KpiCard({ icon, label, value, sub, tone = "default" }: {
  icon: React.ReactNode; label: string; value: string;
  sub?: string; tone?: "default" | "success" | "warn" | "danger" | "accent";
}) {
  const toneCls = {
    default: "text-foreground",
    accent: "accent-text",
    success: "text-emerald-600",
    warn: "text-amber-600",
    danger: "text-destructive",
  }[tone];
  return (
    <div className="glass-panel-strong p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={toneCls}>{icon}</span>
      </div>
      <div className={`mt-3 text-2xl font-bold ${toneCls}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    success: "bg-emerald-100 text-emerald-700",
    pending: "bg-amber-100 text-amber-700",
    expired: "bg-slate-200 text-slate-600",
    failed: "bg-red-100 text-red-700",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${map[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status}
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

  return (
    <AppShell>
      <PageHeader
        icon={<ShieldCheck className="size-6" />}
        title="Admin Dashboard"
        subtitle="Full overview — users, OTPs, ranges, earnings & withdrawals."
      />

      {stats.isLoading && (
        <div className="glass-panel-strong p-10 text-center text-muted-foreground">Loading dashboard…</div>
      )}

      {stats.error && (
        <div className="glass-panel-strong p-6 text-destructive text-sm">
          Failed to load: {(stats.error as Error).message}
        </div>
      )}

      {d && (
        <>
          {/* USERS */}
          <h3 className="mb-3 mt-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Users</h3>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <KpiCard icon={<Users className="size-5" />} label="Total" value={fmt(d.users.total)} tone="accent" />
            <KpiCard icon={<CheckCircle2 className="size-5" />} label="Active" value={fmt(d.users.active)} tone="success" />
            <KpiCard icon={<XCircle className="size-5" />} label="Blocked" value={fmt(d.users.blocked)} tone="danger" />
            <KpiCard icon={<Clock className="size-5" />} label="Suspended" value={fmt(d.users.suspended)} tone="warn" />
            <KpiCard icon={<TrendingUp className="size-5" />} label="New Today" value={fmt(d.users.new_today)} />
            <KpiCard icon={<TrendingUp className="size-5" />} label="New 7d" value={fmt(d.users.new_7d)} />
          </div>

          {/* OTPs */}
          <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">OTPs / Allocations</h3>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <KpiCard icon={<Hash className="size-5" />} label="Total" value={fmt(d.otps.total)} tone="accent" />
            <KpiCard icon={<CheckCircle2 className="size-5" />} label="Success" value={fmt(d.otps.success)} tone="success" />
            <KpiCard icon={<Clock className="size-5" />} label="Pending" value={fmt(d.otps.pending)} tone="warn" />
            <KpiCard icon={<XCircle className="size-5" />} label="Expired" value={fmt(d.otps.expired)} />
            <KpiCard icon={<Activity className="size-5" />} label="Today" value={fmt(d.otps.today)} />
            <KpiCard icon={<CheckCircle2 className="size-5" />} label="Success Today" value={fmt(d.otps.success_today)} tone="success" />
          </div>

          {/* MONEY */}
          <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Money (BDT)</h3>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            <KpiCard icon={<DollarSign className="size-5" />} label="Lifetime Earned" value={bdt(d.money.total_earned)} tone="accent" />
            <KpiCard icon={<Wallet className="size-5" />} label="User Balance" value={bdt(d.money.total_balance)} />
            <KpiCard icon={<TrendingUp className="size-5" />} label="Earned Today" value={bdt(d.money.earned_today)} tone="success" />
            <KpiCard icon={<Clock className="size-5" />} label="Pending Withdraw" value={bdt(d.money.pending_withdraw)} tone="warn" />
            <KpiCard icon={<CheckCircle2 className="size-5" />} label="Paid Out" value={bdt(d.money.paid_withdraw)} tone="success" />
          </div>

          {/* TOP USERS + RECENT USERS */}
          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="glass-panel-strong overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border/50 p-4">
                <Crown className="size-4 accent-text" />
                <h3 className="font-bold">Top Earners</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">User</th>
                      <th className="px-3 py-2 text-right">OTPs ✓ / Total</th>
                      <th className="px-3 py-2 text-right">Earned</th>
                      <th className="px-3 py-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.top_users.length === 0 && (
                      <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No users yet.</td></tr>
                    )}
                    {d.top_users.map((u) => (
                      <tr key={u.id} className="border-t border-border/30">
                        <td className="px-3 py-2">
                          <div className="font-medium">{u.name || "—"}</div>
                          <div className="text-[11px] text-muted-foreground">{u.email}</div>
                        </td>
                        <td className="px-3 py-2 text-right font-mono">{u.success_count}/{u.total_count}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold accent-text">{bdt(u.lifetime_earning)}</td>
                        <td className="px-3 py-2 text-right font-mono">{bdt(u.balance)}</td>
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
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">User</th>
                      <th className="px-3 py-2 text-right">Allocs</th>
                      <th className="px-3 py-2 text-right">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.recent_users.length === 0 && (
                      <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">No users yet.</td></tr>
                    )}
                    {d.recent_users.map((u) => (
                      <tr key={u.id} className="border-t border-border/30">
                        <td className="px-3 py-2">
                          <div className="font-medium">{u.name || "—"}</div>
                          <div className="text-[11px] text-muted-foreground">{u.email}</div>
                        </td>
                        <td className="px-3 py-2 text-right font-mono">{u.total_count}</td>
                        <td className="px-3 py-2 text-right text-[11px] text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* TOP RANGES + RECENT OTPS */}
          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="glass-panel-strong overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border/50 p-4">
                <TrendingUp className="size-4 accent-text" />
                <h3 className="font-bold">Top Ranges (30d)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Country / Operator</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2 text-right">Success</th>
                      <th className="px-3 py-2 text-right">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.top_ranges.length === 0 && (
                      <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No allocations in last 30 days.</td></tr>
                    )}
                    {d.top_ranges.map((r, i) => {
                      const rate = r.count > 0 ? Math.round((r.success / r.count) * 100) : 0;
                      return (
                        <tr key={i} className="border-t border-border/30">
                          <td className="px-3 py-2 font-medium">{r.range_label}</td>
                          <td className="px-3 py-2 text-right font-mono">{r.count}</td>
                          <td className="px-3 py-2 text-right font-mono text-emerald-600">{r.success}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold">{rate}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="glass-panel-strong overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border/50 p-4">
                <Activity className="size-4 accent-text" />
                <h3 className="font-bold">Recent OTPs (Live)</h3>
                <Link to="/admin/allocations" className="ml-auto text-[11px] accent-text hover:underline">View all →</Link>
              </div>
              <div className="max-h-[420px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/80 text-[10px] uppercase tracking-wider text-muted-foreground backdrop-blur">
                    <tr>
                      <th className="px-3 py-2 text-left">Number</th>
                      <th className="px-3 py-2 text-left">User</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-right">Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.recent_otps.length === 0 && (
                      <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No OTPs yet.</td></tr>
                    )}
                    {d.recent_otps.map((a) => (
                      <tr key={a.id} className="border-t border-border/30">
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
          </div>
        </>
      )}
    </AppShell>
  );
}
