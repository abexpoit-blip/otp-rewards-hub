import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  CreditCard,
  Hash,
  LayoutDashboard,
  LineChart,
  ListChecks,
  LogOut,
  Radio,
  Tags,
  User,
} from "lucide-react";
import { TweaksPanel } from "./TweaksPanel";
import { useTweaks } from "@/lib/tweaks";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const sections = [
  {
    label: null as string | null,
    items: [{ to: "/", icon: LayoutDashboard, label: "Dashboard" }],
  },
  {
    label: "Dialer Panel",
    items: [
      { to: "/get-number", icon: Hash, label: "Get Number" },
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
      { to: "/payment", icon: CreditCard, label: "Payment" },
    ],
  },
] as const;

export function AppSidebar() {
  const { sidebar } = useTweaks();
  const collapsed = sidebar === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => {
    logout();
    navigate({ to: "/login" });
  };

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200",
        collapsed ? "w-[72px]" : "w-[240px]",
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 px-4">
        <div className="relative grid size-9 place-items-center rounded-xl accent-bg font-bold shadow-lg accent-glow">
          N
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold tracking-wider">NEXUS SMS</span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              v2 panel
            </span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {sections.map((section, i) => (
          <div key={i} className="mb-4">
            {section.label && !collapsed && (
              <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.label}
              </div>
            )}
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active =
                  item.to === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.to);
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                        collapsed && "justify-center",
                        active
                          ? "accent-bg shadow-sm"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon className="size-4 shrink-0" />
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
            "group mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition hover:bg-sidebar-accent hover:text-sidebar-foreground",
            collapsed && "justify-center",
          )}
          title={collapsed ? "Logout" : undefined}
        >
          <LogOut className="size-4 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </nav>

      {/* Footer */}
      <div className="space-y-3 border-t border-sidebar-border p-3">
        <TweaksPanel />

        {!collapsed && (
          <div className="relative overflow-hidden rounded-xl border border-sidebar-border bg-gradient-to-br from-card to-sidebar p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="rounded-md accent-bg-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                Dev
              </span>
              <span className="text-muted-foreground">{"</>"}</span>
            </div>
            <div className="text-sm font-semibold">Are you a developer?</div>
            <a
              href="#"
              className="mt-2 flex items-center justify-between rounded-lg accent-bg px-2.5 py-1.5 text-xs font-semibold"
            >
              <span>See the API</span>
              <span>→</span>
            </a>
          </div>
        )}
      </div>
    </aside>
  );
}
