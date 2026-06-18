import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import {
  listAddressesFn, addAddressFn, deleteAddressFn,
  listWithdrawalsFn, createWithdrawalFn,
} from "@/lib/withdrawals.functions";
import { listEnabledGatewaysFn } from "@/lib/gateways.functions";
import { getProfileFn } from "@/lib/profile.functions";
import { Wallet, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/withdrawals")({
  head: () => ({ meta: [{ title: "Withdrawals — Nexus SMS" }] }),
  component: () => (<Protected><WithdrawalsPage /></Protected>),
});

function WithdrawalsPage() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const callAddrs = useServerFn(listAddressesFn);
  const callAddAddr = useServerFn(addAddressFn);
  const callDelAddr = useServerFn(deleteAddressFn);
  const callWds = useServerFn(listWithdrawalsFn);
  const callCreateWd = useServerFn(createWithdrawalFn);
  const callProfile = useServerFn(getProfileFn);

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => callProfile({ data: { token: token! } }), enabled: !!token });
  const addrs = useQuery({ queryKey: ["addresses"], queryFn: () => callAddrs({ data: { token: token! } }), enabled: !!token });
  const wds = useQuery({ queryKey: ["withdrawals"], queryFn: () => callWds({ data: { token: token! } }), enabled: !!token });

  const addAddrMut = useMutation({
    mutationFn: (v: any) => callAddAddr({ data: { token: token!, ...v } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["addresses"] }),
  });
  const delAddrMut = useMutation({
    mutationFn: (id: string) => callDelAddr({ data: { token: token!, id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["addresses"] }),
  });
  const createWdMut = useMutation({
    mutationFn: (v: any) => callCreateWd({ data: { token: token!, ...v } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["withdrawals"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  const [newAddr, setNewAddr] = useState({ gateway: "USDT-TRC20", address: "", label: "" });
  const [newWd, setNewWd] = useState({ gateway: "USDT-TRC20", address: "", amount: "" });
  const [wdMsg, setWdMsg] = useState<string | null>(null);

  const onCreateWd = async (e: React.FormEvent) => {
    e.preventDefault();
    setWdMsg(null);
    try {
      const amt = parseFloat(newWd.amount);
      if (!amt || amt <= 0) throw new Error("Enter a valid amount");
      await createWdMut.mutateAsync({ ...newWd, amount: amt });
      setNewWd({ gateway: "USDT-TRC20", address: "", amount: "" });
      setWdMsg("Withdrawal request submitted ✓");
    } catch (e: any) {
      setWdMsg(e?.message || "Failed");
    }
  };

  return (
    <AppShell>
      <PageHeader icon={<Wallet className="size-6" />} title="Withdrawals" subtitle="Request payouts and manage your payment addresses." />

      {/* Balance + new withdrawal */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="glass-panel-strong p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Available Balance</p>
          <p className="mt-2 text-4xl font-bold tracking-tight" data-mask>
            ${profile.data ? Number(profile.data.balance).toFixed(2) : "—"}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Lifetime: ${profile.data ? Number(profile.data.lifetime_earning).toFixed(2) : "—"}
          </p>
        </div>

        <form onSubmit={onCreateWd} className="glass-panel p-6 xl:col-span-2">
          <h3 className="mb-3 text-lg font-bold tracking-tight">New withdrawal</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Select label="Gateway" value={newWd.gateway} onChange={(v) => setNewWd({ ...newWd, gateway: v })} options={GATEWAYS} />
            <Field label="Amount (USD)" type="number" value={newWd.amount} onChange={(v) => setNewWd({ ...newWd, amount: v })} />
            <Field label="Payout address" value={newWd.address} onChange={(v) => setNewWd({ ...newWd, address: v })} />
          </div>
          {wdMsg && <p className={`mt-3 text-xs ${wdMsg.includes("✓") ? "text-emerald-600" : "text-destructive"}`}>{wdMsg}</p>}
          <button
            type="submit"
            disabled={createWdMut.isPending}
            className="accent-bg mt-4 rounded-xl px-4 py-2 text-sm font-semibold accent-glow disabled:opacity-60"
          >
            {createWdMut.isPending ? "Submitting…" : "Request payout"}
          </button>
        </form>
      </div>

      {/* Saved addresses */}
      <div className="glass-panel mt-6 p-6">
        <h3 className="mb-4 text-lg font-bold tracking-tight">Saved Payment Addresses</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addAddrMut.mutate(newAddr);
            setNewAddr({ gateway: "USDT-TRC20", address: "", label: "" });
          }}
          className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4"
        >
          <Select label="Gateway" value={newAddr.gateway} onChange={(v) => setNewAddr({ ...newAddr, gateway: v })} options={GATEWAYS} />
          <Field label="Address" value={newAddr.address} onChange={(v) => setNewAddr({ ...newAddr, address: v })} />
          <Field label="Label (optional)" value={newAddr.label} onChange={(v) => setNewAddr({ ...newAddr, label: v })} />
          <button type="submit" className="self-end rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-background">
            <Plus className="mr-1 inline size-4" /> Add
          </button>
        </form>

        {addrs.data && addrs.data.length > 0 ? (
          <ul className="divide-y divide-border">
            {addrs.data.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-3">
                <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-bold accent-text">{a.gateway}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs">{a.address}</p>
                  {a.label && <p className="text-xs text-muted-foreground">{a.label}</p>}
                </div>
                <button
                  onClick={() => delAddrMut.mutate(a.id)}
                  className="rounded-md p-2 text-destructive hover:bg-destructive/10"
                  aria-label="Delete"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No addresses saved yet.</p>
        )}
      </div>

      {/* History */}
      <div className="glass-panel mt-6 p-6">
        <h3 className="mb-4 text-lg font-bold tracking-tight">Withdrawal History</h3>
        {wds.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : wds.data && wds.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="py-2">Date</th>
                  <th className="py-2">Amount</th>
                  <th className="py-2">Gateway</th>
                  <th className="py-2">Address</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">TX</th>
                </tr>
              </thead>
              <tbody>
                {wds.data.map((w) => (
                  <tr key={w.id} className="border-t border-border">
                    <td className="py-2 font-mono text-xs whitespace-nowrap">{new Date(w.created_at).toLocaleString()}</td>
                    <td className="py-2 font-bold">${Number(w.amount).toFixed(2)}</td>
                    <td className="py-2">{w.gateway}</td>
                    <td className="py-2 truncate font-mono text-xs" style={{ maxWidth: 200 }}>{w.address}</td>
                    <td className="py-2">
                      <StatusBadge status={w.status} />
                    </td>
                    <td className="py-2 font-mono text-xs">{w.tx_id || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No withdrawals yet.</p>
        )}
      </div>
    </AppShell>
  );
}

function Field({ label, type = "text", value, onChange }: {
  label: string; type?: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-input bg-white/70 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
    </div>
  );
}

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: readonly string[];
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-input bg-white/70 px-3 py-2 text-sm focus:border-primary focus:outline-none">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-700",
    approved: "bg-blue-500/15 text-blue-700",
    paid: "bg-emerald-500/15 text-emerald-700",
    rejected: "bg-destructive/15 text-destructive",
  };
  return <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold uppercase ${map[status] || "bg-muted text-muted-foreground"}`}>{status}</span>;
}
