import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { groupPathForSlug } from '../lib/groupPaths'
import {
  OFFICIAL_TAG_META,
  OFFICIAL_TAGS,
  TAG_DESCRIPTIONS,
  TAG_ICONS,
} from '../services/TagService'
import { SEARCH_DASHBOARD as S } from '../styles/mobile-theme'

/**
 * /group — hub wszystkich oficjalnych stref.
 *
 * Wizualnie 1:1 z `QuickScopesGrid` z `SearchDashboard` (/search empty state):
 *  - `S.scopeTile + S.panelInnerGlow` jako kafelek (glass + gold hover + scale).
 *  - `S.scopeIcon` jako rounded-xl bańka z ikoną z `TAG_ICONS`.
 *  - `S.scopeTitle` + `S.scopeDescription` jako stack tekstowy.
 *  - `S.motion.container/section/chipContainer/chip` jako stagger entry.
 */
export default function GroupsIndexView() {
  const navigate = useNavigate()

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12 lg:gap-4">
      <aside className="hidden lg:col-span-3 lg:block" aria-hidden />

      <section className="lg:col-span-6">
        <div className="mx-auto w-full max-w-3xl px-0 pt-5 md:pt-2">
          <motion.div
            variants={S.motion.container}
            initial="hidden"
            animate="show"
            className="flex flex-col gap-5"
          >
            <motion.section variants={S.motion.section}>
              <header className="mb-3 px-1">
                <h2 className={S.sectionTitle}>Oficjalne strefy</h2>
              </header>

              <motion.div
                variants={S.motion.chipContainer}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3"
              >
                {OFFICIAL_TAGS.map((slug) => {
                  const meta = OFFICIAL_TAG_META[slug]
                  const Icon = TAG_ICONS[slug]
                  const description = TAG_DESCRIPTIONS[slug]
                  return (
                    <motion.button
                      key={slug}
                      type="button"
                      variants={S.motion.chip}
                      onClick={() => navigate(groupPathForSlug(slug))}
                      aria-label={`Otwórz strefę ${meta.name}`}
                      className={`${S.scopeTile} ${S.panelInnerGlow}`}
                    >
                      <span className={S.scopeIcon}>
                        <Icon size={18} strokeWidth={2} />
                      </span>
                      <span className="flex flex-col gap-1">
                        <span className={S.scopeTitle}>{meta.name}</span>
                        <span className={S.scopeDescription}>{description}</span>
                      </span>
                    </motion.button>
                  )
                })}
              </motion.div>
            </motion.section>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
