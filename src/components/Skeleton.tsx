// Shimmer skeleton primitives with built-in a11y.
// Wrap any skeleton tree in a region with role="status" + aria-busy="true"
// and provide an sr-only label describing what is loading.

const SHIMMER =
  "relative overflow-hidden bg-muted/60 before:absolute before:inset-0 " +
  "before:-translate-x-full before:animate-[shimmer_1.6s_infinite] " +
  "before:bg-gradient-to-r before:from-transparent before:via-white/50 before:to-transparent " +
  "dark:before:via-white/10";

export function SkeletonBar({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`rounded ${SHIMMER} ${className}`} />;
}

export function SkeletonRegion({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function SkeletonRows({ rows = 6, label = "Loading…" }: { rows?: number; label?: string }) {
  return (
    <SkeletonRegion label={label}>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <SkeletonBar className="h-9 w-9 rounded-md" />
            <div className="flex-1 space-y-1.5">
              <SkeletonBar className="h-3 w-2/3" />
              <SkeletonBar className="h-2.5 w-1/3" />
            </div>
            <SkeletonBar className="h-6 w-16" />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

export function SkeletonFeedRows({ rows = 5, label = "Loading feed…" }: { rows?: number; label?: string }) {
  return (
    <SkeletonRegion label={label}>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="border border-border rounded-lg p-3 bg-background/40 space-y-2">
            <div className="flex items-center justify-between">
              <SkeletonBar className="h-2.5 w-20" />
              <SkeletonBar className="h-4 w-10" />
            </div>
            <SkeletonBar className="h-3.5 w-1/2" />
            <SkeletonBar className="h-3 w-4/5" />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

export function SkeletonNavItems({ rows = 6, label = "Loading menu…" }: { rows?: number; label?: string }) {
  return (
    <SkeletonRegion label={label}>
      <ul className="flex flex-col gap-1">
        {Array.from({ length: rows }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 rounded-2xl px-3 py-2.5">
            <SkeletonBar className="size-[18px] rounded-md" />
            <SkeletonBar className="h-3 flex-1 max-w-[140px]" />
          </li>
        ))}
      </ul>
    </SkeletonRegion>
  );
}

export function SkeletonCount({ className = "h-5 w-10" }: { className?: string }) {
  return <SkeletonBar className={`inline-block align-middle ${className}`} />;
}
