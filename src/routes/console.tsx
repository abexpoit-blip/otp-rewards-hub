import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { consoleFeedFn } from "@/lib/stex.functions";
import { TerminalSquare } from "lucide-react";

export const Route = createFileRoute("/console")({
  head: () => ({ meta: [{ title: "Console — Nexus SMS" }] }),
  component: () => (<Protected><ConsolePage /></Protected>),
});

function ConsolePage() {
  const { token } = useAuth();
  const callConsole = useServerFn(consoleFeedFn);
  const { data, isLoading } = useQuery({
    queryKey: ["stex-console"],
    queryFn: () => callConsole({ data: { token: token! } }),
    enabled: !!token,
    refetchInterval: 5000,
  });

  return (
    <AppShell>
      <PageHeader icon={<TerminalSquare className="size-6" />} title="Live Console" subtitle="Global live feed of recent OTP hits (last 15 minutes). Updates every 5s." />
      <div className="glass-panel-strong p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !data?.hits || data.hits.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">No recent hits.</p>
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
                {data.hits.map((h, i) => (
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
