import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { listApiKeysFn, createApiKeyFn, revokeApiKeyFn } from "@/lib/api-keys.functions";
import { Key, Plus, Copy, Check, BookOpen, Terminal, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/api-keys")({
  head: () => ({ meta: [{ title: "API Keys — Nexus SMS" }] }),
  component: () => (<Protected><ApiKeysPage /></Protected>),
});

function ApiKeysPage() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const callList = useServerFn(listApiKeysFn);
  const callCreate = useServerFn(createApiKeyFn);
  const callRevoke = useServerFn(revokeApiKeyFn);

  const keys = useQuery({ queryKey: ["api-keys"], queryFn: () => callList({ data: { token: token! } }), enabled: !!token });
  const createMut = useMutation({
    mutationFn: (label: string) => callCreate({ data: { token: token!, label: label || null } }),
    onSuccess: () => { toast.success("API key created"); qc.invalidateQueries({ queryKey: ["api-keys"] }); },
    onError: (e: any) => toast.error(e?.message || "Failed to create key"),
  });
  const revokeMut = useMutation({
    mutationFn: (id: string) => callRevoke({ data: { token: token!, id } }),
    onSuccess: () => { toast.success("API key revoked"); qc.invalidateQueries({ queryKey: ["api-keys"] }); },
    onError: (e: any) => toast.error(e?.message || "Failed to revoke key"),
  });

  const [label, setLabel] = useState("");
  const [copied, setCopied] = useState(false);
  const fresh = createMut.data?.key;

  const copyKey = async () => {
    if (!fresh) return;
    await navigator.clipboard.writeText(fresh);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AppShell>
      <PageHeader icon={<Key className="size-6" />} title="API Keys" subtitle="Generate keys for external bots and integrations." />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          createMut.mutate(label);
          setLabel("");
        }}
        className="glass-panel mb-6 flex flex-wrap items-end gap-3 p-6"
      >
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Label (optional)</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Production bot"
            className="w-full rounded-xl border border-input bg-white/70 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>
        <button type="submit" disabled={createMut.isPending}
          className="accent-bg inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold accent-glow disabled:opacity-60">
          <Plus className="size-4" />
          {createMut.isPending ? "Generating…" : "Generate key"}
        </button>
      </form>

      {fresh && (
        <div className="glass-panel-strong mb-6 border-2 border-amber-400/40 p-6">
          <p className="mb-2 text-sm font-bold text-amber-700">⚠ Copy this key now — it won't be shown again</p>
          <div className="flex items-center gap-2 rounded-xl bg-foreground p-3 font-mono text-xs text-background">
            <code className="flex-1 break-all">{fresh}</code>
            <button onClick={copyKey} className="rounded-md bg-background/20 p-2">
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </button>
          </div>
        </div>
      )}

      <div className="glass-panel p-6">
        <h3 className="mb-4 text-lg font-bold tracking-tight">Active Keys</h3>
        {keys.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : keys.data && keys.data.length > 0 ? (
          <ul className="divide-y divide-border">
            {keys.data.map((k) => (
              <li key={k.id} className="flex items-center gap-3 py-3">
                <code className="rounded-md bg-muted px-2 py-1 font-mono text-xs">{k.key_prefix}…</code>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">{k.label || "Unlabeled"}</p>
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(k.created_at).toLocaleDateString()}
                    {k.last_used_at && ` · Last used ${new Date(k.last_used_at).toLocaleDateString()}`}
                  </p>
                </div>
                {k.revoked_at ? (
                  <span className="rounded-md bg-destructive/10 px-2 py-1 text-[11px] font-bold uppercase text-destructive">Revoked</span>
                ) : (
                  <button onClick={() => revokeMut.mutate(k.id)}
                    className="rounded-md border border-destructive/30 px-3 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10">
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No API keys yet.</p>
        )}
      </div>
    </AppShell>
  );
}
