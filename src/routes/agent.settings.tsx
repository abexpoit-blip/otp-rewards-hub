import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState, useMemo } from "react";
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
const REQUIRED_KEYS: (keyof Form)[] = ["name","phone","telegram","personal_email","address"];
const MIN_REQUIRED = 4; // 80% of 5

function validate(f: Form, loginEmail?: string | null): Partial<Record<keyof Form, string>> {
  const e: Partial<Record<keyof Form, string>> = {};
  if (f.name.trim() && f.name.trim().length < 2) e.name = "Name must be at least 2 characters.";
  if (f.phone.trim()) {
    const phoneDigits = f.phone.replace(/\D/g, "");
    if (phoneDigits.length < 7) e.phone = "Enter a valid phone number (min 7 digits).";
  }
  if (f.telegram.trim()) {
    const tg = f.telegram.trim().replace(/^@/, "");
    if (!/^[a-zA-Z0-9_]{3,32}$/.test(tg)) e.telegram = "Telegram: 3–32 chars, letters/digits/underscore.";
  }
  if (f.personal_email.trim()) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.personal_email.trim())) e.personal_email = "Enter a valid email.";
    else if (f.personal_email.trim().toLowerCase() === (loginEmail ?? "").toLowerCase()) e.personal_email = "Must differ from your login email.";
  }
  if (f.address.trim() && f.address.trim().length < 5) e.address = "Address must be at least 5 characters.";
  return e;
}

// IMPORTANT: defined OUTSIDE the component so it doesn't remount on every
// keystroke (that was stealing focus and making typing painful).
function Field({
  name, label, value, onChange, type = "text", required = true,
  placeholder, hint, textarea, error, onBlur,
}: {
  name: keyof Form; label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; placeholder?: string; hint?: string;
  textarea?: boolean; error?: string; onBlur?: () => void;
}) {
  const cls = `w-full bg-background border rounded-md px-3 py-2 text-sm transition ${error ? "border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-200" : "border-border focus:border-primary/60 focus:ring-2 focus:ring-primary/20"}`;
  return (
    <label className="block">
      <span className="text-xs font-bold mb-1 block">{label}{required && <span className="text-rose-500 ml-0.5">*</span>}</span>
      {textarea ? (
        <textarea name={name} rows={2} value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} placeholder={placeholder} className={cls} />
      ) : (
        <input name={name} type={type} value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} placeholder={placeholder} className={cls} />
      )}
      {error ? (
        <p className="text-[11px] text-rose-600 mt-1 font-medium">{error}</p>
      ) : hint ? (
        <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>
      ) : null}
    </label>
  );
}

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
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (profile.data && !hydrated) {
      setForm({
        name: profile.data.name ?? "",
        phone: profile.data.phone ?? "",
        telegram: profile.data.telegram ?? "",
        personal_email: profile.data.personal_email ?? "",
        address: profile.data.address ?? "",
        group_link: profile.data.group_link ?? "",
      });
      setHydrated(true);
    }
  }, [profile.data, hydrated]);

  const errors = useMemo(() => validate(form, user?.email), [form, user?.email]);
  const filled = REQUIRED_KEYS.filter((k) => (form[k] ?? "").trim().length > 0 && !errors[k]).length;
  const pct = Math.round((filled / REQUIRED_KEYS.length) * 100);
  const meetsThreshold = filled >= MIN_REQUIRED;
  const complete = !!profile.data?.profile_complete;
  const isAdmin = user?.roles?.includes("admin");

  const [touched, setTouched] = useState<Partial<Record<keyof Form, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const showErr = (k: keyof Form): string | undefined =>
    (submitted || touched[k]) ? errors[k] : undefined;

  const save = useMutation({
    mutationFn: () => callSave({ data: {
      token: token!,
      name: form.name.trim() || "—",
      phone: form.phone.trim() || "—",
      telegram: form.telegram.trim() || "—",
      personal_email: form.personal_email.trim() || `noreply+${Date.now()}@local`,
      address: form.address.trim() || "—",
      group_link: form.group_link.trim() || null,
    } }),
    onSuccess: () => {
      toast.success("Profile saved.");
      qc.invalidateQueries({ queryKey: ["agent-profile"] });
    },
    onError: (e: any) => toast.error(e?.message || "Save failed"),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    // Block ONLY on inline format errors of fields that ARE filled.
    if (Object.values(errors).some(Boolean)) {
      toast.error("Please fix the highlighted fields before saving.");
      return;
    }
    save.mutate();
  };

  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const blur = (k: keyof Form) => () => setTouched((t) => ({ ...t, [k]: true }));

  return (
    <AppShell>
      <PageHeader icon={<Settings className="size-6" />} title="Agent Profile" subtitle="Fill at least 80% (4 of 5 required fields) to unlock user approvals." />

      <div className={`mb-4 rounded-xl border p-4 ${complete ? "border-emerald-300/60 bg-emerald-50 dark:bg-emerald-950/30" : "border-amber-300/60 bg-amber-50 dark:bg-amber-950/30"}`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            {complete ? <CheckCircle2 className="size-5 text-emerald-600" /> : <AlertTriangle className="size-5 text-amber-600" />}
            <div>
              <p className={`text-sm font-bold ${complete ? "text-emerald-800 dark:text-emerald-300" : "text-amber-800 dark:text-amber-300"}`}>
                {complete ? "Profile unlocked" : meetsThreshold ? "Almost there — save to unlock" : "Profile incomplete"}
              </p>
              <p className={`text-[11px] ${complete ? "text-emerald-700/90" : "text-amber-700/90"}`}>
                {complete ? "You can manage and approve users." : `Fill at least ${MIN_REQUIRED} of ${REQUIRED_KEYS.length} required fields.`}
              </p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${complete ? "bg-emerald-100 border-emerald-300 text-emerald-800" : "bg-amber-100 border-amber-300 text-amber-800"}`}>
            {filled}/{REQUIRED_KEYS.length} · {pct}%
          </span>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
          <div
            className={`h-full transition-all duration-500 ${meetsThreshold ? "bg-gradient-to-r from-emerald-400 to-emerald-600" : "bg-gradient-to-r from-amber-400 to-rose-400"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

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
          <Field name="name" label="Full Name" value={form.name} onChange={set("name")} onBlur={blur("name")} error={showErr("name")} placeholder="e.g. Rakib Hasan" />
          <Field name="phone" label="Phone Number" value={form.phone} onChange={set("phone")} onBlur={blur("phone")} error={showErr("phone")} placeholder="+8801XXXXXXXXX" />
          <Field name="telegram" label="Telegram ID / Username" value={form.telegram} onChange={set("telegram")} onBlur={blur("telegram")} error={showErr("telegram")} placeholder="@yourhandle" hint="Without spaces. Leading @ is fine." />
          <Field name="personal_email" label="Personal Email" type="email" value={form.personal_email} onChange={set("personal_email")} onBlur={blur("personal_email")} error={showErr("personal_email")} placeholder="you@gmail.com" hint="Different from your agent login email." />
          <div className="sm:col-span-2">
            <Field name="address" label="Address" value={form.address} onChange={set("address")} onBlur={blur("address")} error={showErr("address")} placeholder="House, road, area, city, country" textarea />
          </div>
          <div className="sm:col-span-2">
            <Field name="group_link" label="Group Link (optional)" required={false} value={form.group_link} onChange={set("group_link")} onBlur={blur("group_link")} error={showErr("group_link")} placeholder="https://t.me/yourgroup" hint="Your Telegram/WhatsApp/FB group link, if any." />
          </div>

          <div className="sm:col-span-2 flex items-center justify-end gap-2 pt-2 border-t border-border mt-2">
            {isAdmin && (
              <button type="button" onClick={() => navigate({ to: "/agent/users" })} className="text-xs px-3 py-2 rounded-lg hover:bg-accent">Skip (admin)</button>
            )}
            <button
              type="submit"
              disabled={save.isPending}
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
