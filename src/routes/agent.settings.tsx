import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/AppShell";
import { AgentProtected } from "@/components/AgentProtected";
import { useAuth } from "@/lib/auth";
import { agentGetProfileFn, agentSaveProfileFn } from "@/lib/agent.functions";
import { Settings, CheckCircle2, AlertTriangle, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/agent/settings")({
  head: () => ({ meta: [{ title: "Agent · Settings — Nexus X" }] }),
  component: () => (<AgentProtected allowIncompleteProfile><AgentSettings /></AgentProtected>),
});

type Form = {
  name: string; phone: string; telegram: string;
  personal_email: string; address: string; group_link: string;
};

const EMPTY: Form = { name: "", phone: "", telegram: "", personal_email: "", address: "", group_link: "" };

function AgentSettings() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const callGet = useServerFn(agentGetProfileFn);
  const callSave = useServerFn(agentSaveProfileFn);

  const profile = useQuery({
    queryKey: ["agent-profile"],
    queryFn: () => callGet({ data: { token: token! } }),
    enabled: !!token,
  });

  const [form, setForm] = useState<Form>(EMPTY);
  useEffect(() => {
    if (profile.data) setForm({
      name: profile.data.name ?? "",
      phone: profile.data.phone ?? "",
      telegram: profile.data.telegram ?? "",
      personal_email: profile.data.personal_email ?? "",
      address: profile.data.address ?? "",
      group_link: profile.data.group_link ?? "",
    });
  }, [profile.data]);

  const save = useMutation({
    mutationFn: () => callSave({ data: {
      token: token!,
      name: form.name.trim(),
      phone: form.phone.trim(),
      telegram: form.telegram.trim(),
      personal_email: form.personal_email.trim(),
      address: form.address.trim(),
      group_link: form.group_link.trim() || null,
    } }),
    onSuccess: () => {
      toast.success("Profile saved — you can now manage users.");
      qc.invalidateQueries({ queryKey: ["agent-profile"] });
    },
    onError: (e: any) => toast.error(e?.message || "Save failed"),
  });

  const complete = !!profile.data?.profile_complete;
  const isAdmin = user?.roles?.includes("admin");

  // ---- inline validation ----
  const [touched, setTouched] = useState<Partial<Record<keyof Form, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  const validate = (f: Form): Partial<Record<keyof Form, string>> => {
    const e: Partial<Record<keyof Form, string>> = {};
    if (f.name.trim().length < 2) e.name = "Name must be at least 2 characters.";
    const phoneDigits = f.phone.replace(/\D/g, "");
    if (phoneDigits.length < 7) e.phone = "Enter a valid phone number (digits only, min 7).";
    const tg = f.telegram.trim().replace(/^@/, "");
    if (!/^[a-zA-Z0-9_]{3,32}$/.test(tg)) e.telegram = "Telegram username: 3–32 chars, letters/digits/underscore.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.personal_email.trim())) e.personal_email = "Enter a valid email address.";
    else if (f.personal_email.trim().toLowerCase() === (user?.email ?? "").toLowerCase()) e.personal_email = "Must differ from your agent login email.";
    if (f.address.trim().length < 5) e.address = "Address must be at least 5 characters.";
    if (f.group_link.trim() && !/^https?:\/\/.+/i.test(f.group_link.trim())) e.group_link = "Group link must start with http(s)://";
    return e;
  };

  const errors = validate(form);
  const hasErrors = Object.keys(errors).length > 0;
  const showErr = (k: keyof Form) => (submitted || touched[k]) && errors[k];

  const Field = ({ name, label, value, onChange, type = "text", required = true, placeholder, hint, textarea }: {
    name: keyof Form; label: string; value: string; onChange: (v: string) => void;
    type?: string; required?: boolean; placeholder?: string; hint?: string; textarea?: boolean;
  }) => {
    const err = showErr(name);
    const cls = `w-full bg-background border rounded-md px-3 py-2 text-sm transition ${err ? "border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-200" : "border-border focus:border-primary/60 focus:ring-2 focus:ring-primary/20"}`;
    return (
      <label className="block">
        <span className="text-xs font-bold mb-1 block">{label}{required && <span className="text-rose-500 ml-0.5">*</span>}</span>
        {textarea ? (
          <textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, [name]: true }))} placeholder={placeholder} className={cls} />
        ) : (
          <input type={type} value={value} onChange={(e) => onChange(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, [name]: true }))} placeholder={placeholder} className={cls} />
        )}
        {err ? (
          <p className="text-[11px] text-rose-600 mt-1 font-medium">{errors[name]}</p>
        ) : hint ? (
          <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>
        ) : null}
      </label>
    );
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      toast.error("Please fix the highlighted fields before saving.");
      return;
    }
    save.mutate();
  };

  return (
    <AppShell>
      <PageHeader icon={<Settings className="size-6" />} title="Agent Profile" subtitle="Complete your personal details. Required before approving any user." />

      {!complete && (
        <div className="mb-4 rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 p-4 flex items-start gap-3">
          <AlertTriangle className="size-5 text-amber-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold text-amber-800 dark:text-amber-300">Profile incomplete</p>
            <p className="text-amber-700 dark:text-amber-400/90 text-xs mt-0.5">
              You must fill all required fields (marked <span className="text-rose-500">*</span>) before you can approve users under your agent account.
            </p>
          </div>
        </div>
      )}

      {complete && (
        <div className="mb-4 rounded-xl border border-emerald-300/60 bg-emerald-50 dark:bg-emerald-950/30 p-4 flex items-center gap-3">
          <CheckCircle2 className="size-5 text-emerald-600" />
          <p className="text-sm text-emerald-800 dark:text-emerald-300 font-bold">Profile complete — you can manage users.</p>
        </div>
      )}

      <div className="glass-panel-strong p-6 max-w-2xl">
        <dl className="mb-5 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg border border-border p-3">
            <dt className="text-muted-foreground">Login email</dt>
            <dd className="font-mono font-bold">{user?.email}</dd>
          </div>
          <div className="rounded-lg border border-border p-3">
            <dt className="text-muted-foreground">Roles</dt>
            <dd className="font-mono">{user?.roles?.join(", ")}</dd>
          </div>
        </dl>

        <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field name="name" label="Full Name" value={form.name} onChange={(v: string) => setForm({ ...form, name: v })} placeholder="e.g. Rakib Hasan" />
          <Field name="phone" label="Phone Number" value={form.phone} onChange={(v: string) => setForm({ ...form, phone: v })} placeholder="+8801XXXXXXXXX" />
          <Field name="telegram" label="Telegram ID / Username" value={form.telegram} onChange={(v: string) => setForm({ ...form, telegram: v })} placeholder="@yourhandle" hint="Without spaces. We strip the leading @ automatically." />
          <Field name="personal_email" label="Personal Email" type="email" value={form.personal_email} onChange={(v: string) => setForm({ ...form, personal_email: v })} placeholder="you@gmail.com" hint="Different from your agent login email." />
          <div className="sm:col-span-2">
            <Field name="address" label="Address" value={form.address} onChange={(v: string) => setForm({ ...form, address: v })} placeholder="House, road, area, city, country" textarea />
          </div>
          <div className="sm:col-span-2">
            <Field name="group_link" label="Group Link (optional)" required={false} value={form.group_link} onChange={(v: string) => setForm({ ...form, group_link: v })} placeholder="https://t.me/yourgroup" hint="If you run a Telegram/WhatsApp/FB group for your users, share the link." />
          </div>

          {submitted && hasErrors && (
            <div className="sm:col-span-2 rounded-lg border border-rose-300/60 bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-700 dark:text-rose-300">
              {Object.keys(errors).length} field(s) need attention. Scroll up and fix the red highlighted inputs.
            </div>
          )}

          <div className="sm:col-span-2 flex items-center justify-end gap-2 pt-2 border-t border-border mt-2">
            {isAdmin && (
              <button type="button" onClick={() => navigate({ to: "/agent/users" })} className="text-xs px-3 py-2 rounded-lg hover:bg-accent">Skip (admin)</button>
            )}
            <button
              type="submit"
              disabled={save.isPending || hasErrors}
              title={hasErrors ? "Fix the highlighted fields first" : "Save profile"}
              className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-xs font-bold shadow-md shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="size-3.5" /> {save.isPending ? "Saving…" : "Save profile"}
            </button>
          </div>
        </form>
      </div>

    </AppShell>
  );
}
