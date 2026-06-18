import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { summaryReportFn } from "@/lib/stex.functions";
import { BarChart3, Download, TrendingUp, TrendingDown, Layers, Target, DollarSign, CheckCircle2 } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/summary")({
  head: () => ({ meta: [{ title: "Summary — Nexus SMS" }] }),
  component: () => (<Protected><SummaryPage /></Protected>),
});

type Range = 7 | 14 | 30;

function pctDelta(curr: number, prev: number): { value: number; sign: "up" | "down" | "flat" } {
  if (prev === 0 && curr === 0) return { value: 0, sign: "flat" };
  if (prev === 0) return { value: 100, sign: "up" };
  const d = ((curr - prev) / prev) * 100;
  return { value: Math.abs(d), sign: d > 0.05 ? "up" : d < -0.05 ? "down" : "flat" };
}

function StatCard({
  label, value, deltaLabel, delta, Icon, accent,
}: {
  label: string; value: string; deltaLabel: string;
  delta: { value: number; sign: "up" | "down" | "flat" };
  Icon: any; accent: string;
}) {
  const color = delta.sign === "up" ? "text-emerald-600" : delta.sign === "down" ? "text-rose-600" : "text-muted-foreground";
  const Arrow = delta.sign === "up" ? TrendingUp : delta.sign === "down" ? TrendingDown : null;
  return (
    <div className="glass-panel-strong p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{label}</div>
        <span className={`size-7 rounded-md flex items-center justify-center ${accent}`}><Icon className="size-3.5" /></span>
      </div>
      <div className="text-3xl font-bold tabular-nums">{value}</div>
      <div className={`mt-1 text-xs flex items-center gap-1 ${color}`}>
        {Arrow ? <Arrow className="size-3" /> : null}
        {delta.sign === "flat" ? "no change" : `${delta.sign === "up" ? "+" : "-"}${delta.value.toFixed(0)}% ${deltaLabel}`}
      </div>
    </div>
  );
}

function SummaryPage() {
  const { token } = useAuth();
  const [days, setDays] = useState<Range>(7);
  const callReport = useServerFn(summaryReportFn);

  const { data, isLoading } = useQuery({
    queryKey: ["summary-report", days],
    queryFn: () => callReport({ data: { token: token!, days } }),
    enabled: !!token,
    refetchInterval: 15000,
  });

  const rows = data?.rows ?? [];
  const totals = data?.totals ?? { allocation: 0, success: 0, failed: 0, amount: "0" };
  const prev = data?.prevTotals ?? { allocation: 0, success: 0, failed: 0, amount: "0" };

  const tAlloc = Number(totals.allocation) || 0;
  const tSuccess = Number(totals.success) || 0;
  const tFailed = Number(totals.failed) || 0;
  const tAmount = Number(totals.amount) || 0;
  const pAlloc = Number(prev.allocation) || 0;
  const pSuccess = Number(prev.success) || 0;
  const pAmount = Number(prev.amount) || 0;
  const rate = tAlloc ? (tSuccess / tAlloc) * 100 : 0;
  const pRate = pAlloc ? (pSuccess / pAlloc) * 100 : 0;

  const chartData = useMemo(() => rows.map((r: any) => ({
    day: new Date(r.day).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    success: Number(r.success) || 0,
    failed: Number(r.failed) || 0,
    earned: Number(r.amount) || 0,
  })), [rows]);

  const exportCsv = () => {
    const head = ["date", "allocation", "success", "failed", "rate_pct", "amount_usd"];
    const body = rows.map((r: any) => {
      const a = Number(r.allocation) || 0;
      const s = Number(r.success) || 0;
      const f = Number(r.failed) || 0;
      const amt = Number(r.amount) || 0;
      const rate = a ? ((s / a) * 100).toFixed(2) : "0";
      return [r.day, a, s, f, rate, amt.toFixed(2)];
    });
    const totalRow = ["TOTAL", tAlloc, tSuccess, tFailed, rate.toFixed(2), tAmount.toFixed(2)];
    const csv = [head, ...body, totalRow].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `nexus-summary-${days}d.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell>
      <PageHeader icon={<BarChart3 className="size-6" />} title="Summary Dashboard" subtitle="Performance metrics and financial overview." />

      {/* Date range selector */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Date range</span>
        {([7, 14, 30] as Range[]).map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold ${days === d ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground hover:bg-accent"}`}
          >
            Last {d} Days
          </button>
        ))}
      </div>

      {isLoading && !data ? (
        <div className="glass-panel-strong p-6 text-sm text-muted-foreground">Loading…</div>
      ) : (
        <>
          {/* 4 KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Total Allocation"
              value={String(tAlloc)}
              deltaLabel="vs prev."
              delta={pctDelta(tAlloc, pAlloc)}
              Icon={Layers}
              accent="bg-blue-500/15 text-blue-600"
            />
            <StatCard
              label="Success Rate"
              value={`${rate.toFixed(1)}%`}
              deltaLabel="pp vs prev."
              delta={{ value: Math.abs(rate - pRate), sign: rate > pRate ? "up" : rate < pRate ? "down" : "flat" }}
              Icon={Target}
              accent="bg-amber-500/15 text-amber-600"
            />
            <StatCard
              label="Total Earnings"
              value={`৳${tAmount.toFixed(2)}`}
              deltaLabel="vs prev."
              delta={pctDelta(tAmount, pAmount)}
              Icon={DollarSign}
              accent="bg-emerald-500/15 text-emerald-600"
            />
            <StatCard
              label="Total Success"
              value={String(tSuccess)}
              deltaLabel={`out of ${tAlloc}`}
              delta={pctDelta(tSuccess, pSuccess)}
              Icon={CheckCircle2}
              accent="bg-purple-500/15 text-purple-600"
            />
          </div>

          {/* 2 charts side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div className="glass-panel-strong p-5">
              <h3 className="font-bold mb-3">Success vs Failed Trends</h3>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gSuccess" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.55} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gFailed" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Area type="monotone" dataKey="success" stroke="#10b981" strokeWidth={2} fill="url(#gSuccess)" name="Success" />
                    <Area type="monotone" dataKey="failed" stroke="#f43f5e" strokeWidth={2} fill="url(#gFailed)" name="Failed" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="glass-panel-strong p-5">
              <h3 className="font-bold mb-3">Earnings Overview</h3>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gEarn" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.55} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Area type="monotone" dataKey="earned" stroke="#3b82f6" strokeWidth={2} fill="url(#gEarn)" name="Earned ($)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Detailed Report Table */}
          <div className="glass-panel-strong p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold">Detailed Report</h3>
              <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold">
                <Download className="size-3" /> Download CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                    <th className="py-2">Date</th>
                    <th className="py-2 text-right">Allocation</th>
                    <th className="py-2 text-right">Success</th>
                    <th className="py-2 text-right">Failed</th>
                    <th className="py-2 text-right">Rate</th>
                    <th className="py-2 text-right">Amount ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any) => {
                    const a = Number(r.allocation) || 0;
                    const s = Number(r.success) || 0;
                    const f = Number(r.failed) || 0;
                    const amt = Number(r.amount) || 0;
                    const rt = a ? (s / a) * 100 : 0;
                    return (
                      <tr key={r.day} className="border-t border-border hover:bg-accent/30">
                        <td className="py-2 font-mono text-xs">{new Date(r.day).toISOString().slice(0, 10)}</td>
                        <td className="py-2 text-right font-mono">{a}</td>
                        <td className="py-2 text-right font-mono text-emerald-600">{s}</td>
                        <td className="py-2 text-right font-mono text-rose-600">{f}</td>
                        <td className="py-2 text-right font-mono">{rt.toFixed(0)}%</td>
                        <td className="py-2 text-right font-mono">৳{amt.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-border bg-muted/40 font-bold">
                    <td className="py-2 text-xs uppercase tracking-widest">Total</td>
                    <td className="py-2 text-right font-mono">{tAlloc}</td>
                    <td className="py-2 text-right font-mono text-emerald-600">{tSuccess}</td>
                    <td className="py-2 text-right font-mono text-rose-600">{tFailed}</td>
                    <td className="py-2 text-right font-mono">{rate.toFixed(0)}%</td>
                    <td className="py-2 text-right font-mono">৳{tAmount.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
