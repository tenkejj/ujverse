import { AnimatePresence } from 'framer-motion'
import { PROFILE_MOBILE } from '../../styles/mobile-theme'
import ProfileActionButton, { type ActionKind } from './ProfileActionButton'
import { useShowFab } from './profileScroll'

type Props = {
  kind: ActionKind
  onClick: () => void
  loading?: boolean
}

/**
 * Floating Action Button — pojawia się tylko na mobile po przewinięciu
 * poza hero. Dzięki layoutId `profile-edit-action` Framer Motion morphuje
 * inline → fab (i z powrotem przy scroll-up).
 */
export default function ProfileFab({ kind, onClick, loading }: Props) {
  const show = useShowFab()

  return (
    <AnimatePresence mode="popLayout">
      {show ? (
        <div key="profile-fab" className={PROFILE_MOBILE.fab.wrapperClass}>
          <ProfileActionButton
            variant="fab"
            kind={kind}
            onClick={onClick}
            loading={loading}
          />
        </div>
      ) : null}
    </AnimatePresence>
  )
}
