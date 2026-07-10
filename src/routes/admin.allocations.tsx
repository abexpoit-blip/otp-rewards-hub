import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { adminListAllocationsFn, adminForceExpireAllocFn, adminVerifyCommissionsFn } from "@/lib/admin.functions";
import { Activity, X, Search, RefreshCw, AlertTriangle, Clock, CheckCircle2, XCircle, Hash, Calendar, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Pager } from "@/components/Pager";

const allocSearch = z.object({
  status: fallback(z.enum(["all", "pending", "success", "expired", "failed"]), "all").default("all"),
  range: fallback(z.enum(["all", "today", "7d", "30d"]), "all").default("all"),
  q: fallback(z.string(), "").default(""),
  page: fallback(z.number().int().min(1), 1).default(1),
  pageSize: fallback(z.enum(["25", "50", "100", "200"]), "50").default("50"),
});

export const Route = createFileRoute("/admin/allocations")({
  validateSearch: zodValidator(allocSearch),
  head: () => ({ meta: [{ title: "Admin · Allocations — Nexus X" }] }),
  component: () => (<Protected><AdminAllocations /></Protected>),
});

function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const ms = new Date(to).getTime() - now;
  if (ms <= 0) return <span className="text-muted-foreground">expired</span>;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, "0");
  const danger = ms < 60_000;
  return (
    <span className={`font-mono text-xs ${danger ? "text-destructive font-bold" : "text-foreground"}`}>
      {m}:{ss}
    </span>
  );
}

function AdminAllocations() {
  const { user, token } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate({ from: "/admin/allocations" });
  const search = Route.useSearch();
  const { status, range, q: searchQ, page, pageSize } = search;
  const limit = Number(pageSize);
  const offset = (page - 1) * limit;
  const [searchInput, setSearchInput] = useState(searchQ);
  useEffect(() => { setSearchInput(searchQ); }, [searchQ]);

  const callList = useServerFn(adminListAllocationsFn);
  const callExpire = useServerFn(adminForceExpireAllocFn);
  const callVerify = useServerFn(adminVerifyCommissionsFn);
  const [audit, setAudit] = useState<{ scanned: number; mismatched: number; rows: any[] } | null>(null);
  const [auditing, setAuditing] = useState(false);
  const runAudit = async () => {
    setAuditing(true);
    try {
      const r = await callVerify({ data: { token: token!, hours: 24 } });
      setAudit(r);
      if (r.mismatched === 0) toast.success(`✓ All ${r.scanned} commissions match (last 24h)`);
      else toast.warning(`${r.mismatched} of ${r.scanned} allocations mismatched`);
    } catch (e: any) { toast.error(e?.message || "Audit failed"); }
    finally { setAuditing(false); }
  };
  const isAdmin = !!user?.roles?.includes("admin");

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-allocs", status, range, searchQ, page, pageSize],
    queryFn: () => callList({ data: { token: token!, status, range, search: searchQ, limit, offset } }),
    enabled: !!token && isAdmin,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });

  const mut = useMutation({
    mutationFn: (id: string) => callExpire({ data: { token: token!, id } }),
    onSuccess: () => {
      toast.success("Allocation expired");
      qc.invalidateQueries({ queryKey: ["admin-allocs"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard-stats"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  const setSearch = (patch: Partial<typeof search>) =>
    navigate({ search: (prev: typeof search) => {
      // Reset to page 1 when filters change (unless caller set page explicitly)
      const filterChanged = ("status" in patch) || ("range" in patch) || ("q" in patch) || ("pageSize" in patch);
      const next = { ...prev, ...patch };
      if (filterChanged && !("page" in patch)) next.page = 1;
      return next;
    }});

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="glass-panel-strong p-12 text-center">
          <AlertTriangle className="mx-auto size-10 text-destructive" />
          <h2 className="mt-3 text-xl font-bold">Admin only</h2>
        </div>
      </AppShell>
    );
  }

  const tabs: Array<{ key: typeof status; label: string; Icon: any; tone: string }> = [
    { key: "all",     label: "All",     Icon: Hash,          tone: "text-foreground" },
    { key: "pending", label: "Pending", Icon: Clock,         tone: "text-[color:var(--color-warning)]" },
    { key: "success", label: "Success", Icon: CheckCircle2,  tone: "text-[color:var(--color-success)]" },
    { key: "failed",  label: "Failed",  Icon: XCircle,       tone: "text-destructive" },
  ];
  const ranges: Array<{ key: typeof range; label: string }> = [
    { key: "today", label: "Today" },
    { key: "7d",    label: "7 days" },
    { key: "30d",   label: "30 days" },
    { key: "all",   label: "All time" },
  ];

  const statusBadge: Record<string, string> = {
    pending: "bg-[color:color-mix(in_oklab,var(--color-warning)_15%,transparent)] text-[color:var(--color-warning)] ring-1 ring-[color:color-mix(in_oklab,var(--color-warning)_30%,transparent)]",
    success: "bg-[color:color-mix(in_oklab,var(--color-success)_15%,transparent)] text-[color:var(--color-success)] ring-1 ring-[color:color-mix(in_oklab,var(--color-success)_30%,transparent)]",
    expired: "bg-muted text-muted-foreground ring-1 ring-border",
    failed:  "bg-[color:color-mix(in_oklab,var(--color-destructive)_15%,transparent)] text-[color:var(--color-destructive)] ring-1 ring-[color:color-mix(in_oklab,var(--color-destructive)_30%,transparent)]",
  };

  return (
    <AppShell>
      <PageHeader
        icon={<Activity className="size-6" />}
        title="Allocations"
        subtitle="All numbers issued to users. Pending numbers auto-expire 20 minutes after issue."
      />

      <div className="glass-panel-strong mb-4 space-y-2 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1">
            {tabs.map(({ key, label, Icon, tone }) => (
              <button
                key={key}
                onClick={() => setSearch({ status: key })}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  status === key ? "bg-primary text-primary-foreground shadow-sm" : `hover:bg-muted ${tone}`
                }`}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={runAudit}
            disabled={auditing}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-60"
            title="Recompute commission = agent_rate − user_rate for the last 24h and flag mismatches"
          >
            <ShieldCheck className={`size-3.5 ${auditing ? "animate-pulse" : ""}`} />
            Verify commissions (24h)
          </button>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted"
          >
            <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-0.5">
            <Calendar className="ml-1.5 size-3.5 text-muted-foreground" />
            {ranges.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSearch({ range: key })}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  range === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); setSearch({ q: searchInput.trim() }); }}
            className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 min-w-[240px]"
          >
            <Search className="size-4 text-muted-foreground" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by email, number, or service id…  (press Enter)"
              className="flex-1 bg-transparent text-sm outline-none"
            />
            {searchQ && (
              <button
                type="button"
                onClick={() => { setSearchInput(""); setSearch({ q: "" }); }}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted"
              >
                <X className="size-3.5" />
              </button>
            )}
          </form>
        </div>
      </div>

      {error && (
        <div className="glass-panel-strong mb-4 p-4 text-sm text-destructive">
          Failed to load: {(error as Error).message}
        </div>
      )}

      {audit && (
        <div className={`glass-panel-strong mb-4 p-4 text-sm ${audit.mismatched > 0 ? "border border-destructive/40" : "border border-emerald-500/30"}`}>
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <ShieldCheck className="size-4" />
            Commission audit — last 24h
            <span className="ml-auto text-xs text-muted-foreground">
              Scanned {audit.scanned} · Mismatched {audit.mismatched}
            </span>
            <button onClick={() => setAudit(null)} className="rounded p-1 hover:bg-muted"><X className="size-3.5" /></button>
          </div>
          {audit.mismatched === 0 ? (
            <p className="text-xs text-emerald-600">✓ All commissions equal (agent_rate − user_rate).</p>
          ) : (
            <div className="max-h-64 overflow-auto rounded border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left">Number</th>
                    <th className="p-2 text-left">User (rate)</th>
                    <th className="p-2 text-left">Agent (rate)</th>
                    <th className="p-2 text-right">Stored</th>
                    <th className="p-2 text-right">Expected</th>
                    <th className="p-2 text-right">Diff</th>
                    <th className="p-2 text-left">Settled</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.rows.map((r) => (
                    <tr key={r.id} className="border-t border-border/40">
                      <td className="p-2 font-mono">{r.full_number}</td>
                      <td className="p-2">{r.user_email} <span className="text-muted-foreground">(৳{Number(r.user_rate).toFixed(2)})</span></td>
                      <td className="p-2">{r.agent_email || "—"} <span className="text-muted-foreground">{r.agent_rate ? `(৳${Number(r.agent_rate).toFixed(2)})` : ""}</span></td>
                      <td className="p-2 text-right font-mono">৳{r.stored_commission}</td>
                      <td className="p-2 text-right font-mono">{r.expected_commission != null ? `৳${r.expected_commission}` : "—"}</td>
                      <td className={`p-2 text-right font-mono font-bold ${Number(r.diff) > 0 ? "text-emerald-600" : "text-destructive"}`}>{Number(r.diff) > 0 ? "+" : ""}৳{r.diff}</td>
                      <td className="p-2 text-muted-foreground whitespace-nowrap">{r.settled_at ? new Date(r.settled_at).toLocaleString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="glass-panel-strong overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-3 text-left">Number</th>
              <th className="p-3 text-left">User</th>
              <th className="p-3 text-left">Agent</th>
              <th className="p-3 text-left">Service</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Expires</th>
              <th className="p-3 text-right">User pay</th>
              <th className="p-3 text-right">Agent pay</th>
              <th className="p-3 text-left">Created</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : !data || data.rows.length === 0 ? (
              <tr><td colSpan={10} className="p-10 text-center text-muted-foreground">No allocations match this filter.</td></tr>
            ) : data.rows.map((a) => {
              const userPay = Number(a.user_payout || a.payout_amount || 0);
              const agentPay = Number(a.agent_commission || 0);
              const expected = a.expected_commission != null ? Number(a.expected_commission) : null;
              const mismatch = a.status === "success" && !a.commission_ok;
              return (
              <tr key={a.id} className={`border-t border-border/40 transition-colors hover:bg-muted/30 ${mismatch ? "bg-destructive/5" : ""}`}>
                <td className="p-3 font-mono text-xs">{a.full_number}</td>
                <td className="p-3 text-xs text-muted-foreground">
                  <button
                    onClick={() => setSearch({ q: a.user_email, page: 1 })}
                    className="hover:underline"
                    title={`User rate: ৳${Number(a.user_rate).toFixed(4)}`}
                  >
                    {a.user_email}
                  </button>
                  <div className="text-[10px] text-muted-foreground/70">rate ৳{Number(a.user_rate).toFixed(2)}</div>
                </td>
                <td className="p-3 text-xs text-muted-foreground">
                  {a.agent_email ? (
                    <>
                      <span>{a.agent_email}</span>
                      <div className="text-[10px] text-muted-foreground/70">rate ৳{a.agent_rate ? Number(a.agent_rate).toFixed(2) : "—"}</div>
                    </>
                  ) : <span className="text-muted-foreground/60">—</span>}
                </td>
                <td className="p-3 text-xs">{a.sid || "—"}</td>
                <td className="p-3">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusBadge[a.status] || "bg-muted text-muted-foreground"}`}>
                    {a.status}
                  </span>
                </td>
                <td className="p-3">
                  {a.status === "pending"
                    ? <Countdown to={a.expires_at} />
                    : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="p-3 text-right font-mono text-xs">
                  {userPay > 0 ? <span className="text-emerald-600 font-semibold">৳{userPay.toFixed(4)}</span> : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="p-3 text-right font-mono text-xs">
                  {agentPay > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="text-violet-600 font-semibold">৳{agentPay.toFixed(4)}</span>
                      {mismatch && expected != null && (
                        <span
                          className="rounded bg-destructive/15 px-1 py-0.5 text-[9px] font-bold text-destructive"
                          title={`Expected ৳${expected.toFixed(4)} (agent_rate − user_rate)`}
                        >
                          ⚠ ≠ ৳{expected.toFixed(4)}
                        </span>
                      )}
                    </span>
                  ) : a.agent_id ? (
                    mismatch && expected != null ? (
                      <span className="rounded bg-destructive/15 px-1 py-0.5 text-[9px] font-bold text-destructive" title="Commission missing">
                        ⚠ expected ৳{expected.toFixed(4)}
                      </span>
                    ) : <span className="text-muted-foreground">৳0</span>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(a.created_at).toLocaleString()}
                </td>
                <td className="p-3 text-right">
                  {a.status === "pending" && (
                    <button
                      onClick={() => { if (confirm(`Force expire ${a.full_number}?`)) mut.mutate(a.id); }}
                      className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-2 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/10"
                    >
                      <X className="size-3.5" />
                      Expire
                    </button>
                  )}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
        {data && (
          <Pager
            page={page}
            pageSize={limit}
            total={data.total}
            shown={data.rows.length}
            onPage={(p) => setSearch({ page: p })}
            onPageSize={(s) => setSearch({ pageSize: s as any, page: 1 })}
          />
        )}
      </div>
    </AppShell>
  );
}
