import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { adminListPayoutsFn, adminUpsertPayoutFn, adminDeletePayoutFn } from "@/lib/admin.functions";
import { DollarSign, Plus, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/payouts")({
  head: () => ({ meta: [{ title: "Admin · Payouts — Nexus SMS" }] }),
  component: () => (<Protected><AdminPayouts /></Protected>),
});

function AdminPayouts() {
  const { user, token } = useAuth();
  const qc = useQueryClient();
  const callList = useServerFn(adminListPayoutsFn);
  const callUpsert = useServerFn(adminUpsertPayoutFn);
  const callDelete = useServerFn(adminDeletePayoutFn);
  const isAdmin = user?.roles?.includes("admin");

  const { data } = useQuery({
    queryKey: ["admin-payouts"],
    queryFn: () => callList({ data: { token: token! } }),
    enabled: !!token && isAdmin,
  });

  const upsertMut = useMutation({
    mutationFn: (v: any) => callUpsert({ data: { token: token!, ...v } }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["admin-payouts"] }); },
    onError: (e: any) => toast.error(e?.message || "Save failed"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => callDelete({ data: { token: token!, id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-payouts"] }); },
  });

  const [form, setForm] = useState({ sid: "", country: "", amount: "0.10", note: "" });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(form.amount);
    if (!form.sid.trim() || isNaN(amt) || amt < 0) {
      toast.error("Enter a service id and a valid amount");
      return;
    }
    upsertMut.mutate({
      sid: form.sid.trim().toUpperCase(),
      country: form.country.trim() || null,
      amount: amt,
      active: true,
      note: form.note.trim() || null,
    });
  };

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

  const defaultPayout = "$0.10 (STEX_DEFAULT_PAYOUT env)";
  return (
    <AppShell>
      <PageHeader icon={<DollarSign className="size-6" />} title="Payout Pricing" subtitle="Per-service & per-country payout overrides. Order: (sid, country) → (sid, any) → default." />

      <form onSubmit={onSubmit} className="glass-panel-strong p-6 mb-6">
        <h3 className="mb-3 font-bold">Add or update a rule</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <In label="Service (sid)" value={form.sid} onChange={(v) => setForm({ ...form, sid: v })} placeholder="TELEGRAM" />
          <In label="Country (optional)" value={form.country} onChange={(v) => setForm({ ...form, country: v })} placeholder="Bangladesh / blank=any" />
          <In label="Amount (USD)" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} placeholder="0.15" />
          <In label="Note (optional)" value={form.note} onChange={(v) => setForm({ ...form, note: v })} placeholder="" />
          <div className="flex items-end">
            <button disabled={upsertMut.isPending} className="w-full rounded-xl accent-bg px-4 py-2 text-sm font-semibold accent-glow disabled:opacity-50 flex items-center justify-center gap-1">
              <Plus className="size-4" /> Save
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Default when no rule matches: {defaultPayout}</p>
      </form>

      <div className="glass-panel-strong p-0 overflow-hidden">
        {!data?.length ? (
          <p className="p-12 text-center text-sm text-muted-foreground">No payout rules yet — the default applies to every OTP.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground bg-background/30">
                <th className="px-4 py-2">Service</th>
                <th className="px-4 py-2">Country</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Active</th>
                <th className="px-4 py-2">Note</th>
                <th className="px-4 py-2">Updated</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-2 font-bold accent-text">{p.sid}</td>
                  <td className="px-4 py-2">{p.country || <span className="text-muted-foreground italic">any</span>}</td>
                  <td className="px-4 py-2 font-mono">${Number(p.amount).toFixed(4)}</td>
                  <td className="px-4 py-2">{p.active ? "✓" : "—"}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{p.note || "—"}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(p.updated_at).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    <button onClick={() => delMut.mutate(p.id)} className="rounded p-1 text-destructive hover:bg-destructive/10">
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}

function In({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-xl border border-input bg-background/40 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
    </div>
  );
}
