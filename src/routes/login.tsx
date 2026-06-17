import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  AuthShell,
  ErrorBox,
  Field,
  PrimaryButton,
  TextInput,
  useFormState,
} from "@/components/AuthShell";
import { useAuth } from "@/lib/auth";

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
