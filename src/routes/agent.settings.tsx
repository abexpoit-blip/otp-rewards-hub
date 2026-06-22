import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { AgentProtected } from "@/components/AgentProtected";
import { useAuth } from "@/lib/auth";
import { Settings } from "lucide-react";

export const Route = createFileRoute("/agent/settings")({
  head: () => ({ meta: [{ title: "Agent · Settings — Nexus X" }] }),
  component: () => (<AgentProtected><AgentSettings /></AgentProtected>),
});

function AgentSettings() {
  const { user } = useAuth();
  return (
    <AppShell>
      <PageHeader icon={<Settings className="size-6" />} title="Agent Settings" subtitle="Your agent profile (read-only). Contact admin to change your OTP rate or password." />
      <div className="glass-panel-strong p-6 max-w-xl">
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between"><dt className="text-muted-foreground">Email</dt><dd className="font-mono">{user?.email}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Name</dt><dd>{user?.name || "—"}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Phone</dt><dd>{user?.phone || "—"}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Roles</dt><dd>{user?.roles?.join(", ")}</dd></div>
        </dl>
        <p className="mt-6 text-xs text-muted-foreground">
          Share <b>{user?.email}</b> with people who want to sign up under your agent. They must enter this email on the signup page.
        </p>
      </div>
    </AppShell>
  );
}
