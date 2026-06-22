import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/AppShell";
import { AgentProtected } from "@/components/AgentProtected";
import { useAuth } from "@/lib/auth";
import { agentListWithdrawalsFn, agentUpdateWithdrawalFn } from "@/lib/agent.functions";
import { Wallet, Check, X, Banknote } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/agent/withdrawals")({
  head: () => ({ meta: [{ title: "Agent · Withdrawals — Nexus X" }] }),
  component: () => (<AgentProtected><AgentWithdrawals /></AgentProtected>),
});

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-700",
    approved: "bg-blue-500/15 text-blue-700",
    paid: "bg-emerald-500/15 text-emerald-700",
    rejected: "bg-destructive/15 text-destructive",
  };
  return <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${map[status] || "bg-muted"}`}>{status}</span>;
}

function AgentWithdrawals() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const callList = useServerFn(agentListWithdrawalsFn);
  const callUpdate = useServerFn(agentUpdateWithdrawalFn);
  const { data, isLoading } = useQuery({
    queryKey: ["agent-withdrawals"],
    queryFn: () => callList({ data: { token: token! } }),
    enabled: !!token,
    refetchInterval: 15_000,
  });
  const mut = useMutation({
    mutationFn: (v: any) => callUpdate({ data: { token: token!, ...v } }),
    onSuccess: (r) => { toast.success(`Status: ${r.status}`); qc.invalidateQueries({ queryKey: ["agent-withdrawals"] }); },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  return (
    <AppShell>
      <PageHeader icon={<Wallet className="size-6" />} title="Withdrawal Approval" subtitle="Pending first. Approving locks the balance; rejecting refunds the user." />
      <div className="glass-panel-strong overflow-x-auto">
        {isLoading ? (<p className="p-6 text-sm text-muted-foreground">Loading…</p>) : !data?.length ? (
          <p className="p-12 text-center text-sm text-muted-foreground">No withdrawals from your users yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase">
              <tr><th className="text-left p-3">Date</th><th className="text-left p-3">User</th><th className="text-left p-3">Amount</th><th className="text-left p-3">Gateway</th><th className="text-left p-3">Address</th><th className="text-left p-3">Status</th><th className="text-left p-3">Actions</th></tr>
            </thead>
            <tbody>
              {data.map((w: any) => <Row key={w.id} w={w} onAction={(v) => mut.mutate(v)} busy={mut.isPending} />)}
            </tbody>
          </table>
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
      <td className="px-4 py-3"><div className="font-semibold">{w.user_name || "—"}</div><div className="text-xs text-muted-foreground">{w.user_email}</div></td>
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
          <div className="space-y-1 mb-1">
            <input value={tx} onChange={(e) => setTx(e.target.value)} placeholder="TX id (optional)" className="w-full rounded border border-border bg-background/40 px-2 py-1 text-xs" />
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="w-full rounded border border-border bg-background/40 px-2 py-1 text-xs" />
            <div className="flex flex-col gap-1">
              {pending && <button disabled={busy} onClick={() => onAction({ id: w.id, action: "approve", tx_id: tx || null, admin_note: note || null })} className="rounded bg-blue-500/15 text-blue-700 px-2 py-1 text-xs font-bold inline-flex items-center gap-1"><Check className="size-3" /> Approve</button>}
              {(pending || approved) && <button disabled={busy} onClick={() => onAction({ id: w.id, action: "paid", tx_id: tx || null, admin_note: note || null })} className="rounded bg-emerald-500/15 text-emerald-700 px-2 py-1 text-xs font-bold inline-flex items-center gap-1"><Banknote className="size-3" /> Mark Paid</button>}
              {(pending || approved) && <button disabled={busy} onClick={() => onAction({ id: w.id, action: "reject", admin_note: note || null })} className="rounded bg-destructive/15 text-destructive px-2 py-1 text-xs font-bold inline-flex items-center gap-1"><X className="size-3" /> Reject (refund)</button>}
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}
