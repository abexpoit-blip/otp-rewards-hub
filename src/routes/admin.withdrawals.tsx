import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { adminListWithdrawalsFn, adminUpdateWithdrawalFn } from "@/lib/admin.functions";
import { Wallet, Check, X, Banknote, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/withdrawals")({
  head: () => ({ meta: [{ title: "Admin · Withdrawals — Nexus SMS" }] }),
  component: () => (<Protected><AdminWithdrawals /></Protected>),
});

function AdminWithdrawals() {
  const { user, token } = useAuth();
  const qc = useQueryClient();
  const callList = useServerFn(adminListWithdrawalsFn);
  const callUpdate = useServerFn(adminUpdateWithdrawalFn);
  const isAdmin = user?.roles?.includes("admin");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-withdrawals"],
    queryFn: () => callList({ data: { token: token! } }),
    enabled: !!token && isAdmin,
    refetchInterval: 15000,
  });

  const mut = useMutation({
    mutationFn: (v: any) => callUpdate({ data: { token: token!, ...v } }),
    onSuccess: (r) => {
      toast.success(`Status: ${r.status}`);
      qc.invalidateQueries({ queryKey: ["admin-withdrawals"] });
    },
    onError: (e: any) => toast.error(e?.message || "Action failed"),
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

  return (
    <AppShell>
      <PageHeader icon={<Wallet className="size-6" />} title="Withdrawal Approval" subtitle="Pending first. Approving locks balance; rejecting refunds the user." />
      <div className="glass-panel-strong p-0 overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : !data?.length ? (
          <p className="p-12 text-center text-sm text-muted-foreground">No withdrawals.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground bg-background/30">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">User</th>
                  <th className="px-4 py-2">Amount</th>
                  <th className="px-4 py-2">Gateway</th>
                  <th className="px-4 py-2">Address</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">TX / Note</th>
                  <th className="px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.map((w) => (
                  <Row key={w.id} w={w} onAction={(v) => mut.mutate(v)} busy={mut.isPending} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Row({ w, onAction, busy }: { w: any; onAction: (v: any) => void; busy: boolean }) {
  const [tx, setTx] = useState(w.tx_id || "");
  const [note, setNote] = useState(w.admin_note || "");
  const pending = w.status === "pending";
  const approved = w.status === "approved";
  const closed = w.status === "paid" || w.status === "rejected";

  return (
    <tr className="border-t border-border align-top">
      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{new Date(w.created_at).toLocaleString()}</td>
      <td className="px-4 py-3">
        <div className="font-semibold">{w.user_name || "—"}</div>
        <div className="text-xs text-muted-foreground">{w.user_email}</div>
      </td>
      <td className="px-4 py-3 font-bold">৳{Number(w.amount).toFixed(2)}</td>
      <td className="px-4 py-3">{w.gateway}</td>
      <td className="px-4 py-3 font-mono text-xs break-all max-w-[180px]">{w.address}</td>
      <td className="px-4 py-3"><StatusBadge status={w.status} /></td>
      <td className="px-4 py-3">
        {closed ? (
          <div className="text-xs space-y-1">
            {w.tx_id && <div className="font-mono">TX: {w.tx_id}</div>}
            {w.admin_note && <div className="text-muted-foreground">{w.admin_note}</div>}
          </div>
        ) : (
          <div className="space-y-1">
            <input value={tx} onChange={(e) => setTx(e.target.value)} placeholder="TX id (optional)"
              className="w-full rounded border border-border bg-background/40 px-2 py-1 text-xs" />
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)"
              className="w-full rounded border border-border bg-background/40 px-2 py-1 text-xs" />
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          {pending && (
            <button disabled={busy} onClick={() => onAction({ id: w.id, action: "approve", tx_id: tx || null, admin_note: note || null })}
              className="rounded bg-blue-500/15 text-blue-700 px-2 py-1 text-xs font-bold hover:bg-blue-500/25 disabled:opacity-50 flex items-center gap-1">
              <Check className="size-3" /> Approve
            </button>
          )}
          {(pending || approved) && (
            <button disabled={busy} onClick={() => onAction({ id: w.id, action: "paid", tx_id: tx || null, admin_note: note || null })}
              className="rounded bg-emerald-500/15 text-emerald-700 px-2 py-1 text-xs font-bold hover:bg-emerald-500/25 disabled:opacity-50 flex items-center gap-1">
              <Banknote className="size-3" /> Mark Paid
            </button>
          )}
          {(pending || approved) && (
            <button disabled={busy} onClick={() => onAction({ id: w.id, action: "reject", admin_note: note || null })}
              className="rounded bg-destructive/15 text-destructive px-2 py-1 text-xs font-bold hover:bg-destructive/25 disabled:opacity-50 flex items-center gap-1">
              <X className="size-3" /> Reject (refund)
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-700",
    approved: "bg-blue-500/15 text-blue-700",
    paid: "bg-emerald-500/15 text-emerald-700",
    rejected: "bg-destructive/15 text-destructive",
  };
  return <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${map[status] || "bg-muted"}`}>{status}</span>;
}
