import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { summaryFn, summaryDailyFn } from "@/lib/stex.functions";
import { BarChart3, Download } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/summary")({
  head: () => ({ meta: [{ title: "Summary — Nexus SMS" }] }),
  component: () => (<Protected><SummaryPage /></Protected>),
});

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="glass-panel-strong p-5">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function SummaryPage() {
  const { token } = useAuth();
  const [days, setDays] = useState<7 | 14 | 30>(14);
  const callSummary = useServerFn(summaryFn);
  const callDaily = useServerFn(summaryDailyFn);
  const { data, isLoading } = useQuery({
    queryKey: ["summary"],
    queryFn: () => callSummary({ data: { token: token! } }),
    enabled: !!token,
    refetchInterval: 15000,
  });
  const { data: dailyData } = useQuery({
    queryKey: ["summary-daily", days],
    queryFn: () => callDaily({ data: { token: token!, days } }),
    enabled: !!token,
    refetchInterval: 30000,
  });

  const chartData = useMemo(() => (dailyData?.daily || []).map((d: any) => ({
    day: new Date(d.day).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    total: d.total,
    success: d.success,
    earned: Number(d.earned),
  })), [dailyData]);

  const exportCsv = () => {
    const rows = [["day", "total", "success", "earned_usd"], ...(dailyData?.daily || []).map((d: any) => [d.day, d.total, d.success, d.earned])];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `nexus-summary-${days}d.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const s = data?.stats;
  return (
    <AppShell>
      <PageHeader icon={<BarChart3 className="size-6" />} title="Summary" subtitle="Your allocation and earning statistics." />
      {isLoading || !s ? (
        <div className="glass-panel-strong p-6 text-sm text-muted-foreground">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Today Earned" value={`$${Number(s.today_earned).toFixed(2)}`} sub={`${s.today_success}/${s.today_total} success today`} />
            <StatCard label="Lifetime Earned" value={`$${Number(s.earned).toFixed(2)}`} sub={`${s.success} successful OTPs`} />
            <StatCard label="Total Allocations" value={String(s.total)} sub={`${s.pending} pending`} />
            <StatCard label="Failed / Expired" value={String(s.failed)} />
          </div>

          <div className="glass-panel-strong p-6 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold">Daily Performance</h3>
                <p className="text-xs text-muted-foreground">Allocations, success and earnings per day</p>
              </div>
              <div className="flex items-center gap-2">
                {[7, 14, 30].map((d) => (
                  <button key={d} onClick={() => setDays(d as any)} className={`px-3 py-1 rounded-md text-xs ${days === d ? "bg-primary text-primary-foreground" : "border border-border hover:bg-accent"}`}>{d}d</button>
                ))}
                <button onClick={exportCsv} className="px-3 py-1 rounded-md text-xs border border-border hover:bg-accent flex items-center gap-1">
                  <Download className="size-3" /> CSV
                </button>
              </div>
            </div>
            <div className="h-[260px]">
              {chartData.length === 0 ? (
                <p className="text-sm text-muted-foreground py-12 text-center">No data for this range.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "white", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }} />
                    <Line type="monotone" dataKey="total" stroke="#94a3b8" strokeWidth={2} dot={false} name="Total" />
                    <Line type="monotone" dataKey="success" stroke="#16a34a" strokeWidth={2.5} dot={false} name="Success" />
                    <Line type="monotone" dataKey="earned" stroke="hsl(var(--accent-hsl))" strokeWidth={2.5} dot={false} name="Earned ($)" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="glass-panel-strong p-6">
            <h3 className="font-bold mb-3">By Country (top 10)</h3>
            {!data.byCountry?.length ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                    <th className="py-2">Country</th>
                    <th className="py-2 text-right">Total</th>
                    <th className="py-2 text-right">Success</th>
                    <th className="py-2 text-right">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byCountry.map((c: any) => (
                    <tr key={c.country || "unknown"} className="border-t border-border">
                      <td className="py-2">{c.country || "—"}</td>
                      <td className="py-2 text-right font-mono">{c.total}</td>
                      <td className="py-2 text-right font-mono">{c.success}</td>
                      <td className="py-2 text-right font-mono">{c.total ? Math.round((c.success / c.total) * 100) : 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}
