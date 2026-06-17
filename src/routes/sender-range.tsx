import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { liveAccessFn } from "@/lib/stex.functions";
import { Radio, Search } from "lucide-react";

export const Route = createFileRoute("/sender-range")({
  head: () => ({ meta: [{ title: "Sender / Range — Nexus SMS" }] }),
  component: () => (<Protected><SenderRangePage /></Protected>),
});

type Row = { sid: string; range: string; last_at: number };

function SenderRangePage() {
  const { token } = useAuth();
  const callLive = useServerFn(liveAccessFn);
  const [query, setQuery] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["stex-live"],
    queryFn: () => callLive({ data: { token: token! } }),
    enabled: !!token,
    refetchInterval: 30000,
  });

  const rows = useMemo<Row[]>(() => {
    if (!data) return [];
    const all: Row[] = [];
    for (const s of data.services) for (const r of s.ranges) all.push({ sid: s.sid, range: r, last_at: s.last_at });
    const q = query.trim().toLowerCase();
    const filtered = q ? all.filter((r) => r.sid.toLowerCase().includes(q) || r.range.toLowerCase().includes(q)) : all;
    return filtered.sort((a, b) => b.last_at - a.last_at);
  }, [data, query]);

  return (
    <AppShell>
      <PageHeader icon={<Radio className="size-6" />} title="Sender / Range" subtitle="Flat searchable index of every (service, range) pair." />

      <div className="glass-panel-strong p-4 mb-4 flex items-center gap-2">
        <Search className="size-4 text-muted-foreground" />
        <input
          placeholder="Filter by service or range digits"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <span className="text-xs text-muted-foreground">{rows.length} rows</span>
      </div>

      <div className="glass-panel-strong p-0 overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground bg-background/30">
                  <th className="px-4 py-2">Service</th>
                  <th className="px-4 py-2">Range</th>
                  <th className="px-4 py-2">Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.sid}-${r.range}-${i}`} className="border-t border-border">
                    <td className="px-4 py-2 font-semibold accent-text">{r.sid}</td>
                    <td className="px-4 py-2 font-mono text-xs">{r.range}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(r.last_at).toLocaleTimeString()}</td>
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
