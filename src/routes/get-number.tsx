import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { liveAccessFn, allocateNumberFn } from "@/lib/stex.functions";
import { Hash, Copy, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/get-number")({
  head: () => ({ meta: [{ title: "Get Number — Nexus SMS" }] }),
  component: () => (<Protected><GetNumberPage /></Protected>),
});

function GetNumberPage() {
  const { token } = useAuth();
  const callLive = useServerFn(liveAccessFn);
  const callAlloc = useServerFn(allocateNumberFn);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [lastAlloc, setLastAlloc] = useState<{ full: string; country: string; operator: string } | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["stex-live"],
    queryFn: () => callLive({ data: { token: token! } }),
    enabled: !!token,
    refetchInterval: 30000,
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.services;
    return data.services
      .map((s) => ({ ...s, ranges: s.ranges.filter((r) => r.toLowerCase().includes(q) || s.sid.toLowerCase().includes(q)) }))
      .filter((s) => s.ranges.length > 0 || s.sid.toLowerCase().includes(q));
  }, [data, query]);

  const handleAllocate = async (rangePattern: string, sid: string) => {
    if (!token) return;
    const rid = rangePattern.replace(/X+$/i, "");
    setBusy(rangePattern);
    try {
      const r = await callAlloc({ data: { token, rid, sid } });
      setLastAlloc({ full: r.full_number, country: r.country || "", operator: r.operator || "" });
      toast.success(`Number allocated: ${r.full_number}`);
    } catch (e: any) {
      toast.error(e?.message || "Allocation failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <AppShell>
      <PageHeader icon={<Hash className="size-6" />} title="Get Number" subtitle="Pick a range from the live feed. Allocated numbers appear in OTP Inbox." />

      {lastAlloc && (
        <div className="glass-panel-strong p-4 mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Last allocated</div>
            <div className="font-mono text-lg">{lastAlloc.full}</div>
            <div className="text-xs text-muted-foreground">{lastAlloc.country} · {lastAlloc.operator}</div>
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(lastAlloc.full); toast.success("Copied"); }}
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent flex items-center gap-1"
          ><Copy className="size-3" /> Copy</button>
        </div>
      )}

      <div className="glass-panel-strong p-4 mb-4 flex items-center gap-2">
        <Search className="size-4 text-muted-foreground" />
        <input
          placeholder="Search by service (TELEGRAM, FACEBOOK…) or range digits"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <button onClick={() => refetch()} className="text-xs text-muted-foreground hover:text-foreground">Refresh</button>
      </div>

      <div className="glass-panel-strong p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading live ranges…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">No services match your search.</p>
        ) : (
          <div className="space-y-6">
            {filtered.map((s) => (
              <div key={s.sid}>
                <div className="mb-2 flex items-baseline gap-2">
                  <h3 className="font-bold text-base accent-text">{s.sid}</h3>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    last hit {new Date(s.last_at).toLocaleTimeString()}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {s.ranges.map((r) => (
                    <button
                      key={r}
                      disabled={busy === r}
                      onClick={() => handleAllocate(r, s.sid)}
                      className="rounded-md border border-border bg-background/40 px-3 py-1.5 font-mono text-xs hover:bg-primary/10 hover:border-primary disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {busy === r && <Loader2 className="size-3 animate-spin" />}
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
