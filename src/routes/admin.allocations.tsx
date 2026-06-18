import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { adminListAllocationsFn, adminForceExpireAllocFn } from "@/lib/admin.functions";
import { Activity, X, Search, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/allocations")({
  head: () => ({ meta: [{ title: "Admin · Allocations — Nexus SMS" }] }),
  component: () => (<Protected><AdminAllocations /></Protected>),
});

function AdminAllocations() {
  const { user, token } = useAuth();
  const qc = useQueryClient();
  const callList = useServerFn(adminListAllocationsFn);
  const callExpire = useServerFn(adminForceExpireAllocFn);
  const isAdmin = user?.roles?.includes("admin");

  const [status, setStatus] = useState<"all" | "pending" | "success" | "expired" | "failed">("all");
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-allocs", status, search],
    queryFn: () => callList({ data: { token: token!, status, search } }),
    enabled: !!token && isAdmin,
    refetchInterval: 10_000,
  });

  const mut = useMutation({
    mutationFn: (id: string) => callExpire({ data: { token: token!, id } }),
    onSuccess: () => { toast.success("Allocation expired"); qc.invalidateQueries({ queryKey: ["admin-allocs"] }); },
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

  const statusColor: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    success: "bg-emerald-100 text-emerald-700",
    expired: "bg-slate-200 text-slate-700",
    failed: "bg-rose-100 text-rose-700",
  };

  return (
    <AppShell>
      <PageHeader icon={<Activity className="size-6" />} title="Allocations" subtitle="All number allocations across users. Force expire pending ones to free up numbers." />

      <div className="glass-panel-strong p-3 mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {(["all", "pending", "success", "expired", "failed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize ${status === s ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground"}`}
            >{s}</button>
          ))}
        </div>
        <div className="flex-1 flex items-center gap-2 min-w-[200px]">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email, number, or sid…"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <button onClick={() => refetch()} className="rounded-md p-1.5 hover:bg-accent"><RefreshCw className="size-4" /></button>
      </div>

      <div className="glass-panel-strong overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase">
            <tr>
              <th className="text-left p-3">Number</th>
              <th className="text-left p-3">User</th>
              <th className="text-left p-3">Service</th>
              <th className="text-left p-3">Country</th>
              <th className="text-left p-3">Status</th>
              <th className="text-right p-3">Payout</th>
              <th className="text-left p-3">Created</th>
              <th className="text-right p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
            ) : data?.length === 0 ? (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No allocations</td></tr>
            ) : data?.map((a) => (
              <tr key={a.id} className="border-t border-border">
                <td className="p-3 font-mono">{a.full_number}</td>
                <td className="p-3 text-xs">{a.user_email}</td>
                <td className="p-3 text-xs">{a.sid || "—"}</td>
                <td className="p-3 text-xs">{a.country || "—"} {a.operator ? `· ${a.operator}` : ""}</td>
                <td className="p-3">
                  <span className={`text-[10px] font-bold rounded px-2 py-0.5 uppercase ${statusColor[a.status] || "bg-muted"}`}>{a.status}</span>
                </td>
                <td className="p-3 text-right font-mono text-xs">৳{Number(a.payout_amount).toFixed(4)}</td>
                <td className="p-3 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</td>
                <td className="p-3 text-right">
                  {a.status === "pending" && (
                    <button onClick={() => { if (confirm("Force expire " + a.full_number + "?")) mut.mutate(a.id); }} className="p-1.5 rounded hover:bg-rose-50 text-rose-700" title="Force expire">
                      <X className="size-4" />
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
