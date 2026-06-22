import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { adminListAgentsFn, adminCreateAgentFn, adminUpdateAgentFn, adminImpersonateFn, adminGetAgentDomainFn, type AdminAgentRow } from "@/lib/admin.functions";
import { UserCog, Plus, Pencil, AlertTriangle, ShieldCheck, ShieldOff, Sparkles, AtSign } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/agents")({
  head: () => ({ meta: [{ title: "Admin · Agents — Nexus X" }] }),
  component: () => (<Protected><AdminAgents /></Protected>),
});

type ModalState =
  | { kind: "create" }
  | { kind: "edit"; row: AdminAgentRow }
  | null;

function AdminAgents() {
  const { user, token, enterImpersonation } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isAdmin = user?.roles?.includes("admin");
  const callList = useServerFn(adminListAgentsFn);
  const callCreate = useServerFn(adminCreateAgentFn);
  const callUpdate = useServerFn(adminUpdateAgentFn);
  const callImp = useServerFn(adminImpersonateFn);
  const callDomain = useServerFn(adminGetAgentDomainFn);

  const [modal, setModal] = useState<ModalState>(null);
  const [form, setForm] = useState<{ username: string; password: string; name: string; otp_rate: string; agent_active: boolean }>({ username: "", password: "", name: "", otp_rate: "0.60", agent_active: true });

  const list = useQuery({
    queryKey: ["admin-agents"],
    queryFn: () => callList({ data: { token: token! } }),
    enabled: !!token && !!isAdmin,
    refetchInterval: 15_000,
  });

  const domainQ = useQuery({
    queryKey: ["admin-agent-domain"],
    queryFn: () => callDomain({ data: { token: token! } }),
    enabled: !!token && !!isAdmin,
    staleTime: 60_000,
  });
  const domain = domainQ.data?.domain || "v2.nexus-x.site";

  const create = useMutation({
    mutationFn: () => callCreate({ data: { token: token!, username: form.username.trim().toLowerCase(), password: form.password, name: form.name.trim() || null, otp_rate: parseFloat(form.otp_rate) } }),
    onSuccess: (r) => { toast.success(`Agent created · ${r.email}`); setModal(null); qc.invalidateQueries({ queryKey: ["admin-agents"] }); },
    onError: (e: any) => toast.error(e?.message || "Create failed"),
  });
  const update = useMutation({
    mutationFn: (v: any) => callUpdate({ data: { token: token!, ...v } }),
    onSuccess: () => { toast.success("Saved"); setModal(null); qc.invalidateQueries({ queryKey: ["admin-agents"] }); },
    onError: (e: any) => toast.error(e?.message || "Save failed"),
  });
  const imp = useMutation({
    mutationFn: (uid: string) => callImp({ data: { token: token!, user_id: uid } }),
    onSuccess: (r) => { enterImpersonation(r.token, r.user); toast.success(`Now viewing as ${r.user.email}`); navigate({ to: "/agent" }); },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  const openCreate = () => { setForm({ username: "", password: "", name: "", otp_rate: "0.60", agent_active: true }); setModal({ kind: "create" }); };
  const openEdit = (row: AdminAgentRow) => { setForm({ username: row.email.split("@")[0] || "", password: "", name: row.name || "", otp_rate: row.otp_rate, agent_active: row.agent_active }); setModal({ kind: "edit", row }); };

  if (!isAdmin) {
    return (<AppShell><div className="glass-panel-strong p-12 text-center"><AlertTriangle className="mx-auto size-10 text-destructive" /><h2 className="mt-3 text-xl font-bold">Admin only</h2></div></AppShell>);
  }

  const usernameOk = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/i.test(form.username.trim());
  const previewEmail = form.username.trim() ? `${form.username.trim().toLowerCase()}@${domain}` : "";

  return (
    <AppShell>
      <PageHeader icon={<UserCog className="size-6" />} title="Agents (Sub-Admins)" subtitle={`Create agent accounts. Email auto-generates as username@${domain}. Cap: ৳0.70 per OTP.`} />

      <div className="mb-4 flex justify-end">
        <button onClick={openCreate} className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-xs font-bold shadow-md shadow-primary/25 hover:bg-primary/90">
          <Plus className="size-3.5" /> New Agent
        </button>
      </div>

      <div className="glass-panel-strong overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase">
            <tr>
              <th className="text-left p-3">Agent</th>
              <th className="text-right p-3">OTP Rate</th>
              <th className="text-right p-3">Users</th>
              <th className="text-right p-3">Pending</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Last login</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.isLoading ? <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Loading…</td></tr> :
              !list.data?.length ? <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No agents yet.</td></tr> :
                list.data.map((a) => (
                  <tr key={a.id} className="border-t border-border">
                    <td className="p-3">
                      <div className="font-medium">{a.email}</div>
                      {a.name && <div className="text-xs text-muted-foreground">{a.name}</div>}
                    </td>
                    <td className="p-3 text-right font-mono font-bold">৳{Number(a.otp_rate).toFixed(2)}</td>
                    <td className="p-3 text-right">{a.users_under}</td>
                    <td className="p-3 text-right">{a.pending_under > 0 ? <span className="rounded px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold">{a.pending_under}</span> : "—"}</td>
                    <td className="p-3">{a.agent_active ? <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><ShieldCheck className="size-3" /> active</span> : <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700"><ShieldOff className="size-3" /> inactive</span>}</td>
                    <td className="p-3 text-xs text-muted-foreground">{a.last_login_at ? new Date(a.last_login_at).toLocaleString() : "Never"}</td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => { if (confirm(`Sign in as ${a.email}? You can exit anytime.`)) imp.mutate(a.id); }} className="rounded bg-indigo-50 text-indigo-700 border border-indigo-200/60 px-2 py-1 text-xs font-bold inline-flex items-center gap-1"><Sparkles className="size-3" /> Login as</button>
                        <button onClick={() => openEdit(a)} className="rounded border border-border px-2 py-1 text-xs font-medium hover:bg-muted inline-flex items-center gap-1"><Pencil className="size-3" /> Edit</button>
                      </div>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setModal(null)}>
          <div className="glass-panel-strong p-6 w-[480px] max-w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4">{modal.kind === "create" ? "Create Agent" : `Edit ${modal.row.email}`}</h3>
            <div className="space-y-3">
              {modal.kind === "create" ? (
                <label className="block text-xs">
                  <span className="font-bold mb-1 block">Username</span>
                  <div className="flex items-stretch rounded-md border border-border overflow-hidden focus-within:ring-2 focus-within:ring-primary/40">
                    <input
                      autoFocus
                      type="text"
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value.replace(/\s+/g, "") })}
                      className="flex-1 bg-background px-3 py-2 text-sm font-mono outline-none"
                      placeholder="rakib"
                    />
                    <span className="inline-flex items-center gap-1 bg-muted/60 px-3 text-xs font-mono text-muted-foreground border-l border-border">
                      <AtSign className="size-3" />{domain}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Login email will be <span className="font-mono">{previewEmail || `username@${domain}`}</span>. Letters, digits, dot, dash, underscore.
                  </p>
                </label>
              ) : (
                <div className="text-xs">
                  <span className="font-bold mb-1 block">Email</span>
                  <div className="bg-muted/50 border border-border rounded-md px-3 py-2 text-sm font-mono opacity-80">{modal.row.email}</div>
                </div>
              )}
              <label className="block text-xs"><span className="font-bold mb-1 block">Name (optional, shown internally)</span>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" placeholder="e.g. Rakib Hasan" />
              </label>
              <label className="block text-xs"><span className="font-bold mb-1 block">Password {modal.kind === "edit" && "(leave blank to keep current)"}</span>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" placeholder={modal.kind === "edit" ? "•••••• (unchanged)" : "Min 6 chars"} />
              </label>
              <label className="block text-xs"><span className="font-bold mb-1 block">OTP Rate (BDT, max 0.70)</span>
                <input type="number" step="0.01" min="0" max="0.70" value={form.otp_rate} onChange={(e) => setForm({ ...form, otp_rate: e.target.value })} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm font-mono" />
                <p className="text-[10px] text-muted-foreground mt-1">New signups under this agent will get this rate. Existing users keep their rate.</p>
              </label>
              {modal.kind === "edit" && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.agent_active} onChange={(e) => setForm({ ...form, agent_active: e.target.checked })} /> Agent active (uncheck to pause new signups under this agent)
                </label>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setModal(null)} className="px-3 py-2 text-xs hover:bg-accent rounded-lg">Cancel</button>
              <button
                disabled={create.isPending || update.isPending}
                onClick={() => {
                  const rate = parseFloat(form.otp_rate);
                  if (!isFinite(rate) || rate < 0 || rate > 0.70) return toast.error("Rate must be between 0 and 0.70");
                  if (modal.kind === "create") {
                    if (!usernameOk) return toast.error("Invalid username");
                    if (form.password.length < 6) return toast.error("Password must be at least 6 chars");
                    create.mutate();
                  } else {
                    update.mutate({
                      agent_id: modal.row.id,
                      otp_rate: rate,
                      agent_active: form.agent_active,
                      name: form.name.trim() || null,
                      ...(form.password ? { password: form.password } : {}),
                    });
                  }
                }}
                className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50"
              >
                {modal.kind === "create" ? "Create Agent" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
