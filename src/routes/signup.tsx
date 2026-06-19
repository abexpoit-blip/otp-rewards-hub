import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
import { Lock, Wrench } from "lucide-react";

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
  });
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();
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
    setLoading(true);
    try {
      await signup(form);
      navigate({ to: "/" });
    } catch (e: any) {
      setErr(e?.message || "Could not create account.");
    } finally {
      setLoading(false);
    }
  };

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
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Full Name">
          <TextInput
            required
            placeholder="Jon Doe"
            value={form.name}
            onChange={set("name")}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Email">
            <TextInput
              type="email"
              required
              placeholder="name@nexus.io"
              value={form.email}
              onChange={set("email")}
            />
          </Field>
          <Field label="Phone">
            <TextInput
              type="tel"
              required
              placeholder="+1…"
              value={form.phone}
              onChange={set("phone")}
            />
          </Field>
        </div>

        <Field label="Password">
          <TextInput
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            placeholder="At least 6 characters"
            value={form.password}
            onChange={set("password")}
          />
        </Field>

        <div className="rounded-md border border-amber-400/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-[11px] leading-relaxed p-2.5 flex gap-2">
          <span className="text-base leading-none">⚠️</span>
          <span>
            <b>Inactivity policy:</b> if you don't log in for <b>14 consecutive days</b>, your account will be
            automatically deleted along with all data, API keys, and any zero-balance history. Keep your balance positive
            or log in regularly to stay active.
          </span>
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          By creating an account you accept the operator terms and live-monitoring policy.
        </p>

        <ErrorBox>{err}</ErrorBox>

        <PrimaryButton type="submit" loading={loading}>
          Create Account
        </PrimaryButton>
      </form>
    </AuthShell>
  );
}
