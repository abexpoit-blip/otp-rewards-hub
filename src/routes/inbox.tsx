import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { MessageSquare, Wifi, WifiOff } from "lucide-react";

export const Route = createFileRoute("/inbox")({
  head: () => ({ meta: [{ title: "OTP Inbox — Nexus SMS" }] }),
  component: () => (<Protected><InboxPage /></Protected>),
});

type OtpRow = {
  id: string;
  number: string | null;
  sender: string | null;
  body: string;
  country: string | null;
  received_at: string;
};

function InboxPage() {
  const { token } = useAuth();
  const [otps, setOtps] = useState<OtpRow[]>([]);
  const [status, setStatus] = useState<"connecting" | "live" | "reconnecting">("connecting");
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!token) return;
    let stopped = false;
    let backoff = 1000;

    const connect = () => {
      if (stopped) return;
      setStatus(esRef.current ? "reconnecting" : "connecting");
      const es = new EventSource(`/api/inbox/stream?token=${encodeURIComponent(token)}`);
      esRef.current = es;

      es.addEventListener("connected", () => {
        setStatus("live");
        backoff = 1000;
      });

      es.addEventListener("backlog", (e: MessageEvent) => {
        try {
          const rows = JSON.parse(e.data) as OtpRow[];
          setOtps(rows); // newest first from server
        } catch {}
      });

      es.addEventListener("otp", (e: MessageEvent) => {
        try {
          const rows = JSON.parse(e.data) as OtpRow[];
          setOtps((prev) => {
            const ids = new Set(prev.map((r) => r.id));
            const fresh = rows.filter((r) => !ids.has(r.id));
            // server sends ASC; we want newest first
            return [...fresh.reverse(), ...prev].slice(0, 200);
          });
        } catch {}
      });

      es.addEventListener("ping", () => {
        // keep-alive — nothing to do
      });

      es.onerror = () => {
        es.close();
        esRef.current = null;
        if (stopped) return;
        setStatus("reconnecting");
        setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 15000);
      };
    };

    connect();
    return () => {
      stopped = true;
      esRef.current?.close();
      esRef.current = null;
    };
  }, [token]);

  return (
    <AppShell>
      <PageHeader icon={<MessageSquare className="size-6" />} title="OTP Inbox" subtitle="Real-time stream — new OTPs appear instantly via SSE." />

      <div className="mb-4 flex items-center gap-2 text-xs">
        {status === "live" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-700 px-2 py-1 font-bold">
            <Wifi className="size-3" /> LIVE
          </span>
        ) : status === "connecting" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-700 px-2 py-1 font-bold">
            <Wifi className="size-3 animate-pulse" /> CONNECTING…
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 text-destructive px-2 py-1 font-bold">
            <WifiOff className="size-3" /> RECONNECTING…
          </span>
        )}
        <span className="text-muted-foreground">{otps.length} OTPs loaded</span>
      </div>

      <div className="glass-panel-strong p-6">
        {otps.length === 0 ? (
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
                {otps.map((o) => (
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
