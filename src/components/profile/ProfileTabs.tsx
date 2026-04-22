import { motion } from 'framer-motion'
import { PROFILE_MOBILE } from '../../styles/mobile-theme'
import { TAB_ITEMS, type ProfileTab } from './profileTabs.types'

type Props = {
  activeTab: ProfileTab
  onTabChange: (tab: ProfileTab) => void
}

export default function ProfileTabs({ activeTab, onTabChange }: Props) {
  return (
    <motion.nav
      variants={PROFILE_MOBILE.motion.fadeUp}
      role="tablist"
      aria-label="Treści profilu"
      className={`mt-4 ${PROFILE_MOBILE.card.paddingXClass}`}
    >
      <div className={PROFILE_MOBILE.tabs.rowClass}>
        {TAB_ITEMS.map((t) => {
          const isActive = activeTab === t.id
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`profile-tab-panel-${t.id}`}
              id={`profile-tab-${t.id}`}
              onClick={() => onTabChange(t.id)}
              className={`${PROFILE_MOBILE.tabs.tabBaseClass} ${
                isActive
                  ? PROFILE_MOBILE.tabs.tabActiveClass
                  : PROFILE_MOBILE.tabs.tabInactiveClass
              }`}
            >
              {t.label}
              {isActive ? (
                <motion.span
                  layoutId={PROFILE_MOBILE.tabs.indicatorLayoutId}
                  className={PROFILE_MOBILE.tabs.indicatorClass}
                  transition={PROFILE_MOBILE.motion.indicatorSpring}
                />
              ) : null}
            </button>
          )
        })}
      </div>
    </motion.nav>
  )
}
