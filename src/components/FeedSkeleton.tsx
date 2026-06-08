type Props = { count?: number }

/**
 * Inert post-card placeholders for the main feed.
 *
 * Geometry mirrors PostCard `variant="stacked"` (`px-6 pt-6 pb-4`) and the
 * divider stack used in FeedView (`divide-y divide-[#0f172a]/10 dark:divide-white/10`)
 * so the layout doesn't shift when real posts hydrate (low CLS).
 *
 * Palette follows project skeleton convention (slate-200/100 + white/10/5),
 * matching `ui/Skeleton`, `ProfileSkeleton`, `SinglePostView` loading state
 * and notifications `SkeletonRow`.
 */
export default function FeedSkeleton({ count = 4 }: Props) {
  return (
    <div
      className="w-full bg-transparent divide-y divide-[#0f172a]/10 dark:divide-white/10"
      aria-hidden
      role="status"
      aria-label="Ładowanie wpisów"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="px-6 pt-6 pb-4 animate-pulse">
          <div className="flex gap-3">
            <div className="h-10 w-10 shrink-0 rounded-full bg-slate-200 dark:bg-white/10" />
            <div className="min-w-0 flex-1 space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <div className="h-3 w-32 rounded-full bg-slate-200 dark:bg-white/10" />
                <div className="h-2.5 w-16 rounded-full bg-slate-100 dark:bg-white/5" />
              </div>
              <div className="h-3 w-3/4 rounded-full bg-slate-100 dark:bg-white/5" />
              <div className="h-3 w-1/2 rounded-full bg-slate-100 dark:bg-white/5" />
              <div className="mt-3 flex gap-6">
                <div className="h-3 w-10 rounded-full bg-slate-100 dark:bg-white/5" />
                <div className="h-3 w-10 rounded-full bg-slate-100 dark:bg-white/5" />
                <div className="h-3 w-10 rounded-full bg-slate-100 dark:bg-white/5" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
