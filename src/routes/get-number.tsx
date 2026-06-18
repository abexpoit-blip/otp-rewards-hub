import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { allocateNumberFn, myAllocationsFn } from "@/lib/stex.functions";
import { getOtpsFn } from "@/lib/inbox.functions";
import { Hash, Copy, Loader2, Search, Globe2, Play, Pause, RefreshCw, CheckCircle2, XCircle, Clock, MessageSquare, Plus, Inbox } from "lucide-react";
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
  const [now, setNow] = useState(() => new Date());
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

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

  const otpByNumber = useMemo(() => {
    const m = new Map<string, { body: string; received_at: string }>();
    for (const o of otps ?? []) {
      if (!o.number) continue;
      const keys = [o.number, "+" + o.number, o.number.replace(/^\+/, "")];
      for (const k of keys) if (!m.has(k)) m.set(k, { body: o.body, received_at: o.received_at });
    }
    return m;
  }, [otps]);

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
        if (r.status === "success") toast.success(`OTP received for ${shown}`, { duration: 4000 });
        else if (r.status === "failed" || r.status === "expired") toast.error(`Allocation ${shown} ${r.status}`);
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

  const toggleSync = () => {
    if (!sync && !syncRid && rangeInput.trim()) {
      setSyncRid(rangeInput.trim().replace(/X+$/i, ""));
      setSyncSid("");
    }
    setSync((v) => !v);
  };

  const statusBadge = (s: string) => {
    const map: Record<string, { cls: string; Icon: any; label: string }> = {
      success:  { cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30", Icon: CheckCircle2, label: "SUCCESS" },
      failed:   { cls: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30", Icon: XCircle, label: "FAILED" },
      expired:  { cls: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20", Icon: XCircle, label: "EXPIRED" },
      pending:  { cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30", Icon: Clock, label: "PENDING" },
    };
    const cfg = map[s] || map.pending;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${cfg.cls}`}>
        <cfg.Icon className="size-3" /> {cfg.label}
      </span>
    );
  };

  const timeStr = now.toTimeString().slice(0, 8);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Get Number</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Allocate numbers from a prefix range and watch incoming OTPs.</p>
          </div>
          <div className="flex items-center gap-3 text-xs font-medium">
            <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Live
            </div>
            <div className="bg-card/50 backdrop-blur-sm border border-border px-3 py-1.5 rounded-lg shadow-sm font-mono text-muted-foreground">
              {timeStr} <span className="opacity-60">UTC{-new Date().getTimezoneOffset() / 60 >= 0 ? "+" : ""}{-new Date().getTimezoneOffset() / 60}</span>
            </div>
          </div>
        </div>

        {/* Main Control Card */}
        <div className="glass-panel-strong rounded-2xl p-6 shadow-xl shadow-primary/5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <span className="text-[10px] font-bold tracking-widest text-primary uppercase">Enter Number Range</span>
            <button
              onClick={toggleSync}
              disabled={!syncRid && !sync && !rangeInput.trim()}
              title="SYNC MODE — auto loop every 6s"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition ${
                sync
                  ? "bg-rose-500 text-white shadow-md shadow-rose-200"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted border border-border disabled:opacity-40"
              }`}
            >
              {sync ? <Pause className="size-3" /> : <Play className="size-3" />}
              Sync {sync ? "On" : "Mode"}
            </button>
          </div>

          <div className="flex gap-3 flex-col sm:flex-row">
            <div className="relative flex-1 group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium group-focus-within:text-primary transition-colors">
                <Hash className="size-4" />
              </div>
              <input
                placeholder="e.g., 88017XXX (type the trailing X's yourself)"
                value={rangeInput}
                onChange={(e) => setRangeInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleDirect(); }}
                className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all placeholder:text-muted-foreground/60 font-mono text-sm"
              />
            </div>
            <button
              onClick={handleDirect}
              disabled={!!busy}
              aria-busy={!!busy}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-7 py-3 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" strokeWidth={2.5} />}
              {busy ? "Allocating…" : "Get Number"}
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-6 items-center">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" checked={national} onChange={(e) => setNational(e.target.checked)} className="size-4 rounded border-border text-primary focus:ring-primary accent-primary" />
                <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">National Format</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" checked={noPlus} onChange={(e) => setNoPlus(e.target.checked)} className="size-4 rounded border-border text-primary focus:ring-primary accent-primary" />
                <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">Remove (+)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Split Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-3 space-y-4">
            <div className="glass-panel-strong rounded-2xl p-5 shadow-lg shadow-primary/5">
              <div className="relative mb-6">
                <Search className="size-3.5 absolute left-3 top-2.5 text-muted-foreground" />
                <input
                  placeholder="Search numbers..."
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-muted/40 border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 mb-6">
                {([
                  ["all", "All", counts.total],
                  ["success", "Success", counts.success],
                  ["failed", "Failed", counts.failed],
                  ["pending", "Pending", counts.pending],
                ] as const).map(([k, label, val]) => (
                  <button
                    key={k}
                    onClick={() => setStatusTab(k)}
                    className={`py-2 px-2 text-[10px] font-bold uppercase rounded-lg border transition ${
                      statusTab === k
                        ? "bg-primary/10 text-primary border-primary/30"
                        : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/60"
                    }`}
                  >
                    {label} <span className="opacity-60 ml-0.5">{val}</span>
                  </button>
                ))}
              </div>

              <div className="text-center mb-6">
                <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1 tracking-widest">Success Rate</div>
                <div className="text-3xl font-black text-amber-500 font-mono">{successRate.toFixed(1)}%</div>
                <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-amber-500" style={{ width: `${successRate}%` }} />
                </div>
              </div>

              <div className="space-y-2">
                <StatRow color="emerald" label="Success" value={counts.success} />
                <StatRow color="rose" label="Failed" value={counts.failed} />
                <StatRow color="amber" label="Pending" value={counts.pending} />
              </div>
            </div>
          </div>

          {/* Allocations */}
          <div className="lg:col-span-9 glass-panel-strong rounded-2xl shadow-lg shadow-primary/5 flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">
                {mine?.rows?.length ? `1 – ${mine.rows.length} of ${counts.total}` : "0 of 0"}
              </span>
              <button
                onClick={() => refetchMine()}
                disabled={mineFetching}
                className="text-[10px] font-bold text-primary flex items-center gap-1.5 hover:underline disabled:opacity-60"
              >
                <RefreshCw className={`size-3 ${mineFetching ? "animate-spin" : ""}`} />
                {mineFetching ? "REFRESHING…" : "REFRESH"}
              </button>
            </div>

            {!mine ? (
              <div className="p-5"><SkeletonRows rows={6} /></div>
            ) : !mine.rows?.length ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                <div className="size-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <Inbox className="size-8 text-muted-foreground/40" />
                </div>
                <p className="text-sm text-muted-foreground max-w-xs">
                  No allocations yet. Enter a range above and hit <span className="text-primary font-semibold">Get Number</span>.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                      <th className="py-2.5 px-4">Number Info</th>
                      <th className="py-2.5 px-4">Country / Operator</th>
                      <th className="py-2.5 px-4">OTP</th>
                      <th className="py-2.5 px-4 text-right">Activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mine.rows.map((r: any) => {
                      const shown = noPlus ? r.no_plus_number : national ? r.national_number : r.full_number;
                      const otp = otpByNumber.get(r.full_number) || otpByNumber.get(r.no_plus_number) || otpByNumber.get(r.national_number);
                      return (
                        <tr key={r.id} className="border-t border-border hover:bg-accent/30 align-top">
                          <td className="py-3 px-4">
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
                          <td className="py-3 px-4">
                            <div className="text-foreground">{r.country || "—"}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Globe2 className="size-3" /> {r.operator || "—"}{r.sid ? ` · ${r.sid}` : ""}
                            </div>
                          </td>
                          <td className="py-3 px-4 max-w-[320px]">
                            {otp ? (
                              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2 py-1.5">
                                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-emerald-600 dark:text-emerald-400 font-bold mb-1">
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
                          <td className="py-3 px-4 text-right text-xs text-muted-foreground whitespace-nowrap">
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
      </div>
    </AppShell>
  );
}

function StatRow({ color, label, value }: { color: "emerald" | "rose" | "amber"; label: string; value: number }) {
  const dot = color === "emerald" ? "bg-emerald-500"
            : color === "rose" ? "bg-rose-500"
            : "bg-amber-500";
  return (
    <div className="flex items-center justify-between p-2.5 rounded-xl hover:bg-accent/40 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`size-2 rounded-full ${dot}`} />
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      </div>
      <span className="text-xs font-bold text-foreground font-mono">{value}</span>
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
