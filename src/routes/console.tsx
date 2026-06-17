import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { consoleFeedFn } from "@/lib/stex.functions";
import { TerminalSquare, Search } from "lucide-react";
import {
  Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

export const Route = createFileRoute("/console")({
  head: () => ({ meta: [{ title: "Console — Nexus SMS" }] }),
  component: () => (<Protected><ConsolePage /></Protected>),
});

const DONUT_COLORS = ["#2563eb", "#16a34a", "#a855f7", "#f59e0b", "#ec4899", "#0ea5e9", "#64748b", "#dc2626"];

function ConsolePage() {
  const { token } = useAuth();
  const callConsole = useServerFn(consoleFeedFn);
  const [q, setQ] = useState("");
  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["stex-console"],
    queryFn: () => callConsole({ data: { token: token! } }),
    enabled: !!token,
    refetchInterval: 5000,
  });

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

  // Top Apps (by sid)
  const topApps = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of hits) m.set(h.sid, (m.get(h.sid) || 0) + 1);
    return Array.from(m.entries()).map(([sid, count]) => ({ sid, count }))
      .sort((a, b) => b.count - a.count).slice(0, 8);
  }, [hits]);

  // Carrier distribution: take first 2-3 digit prefix as carrier proxy
  const carriers = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of hits) {
      const m1 = h.range.match(/^(\d{1,3})/);
      const key = m1 ? `+${m1[1]}` : "other";
      m.set(key, (m.get(key) || 0) + 1);
    }
    return Array.from(m.entries()).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value).slice(0, 8);
  }, [hits]);

  return (
    <AppShell>
      <PageHeader icon={<TerminalSquare className="size-6" />} title="Live Console" subtitle="Global OTP feed (last 15 min). Refreshes every 5s." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="glass-panel-strong p-5 lg:col-span-2">
          <h3 className="text-sm font-bold mb-2">Top Apps</h3>
          <div className="h-[200px]">
            {topApps.length === 0 ? <p className="text-xs text-muted-foreground">No data yet.</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topApps} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="sid" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "white", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="count" fill="hsl(var(--accent-hsl))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="glass-panel-strong p-5">
          <h3 className="text-sm font-bold mb-2">Carrier Distribution</h3>
          <div className="h-[200px]">
            {carriers.length === 0 ? <p className="text-xs text-muted-foreground">No data yet.</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={carriers} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
                    {carriers.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "white", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="glass-panel-strong p-4 mb-4 flex items-center gap-2">
        <Search className="size-4 text-muted-foreground" />
        <input
          placeholder="Filter feed (sid, range, message)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <span className="text-[10px] text-muted-foreground">
          {dataUpdatedAt ? `updated ${Math.max(1, Math.round((Date.now() - dataUpdatedAt) / 1000))}s ago` : "—"}
        </span>
      </div>

      <div className="glass-panel-strong p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">No hits match.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="py-2">Time</th>
                  <th className="py-2">Service</th>
                  <th className="py-2">Range</th>
                  <th className="py-2">Message</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((h, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="py-2 font-mono text-xs whitespace-nowrap">{new Date(h.time).toLocaleTimeString()}</td>
                    <td className="py-2 font-semibold accent-text">{h.sid}</td>
                    <td className="py-2 font-mono text-xs">{h.range}</td>
                    <td className="py-2 max-w-md break-words">{h.message}</td>
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
