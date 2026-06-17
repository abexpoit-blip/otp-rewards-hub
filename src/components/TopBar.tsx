import { Clock, Search } from "lucide-react";
import { useEffect, useState } from "react";

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
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border/60 bg-background/80 px-6 backdrop-blur-md">
      <div className="flex flex-1 items-center gap-2 text-muted-foreground">
        <Search className="size-4" />
        <input
          type="text"
          placeholder="Search"
          className="w-full max-w-md bg-transparent text-sm placeholder:text-muted-foreground/60 focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-2 text-xs">
        <Clock className="size-3.5 accent-text" />
        <span className="font-mono text-sm font-semibold tracking-wider">
          {time}
        </span>
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
          UTC+0
        </span>
        <span className="text-muted-foreground">•</span>
        <span className="font-mono text-muted-foreground">
          {day} {month}
        </span>
      </div>
    </header>
  );
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
