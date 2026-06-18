import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { MessageSquare, Wifi, WifiOff, RefreshCw, AlertTriangle, Download, Calendar } from "lucide-react";
import { toast } from "sonner";

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

type Status = "connecting" | "live" | "reconnecting" | "offline";

function InboxPage() {
  const { token } = useAuth();
  const [otps, setOtps] = useState<OtpRow[]>([]);
  const [status, setStatus] = useState<Status>("connecting");
  const [attempts, setAttempts] = useState(0);
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [manualReconnect, setManualReconnect] = useState(0);

  const esRef = useRef<EventSource | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // tick every second to update "X s ago" labels and retry countdown
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!token) return;
    let stopped = false;
    let backoff = 1000;
    let attemptCount = 0;

    const cleanup = () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      esRef.current?.close();
      esRef.current = null;
    };

    const connect = () => {
      if (stopped) return;
      attemptCount += 1;
      setAttempts(attemptCount);
      setRetryAt(null);
      setStatus(attemptCount === 1 ? "connecting" : "reconnecting");

      const es = new EventSource(`/api/inbox/stream?token=${encodeURIComponent(token)}`);
      esRef.current = es;

      es.addEventListener("connected", () => {
        setStatus("live");
        setLastError(null);
        setLastEventAt(Date.now());
        backoff = 1000;
        attemptCount = 0;
        setAttempts(0);
      });

      es.addEventListener("backlog", (e: MessageEvent) => {
        setLastEventAt(Date.now());
        try {
          const rows = JSON.parse(e.data) as OtpRow[];
          setOtps(rows);
        } catch {}
      });

      es.addEventListener("otp", (e: MessageEvent) => {
        setLastEventAt(Date.now());
        try {
          const rows = JSON.parse(e.data) as OtpRow[];
          setOtps((prev) => {
            const ids = new Set(prev.map((r) => r.id));
            const fresh = rows.filter((r) => !ids.has(r.id));
            return [...fresh.reverse(), ...prev].slice(0, 200);
          });
        } catch {}
      });

      es.addEventListener("ping", () => {
        setLastEventAt(Date.now());
      });

      es.onerror = () => {
        es.close();
        esRef.current = null;
        if (stopped) return;

        // Give up after many attempts → require manual retry
        if (attemptCount >= 8) {
          setStatus("offline");
          setLastError(`Stream offline after ${attemptCount} attempts. Click reconnect.`);
          return;
        }

        setStatus("reconnecting");
        setLastError("Connection lost — retrying…");
        const delay = backoff;
        setRetryAt(Date.now() + delay);
        retryTimerRef.current = setTimeout(connect, delay);
        backoff = Math.min(backoff * 2, 15000);
      };
    };

    connect();
    return () => {
      stopped = true;
      cleanup();
    };
  }, [token, manualReconnect]);

  // Date filter (YYYY-MM-DD). Empty = no bound.
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const filteredOtps = useMemo(() => {
    if (!fromDate && !toDate) return otps;
    const fromTs = fromDate ? new Date(fromDate + "T00:00:00").getTime() : -Infinity;
    const toTs = toDate ? new Date(toDate + "T23:59:59.999").getTime() : Infinity;
    return otps.filter((o) => {
      const t = new Date(o.received_at).getTime();
      return t >= fromTs && t <= toTs;
    });
  }, [otps, fromDate, toDate]);

  // Extract OTP code from message body (4-8 digit run, allows separators like 123-456 or 123 456)
  const extractOtp = (body: string): string => {
    if (!body) return "";
    // Prefer grouped patterns like "123-456" or "123 456"
    const grouped = body.match(/\b(\d{3})[\s-](\d{3,4})\b/);
    if (grouped) return grouped[1] + grouped[2];
    const m = body.match(/\b(\d{4,8})\b/);
    return m ? m[1] : "";
  };

  const downloadTxt = () => {
    if (!filteredOtps.length) { toast.error("No OTPs to download"); return; }
    const lines: string[] = [];
    let skipped = 0;
    for (const o of filteredOtps) {
      const num = (o.number || "").trim();
      const code = extractOtp(o.body);
      if (!num || !code) { skipped++; continue; }
      lines.push(`${num}|${code}`);
    }
    if (!lines.length) { toast.error("No Number|OTP pairs found"); return; }
    const blob = new Blob([lines.join("\n") + "\n"], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `otp-${stamp}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${lines.length} pairs${skipped ? ` · ${skipped} skipped` : ""}`);
  };

  const lastEventLabel = lastEventAt
    ? `${Math.max(0, Math.floor((nowTick - lastEventAt) / 1000))}s ago`
    : "—";
  const retryInSec =
    retryAt && retryAt > nowTick ? Math.ceil((retryAt - nowTick) / 1000) : null;

  return (
    <AppShell>
      <PageHeader
        icon={<MessageSquare className="size-6" />}
        title="OTP Inbox"
        subtitle="Real-time stream — new OTPs appear instantly via SSE."
      />

      {/* Status bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        {status === "live" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 font-bold text-emerald-700">
            <Wifi className="size-3" /> LIVE
          </span>
        )}
        {status === "connecting" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-1 font-bold text-amber-700">
            <Wifi className="size-3 animate-pulse" /> CONNECTING…
          </span>
        )}
        {status === "reconnecting" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-1 font-bold text-amber-700">
            <RefreshCw className="size-3 animate-spin" /> RECONNECTING
            {retryInSec !== null && ` (${retryInSec}s)`}
            {attempts > 1 && ` · attempt ${attempts}`}
          </span>
        )}
        {status === "offline" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-1 font-bold text-destructive">
            <WifiOff className="size-3" /> OFFLINE
          </span>
        )}

        <span className="text-muted-foreground">
          Last event: <b>{lastEventLabel}</b> · {filteredOtps.length} / {otps.length} OTPs
        </span>

        <button
          onClick={() => setManualReconnect((n) => n + 1)}
          className="ml-auto inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-semibold hover:bg-white/50"
          title="Force reconnect"
        >
          <RefreshCw className="size-3" /> Reconnect
        </button>
      </div>

      {/* Date filter + Download */}
      <div className="mb-4 flex flex-wrap items-center gap-2 glass-panel-strong p-3 rounded-xl">
        <Calendar className="size-4 text-muted-foreground" />
        <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">From</label>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="bg-background border border-border rounded-md px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-primary/30"
        />
        <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">To</label>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="bg-background border border-border rounded-md px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-primary/30"
        />
        {(fromDate || toDate) && (
          <button
            onClick={() => { setFromDate(""); setToDate(""); }}
            className="text-[10px] font-semibold text-muted-foreground hover:text-foreground underline"
          >
            Clear
          </button>
        )}
        <button
          onClick={downloadCsv}
          disabled={!filteredOtps.length}
          className="ml-auto inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="size-3.5" /> Download CSV
        </button>
      </div>

      {lastError && status !== "live" && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{lastError}</span>
        </div>
      )}

      <div className="glass-panel-strong p-6">
        {filteredOtps.length === 0 ? (
          <div className="py-16 text-center">
            <MessageSquare className="mx-auto size-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">
              {otps.length === 0
                ? <>No OTPs yet. Allocate a number from <b>Get Number</b> to start receiving messages.</>
                : <>No OTPs match the selected date range.</>}
            </p>
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
                {filteredOtps.map((o) => (
                  <tr key={o.id} className="border-t border-border">
                    <td className="py-2 font-mono text-xs whitespace-nowrap">
                      {new Date(o.received_at).toLocaleString()}
                    </td>
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
