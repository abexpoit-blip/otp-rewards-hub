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
      title="Operator Access"
      subtitle="Secure gateway to Nexus SMS V2 infrastructure."
      footer={
        <>
          New operator?{" "}
          <Link to="/signup" className="text-cyan-400 hover:underline">
            Request uplink
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
          label="Passkey"
          hint={
            <Link to="/login" className="text-[10px] text-cyan-400/80 hover:text-cyan-300">
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

        <label className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
          <input
            type="checkbox"
            className="accent-cyan-500"
            defaultChecked
          />
          Remember_Me
        </label>

        <ErrorBox>{err}</ErrorBox>

        <PrimaryButton type="submit" loading={loading}>
          Initialize Session
        </PrimaryButton>
      </form>
    </AuthShell>
  );
}
