import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { adminListUsersFn, adminUserActionFn, type AdminUserRow } from "@/lib/admin.functions";
import { Users, Ban, CheckCircle2, Plus, Minus, ShieldCheck, ShieldOff, Search, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Admin · Users — Nexus SMS" }] }),
  component: () => (<Protected><AdminUsers /></Protected>),
});

function AdminUsers() {
  const { user, token } = useAuth();
  const qc = useQueryClient();
  const callList = useServerFn(adminListUsersFn);
  const callAction = useServerFn(adminUserActionFn);
  const isAdmin = user?.roles?.includes("admin");

  const [search, setSearch] = useState("");
  const [creditOpen, setCreditOpen] = useState<null | { user: AdminUserRow; mode: "credit" | "debit" }>(null);
  const [amount, setAmount] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () => callList({ data: { token: token!, search } }),
    enabled: !!token && isAdmin,
  });

  const mut = useMutation({
    mutationFn: (v: any) => callAction({ data: { token: token!, ...v } }),
    onSuccess: () => { toast.success("Done"); qc.invalidateQueries({ queryKey: ["admin-users"] }); setCreditOpen(null); setAmount(""); },
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

  return (
    <AppShell>
      <PageHeader icon={<Users className="size-6" />} title="Users" subtitle="Manage user accounts, balance, and roles." />

      <div className="glass-panel-strong p-3 mb-4 flex items-center gap-2">
        <Search className="size-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email or name…"
          className="flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      <div className="glass-panel-strong overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase">
            <tr>
              <th className="text-left p-3">Email</th>
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
            ) : data?.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="p-3">
                  <div className="font-medium">{u.email}</div>
                  {u.name && <div className="text-xs text-muted-foreground">{u.name}</div>}
                </td>
                <td className="p-3">
                  <span className={`text-xs font-bold rounded px-2 py-0.5 ${u.status === "blocked" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {u.status}
                  </span>
                </td>
                <td className="p-3 text-right font-mono">${Number(u.balance).toFixed(4)}</td>
                <td className="p-3 text-right font-mono text-muted-foreground">${Number(u.lifetime_earning).toFixed(2)}</td>
                <td className="p-3 text-right text-xs">{u.success_allocations}/{u.total_allocations}</td>
                <td className="p-3 text-xs">{u.roles.length ? u.roles.join(", ") : <span className="text-muted-foreground">user</span>}</td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-1">
                    {u.status === "blocked" ? (
                      <button title="Unblock" onClick={() => mut.mutate({ user_id: u.id, action: "unblock" })} className="p-1.5 rounded hover:bg-emerald-50 text-emerald-700"><CheckCircle2 className="size-4" /></button>
                    ) : (
                      <button title="Block" onClick={() => mut.mutate({ user_id: u.id, action: "block" })} className="p-1.5 rounded hover:bg-rose-50 text-rose-700"><Ban className="size-4" /></button>
                    )}
                    <button title="Credit" onClick={() => { setCreditOpen({ user: u, mode: "credit" }); setAmount(""); }} className="p-1.5 rounded hover:bg-accent"><Plus className="size-4" /></button>
                    <button title="Debit" onClick={() => { setCreditOpen({ user: u, mode: "debit" }); setAmount(""); }} className="p-1.5 rounded hover:bg-accent"><Minus className="size-4" /></button>
                    {u.roles.includes("admin") ? (
                      <button title="Revoke admin" onClick={() => { if (confirm("Revoke admin from " + u.email + "?")) mut.mutate({ user_id: u.id, action: "revoke_admin" }); }} className="p-1.5 rounded hover:bg-accent"><ShieldOff className="size-4" /></button>
                    ) : (
                      <button title="Grant admin" onClick={() => { if (confirm("Grant admin to " + u.email + "?")) mut.mutate({ user_id: u.id, action: "grant_admin" }); }} className="p-1.5 rounded hover:bg-accent"><ShieldCheck className="size-4" /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creditOpen && (
        <div className="fixed inset-0 bg-black/50 grid place-items-center z-50" onClick={() => setCreditOpen(null)}>
          <div className="glass-panel-strong p-6 w-[400px]" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-1 capitalize">{creditOpen.mode} balance</h3>
            <p className="text-sm text-muted-foreground mb-4">{creditOpen.user.email}</p>
            <input
              autoFocus
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount (USD)"
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm mb-3"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setCreditOpen(null)} className="px-4 py-2 rounded-lg text-sm hover:bg-accent">Cancel</button>
              <button
                onClick={() => mut.mutate({ user_id: creditOpen.user.id, action: creditOpen.mode, amount: parseFloat(amount) })}
                disabled={!amount || isNaN(parseFloat(amount))}
                className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-medium disabled:opacity-40"
              >
                Confirm {creditOpen.mode}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
