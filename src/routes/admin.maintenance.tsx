import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { getPublicSettingsFn } from "@/lib/settings.functions";
import { adminListNoticesFn, type NoticeRow } from "@/lib/notices.functions";
import {
  AlertTriangle, ShieldAlert, UserPlus, Megaphone, CheckCircle2,
  XCircle, Wrench, Settings as SettingsIcon, Radio,
} from "lucide-react";

export const Route = createFileRoute("/admin/maintenance")({
  head: () => ({ meta: [{ title: "Admin · Maintenance Overview — Nexus X" }] }),
  component: () => (<Protected><MaintenanceOverview /></Protected>),
});

function StatusCard({
  title, on, onLabel, offLabel, icon, description, accent,
}: {
  title: string;
  on: boolean;
  onLabel: string;
  offLabel: string;
  icon: React.ReactNode;
  description: string;
  accent: "danger" | "warning" | "success";
}) {
  const tones = {
    danger: {
      ring: "ring-[color:color-mix(in_oklab,var(--color-destructive)_30%,transparent)]",
      bg: "bg-[color:color-mix(in_oklab,var(--color-destructive)_8%,var(--color-card))]",
      text: "text-[color:var(--color-destructive)]",
      dot: "bg-[color:var(--color-destructive)]",
    },
    warning: {
      ring: "ring-[color:color-mix(in_oklab,var(--color-warning)_30%,transparent)]",
      bg: "bg-[color:color-mix(in_oklab,var(--color-warning)_8%,var(--color-card))]",
      text: "text-[color:var(--color-warning)]",
      dot: "bg-[color:var(--color-warning)]",
    },
    success: {
      ring: "ring-[color:color-mix(in_oklab,var(--color-success)_30%,transparent)]",
      bg: "bg-[color:color-mix(in_oklab,var(--color-success)_8%,var(--color-card))]",
      text: "text-[color:var(--color-success)]",
      dot: "bg-[color:var(--color-success)]",
    },
  };
  const t = on ? tones[accent] : tones.success;
  return (
    <div className={`rounded-3xl border border-border ${t.bg} p-5 shadow-sm ring-1 ${t.ring}`}>
      <div className="flex items-start justify-between">
        <div className={`flex size-10 items-center justify-center rounded-2xl ${t.text}`}>
          {icon}
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${t.text}`}>
          <span className={`size-1.5 animate-pulse rounded-full ${t.dot}`} />
          {on ? onLabel : offLabel}
        </span>
      </div>
      <h3 className="mt-3 text-base font-bold text-foreground">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function MaintenanceOverview() {
  const { user, token } = useAuth();
  const isAdmin = !!user?.roles?.includes("admin");
  const callSettings = useServerFn(getPublicSettingsFn);
  const callNotices = useServerFn(adminListNoticesFn);

  const settings = useQuery({
    queryKey: ["public-settings-admin"],
    queryFn: () => callSettings(),
    enabled: isAdmin,
    refetchInterval: 15_000,
  });

  const notices = useQuery({
    queryKey: ["admin-notices-overview"],
    queryFn: () => callNotices({ data: { token: token! } }),
    enabled: !!token && isAdmin,
    refetchInterval: 20_000,
  });

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="glass-panel-strong p-12 text-center">
          <AlertTriangle className="mx-auto size-10 text-destructive" />
          <h2 className="mt-3 text-xl font-bold">Admin only</h2>
        </div>
      </AppShell>
    );
  }

  const s = settings.data;
  const now = Date.now();
  const activeNotices: NoticeRow[] = (notices.data ?? []).filter((n) => {
    if (!n.active) return false;
    if (n.starts_at && new Date(n.starts_at).getTime() > now) return false;
    if (n.ends_at && new Date(n.ends_at).getTime() < now) return false;
    return true;
  });
  const latest = activeNotices[0] ?? null;

  return (
    <AppShell>
      <PageHeader
        icon={<Wrench className="size-6" />}
        title="Maintenance Overview"
        subtitle="At-a-glance status of site gates and the latest broadcast notice."
      />

      {(settings.isLoading || notices.isLoading) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-3xl bg-muted" />
          ))}
        </div>
      )}

      {settings.error && (
        <div className="glass-panel-strong p-6 text-sm text-destructive">
          Failed to load settings: {(settings.error as Error).message}
        </div>
      )}

      {s && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatusCard
              title="Full Maintenance Mode"
              on={s.maintenance_mode}
              onLabel="Active · Users blocked"
              offLabel="Off · System live"
              icon={<ShieldAlert className="size-5" />}
              description={
                s.maintenance_mode
                  ? "Non-admin logins are rejected. Admins bypass the gate."
                  : "All users can log in normally."
              }
              accent="danger"
            />
            <StatusCard
              title="Maintenance Banner (Soft)"
              on={s.maintenance_banner_enabled}
              onLabel="Banner Shown"
              offLabel="Hidden"
              icon={<AlertTriangle className="size-5" />}
              description={
                s.maintenance_banner_enabled
                  ? "Users see a sitewide banner but can still use the app."
                  : "No maintenance banner is shown to users."
              }
              accent="warning"
            />
            <StatusCard
              title="Signups"
              on={!s.signup_enabled}
              onLabel="Paused"
              offLabel="Open"
              icon={s.signup_enabled ? <UserPlus className="size-5" /> : <XCircle className="size-5" />}
              description={
                s.signup_enabled
                  ? "New users can register from the signup page."
                  : "Signup form is locked — new registrations are paused."
              }
              accent="danger"
            />
          </div>

          {(s.maintenance_mode || s.maintenance_banner_enabled) && (
            <div className="mt-4 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <Megaphone className="size-3.5" /> Maintenance Message
              </div>
              <p className="mt-2 text-sm text-foreground">{s.maintenance_message}</p>
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="glass-panel-strong overflow-hidden lg:col-span-2">
              <div className="flex items-center justify-between border-b border-border/50 p-4">
                <div className="flex items-center gap-2">
                  <Radio className="size-4 text-primary" />
                  <h3 className="font-bold">Latest Active Notice</h3>
                </div>
                <Link
                  to="/admin/notices"
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:border-primary/40 hover:text-primary"
                >
                  Manage notices →
                </Link>
              </div>
              <div className="p-5">
                {latest ? (
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                        {latest.type}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        latest.priority === "critical"
                          ? "bg-[color:color-mix(in_oklab,var(--color-destructive)_15%,transparent)] text-[color:var(--color-destructive)]"
                          : latest.priority === "warning"
                          ? "bg-[color:color-mix(in_oklab,var(--color-warning)_15%,transparent)] text-[color:var(--color-warning)]"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {latest.priority}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Updated {new Date(latest.updated_at).toLocaleString()}
                      </span>
                    </div>
                    <h4 className="mt-3 text-lg font-bold">{latest.title}</h4>
                    {latest.body && (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{latest.body}</p>
                    )}
                    <div className="mt-3 text-[11px] text-muted-foreground">
                      Audience:{" "}
                      {latest.target_user_ids && latest.target_user_ids.length > 0
                        ? `${latest.target_user_ids.length} targeted user(s)`
                        : "All users (broadcast)"}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckCircle2 className="size-10 text-muted-foreground/50" />
                    <p className="mt-2 text-sm font-medium text-foreground">No active notices</p>
                    <p className="text-xs text-muted-foreground">
                      Create one to broadcast to users on login.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="glass-panel-strong overflow-hidden">
              <div className="border-b border-border/50 p-4">
                <h3 className="font-bold">Quick Actions</h3>
                <p className="text-xs text-muted-foreground">Jump to the relevant admin tool</p>
              </div>
              <div className="divide-y divide-border">
                <Link to="/admin/settings" className="flex items-center justify-between p-4 hover:bg-muted/40">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <SettingsIcon className="size-4 text-primary" /> Toggle Maintenance / Signups
                  </span>
                  <span className="text-xs text-muted-foreground">→</span>
                </Link>
                <Link to="/admin/notices" className="flex items-center justify-between p-4 hover:bg-muted/40">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <Megaphone className="size-4 text-primary" /> Create / Edit Notices
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {activeNotices.length} active
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
