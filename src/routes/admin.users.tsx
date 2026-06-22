import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Pager } from "@/components/Pager";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import {
  adminListUsersFn, adminUserActionFn, adminDeleteUserFn,
  adminImpersonateFn, adminCleanupInactiveFn, type AdminUserRow,
} from "@/lib/admin.functions";
import {
  Users, Ban, CheckCircle2, Plus, Minus, ShieldCheck, ShieldOff, Search, AlertTriangle,
  Clock, LogOut, StickyNote, Trash2, UserCog, Sparkles, MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Admin · Users — Nexus SMS" }] }),
  component: () => (<Protected><AdminUsers /></Protected>),
});

type ModalState =
  | { kind: "credit" | "debit"; user: AdminUserRow }
  | { kind: "suspend"; user: AdminUserRow }
  | { kind: "block"; user: AdminUserRow }
  | { kind: "notes"; user: AdminUserRow }
  | { kind: "delete"; user: AdminUserRow }
  | null;

function AdminUsers() {
  const { user, token, enterImpersonation } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const callList = useServerFn(adminListUsersFn);
  const callAction = useServerFn(adminUserActionFn);
  const callDelete = useServerFn(adminDeleteUserFn);
  const callImpersonate = useServerFn(adminImpersonateFn);
  const callCleanup = useServerFn(adminCleanupInactiveFn);
  const isAdmin = user?.roles?.includes("admin");

  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [amount, setAmount] = useState("");
  const [days, setDays] = useState("1");
  const [note, setNote] = useState("");
  const [deleteEmail, setDeleteEmail] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  useEffect(() => { setPage(1); }, [search, pageSize]);

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

  const delMut = useMutation({
    mutationFn: () =>
      callDelete({ data: { token: token!, user_id: (modal as any).user.id, confirm_email: deleteEmail.trim() } }),
    onSuccess: (r) => {
      toast.success(`Deleted ${r.email}`);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setModal(null); setDeleteEmail("");
    },
    onError: (e: any) => toast.error(e?.message || "Delete failed"),
  });

  const impMut = useMutation({
    mutationFn: (uid: string) => callImpersonate({ data: { token: token!, user_id: uid } }),
    onSuccess: (r) => {
      enterImpersonation(r.token, r.user);
      toast.success(`Now viewing as ${r.user.email}`);
      navigate({ to: "/" });
    },
    onError: (e: any) => toast.error(e?.message || "Impersonation failed"),
  });

  const cleanupMut = useMutation({
    mutationFn: () => callCleanup({ data: { token: token!, days: 14 } }),
    onSuccess: (r) => {
      toast.success(`Cleanup done · ${r.deleted} inactive account(s) removed (${r.days}d)`);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e?.message || "Cleanup failed"),
  });

  if (!isAdmin) {
    return (<AppShell><div className="glass-panel-strong p-12 text-center"><AlertTriangle className="mx-auto size-10 text-destructive" /><h2 className="mt-3 text-xl font-bold">Admin only</h2></div></AppShell>);
  }

  const openModal = (m: NonNullable<ModalState>) => {
    setModal(m);
    if (m.kind === "notes") setNote(m.user.admin_notes || "");
    else if (m.kind === "block") setNote(m.user.ban_reason || "");
    else if (m.kind === "delete") setDeleteEmail("");
    else setNote("");
  };


  const total = data?.length ?? 0;
  const pagedData = useMemo(() => {
    if (!data) return [];
    const start = (page - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, page, pageSize]);

  return (
    <AppShell>
      <PageHeader icon={<Users className="size-6" />} title="Users" subtitle="Manage user accounts, balance, ban/suspend, force-logout, notes." />

      <div className="mb-4 rounded-xl border border-amber-400/30 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-rose-500/10 p-3 flex items-center gap-3">
        <Sparkles className="size-5 text-amber-600 shrink-0" />
        <div className="text-xs flex-1">
          <span className="font-bold">Inactivity policy:</span> accounts with no login for <b>14 days</b> are auto-deleted by the nightly cron
          (admins, users with balance, or pending withdrawals are skipped). Run it now if needed.
        </div>
        <button
          onClick={() => { if (confirm("Run inactive-user cleanup (14 days) now?")) cleanupMut.mutate(); }}
          disabled={cleanupMut.isPending}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow disabled:opacity-50"
        >
          <Trash2 className="size-3.5" /> {cleanupMut.isPending ? "Running…" : "Run cleanup"}
        </button>
      </div>

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
            ) : total === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No users</td></tr>
            ) : pagedData.map((u) => {
              const suspended = u.banned_until && new Date(u.banned_until).getTime() > Date.now();
              const lastLoginMs = u.last_login_at ? new Date(u.last_login_at).getTime() : new Date(u.created_at).getTime();
              const daysIdle = Math.floor((Date.now() - lastLoginMs) / 86400000);
              const inactiveWarn = daysIdle >= 10;
              return (
                <tr key={u.id} className="border-t border-border">
                  <td className="p-3">
                    <div className="font-medium">{u.email}</div>
                    {u.name && <div className="text-xs text-muted-foreground">{u.name}</div>}
                    <div className="mt-1 flex items-center gap-1 flex-wrap">
                      {u.admin_notes && <span title={u.admin_notes} className="text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/10 text-amber-700 rounded font-semibold"><StickyNote className="size-2.5" /> note</span>}
                      {inactiveWarn && (
                        <span
                          title={`No login for ${daysIdle} days. Auto-delete at 14 days (if balance ≤ 0 and no pending withdrawals).`}
                          className={`text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold ${daysIdle >= 14 ? "bg-rose-500/15 text-rose-700" : "bg-orange-500/15 text-orange-700"}`}
                        >
                          <Clock className="size-2.5" /> idle {daysIdle}d
                        </span>
                      )}
                    </div>
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
                  <td className="p-3 text-right font-mono">৳{Number(u.balance).toFixed(4)}</td>
                  <td className="p-3 text-right font-mono text-muted-foreground">৳{Number(u.lifetime_earning).toFixed(2)}</td>
                  <td className="p-3 text-right text-xs">{u.success_allocations}/{u.total_allocations}</td>
                  <td className="p-3 text-xs">{u.roles.length ? u.roles.join(", ") : <span className="text-muted-foreground">user</span>}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 gap-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/60"
                        onClick={() => { if (confirm(`Sign in as ${u.email}? You can exit back to your admin account anytime.`)) impMut.mutate(u.id); }}
                      >
                        <UserCog className="size-3.5" /> Login as user
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline" className="h-8 gap-1.5">
                            <MoreHorizontal className="size-3.5" /> Actions
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel className="text-xs">Status</DropdownMenuLabel>
                          {u.status === "blocked" ? (
                            <DropdownMenuItem onClick={() => mut.mutate({ user_id: u.id, action: "unblock" })} className="text-emerald-700">
                              <CheckCircle2 className="size-4" /> Unblock user
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => openModal({ kind: "block", user: u })} className="text-rose-700">
                              <Ban className="size-4" /> Block (permanent)
                            </DropdownMenuItem>
                          )}
                          {suspended ? (
                            <DropdownMenuItem onClick={() => mut.mutate({ user_id: u.id, action: "unsuspend" })} className="text-emerald-700">
                              <CheckCircle2 className="size-4" /> Unsuspend
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => openModal({ kind: "suspend", user: u })} className="text-amber-700">
                              <Clock className="size-4" /> Suspend (timed)
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => { if (confirm(`Force-logout ${u.email}? All sessions invalidated.`)) mut.mutate({ user_id: u.id, action: "force_logout" }); }}
                            className="text-sky-700"
                          >
                            <LogOut className="size-4" /> Force logout
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />
                          <DropdownMenuLabel className="text-xs">Balance</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => openModal({ kind: "credit", user: u })} className="text-emerald-700">
                            <Plus className="size-4" /> Credit balance
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openModal({ kind: "debit", user: u })} className="text-rose-700">
                            <Minus className="size-4" /> Debit balance
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />
                          <DropdownMenuLabel className="text-xs">Admin</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => openModal({ kind: "notes", user: u })} className="text-amber-700">
                            <StickyNote className="size-4" /> Admin notes
                          </DropdownMenuItem>
                          {u.roles.includes("admin") ? (
                            <DropdownMenuItem onClick={() => { if (confirm("Revoke admin from " + u.email + "?")) mut.mutate({ user_id: u.id, action: "revoke_admin" }); }}>
                              <ShieldOff className="size-4" /> Revoke admin
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => { if (confirm("Grant admin to " + u.email + "?")) mut.mutate({ user_id: u.id, action: "grant_admin" }); }}>
                              <ShieldCheck className="size-4" /> Grant admin
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openModal({ kind: "delete", user: u })} className="text-rose-700 focus:bg-rose-50 focus:text-rose-700">
                            <Trash2 className="size-4" /> Delete user…
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {total > 0 && (
          <Pager
            page={page}
            pageSize={pageSize}
            total={total}
            shown={pagedData.length}
            onPage={setPage}
            onPageSize={(s) => { setPageSize(Number(s)); setPage(1); }}
          />
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={() => setModal(null)}>
          <div className="glass-panel-strong p-6 w-[440px] max-w-full" onClick={(e) => e.stopPropagation()}>
            {(modal.kind === "credit" || modal.kind === "debit") && (<>
              <h3 className="font-bold text-lg mb-1 capitalize">{modal.kind} balance</h3>
              <p className="text-sm text-muted-foreground mb-4">{modal.user.email}</p>
              <input autoFocus type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (BDT)" className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm mb-3" />
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

            {modal.kind === "delete" && (<>
              <h3 className="font-bold text-lg mb-1 text-rose-700 flex items-center gap-2"><Trash2 className="size-5" /> Delete user permanently</h3>
              <p className="text-sm text-muted-foreground mb-2">{modal.user.email}</p>
              <div className="text-xs bg-rose-500/10 text-rose-700 rounded p-2 mb-3">
                This wipes the user and ALL their sessions, allocations, API keys, OTP history, and balance.
                Cannot delete admins or users with pending withdrawals. <b>Cannot be undone.</b>
              </div>
              <label className="block text-xs font-bold mb-1">Type the user's email to confirm</label>
              <input autoFocus value={deleteEmail} onChange={(e) => setDeleteEmail(e.target.value)} placeholder={modal.user.email} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm mb-3 font-mono" />
              <div className="flex justify-end gap-2">
                <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg text-sm hover:bg-accent">Cancel</button>
                <button
                  onClick={() => delMut.mutate()}
                  disabled={deleteEmail.trim().toLowerCase() !== modal.user.email.toLowerCase() || delMut.isPending}
                  className="px-4 py-2 rounded-lg text-sm bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-md disabled:opacity-40"
                >
                  {delMut.isPending ? "Deleting…" : "Delete forever"}
                </button>
              </div>
            </>)}
          </div>
        </div>
      )}
    </AppShell>
  );
}
