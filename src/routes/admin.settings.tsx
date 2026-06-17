import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { adminGetSettingsFn, adminSetSettingFn } from "@/lib/admin.functions";
import { Settings, Save, AlertTriangle, KeyRound } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({ meta: [{ title: "Admin · Settings — Nexus SMS" }] }),
  component: () => (<Protected><AdminSettings /></Protected>),
});

function AdminSettings() {
  const { user, token } = useAuth();
  const qc = useQueryClient();
  const callList = useServerFn(adminGetSettingsFn);
  const callSet = useServerFn(adminSetSettingFn);
  const isAdmin = user?.roles?.includes("admin");

  const { data } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => callList({ data: { token: token! } }),
    enabled: !!token && isAdmin,
  });

  const [draft, setDraft] = useState<Record<string, any>>({});
  useEffect(() => {
    if (data) {
      const d: Record<string, any> = {};
      for (const s of data) if (!s.is_secret) d[s.key] = s.value;
      setDraft(d);
    }
  }, [data]);

  const mut = useMutation({
    mutationFn: (v: { key: string; value: any }) => callSet({ data: { token: token!, ...v } }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["admin-settings"] }); },
    onError: (e: any) => toast.error(e?.message || "Save failed"),
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

  const renderInput = (s: any) => {
    if (s.is_secret) {
      return <SecretInput keyName={s.key} placeholder={s.value === "********" ? "•••••••• (set)" : "Not set"} onSave={(v) => mut.mutate({ key: s.key, value: v })} />;
    }
    const v = draft[s.key];
    const isBool = typeof v === "boolean";
    const isNum = typeof v === "number";
    if (isBool) {
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={!!v} onChange={(e) => setDraft((p) => ({ ...p, [s.key]: e.target.checked }))} />
          <span className="text-sm">{v ? "Enabled" : "Disabled"}</span>
        </label>
      );
    }
    return (
      <input
        type={isNum ? "number" : "text"}
        step={isNum ? "any" : undefined}
        value={v ?? ""}
        onChange={(e) => {
          const nv = isNum ? Number(e.target.value) : e.target.value;
          setDraft((p) => ({ ...p, [s.key]: nv }));
        }}
        className="bg-background border border-border rounded-md px-3 py-2 text-sm font-mono w-48"
      />
    );
  };

  return (
    <AppShell>
      <PageHeader icon={<Settings className="size-6" />} title="System Settings" subtitle="Runtime config — changes take effect within ~15 seconds (no restart needed)." />

      <div className="glass-panel-strong divide-y divide-border">
        {(data ?? []).map((s) => (
          <div key={s.key} className="p-4 flex items-center justify-between gap-6">
            <div className="flex-1 min-w-0">
              <div className="font-mono text-sm font-semibold flex items-center gap-2">
                {s.is_secret && <KeyRound className="size-3.5 text-amber-600" />}
                {s.key}
              </div>
              {s.description && <div className="text-xs text-muted-foreground mt-0.5">{s.description}</div>}
              <div className="text-[10px] text-muted-foreground mt-1">Updated {new Date(s.updated_at).toLocaleString()}</div>
            </div>
            <div className="flex items-center gap-2">
              {renderInput(s)}
              {!s.is_secret && (
                <button
                  onClick={() => mut.mutate({ key: s.key, value: draft[s.key] })}
                  className="rounded-lg bg-primary text-primary-foreground px-3 py-2 text-xs font-medium flex items-center gap-1"
                >
                  <Save className="size-3" /> Save
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

function SecretInput({ keyName, placeholder, onSave }: { keyName: string; placeholder: string; onSave: (v: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <div className="flex items-center gap-2">
      <input
        type="password"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder={placeholder}
        className="bg-background border border-border rounded-md px-3 py-2 text-sm font-mono w-64"
      />
      <button
        disabled={!val}
        onClick={() => { onSave(val); setVal(""); }}
        className="rounded-lg bg-primary text-primary-foreground px-3 py-2 text-xs font-medium flex items-center gap-1 disabled:opacity-40"
      >
        <Save className="size-3" /> Save
      </button>
    </div>
  );
}
