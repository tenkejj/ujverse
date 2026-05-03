import { motion } from 'framer-motion'
import { AcademicCapIcon, CalendarDaysIcon, MapPinIcon } from '@heroicons/react/24/outline'
import type { Profile } from '../../types'
import { PROFILE_MOBILE } from '../../styles/mobile-theme'

type Props = {
  profile: Profile | null
  titleName: string
  handleLabel: string
  hasPublicUsername: boolean
  isOwn: boolean
  joinedLabel: string | null
  followersCount: number
  followingCount: number
  followStatsLoading: boolean
  onOpenFollowModal: (tab: 'followers' | 'following') => void
}

function formatCompactCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return String(n)
}

export default function ProfileIdentity({
  profile,
  titleName,
  handleLabel,
  hasPublicUsername,
  isOwn,
  joinedLabel,
  followersCount,
  followingCount,
  followStatsLoading,
  onOpenFollowModal,
}: Props) {
  return (
    <motion.div
      variants={PROFILE_MOBILE.motion.fadeUp}
      className={`mt-4 space-y-3 ${PROFILE_MOBILE.card.paddingXClass}`}
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#0f172a] dark:text-white">
          {titleName}
        </h1>
        {hasPublicUsername ? (
          <p className="mt-0.5 text-base text-gray-400">{handleLabel}</p>
        ) : null}
      </div>

      {isOwn && !hasPublicUsername ? (
        <p className="rounded-xl border border-amber-200/60 bg-amber-50/80 px-3 py-2 text-sm leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
          Twój profil nie posiada jeszcze publicznej nazwy. Ustaw ją w edycji profilu, aby inni
          mogli Cię znaleźć.
        </p>
      ) : null}

      {profile?.bio ? (
        <p className="max-w-prose whitespace-pre-line text-[15px] leading-relaxed text-[#0f172a] dark:text-white">
          {profile.bio}
        </p>
      ) : (
        <p className="max-w-prose text-sm italic leading-relaxed text-gray-400">
          {isOwn
            ? 'Brak opisu — kliknij „Edytuj profil”, aby dodać bio.'
            : 'Brak opisu.'}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-gray-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="shrink-0 text-gray-400" aria-hidden>
            <MapPinIcon className="h-5 w-5" />
          </span>
          Kraków, Polska
        </span>
        {profile?.department ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="shrink-0 text-gray-400" aria-hidden>
              <AcademicCapIcon className="h-5 w-5" />
            </span>
            <span>{profile.department}</span>
          </span>
        ) : null}
        {joinedLabel ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="shrink-0 text-gray-400" aria-hidden>
              <CalendarDaysIcon className="h-5 w-5" />
            </span>
            Dołączył {joinedLabel}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <button
          type="button"
          onClick={() => onOpenFollowModal('followers')}
          disabled={followStatsLoading}
          className="group inline-flex items-baseline gap-1 transition-colors disabled:cursor-wait disabled:opacity-70"
        >
          <span className="font-semibold tabular-nums text-[#0f172a] dark:text-white">
            {followStatsLoading ? '…' : formatCompactCount(followersCount)}
          </span>
          <span className="text-gray-400 group-hover:text-gray-300 dark:group-hover:text-gray-300">
            Obserwujących
          </span>
        </button>

        <button
          type="button"
          onClick={() => onOpenFollowModal('following')}
          disabled={followStatsLoading}
          className="group inline-flex items-baseline gap-1 transition-colors disabled:cursor-wait disabled:opacity-70"
        >
          <span className="font-semibold tabular-nums text-[#0f172a] dark:text-white">
            {followStatsLoading ? '…' : formatCompactCount(followingCount)}
          </span>
          <span className="text-gray-400 group-hover:text-gray-300 dark:group-hover:text-gray-300">
            Obserwowanych
          </span>
        </button>
      </div>
    </motion.div>
  )
}
