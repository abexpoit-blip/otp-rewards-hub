import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { adminListUsersFn, adminUserActionFn, type AdminUserRow } from "@/lib/admin.functions";
import {
  Users, Ban, CheckCircle2, Plus, Minus, ShieldCheck, ShieldOff, Search, AlertTriangle,
  Clock, LogOut, StickyNote,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Admin · Users — Nexus SMS" }] }),
  component: () => (<Protected><AdminUsers /></Protected>),
});

type ModalState =
  | { kind: "credit" | "debit"; user: AdminUserRow }
  | { kind: "suspend"; user: AdminUserRow }
  | { kind: "block"; user: AdminUserRow }
  | { kind: "notes"; user: AdminUserRow }
  | null;

function AdminUsers() {
  const { user, token } = useAuth();
  const qc = useQueryClient();
  const callList = useServerFn(adminListUsersFn);
  const callAction = useServerFn(adminUserActionFn);
  const isAdmin = user?.roles?.includes("admin");

  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [amount, setAmount] = useState("");
  const [days, setDays] = useState("1");
  const [note, setNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () => callList({ data: { token: token!, search } }),
    enabled: !!token && isAdmin,
  });

  const mut = useMutation({
    mutationFn: (v: any) => callAction({ data: { token: token!, ...v } }),
    onSuccess: () => {
      toast.success("Done");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setModal(null); setAmount(""); setDays("1"); setNote("");
    },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  if (!isAdmin) {
    return (<AppShell><div className="glass-panel-strong p-12 text-center"><AlertTriangle className="mx-auto size-10 text-destructive" /><h2 className="mt-3 text-xl font-bold">Admin only</h2></div></AppShell>);
  }

  const openModal = (m: NonNullable<ModalState>) => {
    setModal(m);
    if (m.kind === "notes") setNote(m.user.admin_notes || "");
    else if (m.kind === "block") setNote(m.user.ban_reason || "");
    else setNote("");
  };

  return (
    <AppShell>
      <PageHeader icon={<Users className="size-6" />} title="Users" subtitle="Manage user accounts, balance, ban/suspend, force-logout, notes." />

      <div className="glass-panel-strong p-3 mb-4 flex items-center gap-2">
        <Search className="size-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by email or name…" className="flex-1 bg-transparent text-sm outline-none" />
      </div>

      <div className="glass-panel-strong overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase">
            <tr>
              <th className="text-left p-3">User</th>
              <th className="text-left p-3">Status</th>
              <th className="text-right p-3">Balance</th>
              <th className="text-right p-3">Lifetime</th>
              <th className="text-right p-3">Allocs</th>
              <th className="text-left p-3">Roles</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
            ) : data?.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No users</td></tr>
            ) : data?.map((u) => {
              const suspended = u.banned_until && new Date(u.banned_until).getTime() > Date.now();
              return (
                <tr key={u.id} className="border-t border-border">
                  <td className="p-3">
                    <div className="font-medium">{u.email}</div>
                    {u.name && <div className="text-xs text-muted-foreground">{u.name}</div>}
                    {u.admin_notes && <div title={u.admin_notes} className="mt-1 text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/10 text-amber-700 rounded font-semibold"><StickyNote className="size-2.5" /> note</div>}
                  </td>
                  <td className="p-3">
                    {u.status === "blocked" ? (
                      <span className="text-xs font-bold rounded px-2 py-0.5 bg-rose-100 text-rose-700">blocked</span>
                    ) : suspended ? (
                      <span title={`Until ${new Date(u.banned_until!).toLocaleString()}`} className="text-xs font-bold rounded px-2 py-0.5 bg-amber-100 text-amber-700">suspended</span>
                    ) : (
                      <span className="text-xs font-bold rounded px-2 py-0.5 bg-emerald-100 text-emerald-700">active</span>
                    )}
                    {u.ban_reason && <div title={u.ban_reason} className="text-[10px] text-muted-foreground mt-1 line-clamp-1 max-w-[160px]">{u.ban_reason}</div>}
                  </td>
                  <td className="p-3 text-right font-mono">${Number(u.balance).toFixed(4)}</td>
                  <td className="p-3 text-right font-mono text-muted-foreground">${Number(u.lifetime_earning).toFixed(2)}</td>
                  <td className="p-3 text-right text-xs">{u.success_allocations}/{u.total_allocations}</td>
                  <td className="p-3 text-xs">{u.roles.length ? u.roles.join(", ") : <span className="text-muted-foreground">user</span>}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1 flex-wrap">
                      {u.status === "blocked" ? (
                        <button title="Unblock" onClick={() => mut.mutate({ user_id: u.id, action: "unblock" })} className="p-1.5 rounded hover:bg-emerald-50 text-emerald-700"><CheckCircle2 className="size-4" /></button>
                      ) : (
                        <button title="Block (permanent)" onClick={() => openModal({ kind: "block", user: u })} className="p-1.5 rounded hover:bg-rose-50 text-rose-700"><Ban className="size-4" /></button>
                      )}
                      {suspended ? (
                        <button title="Unsuspend" onClick={() => mut.mutate({ user_id: u.id, action: "unsuspend" })} className="p-1.5 rounded hover:bg-emerald-50 text-emerald-700"><CheckCircle2 className="size-4" /></button>
                      ) : (
                        <button title="Suspend (timed)" onClick={() => openModal({ kind: "suspend", user: u })} className="p-1.5 rounded hover:bg-amber-50 text-amber-700"><Clock className="size-4" /></button>
                      )}
                      <button title="Force logout" onClick={() => { if (confirm(`Force-logout ${u.email}? All sessions invalidated.`)) mut.mutate({ user_id: u.id, action: "force_logout" }); }} className="p-1.5 rounded hover:bg-sky-50 text-sky-700"><LogOut className="size-4" /></button>
                      <button title="Credit" onClick={() => openModal({ kind: "credit", user: u })} className="p-1.5 rounded hover:bg-emerald-50 text-emerald-700"><Plus className="size-4" /></button>
                      <button title="Debit" onClick={() => openModal({ kind: "debit", user: u })} className="p-1.5 rounded hover:bg-rose-50 text-rose-700"><Minus className="size-4" /></button>
                      <button title="Admin notes" onClick={() => openModal({ kind: "notes", user: u })} className="p-1.5 rounded hover:bg-accent text-amber-700"><StickyNote className="size-4" /></button>
                      {u.roles.includes("admin") ? (
                        <button title="Revoke admin" onClick={() => { if (confirm("Revoke admin from " + u.email + "?")) mut.mutate({ user_id: u.id, action: "revoke_admin" }); }} className="p-1.5 rounded hover:bg-accent"><ShieldOff className="size-4" /></button>
                      ) : (
                        <button title="Grant admin" onClick={() => { if (confirm("Grant admin to " + u.email + "?")) mut.mutate({ user_id: u.id, action: "grant_admin" }); }} className="p-1.5 rounded hover:bg-accent"><ShieldCheck className="size-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={() => setModal(null)}>
          <div className="glass-panel-strong p-6 w-[440px] max-w-full" onClick={(e) => e.stopPropagation()}>
            {(modal.kind === "credit" || modal.kind === "debit") && (<>
              <h3 className="font-bold text-lg mb-1 capitalize">{modal.kind} balance</h3>
              <p className="text-sm text-muted-foreground mb-4">{modal.user.email}</p>
              <input autoFocus type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (USD)" className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm mb-3" />
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional, shown in audit log)" className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm mb-3" />
              <div className="flex justify-end gap-2">
                <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg text-sm hover:bg-accent">Cancel</button>
                <button onClick={() => mut.mutate({ user_id: modal.user.id, action: modal.kind, amount: parseFloat(amount), note })} disabled={!amount || isNaN(parseFloat(amount))} className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-bold shadow-md shadow-primary/25 disabled:opacity-40">Confirm {modal.kind}</button>
              </div>
            </>)}

            {modal.kind === "suspend" && (<>
              <h3 className="font-bold text-lg mb-1">Suspend user</h3>
              <p className="text-sm text-muted-foreground mb-4">{modal.user.email}</p>
              <label className="block text-xs font-bold mb-1">Days</label>
              <input autoFocus type="number" min="1" max="3650" value={days} onChange={(e) => setDays(e.target.value)} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm mb-3" />
              <label className="block text-xs font-bold mb-1">Reason</label>
              <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why are you suspending this user?" className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm mb-3" />
              <div className="flex justify-end gap-2">
                <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg text-sm hover:bg-accent">Cancel</button>
                <button onClick={() => mut.mutate({ user_id: modal.user.id, action: "suspend", days: parseInt(days) || 1, note })} className="px-4 py-2 rounded-lg text-sm bg-amber-600 text-white font-bold shadow-md">Suspend</button>
              </div>
            </>)}

            {modal.kind === "block" && (<>
              <h3 className="font-bold text-lg mb-1 text-rose-700">Block user (permanent)</h3>
              <p className="text-sm text-muted-foreground mb-4">{modal.user.email}</p>
              <label className="block text-xs font-bold mb-1">Reason (shown to user)</label>
              <textarea autoFocus rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Violation of terms, suspicious activity…" className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm mb-3" />
              <div className="flex justify-end gap-2">
                <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg text-sm hover:bg-accent">Cancel</button>
                <button onClick={() => mut.mutate({ user_id: modal.user.id, action: "block", note })} className="px-4 py-2 rounded-lg text-sm bg-rose-600 text-white font-bold shadow-md">Block</button>
              </div>
            </>)}

            {modal.kind === "notes" && (<>
              <h3 className="font-bold text-lg mb-1">Admin notes</h3>
              <p className="text-sm text-muted-foreground mb-4">{modal.user.email} <span className="text-xs">(internal only, never shown to user)</span></p>
              <textarea autoFocus rows={6} value={note} onChange={(e) => setNote(e.target.value)} placeholder="VIP customer, suspicious IP, payment issue…" className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm mb-3" />
              <div className="flex justify-end gap-2">
                <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg text-sm hover:bg-accent">Cancel</button>
                <button onClick={() => mut.mutate({ user_id: modal.user.id, action: "set_notes", note })} className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-bold shadow-md shadow-primary/25">Save notes</button>
              </div>
            </>)}
          </div>
        </div>
      )}
    </AppShell>
  );
}
