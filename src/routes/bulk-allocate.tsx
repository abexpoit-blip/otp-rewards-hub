import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { liveAccessFn } from "@/lib/stex.functions";
import { bulkAllocateFn } from "@/lib/bulk.functions";
import { Layers, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/bulk-allocate")({
  head: () => ({ meta: [{ title: "Bulk Allocate — Nexus SMS" }] }),
  component: () => (<Protected><BulkAllocatePage /></Protected>),
});

type Service = { sid: string; last_at: number; ranges: string[] };
type Row = { rid: string; sid: string; count: number };
type Result = {
  rid: string;
  sid: string | null;
  ok: boolean;
  full_number?: string;
  country?: string;
  error?: string;
};

function BulkAllocatePage() {
  const { token } = useAuth();
  const callLive = useServerFn(liveAccessFn);
  const callBulk = useServerFn(bulkAllocateFn);

  const [services, setServices] = useState<Service[]>([]);
  const [selectedSid, setSelectedSid] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [defaultCount, setDefaultCount] = useState(3);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (!token) return;
    callLive({ data: { token } })
      .then((r: any) => setServices(r.services as Service[]))
      .catch(() => toast.error("Failed to load services"))
      .finally(() => setLoading(false));
  }, [token]);

  const filtered = useMemo(
    () => services.filter((s) => s.sid.toLowerCase().includes(filter.toLowerCase())),
    [services, filter],
  );

  const current = services.find((s) => s.sid === selectedSid);
  const totalRequested = rows.reduce((a, r) => a + r.count, 0);

  const toggleRange = (rid: string) => {
    setRows((prev) => {
      const exists = prev.find((r) => r.rid === rid);
      if (exists) return prev.filter((r) => r.rid !== rid);
      return [...prev, { rid, sid: selectedSid, count: defaultCount }];
    });
  };

  const setCount = (rid: string, count: number) => {
    setRows((prev) => prev.map((r) => (r.rid === rid ? { ...r, count } : r)));
  };

  const selectAll = () => {
    if (!current) return;
    setRows(current.ranges.map((rid) => ({ rid, sid: selectedSid, count: defaultCount })));
  };

  const clearAll = () => setRows([]);

  const submit = async () => {
    if (!token || rows.length === 0) return;
    setSubmitting(true);
    setResults(null);
    try {
      const r: any = await callBulk({ data: { token, items: rows } });
      setResults(r.results);
      toast.success(`Allocated ${r.ok}/${r.total} numbers`);
    } catch (e: any) {
      toast.error(e?.message || "Bulk allocation failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        icon={<Layers className="size-6" />}
        title="Bulk Allocate"
        subtitle="Allocate multiple numbers across ranges in one go — by service & country."
      />

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        {/* Left: Service picker */}
        <div className="glass-panel-strong p-5">
          <div className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Service
          </div>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search service…"
            className="mb-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto size-5 animate-spin" />
            </div>
          ) : (
            <ul className="max-h-[420px] space-y-1 overflow-y-auto">
              {filtered.map((s) => (
                <li key={s.sid}>
                  <button
                    onClick={() => {
                      setSelectedSid(s.sid);
                      setRows([]);
                      setResults(null);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition ${
                      selectedSid === s.sid
                        ? "bg-primary/15 text-primary font-bold"
                        : "hover:bg-white/50"
                    }`}
                  >
                    <span className="truncate">{s.sid}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {s.ranges.length}
                    </span>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="py-6 text-center text-xs text-muted-foreground">
                  No services match.
                </li>
              )}
            </ul>
          )}
        </div>

        {/* Right: Ranges + actions */}
        <div className="space-y-5">
          <div className="glass-panel-strong p-5">
            {!current ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Pick a service on the left to see available ranges.
              </div>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold">{current.sid}</div>
                    <div className="text-xs text-muted-foreground">
                      {current.ranges.length} ranges • {rows.length} selected • {totalRequested} numbers to allocate
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <label className="flex items-center gap-1">
                      Default count
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={defaultCount}
                        onChange={(e) => setDefaultCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                        className="w-16 rounded-lg border border-border bg-background px-2 py-1"
                      />
                    </label>
                    <button onClick={selectAll} className="rounded-lg border border-border px-2 py-1 hover:bg-white/50">
                      Select all
                    </button>
                    <button onClick={clearAll} className="rounded-lg border border-border px-2 py-1 hover:bg-white/50">
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid max-h-[420px] grid-cols-1 gap-2 overflow-y-auto md:grid-cols-2">
                  {current.ranges.map((rid) => {
                    const row = rows.find((r) => r.rid === rid);
                    const active = !!row;
                    return (
                      <div
                        key={rid}
                        className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition ${
                          active ? "border-primary/40 bg-primary/5" : "border-border"
                        }`}
                      >
                        <label className="flex flex-1 cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() => toggleRange(rid)}
                            className="size-4 accent-primary"
                          />
                          <span className="font-mono text-xs">{rid}</span>
                        </label>
                        {active && (
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={row!.count}
                            onChange={(e) =>
                              setCount(rid, Math.max(1, Math.min(20, Number(e.target.value) || 1)))
                            }
                            className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-xs"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    disabled={submitting || rows.length === 0}
                    onClick={submit}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-sm disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="size-4 animate-spin" /> : <Layers className="size-4" />}
                    Allocate {totalRequested} numbers
                  </button>
                </div>
              </>
            )}
          </div>

          {results && (
            <div className="glass-panel-strong p-5">
              <div className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Results — {results.filter((r) => r.ok).length}/{results.length} success
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                      <th className="py-2">Status</th>
                      <th className="py-2">Range</th>
                      <th className="py-2">Number</th>
                      <th className="py-2">Country</th>
                      <th className="py-2">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="py-2">
                          {r.ok ? (
                            <Check className="size-4 text-emerald-600" />
                          ) : (
                            <X className="size-4 text-destructive" />
                          )}
                        </td>
                        <td className="py-2 font-mono text-xs">{r.rid}</td>
                        <td className="py-2 font-mono text-xs">{r.full_number || "—"}</td>
                        <td className="py-2 text-xs">{r.country || "—"}</td>
                        <td className="py-2 text-xs text-muted-foreground">{r.error || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
