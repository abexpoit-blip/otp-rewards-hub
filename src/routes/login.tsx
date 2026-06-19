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
import { Wrench } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — Nexus SMS" },
      { name: "description", content: "Sign in to the Nexus SMS operator panel." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [form, set] = useFormState({ email: "", password: "" });
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const callPublic = useServerFn(getPublicSettingsFn);
  const { data: pub } = useQuery({
    queryKey: ["public-settings-login"],
    queryFn: () => callPublic(),
    staleTime: 30_000,
  });
  const fullMaintenance = !!pub?.maintenance_mode;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate({ to: "/" });
    } catch (e: any) {
      setErr(e?.message || "Login failed. Check credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Enter your credentials to access the Nexus dialer."
      footer={
        <>
          New operator?{" "}
          <Link to="/signup" className="font-semibold accent-text hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {fullMaintenance && (
        <div className="mb-4 rounded-xl border border-amber-400/50 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 p-3 flex items-start gap-2.5 text-amber-900">
          <Wrench className="size-5 mt-0.5 shrink-0 animate-pulse" />
          <div className="text-xs">
            <div className="font-bold text-sm mb-0.5">System under maintenance</div>
            <p className="opacity-90">{pub?.maintenance_message || "We're upgrading the system. Please check back shortly. Only admins can sign in right now."}</p>
          </div>
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-4">

        <Field label="Email Address">
          <TextInput
            type="email"
            autoComplete="email"
            required
            placeholder="operator@nexus.io"
            value={form.email}
            onChange={set("email")}
          />
        </Field>

        <Field
          label="Password"
          hint={
            <Link to="/login" className="text-[11px] accent-text/80 hover:underline">
              Forgot?
            </Link>
          }
        >
          <TextInput
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            value={form.password}
            onChange={set("password")}
          />
        </Field>

        <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <input type="checkbox" className="accent-primary size-3.5" defaultChecked />
          Keep me signed in
        </label>

        <ErrorBox>{err}</ErrorBox>

        <PrimaryButton type="submit" loading={loading}>
          Sign In
        </PrimaryButton>
      </form>
    </AuthShell>
  );
}
