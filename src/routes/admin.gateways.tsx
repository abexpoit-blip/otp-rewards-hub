import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import {
  adminListGatewaysFn, adminUpsertGatewayFn,
  adminDeleteGatewayFn, adminToggleGatewayFn,
  type GatewayRow,
} from "@/lib/gateways.functions";
import { Banknote, Plus, Pencil, Trash2, AlertTriangle, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/gateways")({
  head: () => ({ meta: [{ title: "Admin · Payment Gateways — Nexus SMS" }] }),
  component: () => (<Protected><AdminGateways /></Protected>),
});

type EditState = Partial<GatewayRow> & { _editing: boolean };

const empty: EditState = {
  _editing: true, code: "", name: "", enabled: true,
  min_amount: "2", max_amount: "100000",
  fee_percent: "0", fee_flat: "0",
  auto_approve_under: null, instructions: "", sort_order: 100,
};

function AdminGateways() {
  const { user, token } = useAuth();
  const qc = useQueryClient();
  const isAdmin = user?.roles?.includes("admin");
  const callList = useServerFn(adminListGatewaysFn);
  const callUpsert = useServerFn(adminUpsertGatewayFn);
  const callDel = useServerFn(adminDeleteGatewayFn);
  const callToggle = useServerFn(adminToggleGatewayFn);
  const [edit, setEdit] = useState<EditState | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-gateways"],
    queryFn: () => callList({ data: { token: token! } }),
    enabled: !!token && isAdmin,
  });

  const upsert = useMutation({
    mutationFn: (v: any) => callUpsert({ data: { token: token!, ...v } }),
    onSuccess: () => { toast.success("Saved"); setEdit(null); qc.invalidateQueries({ queryKey: ["admin-gateways"] }); qc.invalidateQueries({ queryKey: ["gateways"] }); },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });
  const del = useMutation({
    mutationFn: (id: string) => callDel({ data: { token: token!, id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-gateways"] }); qc.invalidateQueries({ queryKey: ["gateways"] }); },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });
  const toggle = useMutation({
    mutationFn: (v: { id: string; enabled: boolean }) => callToggle({ data: { token: token!, ...v } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-gateways"] }); qc.invalidateQueries({ queryKey: ["gateways"] }); },
  });

  if (!isAdmin) return (<AppShell><div className="glass-panel-strong p-12 text-center"><AlertTriangle className="mx-auto size-10 text-destructive" /><h2 className="mt-3 text-xl font-bold">Admin only</h2></div></AppShell>);

  return (
    <AppShell>
      <PageHeader icon={<Banknote className="size-6" />} title="Payment Gateways" subtitle="Enable/disable, set min/max, fees, and auto-approve thresholds." />

      <div className="mb-4 flex justify-end">
        <button onClick={() => setEdit({ ...empty })} className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-xs font-bold shadow-md shadow-primary/25 hover:bg-primary/90">
          <Plus className="size-3.5" /> New Gateway
        </button>
      </div>

      <div className="glass-panel-strong overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase">
            <tr>
              <th className="text-left p-3">Code</th>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Min / Max</th>
              <th className="text-left p-3">Fee</th>
              <th className="text-left p-3">Auto-Approve</th>
              <th className="text-left p-3">Enabled</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Loading…</td></tr> :
              (data ?? []).length === 0 ? <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No gateways yet.</td></tr> :
              data!.map((g) => (
                <tr key={g.id} className="border-t border-border">
                  <td className="p-3 font-mono text-xs font-bold">{g.code}</td>
                  <td className="p-3">{g.name}</td>
                  <td className="p-3 font-mono text-xs">৳{Number(g.min_amount).toFixed(2)} – ৳{Number(g.max_amount).toFixed(2)}</td>
                  <td className="p-3 font-mono text-xs">{Number(g.fee_percent).toFixed(2)}% + ${Number(g.fee_flat).toFixed(2)}</td>
                  <td className="p-3 font-mono text-xs">{g.auto_approve_under == null ? "—" : `≤ ৳${Number(g.auto_approve_under).toFixed(2)}`}</td>
                  <td className="p-3">
                    <button onClick={() => toggle.mutate({ id: g.id, enabled: !g.enabled })} title="Toggle">
                      {g.enabled ? <Check className="size-4 text-emerald-600" /> : <X className="size-4 text-muted-foreground" />}
                    </button>
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={() => setEdit({ ...g, _editing: true })} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border hover:bg-muted mr-1"><Pencil className="size-3" /> Edit</button>
                    <button onClick={() => { if (confirm(`Delete gateway "${g.code}"?`)) del.mutate(g.id); }} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10"><Trash2 className="size-3" /></button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setEdit(null)}>
          <div className="max-w-xl w-full glass-panel-strong rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4">{edit.id ? "Edit Gateway" : "New Gateway"}</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Code (unique)" value={edit.code || ""} onChange={(v) => setEdit({ ...edit, code: v.toUpperCase() })} placeholder="bKash" />
              <Field label="Display Name" value={edit.name || ""} onChange={(v) => setEdit({ ...edit, name: v })} placeholder="bKash (BDT)" />
              <Field label="Min Amount ($)" value={String(edit.min_amount ?? "")} onChange={(v) => setEdit({ ...edit, min_amount: v })} type="number" />
              <Field label="Max Amount ($)" value={String(edit.max_amount ?? "")} onChange={(v) => setEdit({ ...edit, max_amount: v })} type="number" />
              <Field label="Fee %" value={String(edit.fee_percent ?? "")} onChange={(v) => setEdit({ ...edit, fee_percent: v })} type="number" />
              <Field label="Fee Flat ($)" value={String(edit.fee_flat ?? "")} onChange={(v) => setEdit({ ...edit, fee_flat: v })} type="number" />
              <Field label="Auto-Approve under ($, optional)" value={edit.auto_approve_under == null ? "" : String(edit.auto_approve_under)} onChange={(v) => setEdit({ ...edit, auto_approve_under: v as any })} type="number" placeholder="leave blank to disable" />
              <Field label="Sort order" value={String(edit.sort_order ?? 100)} onChange={(v) => setEdit({ ...edit, sort_order: Number(v) as any })} type="number" />
            </div>
            <label className="block text-xs mt-3"><span className="font-bold mb-1 block">Instructions (optional, shown to user)</span>
              <textarea rows={3} value={edit.instructions || ""} onChange={(e) => setEdit({ ...edit, instructions: e.target.value })} className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm" />
            </label>
            <label className="flex items-center gap-2 text-sm mt-3"><input type="checkbox" checked={!!edit.enabled} onChange={(e) => setEdit({ ...edit, enabled: e.target.checked })} /> Enabled</label>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEdit(null)} className="text-xs font-semibold px-3 py-2 text-muted-foreground hover:text-foreground">Cancel</button>
              <button
                onClick={() => upsert.mutate({
                  id: edit.id ?? undefined,
                  code: (edit.code || "").trim(),
                  name: (edit.name || "").trim(),
                  enabled: !!edit.enabled,
                  min_amount: Number(edit.min_amount) || 0,
                  max_amount: Number(edit.max_amount) || 0,
                  fee_percent: Number(edit.fee_percent) || 0,
                  fee_flat: Number(edit.fee_flat) || 0,
                  auto_approve_under: edit.auto_approve_under == null || edit.auto_approve_under === "" ? null : Number(edit.auto_approve_under),
                  instructions: edit.instructions || null,
                  sort_order: Number(edit.sort_order) || 100,
                })}
                disabled={!edit.code?.trim() || !edit.name?.trim() || upsert.isPending}
                className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-xs font-bold shadow-md shadow-primary/25 hover:bg-primary/90 disabled:opacity-50"
              >{upsert.isPending ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block text-xs"><span className="font-bold mb-1 block">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm" />
    </label>
  );
}
