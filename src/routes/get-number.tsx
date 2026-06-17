import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { liveAccessFn, allocateNumberFn } from "@/lib/stex.functions";
import { Hash, Copy, Loader2, Search, Globe2, ListFilter, Play, Pause } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/get-number")({
  head: () => ({ meta: [{ title: "Get Number — Nexus SMS" }] }),
  component: () => (<Protected><GetNumberPage /></Protected>),
});

type Mode = "range" | "search" | "access";

type Alloc = { full: string; country: string; operator: string; sid?: string | null; at: number };

function GetNumberPage() {
  const { token } = useAuth();
  const callLive = useServerFn(liveAccessFn);
  const callAlloc = useServerFn(allocateNumberFn);

  const [mode, setMode] = useState<Mode>("range");
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState<string>("");
  const [operator, setOperator] = useState<string>("");
  const [serviceFilter, setServiceFilter] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [recent, setRecent] = useState<Alloc[]>([]);
  const [sync, setSync] = useState(false);
  const [syncRid, setSyncRid] = useState<string>("");
  const [syncSid, setSyncSid] = useState<string>("");
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["stex-live"],
    queryFn: () => callLive({ data: { token: token! } }),
    enabled: !!token,
    refetchInterval: 30000,
  });

  // Derived: countries / operators from current live data (parsed via range prefix country code lookup is upstream-specific, so just use unique strings derived from ranges)
  const services = data?.services ?? [];
  const countries = useMemo(() => {
    const set = new Set<string>();
    for (const s of services) for (const r of s.ranges) {
      // Heuristic: country prefix length varies; group by first 2-3 digits
      const m = r.match(/^(\d{1,3})/);
      if (m) set.add(m[1]);
    }
    return Array.from(set).sort();
  }, [services]);

  const filteredServices = useMemo(() => {
    if (mode === "access") {
      const q = serviceFilter.trim().toLowerCase();
      if (!q) return services;
      return services.filter((s) => s.sid.toLowerCase().includes(q));
    }
    if (mode === "search") {
      const cc = country.trim();
      const op = operator.trim();
      return services
        .map((s) => ({ ...s, ranges: s.ranges.filter((r) => (!cc || r.startsWith(cc)) && (!op || r.includes(op))) }))
        .filter((s) => s.ranges.length);
    }
    // range mode
    const q = query.trim().toLowerCase();
    if (!q) return services;
    return services
      .map((s) => ({ ...s, ranges: s.ranges.filter((r) => r.toLowerCase().includes(q) || s.sid.toLowerCase().includes(q)) }))
      .filter((s) => s.ranges.length || s.sid.toLowerCase().includes(q));
  }, [services, mode, query, country, operator, serviceFilter]);

  const allocate = async (rangePattern: string, sid: string) => {
    if (!token) return null;
    const rid = rangePattern.replace(/X+$/i, "");
    setBusy(rangePattern);
    try {
      const r = await callAlloc({ data: { token, rid, sid } });
      const row: Alloc = { full: r.full_number, country: r.country || "", operator: r.operator || "", sid, at: Date.now() };
      setRecent((p) => [row, ...p].slice(0, 20));
      toast.success(`Allocated ${r.full_number}`);
      return r;
    } catch (e: any) {
      toast.error(e?.message || "Allocation failed");
      return null;
    } finally {
      setBusy(null);
    }
  };

  // SYNC MODE: auto-allocate the last-used range every 6s while toggled on.
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
  }, [sync, syncRid, syncSid]);

  const handleClick = (rangePattern: string, sid: string) => {
    setSyncRid(rangePattern.replace(/X+$/i, ""));
    setSyncSid(sid);
    allocate(rangePattern, sid);
  };

  return (
    <AppShell>
      <PageHeader icon={<Hash className="size-6" />} title="Get Number" subtitle="Three ways to pick a number: by Range, by Country/Operator search, or by Service access." />

      {/* Mode tabs */}
      <div className="glass-panel-strong p-2 mb-4 flex gap-1">
        {([["range","Range",Hash],["search","Search",Search],["access","Access",ListFilter]] as const).map(([k, label, Icon]) => (
          <button
            key={k}
            onClick={() => setMode(k)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${mode === k ? "bg-primary text-primary-foreground shadow" : "hover:bg-accent text-muted-foreground"}`}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>

      {/* Mode-specific controls */}
      <div className="glass-panel-strong p-4 mb-4">
        {mode === "range" && (
          <div className="flex items-center gap-2">
            <Search className="size-4 text-muted-foreground" />
            <input
              placeholder="Search by range prefix or service (e.g. 8801, TELEGRAM)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        )}
        {mode === "search" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Country code</label>
              <select value={country} onChange={(e) => setCountry(e.target.value)} className="mt-1 w-full bg-background border border-border rounded-md px-3 py-2 text-sm">
                <option value="">Any country</option>
                {countries.map((c) => <option key={c} value={c}>+{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Operator digits</label>
              <input
                placeholder="e.g. 17, 88"
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                className="mt-1 w-full bg-background border border-border rounded-md px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>
        )}
        {mode === "access" && (
          <div className="flex items-center gap-2">
            <ListFilter className="size-4 text-muted-foreground" />
            <input
              placeholder="Filter by service (sid): TELEGRAM, FB, WHATSAPP..."
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        )}
      </div>

      {/* SYNC MODE */}
      <div className="glass-panel-strong p-4 mb-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold flex items-center gap-2">
            {sync ? <Play className="size-4 text-emerald-600 animate-pulse" /> : <Pause className="size-4 text-muted-foreground" />}
            SYNC MODE
          </div>
          <div className="text-xs text-muted-foreground">
            {sync ? `Auto-allocating rid=${syncRid} every 6s` : "Allocate one number, then toggle ON to keep pulling that range automatically."}
          </div>
        </div>
        <button
          disabled={!syncRid && !sync}
          onClick={() => setSync((v) => !v)}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${sync ? "bg-rose-500 text-white" : "bg-emerald-500 text-white disabled:opacity-40"}`}
        >
          {sync ? "Stop" : "Start"}
        </button>
      </div>

      {/* Recent allocations */}
      {recent.length > 0 && (
        <div className="glass-panel-strong p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold">Recent allocations</h3>
            <span className="text-[10px] text-muted-foreground">{recent.length} in this session</span>
          </div>
          <div className="max-h-56 overflow-y-auto divide-y divide-border">
            {recent.map((r, i) => (
              <div key={i} className="py-2 flex items-center justify-between text-sm">
                <div>
                  <div className="font-mono">{r.full}</div>
                  <div className="text-xs text-muted-foreground">{r.country} · {r.operator} · {r.sid || "—"}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-muted-foreground">{Math.max(1, Math.round((Date.now() - r.at) / 1000))}s ago</span>
                  <button onClick={() => { navigator.clipboard.writeText(r.full); toast.success("Copied"); }} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent flex items-center gap-1">
                    <Copy className="size-3" /> Copy
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Services grid */}
      <div className="glass-panel-strong p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold flex items-center gap-2"><Globe2 className="size-4" /> Live access ({filteredServices.length} services)</h3>
          <button onClick={() => refetch()} className="text-xs text-muted-foreground hover:text-foreground">Refresh</button>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading live ranges…</p>
        ) : filteredServices.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">No services match your filter.</p>
        ) : (
          <div className="space-y-6">
            {filteredServices.map((s) => (
              <div key={s.sid}>
                <div className="mb-2 flex items-baseline gap-2">
                  <h4 className="font-bold text-base accent-text">{s.sid}</h4>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    last hit {new Date(s.last_at).toLocaleTimeString()} · {s.ranges.length} ranges
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {s.ranges.map((r) => (
                    <button
                      key={r}
                      disabled={!!busy}
                      onClick={() => handleClick(r, s.sid)}
                      className="rounded-md border border-border bg-background px-3 py-1.5 font-mono text-xs hover:bg-accent disabled:opacity-50 flex items-center gap-2"
                    >
                      {busy === r ? <Loader2 className="size-3 animate-spin" /> : null}
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
