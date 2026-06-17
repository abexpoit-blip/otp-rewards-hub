import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import {
  Activity,
  ChevronRight,
  Crown,
  Globe2,
  MessageSquare,
  ShieldCheck,
  Wallet,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Nexus SMS" },
      { name: "description", content: "Live OTP traffic, top performers and earnings at a glance." },
    ],
  }),
  component: Dashboard,
});

const stats = [
  { label: "Today Revenue", value: "$0.00", hint: "Earnings from successful OTPs", icon: Zap, tone: "accent" },
  { label: "Today OTPs", value: "0", hint: "Total successful verifications", icon: MessageSquare, tone: "info" },
  { label: "Yesterday Revenue", value: "$0.00", hint: "Previous day performance", icon: Wallet, tone: "purple" },
  { label: "Yesterday OTPs", value: "0", hint: "Completed verifications", icon: ShieldCheck, tone: "accent" },
];

const hourlyData = Array.from({ length: 24 }, (_, i) => ({
  hour: `${String(i).padStart(2, "0")}:00`,
  value: 0,
}));

const trending = [
  { rank: 1, name: "Facebook", color: "var(--color-chart-2)" },
  { rank: 2, name: "FACEBOOK", color: "var(--color-chart-2)" },
  { rank: 3, name: "AUTHMSG", color: "var(--color-muted-foreground)" },
  { rank: 4, name: "Elephantbet", color: "var(--color-muted-foreground)" },
  { rank: 5, name: "Telegram", color: "var(--color-chart-2)" },
  { rank: 6, name: "alymscintl", color: "var(--color-muted-foreground)" },
  { rank: 7, name: "VERIFY", color: "var(--color-muted-foreground)" },
  { rank: 8, name: "OPENAI", color: "hsl(var(--accent-hsl))" },
  { rank: 9, name: "IndiGo", color: "var(--color-muted-foreground)" },
  { rank: 10, name: "X App", color: "var(--color-muted-foreground)" },
];

function Dashboard() {
  return (
    <AppShell>
      {/* Welcome */}
      <div className="mb-6">
        <h1 className="text-4xl font-bold tracking-tight">
          Welcome back, <span className="accent-text">User</span>!
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here's what's happening with your account today.
        </p>
      </div>

      {/* Announcement */}
      <div className="mb-6 flex gap-3 rounded-2xl border border-warning/30 bg-warning/5 p-4 text-sm">
        <span className="text-lg">📣</span>
        <div className="space-y-1">
          <p>
            <span className="font-semibold">Welcome to Nexus SMS V2!</span> New High Access Panel with real-time
            OTPs. Contact your Team Lead and start earning again.
          </p>
          <p className="text-muted-foreground">
            Auto payment system update coming soon. Join our Telegram channel for updates:{" "}
            <span className="accent-text font-mono">@nexussupport</span>
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Hourly Traffic */}
      <div className="mb-6 rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="size-4 accent-text" />
            <h3 className="font-semibold">Hourly Traffic</h3>
          </div>
          <LiveBadge />
        </div>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={hourlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="hourlyFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--accent-hsl))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--accent-hsl))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--accent-hsl))"
                strokeWidth={2}
                fill="url(#hourlyFill)"
                dot={{ fill: "hsl(var(--accent-hsl))", r: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Two-column bottom */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Top Performers */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Crown className="size-4 accent-text" />
            <h3 className="font-semibold">Your Top Performers</h3>
          </div>
          <div className="mb-2 grid grid-cols-3 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Service</span>
            <span>Volume</span>
            <span className="text-right">Earnings</span>
          </div>
          <div className="grid h-[180px] place-items-center text-center text-sm text-muted-foreground">
            <div>
              <MessageSquare className="mx-auto mb-2 size-6 opacity-40" />
              <p>No activity recorded today</p>
            </div>
          </div>
        </div>

        {/* Global Trending */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe2 className="size-4 accent-text" />
              <h3 className="font-semibold">Global Trending</h3>
            </div>
            <LiveBadge />
          </div>
          <ul className="space-y-1.5">
            {trending.map((t) => (
              <li
                key={t.rank}
                className="flex items-center gap-3 rounded-xl bg-muted/30 px-3 py-2 transition hover:bg-muted/60"
              >
                <span
                  className={`grid size-6 place-items-center rounded-md text-[11px] font-bold ${
                    t.rank === 1
                      ? "accent-bg"
                      : t.rank === 2
                        ? "bg-muted text-foreground"
                        : t.rank === 3
                          ? "bg-orange-500/80 text-white"
                          : "bg-muted text-muted-foreground"
                  }`}
                >
                  {t.rank}
                </span>
                <MessageSquare className="size-3.5" style={{ color: t.color }} />
                <span className="flex-1 text-sm font-medium">{t.name}</span>
                <Sparkline color={t.color} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "accent" | "info" | "purple";
}) {
  const toneClass =
    tone === "accent"
      ? "accent-bg-soft"
      : tone === "info"
        ? "bg-info/15 text-info"
        : "bg-chart-3/20 text-chart-3";
  return (
    <div className="rounded-2xl border border-border bg-card p-5 transition hover:border-border/80">
      <div className="mb-4 flex items-start justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className={`grid size-9 place-items-center rounded-xl ${toneClass}`}>
          <Icon className="size-4" />
        </div>
      </div>
      <div className="font-mono text-3xl font-bold tracking-tight" data-mask>
        {value}
      </div>
      <div className="mt-2 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-info/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-info">
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-info opacity-75" />
        <span className="relative inline-flex size-1.5 rounded-full bg-info" />
      </span>
      Live
    </span>
  );
}

function Sparkline({ color }: { color: string }) {
  const data = Array.from({ length: 14 }, (_, i) => ({
    x: i,
    y: Math.random() * 50 + Math.sin(i / 2) * 10 + 30,
  }));
  return (
    <div className="h-6 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="y" stroke={color} strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
