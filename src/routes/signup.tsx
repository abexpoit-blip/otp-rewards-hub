import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AuthShell,
  ErrorBox,
  Field,
  PrimaryButton,
  TextInput,
  useFormState,
} from "@/components/AuthShell";
import { useAuth } from "@/lib/auth";
import { getPublicSettingsFn } from "@/lib/settings.functions";
import { Lock, Wrench, CheckCircle2, UserCheck } from "lucide-react";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign up — Nexus SMS" },
      { name: "description", content: "Create your Nexus SMS operator account." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const [form, set] = useFormState({
    name: "",
    email: "",
    phone: "",
    password: "",
    agent_email: "",
  });
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const { signup } = useAuth();
  const callPublic = useServerFn(getPublicSettingsFn);
  const { data: pub } = useQuery({
    queryKey: ["public-settings-signup"],
    queryFn: () => callPublic(),
    staleTime: 30_000,
  });

  const signupBlocked = !!pub && (!pub.signup_enabled || pub.maintenance_mode);
  const blockReason = pub?.maintenance_mode
    ? (pub.maintenance_message || "System is under maintenance — signups are paused.")
    : "New signups are temporarily disabled by the admin. Please check back later.";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (signupBlocked) { setErr(blockReason); return; }
    if (form.password.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }
    if (!form.agent_email.trim()) {
      setErr("Agent email is required.");
      return;
    }
    setLoading(true);
    try {
      const r = await signup(form);
      setSuccess(r.message);
    } catch (e: any) {
      setErr(e?.message || "Could not create account.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthShell
        title="Account submitted!"
        subtitle="Awaiting agent approval"
        footer={
          <Link to="/login" className="font-semibold accent-text hover:underline">Back to login</Link>
        }
      >
        <div className="rounded-2xl border border-emerald-400/40 bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 p-5 text-center">
          <CheckCircle2 className="mx-auto size-12 text-emerald-600 mb-2" />
          <p className="text-sm font-medium text-emerald-900 whitespace-pre-wrap">{success}</p>
        </div>
        <p className="mt-4 text-xs text-muted-foreground text-center">
          You'll be able to log in once your agent approves the account.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Provision a fresh operator profile on the Nexus network."
      footer={
        <>
          Already onboarded?{" "}
          <Link to="/login" className="font-semibold accent-text hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {signupBlocked && (
        <div className="mb-4 rounded-xl border border-amber-400/50 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 p-3 flex items-start gap-2.5 text-amber-900">
          {pub?.maintenance_mode ? <Wrench className="size-5 mt-0.5 shrink-0" /> : <Lock className="size-5 mt-0.5 shrink-0" />}
          <div className="text-xs">
            <div className="font-bold text-sm mb-0.5">
              {pub?.maintenance_mode ? "System under maintenance" : "Signups are paused"}
            </div>
            <p className="opacity-90">{blockReason}</p>
          </div>
        </div>
      )}

      <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-start gap-2.5">
        <UserCheck className="size-5 mt-0.5 shrink-0 text-primary" />
        <div className="text-xs">
          <div className="font-bold text-sm mb-0.5">Agent email required</div>
          <p className="opacity-90">
            You must enter your <b>agent's email</b> below. Without a valid agent email no account can be created.
            After signup, your agent will approve your account.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <fieldset disabled={signupBlocked} className="space-y-4 disabled:opacity-60">
        <Field label="Full Name">
          <TextInput required placeholder="Jon Doe" value={form.name} onChange={set("name")} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Email">
            <TextInput type="email" required placeholder="name@nexus.io" value={form.email} onChange={set("email")} />
          </Field>
          <Field label="Phone">
            <TextInput type="tel" required placeholder="+1…" value={form.phone} onChange={set("phone")} />
          </Field>
        </div>

        <Field label="Agent Email (required)">
          <TextInput
            type="email"
            required
            placeholder="agent@v2.nexus-x.site"
            value={form.agent_email}
            onChange={set("agent_email")}
          />
        </Field>

        <Field label="Password">
          <TextInput type="password" autoComplete="new-password" required minLength={6} placeholder="At least 6 characters" value={form.password} onChange={set("password")} />
        </Field>

        <div className="rounded-md border border-amber-400/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-[11px] leading-relaxed p-2.5 flex gap-2">
          <span className="text-base leading-none">⚠️</span>
          <span>
            <b>Inactivity policy:</b> if you don't log in for <b>14 consecutive days</b>, your account will be
            automatically deleted along with all data.
          </span>
        </div>

        <ErrorBox>{err}</ErrorBox>

        <PrimaryButton type="submit" loading={loading} disabled={signupBlocked}>
          {signupBlocked ? "Signups closed" : "Request Account"}
        </PrimaryButton>
        </fieldset>
      </form>
    </AuthShell>
  );
}
