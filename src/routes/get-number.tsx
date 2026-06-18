import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { allocateNumberFn, myAllocationsFn } from "@/lib/stex.functions";
import { getOtpsFn } from "@/lib/inbox.functions";
import { Hash, Copy, Loader2, Search, Globe2, Play, Pause, RefreshCw, CheckCircle2, XCircle, Clock, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { SkeletonRows } from "@/components/Skeleton";

export const Route = createFileRoute("/get-number")({
  head: () => ({ meta: [{ title: "Get Number — Nexus SMS" }] }),
  component: () => (<Protected><GetNumberPage /></Protected>),
});

type StatusTab = "all" | "success" | "failed" | "pending";

function GetNumberPage() {
  const { token } = useAuth();
  const callAlloc = useServerFn(allocateNumberFn);
  const callMine = useServerFn(myAllocationsFn);
  const callOtps = useServerFn(getOtpsFn);
  const seenStatusRef = useRef<Map<string, string>>(new Map());
  const initializedRef = useRef(false);

  const [rangeInput, setRangeInput] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [sync, setSync] = useState(false);
  const [syncRid, setSyncRid] = useState<string>("");
  const [syncSid, setSyncSid] = useState<string>("");
  const [national, setNational] = useState(false);
  const [noPlus, setNoPlus] = useState(false);
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [listSearch, setListSearch] = useState("");
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: mine, isFetching: mineFetching, refetch: refetchMine } = useQuery({
    queryKey: ["my-allocations", statusTab, listSearch],
    queryFn: () => callMine({ data: { token: token!, status: statusTab, search: listSearch || undefined, limit: 100 } }),
    enabled: !!token,
    refetchInterval: 5000,
  });

  const { data: otps } = useQuery({
    queryKey: ["my-otps"],
    queryFn: () => callOtps({ data: { token: token! } }),
    enabled: !!token,
    refetchInterval: 5000,
  });

  // Build a lookup: number → latest OTP body
  const otpByNumber = useMemo(() => {
    const m = new Map<string, { body: string; received_at: string }>();
    for (const o of otps ?? []) {
      if (!o.number) continue;
      const keys = [o.number, "+" + o.number, o.number.replace(/^\+/, "")];
      for (const k of keys) if (!m.has(k)) m.set(k, { body: o.body, received_at: o.received_at });
    }
    return m;
  }, [otps]);

  // Detect status transitions — toast in-place, no redirect.
  useEffect(() => {
    const rows = mine?.rows as Array<{ id: string; status: string; full_number?: string; national_number?: string; no_plus_number?: string }> | undefined;
    if (!rows) return;
    const map = seenStatusRef.current;
    if (!initializedRef.current) {
      for (const r of rows) map.set(r.id, r.status);
      initializedRef.current = true;
      return;
    }
    for (const r of rows) {
      const prev = map.get(r.id);
      if (prev && prev !== r.status) {
        const shown = r.full_number || r.national_number || r.no_plus_number || "number";
        if (r.status === "success") {
          toast.success(`OTP received for ${shown}`, { duration: 4000 });
        } else if (r.status === "failed" || r.status === "expired") {
          toast.error(`Allocation ${shown} ${r.status}`);
        }
      }
      map.set(r.id, r.status);
    }
  }, [mine]);

  const counts = mine?.counts ?? { total: 0, success: 0, failed: 0, pending: 0 };
  const successRate = counts.total ? (counts.success / counts.total) * 100 : 0;

  const allocate = async (rangePattern: string, sid: string) => {
    if (!token) return null;
    const rid = rangePattern.replace(/X+$/i, "").trim();
    if (!rid) { toast.error("Enter a range first"); return null; }
    setBusy(rangePattern);
    try {
      const r = await callAlloc({ data: { token, rid, sid, national, no_plus: noPlus } });
      const shown = (r as any).display_number || r.full_number;
      toast.success(`Allocated ${shown}`);
      refetchMine();
      return r;
    } catch (e: any) {
      toast.error(e?.message || "Allocation failed");
      return null;
    } finally {
      setBusy(null);
    }
  };

  // SYNC MODE: auto-allocate every 6s while toggled on.
  useEffect(() => {
    if (!sync || !syncRid) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      await allocate(syncRid, syncSid);
      if (cancelled) return;
      syncTimer.current = setTimeout(tick, 6000);
    };
    tick();
    return () => { cancelled = true; if (syncTimer.current) clearTimeout(syncTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sync, syncRid, syncSid]);

  const handleDirect = () => {
    const r = rangeInput.trim();
    if (!r) { toast.error("Type a range first (e.g. 88017XXX)"); return; }
    setSyncRid(r.replace(/X+$/i, ""));
    setSyncSid("");
    allocate(r, "");
  };

  const statusBadge = (s: string) => {
    const map: Record<string, { cls: string; Icon: any; label: string }> = {
      success:  { cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30", Icon: CheckCircle2, label: "SUCCESS" },
      failed:   { cls: "bg-rose-500/15    text-rose-700    dark:text-rose-400    border-rose-500/30",    Icon: XCircle,       label: "FAILED" },
      expired:  { cls: "bg-rose-500/10    text-rose-700    dark:text-rose-400    border-rose-500/20",    Icon: XCircle,       label: "EXPIRED" },
      pending:  { cls: "bg-amber-500/15   text-amber-700   dark:text-amber-400   border-amber-500/30",   Icon: Clock,         label: "PENDING" },
    };
    const cfg = map[s] || map.pending;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${cfg.cls}`}>
        <cfg.Icon className="size-3" /> {cfg.label}
      </span>
    );
  };

  return (
    <AppShell>
      <PageHeader icon={<Hash className="size-6" />} title="Get Number" subtitle="Allocate numbers from a prefix range and watch incoming OTPs." />

      {/* ===== TOP: Direct Range Input + Get Number button ===== */}
      <div className="glass-panel-strong p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] uppercase tracking-widest font-bold text-emerald-600">Enter Number Range</div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSync((v) => !v)}
              disabled={!syncRid && !sync}
              title="SYNC MODE — auto loop the last range every 6s"
              className={`size-7 rounded-full flex items-center justify-center ${sync ? "bg-rose-500 text-white" : "bg-muted text-muted-foreground hover:bg-accent disabled:opacity-40"}`}
            >
              {sync ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            </button>
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground ml-1">Sync<br/>Mode</span>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <Hash className="size-4 text-muted-foreground" />
          <input
            placeholder="e.g., 88017XXX  (type the trailing X's yourself)"
            value={rangeInput}
            onChange={(e) => setRangeInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleDirect(); }}
            className="flex-1 bg-background border border-border rounded-md px-3 py-2.5 font-mono text-sm outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={national} onChange={(e) => setNational(e.target.checked)} className="accent-emerald-500" />
              <span>National Format</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={noPlus} onChange={(e) => setNoPlus(e.target.checked)} className="accent-emerald-500" />
              <span>Remove (+)</span>
            </label>
          </div>
          <button
            onClick={handleDirect}
            disabled={!!busy}
            aria-busy={!!busy}
            aria-label={busy ? "Allocating number, please wait" : "Get number"}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Hash className="size-4" aria-hidden="true" />}
            {busy ? "Allocating…" : "Get Number"}
          </button>
        </div>
      </div>

      {/* ===== TWO-COL: filters sidebar + persistent table ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
        {/* LEFT SIDEBAR — filters + counters + success rate */}
        <div className="glass-panel-strong p-4 space-y-3">
          <div className="flex items-center gap-2 bg-background border border-border rounded-md px-2 py-1.5">
            <Search className="size-3.5 text-muted-foreground" />
            <input
              placeholder="Search numbers…"
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              className="flex-1 bg-transparent text-xs outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {([
              ["all", "All", counts.total],
              ["success", "Success", counts.success],
              ["failed", "Failed", counts.failed],
              ["pending", "Pending", counts.pending],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setStatusTab(k)}
                className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-xs font-semibold transition ${statusTab === k ? "bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/40" : "bg-muted text-muted-foreground hover:bg-accent"}`}
              >
                {k === "success" && <CheckCircle2 className="size-3" />}
                {k === "failed" && <XCircle className="size-3" />}
                {k === "pending" && <Clock className="size-3" />}
                {label}
              </button>
            ))}
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Success Rate</span>
              <span className="text-2xl font-bold text-amber-500 font-mono">{successRate.toFixed(1)}%</span>
            </div>
            <div className="h-1 bg-muted rounded overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-amber-500" style={{ width: `${successRate}%` }} />
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-border">
            <CounterRow color="emerald" Icon={CheckCircle2} label="Success" value={counts.success} />
            <CounterRow color="rose" Icon={XCircle} label="Failed" value={counts.failed} />
            <CounterRow color="amber" Icon={Clock} label="Pending" value={counts.pending} />
          </div>
        </div>

        {/* RIGHT — persistent allocations table */}
        <div className="glass-panel-strong p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-muted-foreground">
              {mine?.rows?.length ? `1 – ${mine.rows.length} of ${counts.total}` : "0 of 0"}
            </span>
            <button onClick={() => refetchMine()} disabled={mineFetching} aria-busy={mineFetching} aria-label={mineFetching ? "Refreshing allocations" : "Refresh allocations"} className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border border-border hover:bg-accent disabled:opacity-60 disabled:cursor-not-allowed">
              <RefreshCw className={`size-3 ${mineFetching ? "animate-spin" : ""}`} aria-hidden="true" /> {mineFetching ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {!mine ? (
            <SkeletonRows rows={6} />
          ) : !mine.rows?.length ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No allocations yet. Enter a range above and hit <span className="font-semibold text-emerald-600">Get Number</span>.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                    <th className="py-2 pr-4">Number Info</th>
                    <th className="py-2 pr-4">Country / Operator</th>
                    <th className="py-2 pr-4">OTP</th>
                    <th className="py-2 text-right">Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {mine.rows.map((r: any) => {
                    const shown = noPlus ? r.no_plus_number : national ? r.national_number : r.full_number;
                    const otp = otpByNumber.get(r.full_number) || otpByNumber.get(r.no_plus_number) || otpByNumber.get(r.national_number);
                    return (
                      <tr key={r.id} className="border-t border-border hover:bg-accent/30 align-top">
                        <td className="py-3 pr-4">
                          <div className="font-mono font-semibold flex items-center gap-2">
                            {shown}
                            <button
                              onClick={() => { navigator.clipboard.writeText(shown); toast.success("Copied"); }}
                              className="opacity-50 hover:opacity-100"
                              title="Copy"
                            >
                              <Copy className="size-3" />
                            </button>
                          </div>
                          <div className="mt-1">{statusBadge(r.status)}</div>
                        </td>
                        <td className="py-3 pr-4">
                          <div>{r.country || "—"}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Globe2 className="size-3" /> {r.operator || "—"}{r.sid ? ` · ${r.sid}` : ""}
                          </div>
                        </td>
                        <td className="py-3 pr-4 max-w-[320px]">
                          {otp ? (
                            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2 py-1.5">
                              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-emerald-600 font-bold mb-1">
                                <MessageSquare className="size-3" /> OTP
                                <button
                                  onClick={() => { navigator.clipboard.writeText(otp.body); toast.success("OTP copied"); }}
                                  className="ml-auto opacity-60 hover:opacity-100"
                                  title="Copy OTP"
                                >
                                  <Copy className="size-3" />
                                </button>
                              </div>
                              <div className="text-xs font-mono break-words whitespace-pre-wrap">{otp.body}</div>
                            </div>
                          ) : r.status === "pending" ? (
                            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                              <Loader2 className="size-3 animate-spin" /> Waiting…
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                          {timeAgo(r.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function CounterRow({ color, Icon, label, value }: { color: "emerald" | "rose" | "amber"; Icon: any; label: string; value: number }) {
  const cls = color === "emerald" ? "bg-emerald-500/15 text-emerald-600"
            : color === "rose" ? "bg-rose-500/15 text-rose-600"
            : "bg-amber-500/15 text-amber-600";
  return (
    <div className="flex items-center justify-between bg-muted/40 rounded-md px-3 py-2">
      <div className="flex items-center gap-2 text-sm">
        <span className={`size-6 rounded flex items-center justify-center ${cls}`}><Icon className="size-3.5" /></span>
        <span className="font-medium">{label}</span>
      </div>
      <span className="font-mono font-bold text-sm">{value}</span>
    </div>
  );
}

function timeAgo(iso: string) {
  const t = new Date(iso).getTime();
  const s = Math.max(1, Math.round((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min${m > 1 ? "s" : ""} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}
