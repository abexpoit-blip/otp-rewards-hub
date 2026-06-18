import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { adminDailyReportFn, adminPollerStatusFn, type DailyReportRow } from "@/lib/report.functions";
import { BarChart3, Activity, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/admin/report")({
  head: () => ({ meta: [{ title: "Daily Report — Admin" }] }),
  component: () => (<Protected><ReportPage /></Protected>),
});

function ReportPage() {
  const { token } = useAuth();
  const callReport = useServerFn(adminDailyReportFn);
  const callPoller = useServerFn(adminPollerStatusFn);

  const [rows, setRows] = useState<DailyReportRow[]>([]);
  const [poller, setPoller] = useState<any>(null);
  const [days, setDays] = useState(14);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [r, p] = await Promise.all([
        callReport({ data: { token, days } }),
        callPoller({ data: { token } }),
      ]);
      setRows(r as DailyReportRow[]);
      setPoller(p);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token, days]);

  const totals = rows.reduce(
    (a, r) => ({
      total: a.total + r.total_allocations,
      success: a.success + r.success,
      expired: a.expired + r.expired,
      payout: a.payout + Number(r.payout_total || 0),
    }),
    { total: 0, success: 0, expired: 0, payout: 0 },
  );
  const successRate = totals.total ? Math.round((totals.success / totals.total) * 100) : 0;

  return (
    <AppShell>
      <PageHeader
        icon={<BarChart3 className="size-6" />}
        title="Daily Report"
        subtitle="Allocations, successful OTPs and credited payout per day."
      />

      {/* Poller status */}
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4 text-sm">
        <Activity className={`size-4 ${poller?.started ? "text-emerald-600" : "text-muted-foreground"}`} />
        <span className="font-semibold">Global Poller:</span>
        <span>{poller?.started ? "running" : "not started"}</span>
        {poller?.lastTickAgoMs !== null && poller?.lastTickAgoMs !== undefined && (
          <span className="text-muted-foreground">
            last tick {Math.round(poller.lastTickAgoMs / 1000)}s ago
          </span>
        )}
        {poller?.lastError && (
          <span className="text-destructive">error: {poller.lastError}</span>
        )}
        <button onClick={load} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs hover:bg-white/50">
          <RefreshCw className="size-3" /> Refresh
        </button>
      </div>

      {/* Range picker */}
      <div className="mb-5 flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Range:</span>
        {[7, 14, 30, 60].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`rounded-lg border px-3 py-1 font-semibold transition ${
              days === d ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-white/50"
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      {/* Totals */}
      <div className="mb-5 grid gap-3 md:grid-cols-4">
        {[
          { label: "Total Allocations", value: totals.total },
          { label: "Successful OTPs", value: totals.success },
          { label: "Expired", value: totals.expired },
          { label: "Total Payout", value: `৳${totals.payout.toFixed(2)}` },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{s.label}</div>
            <div className="mt-1 text-2xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>
      <div className="mb-5 text-xs text-muted-foreground">
        Overall success rate: <b>{successRate}%</b> over the last {days} days.
      </div>

      {/* Table */}
      <div className="glass-panel-strong p-5">
        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No allocations in this window.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="py-2">Day</th>
                  <th className="py-2 text-right">Total</th>
                  <th className="py-2 text-right">Success</th>
                  <th className="py-2 text-right">Expired</th>
                  <th className="py-2 text-right">Failed</th>
                  <th className="py-2 text-right">Pending</th>
                  <th className="py-2 text-right">Users</th>
                  <th className="py-2 text-right">Payout</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.day} className="border-t border-border">
                    <td className="py-2 font-mono text-xs">{r.day}</td>
                    <td className="py-2 text-right">{r.total_allocations}</td>
                    <td className="py-2 text-right text-emerald-700 font-semibold">{r.success}</td>
                    <td className="py-2 text-right text-amber-700">{r.expired}</td>
                    <td className="py-2 text-right text-destructive">{r.failed}</td>
                    <td className="py-2 text-right text-muted-foreground">{r.pending}</td>
                    <td className="py-2 text-right">{r.active_users}</td>
                    <td className="py-2 text-right font-bold">${Number(r.payout_total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
