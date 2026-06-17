import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import {
  Activity,
  ArrowUpRight,
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
  component: () => (<Protected><Dashboard /></Protected>),
});

const hourlyData = Array.from({ length: 24 }, (_, i) => ({
  hour: `${String(i).padStart(2, "0")}:00`,
  value: 0,
}));

const trending = [
  { rank: 1, name: "Facebook", color: "#2563eb" },
  { rank: 2, name: "WhatsApp", color: "#16a34a" },
  { rank: 3, name: "AUTHMSG", color: "#94a3b8" },
  { rank: 4, name: "Telegram", color: "#0ea5e9" },
  { rank: 5, name: "OPENAI", color: "#a855f7" },
  { rank: 6, name: "X App", color: "#64748b" },
  { rank: 7, name: "Instagram", color: "#ec4899" },
  { rank: 8, name: "IndiGo", color: "#f59e0b" },
];

function Dashboard() {
  const { user } = useAuth();
  const displayName = user?.name || user?.email?.split("@")[0] || "Operator";
  const balance = user ? Number(user.balance).toFixed(2) : "0.00";

  return (
    <AppShell>
      {/* Header */}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Welcome back, <span className="accent-gradient-text">{displayName}</span>
          </h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Everything is running smoothly today.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white/70 px-4 py-2 text-right shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Balance</p>
            <p className="text-lg font-bold tracking-tight accent-text" data-mask>${balance}</p>
          </div>
        </div>
      </header>

      {/* Announcement */}
      <div className="glass-panel mb-6 flex items-start gap-3 p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-400/15 text-amber-600">
          📣
        </span>
        <div className="space-y-1 text-sm">
          <p className="text-foreground">
            <span className="font-bold">Nexus SMS V2 is live</span> — New High Access Panel with real-time
            OTPs. Contact your Team Lead and start earning again.
          </p>
          <p className="text-muted-foreground">
            Auto payment system update coming soon. Join Telegram:{" "}
            <span className="accent-text font-mono font-semibold">@nexussupport</span>
          </p>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {/* Hero revenue card — spans 2 */}
        <div className="glass-panel-strong relative overflow-hidden p-7 md:col-span-2">
          <div className="relative z-10 flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Today's Revenue</p>
              <h2 className="mt-1 text-5xl font-bold tracking-tighter text-foreground" data-mask>
                $0.00
              </h2>
              <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600">
                <ArrowUpRight className="size-3" />
                +0.0% vs yesterday
              </div>
            </div>
            <div className="hidden h-24 w-48 items-end gap-1.5 sm:flex">
              {[40, 60, 50, 90, 70, 100].map((h, i) => (
                <div
                  key={i}
                  className="w-full rounded-t-lg bg-gradient-to-t from-primary/60 to-primary"
                  style={{ height: `${h}%`, opacity: 0.3 + (i / 6) * 0.7 }}
                />
              ))}
            </div>
          </div>
        </div>

        <StatTile
          label="Today OTPs"
          value="0"
          hint="Success rate 0%"
          icon={<MessageSquare className="size-5" />}
          accent="blue"
        />
        <StatTile
          label="Latency"
          value="42ms"
          hint="Ultra-low response"
          icon={<Zap className="size-5" />}
          accent="indigo"
        />
        <StatTile
          label="Yesterday Revenue"
          value="$0.00"
          hint="Previous day"
          icon={<Wallet className="size-5" />}
          accent="purple"
        />
        <StatTile
          label="Yesterday OTPs"
          value="0"
          hint="Completed verifications"
          icon={<ShieldCheck className="size-5" />}
          accent="sky"
        />
        <StatTile
          label="Active Numbers"
          value="0"
          hint="Currently held"
          icon={<Activity className="size-5" />}
          accent="blue"
        />
        <StatTile
          label="Top Service"
          value="—"
          hint="No traffic yet"
          icon={<Crown className="size-5" />}
          accent="amber"
        />
      </div>

      {/* Chart + Trending row */}
      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="glass-panel-strong p-6 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold tracking-tight text-foreground">Hourly Traffic</h3>
              <p className="text-xs text-muted-foreground">Real-time OTP flow last 24h</p>
            </div>
            <LiveBadge />
          </div>
          <div className="h-[280px]">
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
                    background: "white",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    fontSize: 12,
                    boxShadow: "0 8px 24px -8px rgba(0,0,0,0.1)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--accent-hsl))"
                  strokeWidth={2.5}
                  fill="url(#hourlyFill)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel-strong p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe2 className="size-4 accent-text" />
              <h3 className="font-bold tracking-tight text-foreground">Global Trending</h3>
            </div>
            <LiveBadge />
          </div>
          <ul className="space-y-1.5">
            {trending.map((t) => (
              <li
                key={t.rank}
                className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-white/60"
              >
                <span
                  className={`grid size-6 place-items-center rounded-md text-[11px] font-bold ${
                    t.rank === 1
                      ? "bg-amber-400 text-amber-950"
                      : t.rank === 2
                        ? "bg-slate-300 text-slate-800"
                        : t.rank === 3
                          ? "bg-orange-400 text-orange-950"
                          : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {t.rank}
                </span>
                <MessageSquare className="size-3.5" style={{ color: t.color }} />
                <span className="flex-1 text-sm font-medium text-foreground">{t.name}</span>
                <Sparkline color={t.color} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}

function StatTile({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  accent: "blue" | "indigo" | "purple" | "sky" | "amber";
}) {
  const palette: Record<typeof accent, string> = {
    blue: "bg-blue-500/10 text-blue-600",
    indigo: "bg-indigo-500/10 text-indigo-600",
    purple: "bg-purple-500/10 text-purple-600",
    sky: "bg-sky-500/10 text-sky-600",
    amber: "bg-amber-500/10 text-amber-600",
  };
  return (
    <div className="glass-panel p-6 transition hover:-translate-y-0.5 hover:shadow-xl">
      <div className="mb-4 flex items-center justify-between">
        <div className={`grid size-11 place-items-center rounded-2xl ${palette[accent]}`}>
          {icon}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="text-3xl font-bold tracking-tight text-foreground" data-mask>
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
        <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
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
    <div className="h-6 w-20">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="y" stroke={color} strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
