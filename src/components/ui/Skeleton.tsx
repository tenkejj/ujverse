/** Inert pulse block for loading placeholders (CLS-friendly layouts). */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-slate-200/90 dark:bg-white/10 ${className}`}
      aria-hidden
    />
  )
}
