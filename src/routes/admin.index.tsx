import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { ShieldCheck, Wallet, DollarSign, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin — Nexus SMS" }] }),
  component: () => (<Protected><AdminHome /></Protected>),
});

function AdminHome() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes("admin");
  if (!isAdmin) {
    return (
      <AppShell>
        <div className="glass-panel-strong p-12 text-center">
          <AlertTriangle className="mx-auto size-10 text-destructive" />
          <h2 className="mt-3 text-xl font-bold">Admin only</h2>
          <p className="mt-1 text-sm text-muted-foreground">You don't have permission to view this area.</p>
        </div>
      </AppShell>
    );
  }
  return (
    <AppShell>
      <PageHeader icon={<ShieldCheck className="size-6" />} title="Admin Panel" subtitle="Manage withdrawals and payout pricing." />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to="/admin/withdrawals" className="glass-panel-strong p-6 hover:border-primary">
          <Wallet className="size-6 accent-text" />
          <h3 className="mt-2 font-bold text-lg">Withdrawals</h3>
          <p className="text-sm text-muted-foreground">Approve, reject, or mark payouts as paid.</p>
        </Link>
        <Link to="/admin/payouts" className="glass-panel-strong p-6 hover:border-primary">
          <DollarSign className="size-6 accent-text" />
          <h3 className="mt-2 font-bold text-lg">Payout Pricing</h3>
          <p className="text-sm text-muted-foreground">Set OTP payout per service & country.</p>
        </Link>
      </div>
    </AppShell>
  );
}
