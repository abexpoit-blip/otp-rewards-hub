import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { adminGetSettingsFn, adminSetSettingFn } from "@/lib/admin.functions";
import {
  Settings, Save, AlertTriangle, KeyRound, Search, RotateCcw,
  Wallet, Megaphone, Users, Shield, Wrench, Sparkles, Eye, EyeOff, Check,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({ meta: [{ title: "Admin · Settings — Nexus SMS" }] }),
  component: () => (<Protected><AdminSettings /></Protected>),
});

type Category = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  match: (key: string, isSecret: boolean) => boolean;
  accent: string; // tailwind gradient classes
};

const CATEGORIES: Category[] = [
  { id: "payouts",  label: "Payouts & Rates",  icon: Wallet,    accent: "from-emerald-500/20 to-emerald-500/5", match: (k, s) => !s && (/payout|rate|commission|earning/i.test(k)) },
  { id: "withdraw", label: "Withdrawals",      icon: Wallet,    accent: "from-blue-500/20 to-blue-500/5",       match: (k, s) => !s && /withdraw|payment|gateway|min_/i.test(k) },
  { id: "agent",    label: "Agents & Users",   icon: Users,     accent: "from-violet-500/20 to-violet-500/5",   match: (k, s) => !s && /agent|user|support|signup/i.test(k) },
  { id: "notice",   label: "Notices & Banner", icon: Megaphone, accent: "from-amber-500/20 to-amber-500/5",     match: (k, s) => !s && /maintenance|banner|notice|announce/i.test(k) },
  { id: "secrets",  label: "Secrets & Keys",   icon: KeyRound,  accent: "from-rose-500/20 to-rose-500/5",       match: (_k, s) => s },
  { id: "other",    label: "Other",            icon: Wrench,    accent: "from-slate-500/20 to-slate-500/5",     match: () => true },
];

function categorize(key: string, isSecret: boolean): string {
  for (const c of CATEGORIES) if (c.match(key, isSecret)) return c.id;
  return "other";
}

function AdminSettings() {
  const { user, token } = useAuth();
  const qc = useQueryClient();
  const callList = useServerFn(adminGetSettingsFn);
  const callSet = useServerFn(adminSetSettingFn);
  const isAdmin = user?.roles?.includes("admin");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => callList({ data: { token: token! } }),
    enabled: !!token && isAdmin,
  });

  const [draft, setDraft] = useState<Record<string, any>>({});
  const [activeCat, setActiveCat] = useState<string>("payouts");
  const [search, setSearch] = useState("");

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

  const grouped = useMemo(() => {
    const g: Record<string, any[]> = {};
    for (const c of CATEGORIES) g[c.id] = [];
    for (const s of data ?? []) g[categorize(s.key, s.is_secret)].push(s);
    return g;
  }, [data]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const cat of CATEGORIES) c[cat.id] = grouped[cat.id]?.length ?? 0;
    return c;
  }, [grouped]);

  const visible = useMemo(() => {
    const list = grouped[activeCat] ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((s: any) =>
      s.key.toLowerCase().includes(q) || (s.description || "").toLowerCase().includes(q)
    );
  }, [grouped, activeCat, search]);

  const dirtyKeys = useMemo(() => {
    if (!data) return new Set<string>();
    const dirty = new Set<string>();
    for (const s of data) {
      if (s.is_secret) continue;
      if (JSON.stringify(draft[s.key]) !== JSON.stringify(s.value)) dirty.add(s.key);
    }
    return dirty;
  }, [data, draft]);

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

  const saveAllDirty = async () => {
    const keys = Array.from(dirtyKeys);
    if (!keys.length) return;
    for (const k of keys) await mut.mutateAsync({ key: k, value: draft[k] });
    toast.success(`Saved ${keys.length} setting${keys.length === 1 ? "" : "s"}`);
  };

  const resetAllDirty = () => {
    if (!data) return;
    const d: Record<string, any> = {};
    for (const s of data) if (!s.is_secret) d[s.key] = s.value;
    setDraft(d);
    toast.message("Reverted unsaved changes");
  };

  const activeMeta = CATEGORIES.find((c) => c.id === activeCat)!;

  return (
    <AppShell>
      <PageHeader
        icon={<Settings className="size-6" />}
        title="System Settings"
        subtitle="Runtime config — changes take effect within ~15 seconds, no restart needed."
      />

      {/* Header bar — search + bulk save */}
      <div className="glass-panel-strong mb-4 flex flex-wrap items-center gap-3 rounded-2xl p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search settings…"
            className="w-full rounded-xl bg-background/60 border border-border pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        {dirtyKeys.size > 0 && (
          <>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-700">
              <Sparkles className="size-3" /> {dirtyKeys.size} unsaved
            </span>
            <button
              onClick={resetAllDirty}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-white/50 transition"
            >
              <RotateCcw className="size-3.5" /> Revert
            </button>
            <button
              onClick={saveAllDirty}
              disabled={mut.isPending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-primary to-primary/80 px-4 py-2 text-xs font-bold text-primary-foreground shadow-md shadow-primary/25 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 transition-all"
            >
              <Save className="size-3.5" /> Save all
            </button>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
        {/* Category sidebar */}
        <nav className="glass-panel rounded-2xl p-2 h-fit lg:sticky lg:top-4">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            const active = c.id === activeCat;
            return (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition mb-0.5 ${
                  active
                    ? "bg-gradient-to-r " + c.accent + " text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:bg-white/40 hover:text-foreground"
                }`}
              >
                <Icon className="size-4 shrink-0" />
                <span className="flex-1 text-left">{c.label}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${active ? "bg-background/70" : "bg-muted"}`}>
                  {counts[c.id] ?? 0}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Settings list */}
        <div className={`glass-panel-strong rounded-2xl overflow-hidden bg-gradient-to-br ${activeMeta.accent}`}>
          <div className="flex items-center gap-2 border-b border-border/60 px-5 py-3 bg-background/40 backdrop-blur">
            <activeMeta.icon className="size-4" />
            <h3 className="font-bold text-sm">{activeMeta.label}</h3>
            <span className="ml-auto text-[10px] text-muted-foreground font-mono">{visible.length} item{visible.length === 1 ? "" : "s"}</span>
          </div>

          {isLoading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
          ) : visible.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              {search ? "No settings match your search." : "No settings in this category."}
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {visible.map((s: any) => (
                <SettingRow
                  key={s.key}
                  s={s}
                  draftValue={draft[s.key]}
                  isDirty={dirtyKeys.has(s.key)}
                  onChange={(v) => setDraft((p) => ({ ...p, [s.key]: v }))}
                  onSave={(v) => mut.mutate({ key: s.key, value: v })}
                  onRevert={() => setDraft((p) => ({ ...p, [s.key]: s.value }))}
                  pending={mut.isPending}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function SettingRow({ s, draftValue, isDirty, onChange, onSave, onRevert, pending }: {
  s: any; draftValue: any; isDirty: boolean;
  onChange: (v: any) => void; onSave: (v: any) => void; onRevert: () => void; pending: boolean;
}) {
  return (
    <div className={`px-5 py-4 transition ${isDirty ? "bg-amber-500/5" : ""}`}>
      <div className="flex flex-col lg:flex-row lg:items-start gap-3 lg:gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {s.is_secret && <KeyRound className="size-3.5 text-amber-600" />}
            <code className="font-mono text-sm font-bold">{s.key}</code>
            {isDirty && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-700">
                <Sparkles className="size-2.5" /> unsaved
              </span>
            )}
          </div>
          {s.description && (
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{s.description}</p>
          )}
          <p className="mt-1 text-[10px] text-muted-foreground/70 font-mono">
            Updated {new Date(s.updated_at).toLocaleString()}
          </p>
        </div>

        <div className="flex items-start gap-2 shrink-0">
          {s.is_secret ? (
            <SecretInput
              placeholder={s.value === "********" ? "•••••••• (set)" : "Not set"}
              onSave={(v) => onSave(v)}
            />
          ) : (
            <>
              <ValueInput value={draftValue} onChange={onChange} />
              {isDirty && (
                <>
                  <button
                    onClick={onRevert}
                    title="Revert"
                    className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground hover:bg-white/50 transition"
                  >
                    <RotateCcw className="size-3.5" />
                  </button>
                  <button
                    onClick={() => onSave(draftValue)}
                    disabled={pending}
                    className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-br from-primary to-primary/80 px-3 py-2 text-xs font-bold text-primary-foreground shadow-md shadow-primary/25 hover:shadow-lg disabled:opacity-50 transition"
                  >
                    <Check className="size-3.5" /> Save
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ValueInput({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const isBool = typeof value === "boolean";
  const isNum = typeof value === "number";

  if (isBool) {
    return (
      <button
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-9 w-[88px] items-center rounded-full border transition ${
          value ? "bg-emerald-500/20 border-emerald-500/40" : "bg-muted border-border"
        }`}
      >
        <span
          className={`absolute h-7 w-7 rounded-full bg-background shadow-md transition-all flex items-center justify-center ${
            value ? "translate-x-[52px]" : "translate-x-1"
          }`}
        >
          {value ? <Check className="size-3.5 text-emerald-600" /> : <span className="size-2 rounded-full bg-muted-foreground" />}
        </span>
        <span className={`absolute text-[10px] font-bold uppercase tracking-wider ${value ? "left-3 text-emerald-700" : "right-3 text-muted-foreground"}`}>
          {value ? "On" : "Off"}
        </span>
      </button>
    );
  }

  return (
    <input
      type={isNum ? "number" : "text"}
      step={isNum ? "any" : undefined}
      value={value ?? ""}
      onChange={(e) => onChange(isNum ? Number(e.target.value) : e.target.value)}
      className="bg-background/80 border border-border rounded-lg px-3 py-2 text-sm font-mono w-56 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition"
    />
  );
}

function SecretInput({ placeholder, onSave }: { placeholder: string; onSave: (v: string) => void }) {
  const [val, setVal] = useState("");
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder={placeholder}
          className="bg-background/80 border border-border rounded-lg pl-3 pr-9 py-2 text-sm font-mono w-64 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition"
          title={show ? "Hide" : "Show"}
        >
          {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
      </div>
      <button
        disabled={!val}
        onClick={() => { onSave(val); setVal(""); }}
        className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-br from-primary to-primary/80 px-3 py-2 text-xs font-bold text-primary-foreground shadow-md shadow-primary/25 hover:shadow-lg disabled:opacity-40 transition"
      >
        <Shield className="size-3.5" /> Set
      </button>
    </div>
  );
}
