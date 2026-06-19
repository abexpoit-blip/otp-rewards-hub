import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

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
  const btn =
    "inline-flex size-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 px-3 py-2 text-[11px]">
      <div className="text-muted-foreground">
        Showing <span className="font-semibold text-foreground">{from}</span>–
        <span className="font-semibold text-foreground">{to}</span> of{" "}
        <span className="font-semibold text-foreground">{total.toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-muted-foreground">
          Rows
          <select
            value={String(pageSize)}
            onChange={(e) => onPageSize(e.target.value)}
            className="rounded-md border border-border bg-background px-1.5 py-0.5 text-xs font-semibold text-foreground outline-none"
          >
            {pageSizes.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <button className={btn} onClick={() => onPage(1)} disabled={!canPrev} aria-label="First page">
            <ChevronsLeft className="size-3.5" />
          </button>
          <button className={btn} onClick={() => onPage(page - 1)} disabled={!canPrev} aria-label="Previous page">
            <ChevronLeft className="size-3.5" />
          </button>
          <span className="px-1.5 font-mono text-xs text-foreground">
            {page} / {totalPages}
          </span>
          <button className={btn} onClick={() => onPage(page + 1)} disabled={!canNext} aria-label="Next page">
            <ChevronRight className="size-3.5" />
          </button>
          <button className={btn} onClick={() => onPage(totalPages)} disabled={!canNext} aria-label="Last page">
            <ChevronsRight className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
