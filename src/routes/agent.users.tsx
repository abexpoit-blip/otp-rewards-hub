import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/AppShell";
import { AgentProtected } from "@/components/AgentProtected";
import { useAuth } from "@/lib/auth";
import {
  agentListUsersFn, agentApproveUserFn, agentBulkApproveFn,
  agentSetUserStatusFn, agentUserDetailsFn, agentSetUserOtpRateFn, type AgentUserRow,
} from "@/lib/agent.functions";
import { Users, Check, X, Search, Eye, Clock, Ban, ShieldCheck, CheckSquare, Crown, Coins } from "lucide-react";
import { PerfBadge } from "@/components/PerfBadge";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

export const Route = createFileRoute("/agent/users")({
  head: () => ({ meta: [{ title: "Agent · Users — Nexus X" }] }),
  component: () => (<AgentProtected><AgentUsers /></AgentProtected>),
});

const RATE_DEFAULT = "0.60";
const RATE_CAP = 0.75;

function AgentUsers() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const callList = useServerFn(agentListUsersFn);
  const callApprove = useServerFn(agentApproveUserFn);
  const callBulk = useServerFn(agentBulkApproveFn);
  const callStatus = useServerFn(agentSetUserStatusFn);
  const callDetails = useServerFn(agentUserDetailsFn);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all"|"pending"|"active"|"blocked">("all");
  const [openUser, setOpenUser] = useState<AgentUserRow | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // approve-with-rate modal (single)
  const [approveModal, setApproveModal] = useState<AgentUserRow | null>(null);
  const [approveRate, setApproveRate] = useState(RATE_DEFAULT);

  // bulk approve modal
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRate, setBulkRate] = useState(RATE_DEFAULT);

  // ban modal
  const [banModal, setBanModal] = useState<AgentUserRow | null>(null);
  const [banReason, setBanReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["agent-users", search, status],
    queryFn: () => callList({ data: { token: token!, search, status } }),
    enabled: !!token,
    refetchInterval: 15_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["agent-users"] });
    qc.invalidateQueries({ queryKey: ["agent-stats"] });
  };

  const approveMut = useMutation({
    mutationFn: (v: { user_id: string; action: "approve"|"reject"; otp_rate?: number }) =>
      callApprove({ data: { token: token!, ...v } }),
    onSuccess: (r) => {
      toast.success(r.status === "active" ? `Approved · ৳${(r as any).rate?.toFixed?.(2) ?? ""}/OTP` : "User rejected");
      setApproveModal(null); setApproveRate(RATE_DEFAULT);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  const bulkMut = useMutation({
    mutationFn: () => callBulk({ data: { token: token!, user_ids: [...selected], otp_rate: parseFloat(bulkRate) } }),
    onSuccess: (r) => {
      toast.success(`Approved ${r.approved} user(s) · ৳${parseFloat(bulkRate).toFixed(2)}/OTP`);
      setBulkOpen(false); setBulkRate(RATE_DEFAULT); setSelected(new Set());
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || "Bulk approve failed"),
  });

  const statusMut = useMutation({
    mutationFn: (v: { user_id: string; action: "ban"|"unban"; reason?: string }) =>
      callStatus({ data: { token: token!, ...v } }),
    onSuccess: (r) => {
      toast.success(r.status === "blocked" ? "User banned" : "User unbanned");
      setBanModal(null); setBanReason("");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  const details = useQuery({
    queryKey: ["agent-user-details", openUser?.id],
    queryFn: () => callDetails({ data: { token: token!, user_id: openUser!.id } }),
    enabled: !!openUser && !!token,
  });

  const pendingRows = useMemo(() => (data ?? []).filter((u) => u.status === "pending"), [data]);
  const allPendingSelected = pendingRows.length > 0 && pendingRows.every((u) => selected.has(u.id));
  const toggleAllPending = () => {
    const next = new Set(selected);
    if (allPendingSelected) pendingRows.forEach((u) => next.delete(u.id));
    else pendingRows.forEach((u) => next.add(u.id));
    setSelected(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  return (
    <AppShell>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
        <PageHeader icon={<Users className="size-6" />} title="My Users" subtitle="Approve signups under your agent email. You can ban/unban and set per-user OTP rate." />
        <Link to="/agent/top" className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-300/60 bg-gradient-to-r from-amber-100 to-yellow-50 px-3 py-1.5 text-xs font-bold text-amber-800 shadow-sm hover:shadow-md transition">
          <Crown className="size-3.5" /> Top performers
        </Link>
      </div>


      <div className="glass-panel-strong p-3 mb-4 flex items-center gap-2 flex-wrap">
        <Search className="size-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by email or name…" className="flex-1 min-w-[180px] bg-transparent text-sm outline-none" />
        <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="bg-background border border-border rounded-md px-2 py-1 text-xs">
          <option value="all">All status</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="blocked">Blocked / Banned</option>
        </select>
        {selected.size > 0 && (
          <button
            onClick={() => { setBulkRate(RATE_DEFAULT); setBulkOpen(true); }}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
          >
            <CheckSquare className="size-3.5" /> Bulk approve ({selected.size})
          </button>
        )}
      </div>

      <div className="glass-panel-strong overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase">
            <tr>
              <th className="p-3 w-8">
                <input
                  type="checkbox"
                  checked={allPendingSelected}
                  onChange={toggleAllPending}
                  disabled={pendingRows.length === 0}
                  title="Select all pending"
                />
              </th>
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
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
            ) : !data?.length ? (
              <tr><td colSpan={8} className="p-12 text-center text-muted-foreground">No users yet. Share your agent email so users can sign up.</td></tr>
            ) : data.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="p-3">
                  {u.status === "pending" ? (
                    <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleOne(u.id)} />
                  ) : null}
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{u.email}</span>
                    <PerfBadge count={u.success_allocations} size="xs" />
                  </div>
                  {u.name && <div className="text-xs text-muted-foreground">{u.name}</div>}
                </td>

                <td className="p-3">
                  {u.status === "pending" ? (
                    <span className="text-xs font-bold rounded px-2 py-0.5 bg-amber-100 text-amber-700 inline-flex items-center gap-1"><Clock className="size-3" /> pending</span>
                  ) : u.status === "blocked" ? (
                    <span className="text-xs font-bold rounded px-2 py-0.5 bg-rose-100 text-rose-700">banned</span>
                  ) : (
                    <span className="text-xs font-bold rounded px-2 py-0.5 bg-emerald-100 text-emerald-700">active</span>
                  )}
                </td>
                <td className="p-3 text-right font-mono">৳{Number(u.balance).toFixed(2)}</td>
                <td className="p-3 text-right font-mono text-muted-foreground">৳{Number(u.lifetime_earning).toFixed(2)}</td>
                <td className="p-3 text-right font-mono text-xs">৳{Number(u.otp_rate).toFixed(2)}</td>
                <td className="p-3 text-right text-xs">{u.success_allocations}/{u.total_allocations}</td>
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-1.5 flex-wrap">
                    {u.status === "pending" ? (
                      <>
                        <button onClick={() => { setApproveRate(RATE_DEFAULT); setApproveModal(u); }} className="rounded bg-emerald-500/15 text-emerald-700 px-2 py-1 text-xs font-bold hover:bg-emerald-500/25 inline-flex items-center gap-1"><Check className="size-3" /> Approve</button>
                        <button onClick={() => { if (confirm(`Reject ${u.email}? The signup will be deleted.`)) approveMut.mutate({ user_id: u.id, action: "reject" }); }} className="rounded bg-rose-500/15 text-rose-700 px-2 py-1 text-xs font-bold hover:bg-rose-500/25 inline-flex items-center gap-1"><X className="size-3" /> Reject</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setOpenUser(u)} className="rounded border border-border px-2 py-1 text-xs font-medium hover:bg-muted inline-flex items-center gap-1"><Eye className="size-3" /> View</button>
                        {u.status === "blocked" ? (
                          <button onClick={() => { if (confirm(`Unban ${u.email}?`)) statusMut.mutate({ user_id: u.id, action: "unban" }); }} className="rounded bg-emerald-500/15 text-emerald-700 px-2 py-1 text-xs font-bold hover:bg-emerald-500/25 inline-flex items-center gap-1"><ShieldCheck className="size-3" /> Unban</button>
                        ) : (
                          <button onClick={() => { setBanReason(""); setBanModal(u); }} className="rounded bg-rose-500/15 text-rose-700 px-2 py-1 text-xs font-bold hover:bg-rose-500/25 inline-flex items-center gap-1"><Ban className="size-3" /> Ban</button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Approve single (asks rate) */}
      {approveModal && (
        <Modal onClose={() => setApproveModal(null)}>
          <h3 className="font-bold text-lg mb-1">Approve user</h3>
          <p className="text-sm text-muted-foreground mb-4">{approveModal.email}</p>
          <label className="block text-xs font-bold mb-1">OTP rate (BDT per success) — max ৳{RATE_CAP.toFixed(2)}</label>
          <input
            autoFocus type="number" step="0.01" min="0" max={RATE_CAP}
            value={approveRate} onChange={(e) => setApproveRate(e.target.value)}
            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm mb-3"
          />
          <p className="text-[11px] text-muted-foreground mb-3">Default ৳{RATE_DEFAULT}. This rate applies to every OTP this user delivers.</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setApproveModal(null)} className="px-4 py-2 rounded-lg text-sm hover:bg-accent">Cancel</button>
            <button
              disabled={approveMut.isPending || !approveRate || isNaN(parseFloat(approveRate)) || parseFloat(approveRate) > RATE_CAP}
              onClick={() => approveMut.mutate({ user_id: approveModal.id, action: "approve", otp_rate: parseFloat(approveRate) })}
              className="px-4 py-2 rounded-lg text-sm bg-emerald-600 text-white font-bold shadow-md disabled:opacity-40"
            >
              {approveMut.isPending ? "Approving…" : "Approve"}
            </button>
          </div>
        </Modal>
      )}

      {/* Bulk approve */}
      {bulkOpen && (
        <Modal onClose={() => setBulkOpen(false)}>
          <h3 className="font-bold text-lg mb-1">Bulk approve</h3>
          <p className="text-sm text-muted-foreground mb-4">{selected.size} pending user(s) selected</p>
          <label className="block text-xs font-bold mb-1">OTP rate for all — max ৳{RATE_CAP.toFixed(2)}</label>
          <input
            autoFocus type="number" step="0.01" min="0" max={RATE_CAP}
            value={bulkRate} onChange={(e) => setBulkRate(e.target.value)}
            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm mb-3"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setBulkOpen(false)} className="px-4 py-2 rounded-lg text-sm hover:bg-accent">Cancel</button>
            <button
              disabled={bulkMut.isPending || !bulkRate || isNaN(parseFloat(bulkRate)) || parseFloat(bulkRate) > RATE_CAP}
              onClick={() => bulkMut.mutate()}
              className="px-4 py-2 rounded-lg text-sm bg-emerald-600 text-white font-bold shadow-md disabled:opacity-40"
            >
              {bulkMut.isPending ? "Approving…" : `Approve ${selected.size}`}
            </button>
          </div>
        </Modal>
      )}

      {/* Ban */}
      {banModal && (
        <Modal onClose={() => setBanModal(null)}>
          <h3 className="font-bold text-lg mb-1 text-rose-700">Ban user</h3>
          <p className="text-sm text-muted-foreground mb-4">{banModal.email}</p>
          <label className="block text-xs font-bold mb-1">Reason (shown to user on login)</label>
          <textarea autoFocus rows={3} value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="Violation, fraud, abuse…" className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm mb-3" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setBanModal(null)} className="px-4 py-2 rounded-lg text-sm hover:bg-accent">Cancel</button>
            <button
              disabled={statusMut.isPending}
              onClick={() => statusMut.mutate({ user_id: banModal.id, action: "ban", reason: banReason || undefined })}
              className="px-4 py-2 rounded-lg text-sm bg-rose-600 text-white font-bold shadow-md disabled:opacity-40"
            >
              {statusMut.isPending ? "Banning…" : "Confirm ban"}
            </button>
          </div>
        </Modal>
      )}

      {/* Details */}
      {openUser && (
        <Modal onClose={() => setOpenUser(null)} wide>
          <h3 className="font-bold text-lg">{openUser.email}</h3>
          <p className="text-xs text-muted-foreground mb-4">Monitor only — OTP bodies are hidden for privacy.</p>
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
        </Modal>
      )}
    </AppShell>
  );
}

function Modal({ children, onClose, wide = false }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className={`glass-panel-strong p-6 ${wide ? "w-[640px]" : "w-[440px]"} max-w-full max-h-[85vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
