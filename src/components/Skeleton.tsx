export function SkeletonBar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted/60 ${className}`} />;
}

export function SkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
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
  );
}

export function SkeletonFeedRows({ rows = 5 }: { rows?: number }) {
  return (
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
  );
}
