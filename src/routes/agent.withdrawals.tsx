import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { AgentProtected } from "@/components/AgentProtected";
import { Wallet, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/agent/withdrawals")({
  head: () => ({ meta: [{ title: "Agent · Withdrawals — Nexus X" }] }),
  component: () => (<AgentProtected><AgentWithdrawalsMoved /></AgentProtected>),
});

function AgentWithdrawalsMoved() {
  return (
    <AppShell>
      <PageHeader
        icon={<Wallet className="size-6" />}
        title="Withdrawals moved"
        subtitle="Payouts are now handled exclusively by the admin team."
      />
      <div className="glass-panel-strong p-8 max-w-xl mx-auto text-center">
        <div className="mx-auto mb-4 inline-flex items-center justify-center size-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg">
          <Wallet className="size-7" />
        </div>
        <h3 className="text-lg font-bold mb-2">Managed by admin only</h3>
        <p className="text-sm text-muted-foreground mb-5">
          Your job is to onboard and support users. All withdrawal requests are
          now reviewed and paid out by the admin team to keep payouts consistent
          and audited. You can still view each user's balance and lifetime
          earnings from the Users page.
        </p>
        <Link
          to="/agent/users"
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2 text-sm font-bold text-white shadow-md hover:shadow-lg transition"
        >
          Go to My Users <ArrowRight className="size-4" />
        </Link>
      </div>
    </AppShell>
  );
}
