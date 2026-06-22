import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/AppShell";
import { AgentProtected } from "@/components/AgentProtected";
import { useAuth } from "@/lib/auth";
import { agentListUsersFn, agentApproveUserFn, agentUserDetailsFn, type AgentUserRow } from "@/lib/agent.functions";
import { Users, Check, X, Search, Eye, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/agent/users")({
  head: () => ({ meta: [{ title: "Agent · Users — Nexus X" }] }),
  component: () => (<AgentProtected><AgentUsers /></AgentProtected>),
});

function AgentUsers() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const callList = useServerFn(agentListUsersFn);
  const callApprove = useServerFn(agentApproveUserFn);
  const callDetails = useServerFn(agentUserDetailsFn);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all"|"pending"|"active"|"blocked">("all");
  const [openUser, setOpenUser] = useState<AgentUserRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["agent-users", search, status],
    queryFn: () => callList({ data: { token: token!, search, status } }),
    enabled: !!token,
    refetchInterval: 15_000,
  });

  const approve = useMutation({
    mutationFn: (v: { user_id: string; action: "approve"|"reject" }) => callApprove({ data: { token: token!, ...v } }),
    onSuccess: (r) => { toast.success(r.status === "active" ? "User approved" : "User rejected"); qc.invalidateQueries({ queryKey: ["agent-users"] }); qc.invalidateQueries({ queryKey: ["agent-stats"] }); },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  const details = useQuery({
    queryKey: ["agent-user-details", openUser?.id],
    queryFn: () => callDetails({ data: { token: token!, user_id: openUser!.id } }),
    enabled: !!openUser && !!token,
  });

  return (
    <AppShell>
      <PageHeader icon={<Users className="size-6" />} title="My Users" subtitle="Approve new signups under your agent email. You can monitor activity but cannot change accounts." />

      <div className="glass-panel-strong p-3 mb-4 flex items-center gap-2 flex-wrap">
        <Search className="size-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by email or name…" className="flex-1 min-w-[180px] bg-transparent text-sm outline-none" />
        <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="bg-background border border-border rounded-md px-2 py-1 text-xs">
          <option value="all">All status</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="blocked">Blocked</option>
        </select>
      </div>

      <div className="glass-panel-strong overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase">
            <tr>
              <th className="text-left p-3">User</th>
              <th className="text-left p-3">Status</th>
              <th className="text-right p-3">Balance</th>
              <th className="text-right p-3">Lifetime</th>
              <th className="text-right p-3">Rate</th>
              <th className="text-right p-3">Allocs</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
            ) : !data?.length ? (
              <tr><td colSpan={7} className="p-12 text-center text-muted-foreground">No users yet. Share your agent email so users can sign up.</td></tr>
            ) : data.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="p-3">
                  <div className="font-medium">{u.email}</div>
                  {u.name && <div className="text-xs text-muted-foreground">{u.name}</div>}
                </td>
                <td className="p-3">
                  {u.status === "pending" ? (
                    <span className="text-xs font-bold rounded px-2 py-0.5 bg-amber-100 text-amber-700 inline-flex items-center gap-1"><Clock className="size-3" /> pending</span>
                  ) : u.status === "blocked" ? (
                    <span className="text-xs font-bold rounded px-2 py-0.5 bg-rose-100 text-rose-700">blocked</span>
                  ) : (
                    <span className="text-xs font-bold rounded px-2 py-0.5 bg-emerald-100 text-emerald-700">active</span>
                  )}
                </td>
                <td className="p-3 text-right font-mono">৳{Number(u.balance).toFixed(2)}</td>
                <td className="p-3 text-right font-mono text-muted-foreground">৳{Number(u.lifetime_earning).toFixed(2)}</td>
                <td className="p-3 text-right font-mono text-xs">৳{Number(u.otp_rate).toFixed(2)}</td>
                <td className="p-3 text-right text-xs">{u.success_allocations}/{u.total_allocations}</td>
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-1.5">
                    {u.status === "pending" ? (
                      <>
                        <button onClick={() => { if (confirm(`Approve ${u.email}?`)) approve.mutate({ user_id: u.id, action: "approve" }); }} className="rounded bg-emerald-500/15 text-emerald-700 px-2 py-1 text-xs font-bold hover:bg-emerald-500/25 inline-flex items-center gap-1"><Check className="size-3" /> Approve</button>
                        <button onClick={() => { if (confirm(`Reject ${u.email}? The signup will be deleted.`)) approve.mutate({ user_id: u.id, action: "reject" }); }} className="rounded bg-rose-500/15 text-rose-700 px-2 py-1 text-xs font-bold hover:bg-rose-500/25 inline-flex items-center gap-1"><X className="size-3" /> Reject</button>
                      </>
                    ) : (
                      <button onClick={() => setOpenUser(u)} className="rounded border border-border px-2 py-1 text-xs font-medium hover:bg-muted inline-flex items-center gap-1"><Eye className="size-3" /> View</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openUser && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setOpenUser(null)}>
          <div className="glass-panel-strong p-6 w-[640px] max-w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg">{openUser.email}</h3>
            <p className="text-xs text-muted-foreground mb-4">Monitor only — read access.</p>
            {details.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : details.data && (
              <>
                <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
                  <div className="rounded-lg border border-border p-3"><div className="text-muted-foreground">Balance</div><div className="font-bold text-base">৳{Number(details.data.user.balance).toFixed(2)}</div></div>
                  <div className="rounded-lg border border-border p-3"><div className="text-muted-foreground">Lifetime</div><div className="font-bold text-base">৳{Number(details.data.user.lifetime_earning).toFixed(2)}</div></div>
                  <div className="rounded-lg border border-border p-3"><div className="text-muted-foreground">Rate</div><div className="font-bold text-base">৳{Number(details.data.user.otp_rate).toFixed(2)}</div></div>
                </div>
                <h4 className="font-bold text-sm mb-2">Recent allocations</h4>
                <div className="rounded-lg border border-border overflow-hidden mb-4">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 text-[10px] uppercase"><tr><th className="p-2 text-left">Number</th><th className="p-2 text-left">Status</th><th className="p-2 text-right">Payout</th><th className="p-2 text-right">When</th></tr></thead>
                    <tbody>
                      {details.data.allocations.slice(0,10).map((a: any) => (
                        <tr key={a.id} className="border-t border-border"><td className="p-2 font-mono">{a.full_number || "—"}</td><td className="p-2">{a.status}</td><td className="p-2 text-right font-mono">৳{Number(a.payout_amount).toFixed(2)}</td><td className="p-2 text-right text-muted-foreground">{new Date(a.created_at).toLocaleString()}</td></tr>
                      ))}
                      {!details.data.allocations.length && <tr><td colSpan={4} className="p-3 text-center text-muted-foreground">No allocations yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
                <h4 className="font-bold text-sm mb-2">Recent OTPs (codes hidden)</h4>
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 text-[10px] uppercase"><tr><th className="p-2 text-left">Number</th><th className="p-2 text-left">Body</th><th className="p-2 text-right">When</th></tr></thead>
                    <tbody>
                      {details.data.otps.slice(0,15).map((o: any) => (
                        <tr key={o.id} className="border-t border-border"><td className="p-2 font-mono">{o.number}</td><td className="p-2 text-muted-foreground italic">{o.body_masked}</td><td className="p-2 text-right text-muted-foreground">{new Date(o.received_at).toLocaleString()}</td></tr>
                      ))}
                      {!details.data.otps.length && <tr><td colSpan={3} className="p-3 text-center text-muted-foreground">No OTPs yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <div className="mt-4 text-right">
              <button onClick={() => setOpenUser(null)} className="px-4 py-2 rounded-lg text-sm hover:bg-accent">Close</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
