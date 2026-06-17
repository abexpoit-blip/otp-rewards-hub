import { Bell, Clock, Menu, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AppSidebar } from "./AppSidebar";

export function TopBar() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = now
    ? `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`
    : "--:--:--";
  const day = now ? now.getUTCDate() : "--";
  const month = now
    ? now.toLocaleString("en-US", { month: "short", timeZone: "UTC" })
    : "---";

  return (
    <header className="glass-panel sticky top-4 z-30 flex h-14 items-center gap-2 px-3 lg:top-6 lg:gap-3 lg:px-4">
      {/* Mobile menu trigger */}
      <Sheet>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="Open menu"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-white/70 text-foreground/70 shadow-sm transition hover:bg-white lg:hidden"
          >
            <Menu className="size-4" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] p-0">
          <AppSidebar variant="mobile" />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 items-center gap-2 text-muted-foreground">
        <Search className="size-4 shrink-0" />
        <input
          type="text"
          placeholder="Search…"
          className="w-full min-w-0 bg-transparent text-sm placeholder:text-muted-foreground/60 focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-xs shadow-sm md:flex">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          <span className="font-medium text-foreground/70">Live</span>
        </div>

        <div className="hidden items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-xs shadow-sm md:flex">
          <Clock className="size-3.5 accent-text" />
          <span className="font-mono text-sm font-semibold tracking-wider text-foreground">
            {time}
          </span>
          <span className="font-mono text-[10px] uppercase text-muted-foreground">UTC+0</span>
          <span className="text-muted-foreground/40">·</span>
          <span className="font-mono text-muted-foreground">
            {day} {month}
          </span>
        </div>

        <button
          type="button"
          className="grid size-9 place-items-center rounded-full bg-white/70 text-foreground/70 shadow-sm transition hover:bg-white"
        >
          <Bell className="size-4" />
        </button>
      </div>
    </header>
  );
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
