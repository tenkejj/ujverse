import { type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PROFILE_MOBILE } from '../../styles/mobile-theme'
import type { ProfileTab } from './profileTabs.types'

type Props = {
  activeTab: ProfileTab
  children: ReactNode
}

export default function ProfileTabPanel({ activeTab, children }: Props) {
  return (
    <div className="relative z-10 isolate">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          role="tabpanel"
          id={`profile-tab-panel-${activeTab}`}
          aria-labelledby={`profile-tab-${activeTab}`}
          initial={PROFILE_MOBILE.motion.tabPanel.initial}
          animate={PROFILE_MOBILE.motion.tabPanel.animate}
          exit={PROFILE_MOBILE.motion.tabPanel.exit}
          transition={PROFILE_MOBILE.motion.tabPanel.transition}
          className="min-h-[8rem]"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
