import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { Tags } from "lucide-react";

export const Route = createFileRoute("/sender-range")({
  head: () => ({ meta: [{ title: "Sender / Range — Nexus SMS" }] }),
  component: () => (<Protected><Page /></Protected>),
});

function Page() {
  return (
    <AppShell>
      <PageHeader icon={<Tags className="size-6" />} title="Sender / Range" subtitle="Browse senders and pick number ranges." />
      <div className="glass-panel-strong p-12 text-center">
        <Tags className="mx-auto size-12 text-muted-foreground/40" />
        <h2 className="mt-4 text-2xl font-bold tracking-tight">Coming soon</h2>
      </div>
    </AppShell>
  );
}
