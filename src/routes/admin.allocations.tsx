import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { adminListAllocationsFn, adminForceExpireAllocFn } from "@/lib/admin.functions";
import { Activity, X, Search, RefreshCw, AlertTriangle, Clock, CheckCircle2, XCircle, Hash } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/allocations")({
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
  const callList = useServerFn(adminListAllocationsFn);
  const callExpire = useServerFn(adminForceExpireAllocFn);
  const isAdmin = !!user?.roles?.includes("admin");

  const [status, setStatus] = useState<"all" | "pending" | "success" | "expired" | "failed">("all");
  const [search, setSearch] = useState("");

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-allocs", status, search],
    queryFn: () => callList({ data: { token: token!, status, search } }),
    enabled: !!token && isAdmin,
    refetchInterval: 10_000,
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
    { key: "expired", label: "Expired", Icon: XCircle,       tone: "text-muted-foreground" },
    { key: "failed",  label: "Failed",  Icon: AlertTriangle, tone: "text-destructive" },
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
        subtitle="All number allocations across users. Pending numbers auto-expire 20 minutes after they're issued."
      />

      <div className="glass-panel-strong mb-4 flex flex-wrap items-center gap-2 p-3">
        <div className="flex flex-wrap gap-1">
          {tabs.map(({ key, label, Icon, tone }) => (
            <button
              key={key}
              onClick={() => setStatus(key)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                status === key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : `hover:bg-muted ${tone}`
              }`}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 min-w-[220px]">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email, number, or service id…"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted"
          title="Refresh"
        >
          <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="glass-panel-strong mb-4 p-4 text-sm text-destructive">
          Failed to load allocations: {(error as Error).message}
        </div>
      )}

      <div className="glass-panel-strong overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-3 text-left">Number</th>
              <th className="p-3 text-left">User</th>
              <th className="p-3 text-left">Service</th>
              <th className="p-3 text-left">Range</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Expires</th>
              <th className="p-3 text-right">Payout</th>
              <th className="p-3 text-left">Created</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : !data || data.length === 0 ? (
              <tr><td colSpan={9} className="p-10 text-center text-muted-foreground">No allocations match this filter.</td></tr>
            ) : data.map((a) => (
              <tr key={a.id} className="border-t border-border/40 transition-colors hover:bg-muted/30">
                <td className="p-3 font-mono text-xs">{a.full_number}</td>
                <td className="p-3 text-xs text-muted-foreground">{a.user_email}</td>
                <td className="p-3 text-xs">{a.sid || "—"}</td>
                <td className="p-3 text-xs">
                  {a.country || "—"}
                  {a.operator ? <span className="text-muted-foreground"> · {a.operator}</span> : ""}
                </td>
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
                  {Number(a.payout_amount) > 0 ? `৳${Number(a.payout_amount).toFixed(4)}` : "—"}
                </td>
                <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(a.created_at).toLocaleString()}
                </td>
                <td className="p-3 text-right">
                  {a.status === "pending" && (
                    <button
                      onClick={() => { if (confirm(`Force expire ${a.full_number}?`)) mut.mutate(a.id); }}
                      className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-2 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/10"
                      title="Force expire"
                    >
                      <X className="size-3.5" />
                      Expire
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
