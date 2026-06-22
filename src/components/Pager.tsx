import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

/** Build a compact page list like [1, '…', 4, 5, 6, '…', 20]. */
function pageWindow(current: number, total: number): Array<number | "…"> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: Array<number | "…"> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push("…");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < total - 1) out.push("…");
  out.push(total);
  return out;
}

export function Pager({
  page,
  pageSize,
  total,
  shown,
  onPage,
  onPageSize,
  pageSizes = ["25", "50", "100", "200"],
}: {
  page: number;
  pageSize: number;
  total: number;
  shown: number;
  onPage: (p: number) => void;
  onPageSize: (s: string) => void;
  pageSizes?: string[];
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = (page - 1) * pageSize + shown;
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const navBtn =
    "group inline-flex h-8 items-center gap-1 rounded-lg border border-border/60 bg-background/80 px-2.5 text-[11px] font-semibold text-foreground/80 shadow-sm transition hover:border-primary/40 hover:bg-primary/5 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border/60 disabled:hover:bg-background/80";
  const iconBtn =
    "inline-flex size-8 items-center justify-center rounded-lg border border-border/60 bg-background/80 text-muted-foreground shadow-sm transition hover:border-primary/40 hover:bg-primary/5 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40";
  const numBtn = (active: boolean) =>
    `inline-flex size-8 items-center justify-center rounded-lg border text-[12px] font-bold tabular-nums transition shadow-sm ${
      active
        ? "border-primary/60 bg-gradient-to-b from-primary to-primary/80 text-primary-foreground shadow-primary/25"
        : "border-border/60 bg-background/80 text-foreground/80 hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
    }`;

  const pages = pageWindow(page, totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 bg-gradient-to-b from-transparent to-muted/20 px-4 py-3 text-[11px]">
      <div className="text-muted-foreground">
        Showing <span className="font-semibold text-foreground">{from.toLocaleString()}</span>–
        <span className="font-semibold text-foreground">{to.toLocaleString()}</span> of{" "}
        <span className="font-semibold text-foreground">{total.toLocaleString()}</span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-muted-foreground">
          Rows
          <select
            value={String(pageSize)}
            onChange={(e) => onPageSize(e.target.value)}
            className="rounded-md border border-border/60 bg-background px-2 py-1 text-xs font-semibold text-foreground outline-none focus:border-primary/50"
          >
            {pageSizes.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1.5">
          <button className={iconBtn} onClick={() => onPage(1)} disabled={!canPrev} aria-label="First page" title="First">
            <ChevronsLeft className="size-3.5" />
          </button>
          <button className={navBtn} onClick={() => onPage(page - 1)} disabled={!canPrev} aria-label="Previous page">
            <ChevronLeft className="size-3.5" /> Prev
          </button>
          <div className="mx-1 flex items-center gap-1">
            {pages.map((p, i) =>
              p === "…" ? (
                <span key={`e${i}`} className="px-1 text-muted-foreground/60">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => onPage(p)}
                  className={numBtn(p === page)}
                  aria-current={p === page ? "page" : undefined}
                >
                  {p}
                </button>
              )
            )}
          </div>
          <button className={navBtn} onClick={() => onPage(page + 1)} disabled={!canNext} aria-label="Next page">
            Next <ChevronRight className="size-3.5" />
          </button>
          <button className={iconBtn} onClick={() => onPage(totalPages)} disabled={!canNext} aria-label="Last page" title="Last">
            <ChevronsRight className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
