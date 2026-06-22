import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/AppShell";
import { AgentProtected } from "@/components/AgentProtected";
import { useAuth } from "@/lib/auth";
import { agentTopPerformersFn } from "@/lib/agent.functions";
import { PerfBadge, getTier } from "@/components/PerfBadge";
import { Crown, Trophy, Calendar, Award } from "lucide-react";

export const Route = createFileRoute("/agent/top")({
  head: () => ({ meta: [{ title: "Agent · Top Performers — Nexus X" }] }),
  component: () => (<AgentProtected><TopPage /></AgentProtected>),
});

type Tab = "all" | "7d";

function TopPage() {
  const { token } = useAuth();
  const call = useServerFn(agentTopPerformersFn);
  const [tab, setTab] = useState<Tab>("all");

  const q = useQuery({
    queryKey: ["agent-top"],
    queryFn: () => call({ data: { token: token!, limit: 50 } }),
    enabled: !!token,
    refetchInterval: 30_000,
  });

  const sorted = (q.data ?? []).slice().sort((a, b) =>
    tab === "all" ? b.all_time - a.all_time : b.last_7d - a.last_7d,
  ).filter((u) => (tab === "all" ? u.all_time : u.last_7d) > 0);

  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  return (
    <AppShell>
      <PageHeader icon={<Crown className="size-6" />} title="Top Performers" subtitle="Your highest-earning users — all-time or last 7 days." />

      {/* Tabs */}
      <div className="mb-5 inline-flex rounded-xl border border-border bg-card p-1 shadow-sm">
        {[
          { k: "all" as Tab, label: "All time", Icon: Trophy },
          { k: "7d"  as Tab, label: "Last 7 days", Icon: Calendar },
        ].map(({ k, label, Icon }) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${tab === k ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Icon className="size-3.5" /> {label}
          </button>
        ))}
      </div>

      {q.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0,1,2].map((i) => <div key={i} className="h-40 animate-pulse rounded-3xl bg-muted" />)}
        </div>
      ) : sorted.length === 0 ? (
        <div className="glass-panel-strong p-12 text-center">
          <Trophy className="mx-auto size-10 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-bold">No successful OTPs yet in this period.</p>
          <p className="text-xs text-muted-foreground mt-1">Once your users deliver OTPs, leaderboard will populate.</p>
        </div>
      ) : (
        <>
          {/* Podium */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {top3.map((u, i) => {
              const count = tab === "all" ? u.all_time : u.last_7d;
              const tier = getTier(u.all_time);
              const medal = ["🥇","🥈","🥉"][i];
              const ringClass = i === 0 ? "ring-2 ring-amber-400/70" : i === 1 ? "ring-2 ring-slate-300" : "ring-2 ring-orange-400/60";
              return (
                <div key={u.id} className={`relative overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-sm ${ringClass}`}>
                  <div className="absolute -right-10 -top-10 size-32 rounded-full bg-amber-300/20 blur-3xl" />
                  <div className="relative flex items-start justify-between">
                    <div className="text-3xl">{medal}</div>
                    <PerfBadge count={u.all_time} size="sm" />
                  </div>
                  <div className="relative mt-3">
                    <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground">#{i + 1} · {tier.label}</p>
                    <p className="mt-1 font-mono text-sm font-bold truncate">{u.email}</p>
                    {u.name && <p className="text-xs text-muted-foreground truncate">{u.name}</p>}
                    <div className="mt-3 flex items-end gap-2">
                      <span className="text-3xl font-extrabold tabular-nums">{count.toLocaleString()}</span>
                      <span className="text-xs text-muted-foreground pb-1">OTPs {tab === "all" ? "all-time" : "(7d)"}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">Lifetime earning: <span className="font-mono font-bold text-foreground">৳{Number(u.lifetime_earning).toFixed(2)}</span></p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rest */}
          {rest.length > 0 && (
            <div className="glass-panel-strong overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase">
                  <tr>
                    <th className="text-left p-3 w-12">#</th>
                    <th className="text-left p-3">User</th>
                    <th className="text-left p-3">Tier</th>
                    <th className="text-right p-3">All-time</th>
                    <th className="text-right p-3">Last 7d</th>
                    <th className="text-right p-3">Lifetime ৳</th>
                  </tr>
                </thead>
                <tbody>
                  {rest.map((u, i) => (
                    <tr key={u.id} className="border-t border-border">
                      <td className="p-3 text-xs font-bold text-muted-foreground">#{i + 4}</td>
                      <td className="p-3">
                        <div className="font-mono">{u.email}</div>
                        {u.name && <div className="text-xs text-muted-foreground">{u.name}</div>}
                      </td>
                      <td className="p-3"><PerfBadge count={u.all_time} size="xs" /></td>
                      <td className="p-3 text-right font-mono font-bold tabular-nums">{u.all_time.toLocaleString()}</td>
                      <td className="p-3 text-right font-mono text-muted-foreground tabular-nums">{u.last_7d.toLocaleString()}</td>
                      <td className="p-3 text-right font-mono">৳{Number(u.lifetime_earning).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Legend */}
          <div className="mt-6 glass-panel p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5"><Award className="size-3.5" /> Badge tiers</p>
            <div className="flex flex-wrap gap-2 text-xs">
              <PerfBadge count={500} size="sm" showCount /> <span className="text-muted-foreground self-center">≥ 500</span>
              <PerfBadge count={2000} size="sm" showCount /> <span className="text-muted-foreground self-center">≥ 2,000</span>
              <PerfBadge count={5000} size="sm" showCount /> <span className="text-muted-foreground self-center">≥ 5,000</span>
              <PerfBadge count={10000} size="sm" showCount /> <span className="text-muted-foreground self-center">≥ 10,000</span>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
