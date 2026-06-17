import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { Construction } from "lucide-react";

export const Route = createFileRoute("/get-number")({
  head: () => ({ meta: [{ title: "Get Number — Nexus SMS" }] }),
  component: () => (<Protected><ComingSoon /></Protected>),
});

function ComingSoon() {
  return (
    <AppShell>
      <PageHeader icon={<Construction className="size-6" />} title="Get Number" subtitle="Allocate numbers from connected SMS providers." />
      <div className="glass-panel-strong p-12 text-center">
        <Construction className="mx-auto size-12 text-muted-foreground/40" />
        <h2 className="mt-4 text-2xl font-bold tracking-tight">Coming in next update</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          stex API integration shortly — admin needs to add the upstream API key first.
        </p>
      </div>
    </AppShell>
  );
}
