import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { getOtpsFn } from "@/lib/inbox.functions";
import { MessageSquare } from "lucide-react";

export const Route = createFileRoute("/inbox")({
  head: () => ({ meta: [{ title: "OTP Inbox — Nexus SMS" }] }),
  component: () => (<Protected><InboxPage /></Protected>),
});

function InboxPage() {
  const { token } = useAuth();
  const callGet = useServerFn(getOtpsFn);
  const { data, isLoading } = useQuery({
    queryKey: ["otps"],
    queryFn: () => callGet({ data: { token: token! } }),
    enabled: !!token,
    refetchInterval: 5000, // live polling
  });

  return (
    <AppShell>
      <PageHeader icon={<MessageSquare className="size-6" />} title="OTP Inbox" subtitle="Live incoming OTPs — auto-refreshes every 5 seconds." />

      <div className="glass-panel-strong p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !data || data.length === 0 ? (
          <div className="py-16 text-center">
            <MessageSquare className="mx-auto size-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">No OTPs yet. Allocate a number from <b>Get Number</b> to start receiving messages.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="py-2">Time</th>
                  <th className="py-2">Number</th>
                  <th className="py-2">Sender</th>
                  <th className="py-2">Message</th>
                  <th className="py-2">Country</th>
                </tr>
              </thead>
              <tbody>
                {data.map((o) => (
                  <tr key={o.id} className="border-t border-border">
                    <td className="py-2 font-mono text-xs whitespace-nowrap">{new Date(o.received_at).toLocaleString()}</td>
                    <td className="py-2 font-mono text-xs">{o.number || "—"}</td>
                    <td className="py-2 font-semibold">{o.sender || "—"}</td>
                    <td className="py-2 max-w-md break-words">{o.body}</td>
                    <td className="py-2 text-xs text-muted-foreground">{o.country || "—"}</td>
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
