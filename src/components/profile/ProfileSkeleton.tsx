import { PROFILE_MOBILE } from '../../styles/mobile-theme'

export default function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      <div className={`${PROFILE_MOBILE.card.glassClass} animate-pulse`}>
        <div className={`${PROFILE_MOBILE.cover.heightClass} w-full bg-slate-200 dark:bg-white/10`} />
        <div className={`flex justify-end ${PROFILE_MOBILE.card.paddingXClass} pt-3 pb-2`}>
          <div className="h-9 w-28 rounded-full bg-slate-200 dark:bg-white/10" />
        </div>
        <div
          className={`-mt-12 flex items-end gap-4 ${PROFILE_MOBILE.card.paddingXClass} pb-2 lg:-mt-16`}
        >
          <div className="h-24 w-24 shrink-0 rounded-full bg-slate-200 ring-4 ring-bg-app dark:bg-white/10 lg:h-32 lg:w-32" />
        </div>
        <div className={`space-y-3 pb-6 pt-4 ${PROFILE_MOBILE.card.paddingXClass}`}>
          <div className="h-9 w-56 rounded-lg bg-slate-200 dark:bg-white/10" />
          <div className="h-4 w-36 rounded-full bg-slate-100 dark:bg-white/5" />
          <div className="h-20 max-w-prose rounded-lg bg-slate-100 dark:bg-white/5" />
        </div>
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-2xl border border-slate-100 bg-card p-4 dark:border-border-app"
          >
            <div className="flex gap-3">
              <div className="h-10 w-10 shrink-0 rounded-full bg-slate-200 dark:bg-white/10" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-3 w-1/3 rounded-full bg-slate-200 dark:bg-white/10" />
                <div className="h-2.5 w-3/4 rounded-full bg-slate-100 dark:bg-white/5" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
