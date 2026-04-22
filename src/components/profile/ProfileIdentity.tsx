import { motion } from 'framer-motion'
import { AcademicCapIcon, CalendarDaysIcon, MapPinIcon } from '@heroicons/react/24/outline'
import type { Profile } from '../../types'
import { PROFILE_MOBILE } from '../../styles/mobile-theme'

type Props = {
  profile: Profile | null
  titleName: string
  handleLabel: string
  isOwn: boolean
  joinedLabel: string | null
}

export default function ProfileIdentity({
  profile,
  titleName,
  handleLabel,
  isOwn,
  joinedLabel,
}: Props) {
  return (
    <motion.div
      variants={PROFILE_MOBILE.motion.fadeUp}
      className={`mt-4 space-y-3 ${PROFILE_MOBILE.card.paddingXClass}`}
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-fg-primary dark:text-white">
          {titleName}
        </h1>
        <p className="mt-0.5 text-base text-slate-500 dark:text-slate-500">{handleLabel}</p>
      </div>

      {profile?.bio ? (
        <p className="max-w-prose whitespace-pre-line text-[15px] leading-relaxed text-fg-primary dark:text-white">
          {profile.bio}
        </p>
      ) : (
        <p className="max-w-prose text-sm italic leading-relaxed text-fg-secondary">
          {isOwn
            ? 'Brak opisu — kliknij „Edytuj profil”, aby dodać bio.'
            : 'Brak opisu.'}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-500 dark:text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="shrink-0 text-[var(--profile-accent)]" aria-hidden>
            <MapPinIcon className="h-5 w-5" />
          </span>
          Kraków, Polska
        </span>
        {profile?.department ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="shrink-0 text-[var(--profile-accent)]" aria-hidden>
              <AcademicCapIcon className="h-5 w-5" />
            </span>
            {profile.department}
          </span>
        ) : null}
        {joinedLabel ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="shrink-0 text-[var(--profile-accent)]" aria-hidden>
              <CalendarDaysIcon className="h-5 w-5" />
            </span>
            Dołączył {joinedLabel}
          </span>
        ) : null}
      </div>
    </motion.div>
  )
}
