import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { ListChecks } from "lucide-react";

export const Route = createFileRoute("/access-list")({
  head: () => ({ meta: [{ title: "Access List — Nexus SMS" }] }),
  component: () => (<Protected><Page /></Protected>),
});

function Page() {
  return (
    <AppShell>
      <PageHeader icon={<ListChecks className="size-6" />} title="Access List" subtitle="Recently active services and ranges." />
      <div className="glass-panel-strong p-12 text-center">
        <ListChecks className="mx-auto size-12 text-muted-foreground/40" />
        <h2 className="mt-4 text-2xl font-bold tracking-tight">Coming soon</h2>
      </div>
    </AppShell>
  );
}
