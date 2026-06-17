import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Hash,
  Inbox,
  Key,
  Layers,
  LayoutDashboard,
  LineChart,
  ListChecks,
  LogOut,
  Radio,
  ShieldCheck,
  Tags,
  User,
  Wallet,
  DollarSign,
} from "lucide-react";
import { TweaksPanel } from "./TweaksPanel";
import { useTweaks } from "@/lib/tweaks";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import nexusLogo from "@/assets/nexus-logo.png";
import nexusMark from "@/assets/nexus-favicon.png";

type NavItem = { to: string; icon: any; label: string };
type NavSection = { label: string | null; items: NavItem[] };

const baseSections: NavSection[] = [
  {
    label: null,
    items: [{ to: "/", icon: LayoutDashboard, label: "Dashboard" }],
  },
  {
    label: "Dialer Panel",
    items: [
      { to: "/get-number", icon: Hash, label: "Get Number" },
      { to: "/bulk-allocate", icon: Layers, label: "Bulk Allocate" },
      { to: "/inbox", icon: Inbox, label: "OTP Inbox" },
      { to: "/console", icon: Radio, label: "Console" },
      { to: "/summary", icon: LineChart, label: "Summary" },
      { to: "/access-list", icon: ListChecks, label: "Access List" },
      { to: "/sender-range", icon: Tags, label: "Sender / Range" },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/profile", icon: User, label: "Profile" },
      { to: "/withdrawals", icon: Wallet, label: "Withdrawals" },
      { to: "/api-keys", icon: Key, label: "API Keys" },
    ],
  },
];

const adminSection: NavSection = {
  label: "Admin",
  items: [
    { to: "/admin", icon: ShieldCheck, label: "Admin Home" },
    { to: "/admin/withdrawals", icon: Wallet, label: "Withdrawals" },
    { to: "/admin/payouts", icon: DollarSign, label: "Payouts" },
  ],
};

export function AppSidebar({ variant = "desktop" }: { variant?: "desktop" | "mobile" } = {}) {
  const { sidebar } = useTweaks();
  const collapsed = variant === "desktop" && sidebar === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => {
    logout();
    navigate({ to: "/login" });
  };
  const sections = user?.roles?.includes("admin")
    ? [...baseSections, adminSection]
    : baseSections;

  return (
    <aside
      className={cn(
        "flex flex-col p-5 transition-all duration-300",
        variant === "desktop"
          ? "glass-panel sticky top-4 hidden h-[calc(100vh-2rem)] shrink-0 lg:top-6 lg:flex lg:h-[calc(100vh-3rem)]"
          : "h-full w-full",
        variant === "desktop" && (collapsed ? "w-[78px]" : "w-[240px]"),
      )}
    >
      {/* Logo */}
      <Link to="/" className="mb-8 flex items-center gap-2 px-1">
        {collapsed ? (
          <img src={nexusMark} alt="Nexus" className="size-10 object-contain" />
        ) : (
          <img src={nexusLogo} alt="Nexus 2.0" className="h-10 w-auto object-contain" />
        )}
      </Link>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden -mx-1 px-1">
        {sections.map((section, i) => (
          <div key={i} className="mb-5">
            {section.label && !collapsed && (
              <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">
                {section.label}
              </div>
            )}
            <ul className="flex flex-col gap-1">
              {section.items.map((item) => {
                const active =
                  item.to === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.to);
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to as any}
                      className={cn(
                        "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all",
                        collapsed && "justify-center",
                        active
                          ? "bg-white/80 text-primary shadow-sm border border-primary/15"
                          : "text-foreground/70 hover:bg-white/50 hover:text-foreground",
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon className="size-[18px] shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <button
          type="button"
          onClick={handleLogout}
          className={cn(
            "group mt-2 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-foreground/70 transition-all hover:bg-white/50 hover:text-destructive",
            collapsed && "justify-center",
          )}
          title={collapsed ? "Logout" : undefined}
        >
          <LogOut className="size-[18px] shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </nav>

      {/* Footer */}
      <div className="mt-auto space-y-3 pt-3">
        <TweaksPanel />

        {!collapsed && (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 p-4 text-white shadow-xl shadow-blue-500/25">
            <div className="absolute -right-4 -bottom-4 size-24 rounded-full bg-white/15 blur-2xl" />
            <p className="relative text-[10px] font-bold uppercase tracking-widest opacity-80">
              Pro API
            </p>
            <p className="relative mt-1 text-sm font-semibold">Ready to integrate?</p>
            <a
              href="#"
              className="relative mt-3 flex items-center justify-center rounded-xl border border-white/30 bg-white/15 px-3 py-2 text-xs font-bold backdrop-blur-md transition-colors hover:bg-white/25"
            >
              Get API Key →
            </a>
          </div>
        )}
      </div>
    </aside>
  );
}
