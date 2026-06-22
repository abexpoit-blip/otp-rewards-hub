import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/AppShell";
import { AgentProtected } from "@/components/AgentProtected";
import { useAuth } from "@/lib/auth";
import { agentDashboardStatsFn } from "@/lib/agent.functions";
import { LayoutDashboard, Users, UserPlus, Wallet, MessageSquare, Sparkles, Activity } from "lucide-react";

export const Route = createFileRoute("/agent/")({
  head: () => ({ meta: [{ title: "Agent · Dashboard — Nexus X" }] }),
  component: () => (<AgentProtected><AgentHome /></AgentProtected>),
});

function Tile({ label, value, icon, accent = "primary", to }: any) {
  return (
    <Link to={to} className="group relative block overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md">
      <div className="absolute -right-10 -top-10 size-32 rounded-full opacity-30 blur-3xl" style={{ background: `var(--color-${accent})` }} />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <span className="inline-flex size-6 items-center justify-center rounded-lg" style={{ background: `color-mix(in oklab, var(--color-${accent}) 15%, transparent)`, color: `var(--color-${accent})` }}>{icon}</span>
            {label}
          </div>
          <div className="mt-2 text-3xl font-extrabold tracking-tight">{value}</div>
        </div>
      </div>
    </Link>
  );
}

function AgentHome() {
  const { user, token } = useAuth();
  const call = useServerFn(agentDashboardStatsFn);
  const { data, isLoading } = useQuery({
    queryKey: ["agent-stats"],
    queryFn: () => call({ data: { token: token! } }),
    enabled: !!token,
    refetchInterval: 15_000,
  });

  return (
    <AppShell>
      <PageHeader icon={<LayoutDashboard className="size-6" />} title="Agent Dashboard" subtitle={`Welcome${user?.name ? `, ${user.name}` : ""} — your under-agent overview.`} />

      {isLoading || !data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0,1,2,3].map((i) => (<div key={i} className="h-32 animate-pulse rounded-3xl bg-muted" />))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Total Users" value={data.total_users} icon={<Users className="size-3.5" />} accent="primary" to="/agent/users" />
            <Tile label="Pending Approval" value={data.pending_users} icon={<UserPlus className="size-3.5" />} accent="chart-2" to="/agent/users" />
            <Tile label="OTPs Today" value={data.otps_today} icon={<Activity className="size-3.5" />} accent="chart-3" to="/agent/users" />
            <Tile label="Pending Withdrawals" value={data.pending_withdrawals} icon={<Wallet className="size-3.5" />} accent="chart-4" to="/agent/withdrawals" />
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="glass-panel-strong p-5">
              <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Earned Today (under you)</div>
              <div className="mt-1 text-2xl font-extrabold">৳{Number(data.earned_today).toFixed(2)}</div>
              <p className="mt-2 text-xs text-muted-foreground">Sum of payouts credited to your users today.</p>
            </div>
            <div className="glass-panel-strong p-5">
              <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Lifetime Earned</div>
              <div className="mt-1 text-2xl font-extrabold">৳{Number(data.lifetime_earned).toFixed(2)}</div>
              <p className="mt-2 text-xs text-muted-foreground">All-time earnings across your users.</p>
            </div>
            <Link to="/agent/support" className="glass-panel-strong p-5 hover:border-primary/40 block">
              <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground flex items-center gap-2"><MessageSquare className="size-3.5" /> Need help?</div>
              <div className="mt-1 text-base font-bold">Contact Admin Support</div>
              <p className="mt-2 text-xs text-muted-foreground">Send a message to admin from your support inbox.</p>
              <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary"><Sparkles className="size-3.5" /> Open support →</div>
            </Link>
          </div>
        </>
      )}
    </AppShell>
  );
}
