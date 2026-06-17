import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { liveAccessFn } from "@/lib/stex.functions";
import { ListChecks } from "lucide-react";

export const Route = createFileRoute("/access-list")({
  head: () => ({ meta: [{ title: "Access List — Nexus SMS" }] }),
  component: () => (<Protected><AccessListPage /></Protected>),
});

function AccessListPage() {
  const { token } = useAuth();
  const callLive = useServerFn(liveAccessFn);
  const { data, isLoading } = useQuery({
    queryKey: ["stex-live"],
    queryFn: () => callLive({ data: { token: token! } }),
    enabled: !!token,
    refetchInterval: 30000,
  });

  return (
    <AppShell>
      <PageHeader icon={<ListChecks className="size-6" />} title="Access List" subtitle="Services currently active on the network and the ranges each one hit." />
      <div className="space-y-4">
        {isLoading ? (
          <div className="glass-panel-strong p-6 text-sm text-muted-foreground">Loading…</div>
        ) : !data?.services?.length ? (
          <div className="glass-panel-strong p-12 text-center text-sm text-muted-foreground">No active services right now.</div>
        ) : (
          data.services.map((s) => (
            <div key={s.sid} className="glass-panel-strong p-4">
              <div className="flex items-baseline justify-between mb-2">
                <h3 className="font-bold accent-text">{s.sid}</h3>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  last hit {new Date(s.last_at).toLocaleTimeString()} · {s.ranges.length} ranges
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {s.ranges.map((r) => (
                  <span key={r} className="rounded border border-border bg-background/40 px-2 py-0.5 font-mono text-[11px]">{r}</span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </AppShell>
  );
}
