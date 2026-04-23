import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PROFILE_MOBILE } from '../../styles/mobile-theme'

type StatKey = 'posts' | 'media' | 'followers' | 'following'

type Props = {
  postsCount: number
  mediaCount: number
  followersCount: number
  followingCount: number
  followStatsLoading: boolean
  /** Daty created_at wszystkich wpisów użytkownika (do sparkline'u). */
  postDates: string[]
  /** Daty created_at wpisów z multimedia (do sparkline'u). */
  mediaDates: string[]
  onOpenFollowModal: (tab: 'followers' | 'following') => void
}

function formatCompactCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return String(n)
}

/** Zwraca 7 koszyków tygodniowych (najstarszy → najnowszy) z dat ISO. */
function buildWeeklyBuckets(dates: string[]): number[] {
  const now = Date.now()
  const WEEK = 7 * 24 * 60 * 60 * 1000
  const buckets = new Array<number>(7).fill(0)
  for (const iso of dates) {
    const t = new Date(iso).getTime()
    if (!Number.isFinite(t)) continue
    const weeksAgo = Math.floor((now - t) / WEEK)
    if (weeksAgo < 0 || weeksAgo >= 7) continue
    buckets[6 - weeksAgo] += 1
  }
  return buckets
}

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(1, ...data)
  const W = 140
  const H = 36
  const barW = W / data.length - 2
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      className="overflow-visible"
      role="img"
      aria-label="Aktywność z ostatnich 7 tygodni"
    >
      {data.map((v, i) => {
        const h = Math.max(2, (v / max) * (H - 4))
        const x = i * (barW + 2)
        const y = H - h
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={h}
            rx={2}
            fill="var(--profile-accent)"
            opacity={v === 0 ? 0.2 : 0.85}
          />
        )
      })}
    </svg>
  )
}

export default function ProfileStats({
  postsCount,
  mediaCount,
  followersCount,
  followingCount,
  followStatsLoading,
  postDates,
  mediaDates,
  onOpenFollowModal,
}: Props) {
  const [expanded, setExpanded] = useState<StatKey | null>(null)

  const postsBuckets = useMemo(() => buildWeeklyBuckets(postDates), [postDates])
  const mediaBuckets = useMemo(() => buildWeeklyBuckets(mediaDates), [mediaDates])

  const handleClick = (key: StatKey) => {
    if (key === 'followers' || key === 'following') {
      onOpenFollowModal(key)
      return
    }
    setExpanded((curr) => (curr === key ? null : key))
  }

  const cards: {
    key: StatKey
    value: string
    label: string
    loading?: boolean
  }[] = [
    { key: 'posts', value: formatCompactCount(postsCount), label: 'Wpisy' },
    { key: 'media', value: formatCompactCount(mediaCount), label: 'Multimedia' },
    {
      key: 'followers',
      value: followStatsLoading ? '…' : formatCompactCount(followersCount),
      label: 'Obserwujący',
      loading: followStatsLoading,
    },
    {
      key: 'following',
      value: followStatsLoading ? '…' : formatCompactCount(followingCount),
      label: 'Obserwowani',
      loading: followStatsLoading,
    },
  ]

  const activeBuckets =
    expanded === 'posts' ? postsBuckets : expanded === 'media' ? mediaBuckets : null

  return (
    <motion.div
      variants={PROFILE_MOBILE.motion.fadeUp}
      className={`mt-4 ${PROFILE_MOBILE.card.paddingXClass}`}
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cards.map((c) => {
          const isActive = expanded === c.key
          return (
            <motion.button
              key={c.key}
              type="button"
              onClick={() => handleClick(c.key)}
              disabled={c.loading}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              aria-pressed={isActive}
              className={`group relative flex flex-col items-start gap-0.5 rounded-2xl border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--profile-accent)]/45 ${
                isActive
                  ? 'border-[var(--profile-accent)]/50 bg-[var(--profile-accent)]/8 dark:bg-[var(--profile-accent)]/12'
                  : 'border-border-app/80 bg-bg-card/60 hover:border-[var(--profile-accent)]/35'
              }`}
            >
              <span className="text-xl font-bold tabular-nums text-fg-primary">
                {c.value}
              </span>
              <span className="text-[11px] font-medium uppercase tracking-widest text-fg-secondary">
                {c.label}
              </span>
            </motion.button>
          )
        })}
      </div>

      <AnimatePresence initial={false}>
        {activeBuckets ? (
          <motion.div
            key={expanded}
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-3 flex items-center justify-between gap-4 rounded-2xl border border-border-app/70 bg-bg-card/60 px-4 py-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-secondary">
                  Ostatnie 7 tygodni
                </p>
                <p className="mt-1 text-sm font-semibold text-fg-primary">
                  {expanded === 'posts' ? 'Wpisy tygodniowo' : 'Multimedia tygodniowo'}
                </p>
              </div>
              <Sparkline data={activeBuckets} />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  )
}
