import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import {
  getProfileFn, updateProfileFn, changePasswordFn, getSessionsFn,
} from "@/lib/profile.functions";
import { User, Lock, Clock, Save } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — Nexus SMS" }] }),
  component: () => (<Protected><ProfilePage /></Protected>),
});

function ProfilePage() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const callGet = useServerFn(getProfileFn);
  const callUpdate = useServerFn(updateProfileFn);
  const callPwd = useServerFn(changePasswordFn);
  const callSessions = useServerFn(getSessionsFn);

  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => callGet({ data: { token: token! } }),
    enabled: !!token,
  });
  const sessions = useQuery({
    queryKey: ["sessions"],
    queryFn: () => callSessions({ data: { token: token! } }),
    enabled: !!token,
  });

  const updateMut = useMutation({
    mutationFn: (vars: any) => callUpdate({ data: { token: token!, ...vars } }),
    onSuccess: () => { toast.success("Profile updated"); qc.invalidateQueries({ queryKey: ["profile"] }); },
    onError: (e: any) => toast.error(e?.message || "Update failed"),
  });
  const pwdMut = useMutation({
    mutationFn: (vars: any) => callPwd({ data: { token: token!, ...vars } }),
  });

  // Controlled form — initialize/sync when profile arrives so inputs reflect saved values.
  const [form, setForm] = useState<Record<string, string>>({});
  const [pwd, setPwd] = useState({ currentPassword: "", newPassword: "" });
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);

  const p = profile.data;
  useEffect(() => {
    if (!p) return;
    setForm({
      name: p.name ?? "",
      phone: p.phone ?? "",
      country: (p as any).country ?? "",
      city: (p as any).city ?? "",
      timezone: (p as any).timezone ?? "",
      telegram: (p as any).telegram ?? "",
      bio: (p as any).bio ?? "",
    });
  }, [p]);

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateMut.mutate(form);
  };
  const onPwd = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg(null);
    try {
      await pwdMut.mutateAsync(pwd);
      setPwd({ currentPassword: "", newPassword: "" });
      setPwdMsg("Password updated ✓");
    } catch (e: any) {
      setPwdMsg(e?.message || "Failed");
    }
  };

  return (
    <AppShell>
      <PageHeader icon={<User className="size-6" />} title="Profile" subtitle="Manage your account and security." />

      {/* Top summary */}
      <div className="glass-panel-strong mb-6 p-6">
        {profile.isLoading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : p ? (
          <div className="flex flex-wrap items-center gap-6">
            <div className="grid size-16 place-items-center rounded-full bg-primary/10 text-2xl font-bold accent-text">
              {(p.name || p.email)[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight">{p.name || "Unnamed operator"}</p>
              <p className="text-sm text-muted-foreground">{p.email}</p>
            </div>
            <div className="ml-auto flex gap-6 text-sm">
              <Stat label="Balance" value={`৳${Number(p.balance).toFixed(2)}`} />
              <Stat label="Lifetime" value={`৳${Number(p.lifetime_earning).toFixed(2)}`} />
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Profile info */}
        <form onSubmit={onSave} className="glass-panel p-6 xl:col-span-2">
          <h3 className="mb-4 text-lg font-bold tracking-tight">Personal Info</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Name" value={form.name ?? ""} onChange={(v) => setForm({ ...form, name: v })} />
            <Field label="Phone" value={form.phone ?? ""} onChange={(v) => setForm({ ...form, phone: v })} />
            <Field label="Country" value={form.country ?? ""} onChange={(v) => setForm({ ...form, country: v })} />
            <Field label="City" value={form.city ?? ""} onChange={(v) => setForm({ ...form, city: v })} />
            <Field label="Timezone" value={form.timezone ?? ""} onChange={(v) => setForm({ ...form, timezone: v })} />
            <Field label="Telegram" value={form.telegram ?? ""} onChange={(v) => setForm({ ...form, telegram: v })} />
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Bio</label>
              <textarea
                rows={3}
                value={form.bio ?? ""}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                className="w-full rounded-xl border border-input bg-white/70 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={updateMut.isPending}
            className="accent-bg mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold accent-glow disabled:opacity-60"
          >
            <Save className="size-4" />
            {updateMut.isPending ? "Saving…" : updateMut.isSuccess ? "Saved ✓" : "Save changes"}
          </button>
        </form>

        {/* Password */}
        <form onSubmit={onPwd} className="glass-panel p-6">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-bold tracking-tight">
            <Lock className="size-4 accent-text" /> Password
          </h3>
          <Field label="Current password" type="password" value={pwd.currentPassword} onChange={(v) => setPwd({ ...pwd, currentPassword: v })} />
          <div className="mt-3">
            <Field label="New password (min 6)" type="password" value={pwd.newPassword} onChange={(v) => setPwd({ ...pwd, newPassword: v })} />
          </div>
          {pwdMsg && <p className={`mt-3 text-xs ${pwdMsg.includes("✓") ? "text-emerald-600" : "text-destructive"}`}>{pwdMsg}</p>}
          <button
            type="submit"
            disabled={pwdMut.isPending}
            className="mt-4 w-full rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-60"
          >
            {pwdMut.isPending ? "Updating…" : "Update password"}
          </button>
        </form>

        {/* Login history */}
        <div className="glass-panel p-6 xl:col-span-3">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-bold tracking-tight">
            <Clock className="size-4 accent-text" /> Recent Logins
          </h3>
          {sessions.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : sessions.data && sessions.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                    <th className="py-2">When</th>
                    <th className="py-2">IP</th>
                    <th className="py-2">User Agent</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.data.map((s) => (
                    <tr key={s.id} className="border-t border-border">
                      <td className="py-2 font-mono text-xs">{new Date(s.created_at).toLocaleString()}</td>
                      <td className="py-2 font-mono text-xs">{s.ip || "—"}</td>
                      <td className="py-2 truncate text-xs text-muted-foreground" title={s.user_agent || ""}>
                        {s.user_agent?.slice(0, 80) || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No sessions yet.</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

function Field({
  label, type = "text", defaultValue, value, onChange,
}: {
  label: string; type?: string; defaultValue?: string; value?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input
        type={type}
        defaultValue={defaultValue}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-input bg-white/70 px-3 py-2 text-sm focus:border-primary focus:outline-none"
      />
    </div>
  );
}
