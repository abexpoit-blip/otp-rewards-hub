import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { summaryFn } from "@/lib/stex.functions";
import { BarChart3 } from "lucide-react";

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
  const callSummary = useServerFn(summaryFn);
  const { data, isLoading } = useQuery({
    queryKey: ["summary"],
    queryFn: () => callSummary({ data: { token: token! } }),
    enabled: !!token,
    refetchInterval: 15000,
  });

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
