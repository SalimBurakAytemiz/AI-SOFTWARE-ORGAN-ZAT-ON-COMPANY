import { cn } from "@/lib/utils/cn";

/**
 * Yükleme iskeleti (planning/06 §6.6). prefers-reduced-motion'da animasyon
 * globals.css tarafından kapatılır.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-[var(--radius-sm)] bg-[var(--surface-raised)]", className)}
    />
  );
}

/** Kart ızgarası için hazır iskelet. */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4"
        >
          <Skeleton className="mb-3 h-4 w-20" />
          <Skeleton className="mb-2 h-5 w-3/4" />
          <Skeleton className="mb-3 h-3 w-1/2" />
          <Skeleton className="h-12 w-full" />
        </div>
      ))}
    </div>
  );
}
