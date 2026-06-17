import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { LineChart } from "lucide-react";

export const Route = createFileRoute("/summary")({
  head: () => ({ meta: [{ title: "Summary — Nexus SMS" }] }),
  component: () => (<Protected><Page /></Protected>),
});

function Page() {
  return (
    <AppShell>
      <PageHeader icon={<LineChart className="size-6" />} title="Summary" subtitle="Earnings breakdown and per-service analytics." />
      <div className="glass-panel-strong p-12 text-center">
        <LineChart className="mx-auto size-12 text-muted-foreground/40" />
        <h2 className="mt-4 text-2xl font-bold tracking-tight">Coming soon</h2>
      </div>
    </AppShell>
  );
}
