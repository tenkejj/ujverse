import { Clock, Megaphone, MessageSquare, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { SEARCH_DASHBOARD } from '../../styles/mobile-theme'
import {
  DEPT_SHORT,
  UJ_DEPARTMENTS,
  getDeptAccent,
} from '../../lib/departments'

export type DashboardScope = 'post' | 'komunikat'

const POPULAR_TAGS = ['ankieta', 'ogloszenie', 'pytanie'] as const

type Props = {
  history: string[]
  pendingFilter: DashboardScope | null
  onPickHistory: (entry: string) => void
  onRemoveHistory: (entry: string) => void
  onClearHistory: () => void
  onPickScope: (scope: DashboardScope) => void
  onPickDepartment: (dept: string) => void
  onPickTag: (tag: string) => void
}

type QuickScope = {
  id: DashboardScope
  label: string
  description: string
  icon: typeof MessageSquare
}

const QUICK_SCOPES: ReadonlyArray<QuickScope> = [
  {
    id: 'post',
    label: 'Wpisy Studentów',
    description: 'Przeglądaj posty społeczności UJ',
    icon: MessageSquare,
  },
  {
    id: 'komunikat',
    label: 'Oficjalne Komunikaty',
    description: 'Wyszukaj w komunikatach uczelnianych',
    icon: Megaphone,
  },
]

export default function SearchDashboard({
  history,
  pendingFilter,
  onPickHistory,
  onRemoveHistory,
  onClearHistory,
  onPickScope,
  onPickDepartment,
  onPickTag,
}: Props) {
  return (
    <motion.div
      variants={SEARCH_DASHBOARD.motion.container}
      initial="hidden"
      animate="show"
      className="mx-auto mt-8 flex w-full max-w-2xl flex-col gap-5"
    >
      <RecentSearchesPanel
        history={history}
        onPickHistory={onPickHistory}
        onRemoveHistory={onRemoveHistory}
        onClearHistory={onClearHistory}
      />

      <QuickScopesGrid pendingFilter={pendingFilter} onPickScope={onPickScope} />

      <PopularTagsPanel onPickTag={onPickTag} />

      <DepartmentShortcutsGrid onPickDepartment={onPickDepartment} />
    </motion.div>
  )
}

function RecentSearchesPanel({
  history,
  onPickHistory,
  onRemoveHistory,
  onClearHistory,
}: {
  history: string[]
  onPickHistory: (entry: string) => void
  onRemoveHistory: (entry: string) => void
  onClearHistory: () => void
}) {
  return (
    <motion.section
      variants={SEARCH_DASHBOARD.motion.section}
      className={`${SEARCH_DASHBOARD.panel} ${SEARCH_DASHBOARD.panelInnerGlow} p-5`}
    >
      <header className="mb-3 flex items-center justify-between">
        <h2 className={SEARCH_DASHBOARD.sectionTitle}>Ostatnio wyszukiwane</h2>
        {history.length > 0 && (
          <button
            type="button"
            onClick={onClearHistory}
            className={SEARCH_DASHBOARD.sectionSubtle}
          >
            Wyczyść
          </button>
        )}
      </header>

      {history.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Brak ostatnich wyszukiwań — zacznij od kafla poniżej.
        </p>
      ) : (
        <motion.ul
          variants={SEARCH_DASHBOARD.motion.chipContainer}
          initial="hidden"
          animate="show"
          className="flex flex-wrap gap-2"
        >
          {history.map((entry) => (
            <motion.li key={entry} variants={SEARCH_DASHBOARD.motion.chip}>
              <div className={SEARCH_DASHBOARD.recentChip}>
                <Clock size={12} strokeWidth={2} className={SEARCH_DASHBOARD.recentClock} />
                <button
                  type="button"
                  onClick={() => onPickHistory(entry)}
                  className="rounded-full px-1 py-0.5 text-left outline-none"
                >
                  {entry}
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveHistory(entry)}
                  className={SEARCH_DASHBOARD.recentRemove}
                  aria-label={`Usuń „${entry}” z historii`}
                >
                  <X size={12} strokeWidth={2} />
                </button>
              </div>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </motion.section>
  )
}

function PopularTagsPanel({ onPickTag }: { onPickTag: (tag: string) => void }) {
  return (
    <motion.section
      variants={SEARCH_DASHBOARD.motion.section}
      className={`${SEARCH_DASHBOARD.panel} ${SEARCH_DASHBOARD.panelInnerGlow} p-5`}
    >
      <header className="mb-3">
        <h2 className={SEARCH_DASHBOARD.sectionTitle}>Popularne tagi</h2>
        <p className={SEARCH_DASHBOARD.sectionSubtle}>Filtruj wpisy po hashtagu</p>
      </header>
      <div className="flex flex-wrap gap-2">
        {POPULAR_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => onPickTag(tag)}
            className={`${SEARCH_DASHBOARD.recentChip} border-brand-gold/25 text-brand-gold dark:text-brand-gold-bright`}
          >
            #{tag}
          </button>
        ))}
      </div>
    </motion.section>
  )
}

function QuickScopesGrid({
  pendingFilter,
  onPickScope,
}: {
  pendingFilter: DashboardScope | null
  onPickScope: (scope: DashboardScope) => void
}) {
  return (
    <motion.section variants={SEARCH_DASHBOARD.motion.section}>
      <header className="mb-3 px-1">
        <h2 className={SEARCH_DASHBOARD.sectionTitle}>Szybkie skoki</h2>
      </header>

      <motion.div
        variants={SEARCH_DASHBOARD.motion.chipContainer}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        {QUICK_SCOPES.map((scope) => {
          const Icon = scope.icon
          const isActive = pendingFilter === scope.id
          return (
            <motion.button
              key={scope.id}
              type="button"
              variants={SEARCH_DASHBOARD.motion.chip}
              onClick={() => onPickScope(scope.id)}
              aria-pressed={isActive}
              className={
                `${SEARCH_DASHBOARD.scopeTile} ${SEARCH_DASHBOARD.panelInnerGlow} ` +
                (isActive ? SEARCH_DASHBOARD.panelActive : '')
              }
            >
              <span className={SEARCH_DASHBOARD.scopeIcon}>
                <Icon size={18} strokeWidth={2} />
              </span>
              <span className="flex flex-col gap-1">
                <span className={SEARCH_DASHBOARD.scopeTitle}>{scope.label}</span>
                <span className={SEARCH_DASHBOARD.scopeDescription}>{scope.description}</span>
              </span>
            </motion.button>
          )
        })}
      </motion.div>
    </motion.section>
  )
}

function DepartmentShortcutsGrid({
  onPickDepartment,
}: {
  onPickDepartment: (dept: string) => void
}) {
  return (
    <motion.section
      variants={SEARCH_DASHBOARD.motion.section}
      className={`${SEARCH_DASHBOARD.panel} ${SEARCH_DASHBOARD.panelInnerGlow} p-5`}
    >
      <header className="mb-3 flex items-center justify-between">
        <h2 className={SEARCH_DASHBOARD.sectionTitle}>Skróty wydziałowe</h2>
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
          17 wydziałów
        </span>
      </header>

      <motion.div
        variants={SEARCH_DASHBOARD.motion.chipContainer}
        initial="hidden"
        animate="show"
        className="flex flex-wrap gap-2"
      >
        {UJ_DEPARTMENTS.map((dept) => {
          const accent = getDeptAccent(dept)
          const short = DEPT_SHORT[dept] ?? dept
          return (
            <motion.button
              key={dept}
              type="button"
              variants={SEARCH_DASHBOARD.motion.chip}
              onClick={() => onPickDepartment(dept)}
              title={dept}
              className={SEARCH_DASHBOARD.deptBadge}
              style={{ ['--dept-glow' as string]: accent.glowRgba } as React.CSSProperties}
            >
              <span
                aria-hidden
                className={SEARCH_DASHBOARD.deptDot}
                style={{ background: accent.hex }}
              />
              {short}
            </motion.button>
          )
        })}
      </motion.div>
    </motion.section>
  )
}
