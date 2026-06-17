import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { Radio } from "lucide-react";

export const Route = createFileRoute("/console")({
  head: () => ({ meta: [{ title: "Console — Nexus SMS" }] }),
  component: () => (<Protected><Page /></Protected>),
});

function Page() {
  return (
    <AppShell>
      <PageHeader icon={<Radio className="size-6" />} title="Live Console" subtitle="Global live feed of recent hits across all panels." />
      <div className="glass-panel-strong p-12 text-center">
        <Radio className="mx-auto size-12 text-muted-foreground/40" />
        <h2 className="mt-4 text-2xl font-bold tracking-tight">Coming soon</h2>
        <p className="mt-2 text-sm text-muted-foreground">Will stream from stex /console endpoint.</p>
      </div>
    </AppShell>
  );
}
