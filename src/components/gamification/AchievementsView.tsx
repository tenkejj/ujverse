/**
 * UJverse — AchievementsView: grid wszystkich odznak (unlocked + locked).
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Pełen widok do profilu / settingsów. Pobiera katalog z DB (`achievements_catalog`)
 * + user_achievements; renderuje siatkę pogrupowaną po kategorii. Lock'ed
 * badges są wyszarzone z tooltipem opisu.
 *
 * Wbudowane do `/profile` przez tab "Osiągnięcia" (lub jako sekcja).
 */
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Award,
  BarChart3,
  Bell,
  CheckCircle2,
  CheckSquare,
  Compass,
  Crown,
  Flame,
  Heart,
  Lock,
  type LucideIcon,
  MessageCircle,
  MessagesSquare,
  Mic,
  Sparkles,
  StickyNote,
  Sunrise,
  Tags,
  Target,
  Ticket,
  Trophy,
  UserCheck,
  Users,
} from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { useGamificationContext } from '../../lib/gamificationContext'
import type { AchievementCategory, AchievementRarity } from '../../types/gamification'

const ICON_MAP: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  'user-check': UserCheck,
  compass: Compass,
  flame: Flame,
  crown: Crown,
  'message-circle': MessageCircle,
  'messages-square': MessagesSquare,
  trophy: Trophy,
  mic: Mic,
  'bar-chart-3': BarChart3,
  'sticky-note': StickyNote,
  'check-square': CheckSquare,
  'check-circle-2': CheckCircle2,
  target: Target,
  ticket: Ticket,
  tags: Tags,
  users: Users,
  bell: Bell,
  heart: Heart,
  sunrise: Sunrise,
}

const CATEGORY_LABEL: Record<string, string> = {
  onboarding: 'Pierwsze kroki',
  streak: 'Konsekwencja',
  aula: 'Aula',
  tasks: 'Zadania',
  community: 'Społeczność',
  social: 'Znajomi',
  exploration: 'Eksploracja',
  general: 'Inne',
}

const RARITY_TONE: Record<AchievementRarity, string> = {
  common: 'from-slate-400 to-slate-600',
  rare: 'from-sky-400 to-blue-600',
  epic: 'from-violet-500 to-fuchsia-600',
  legendary: 'from-amber-400 via-orange-500 to-rose-500',
}

type CatalogRow = {
  key: string
  name: string
  description: string
  xp_reward: number
  icon_name: string
  rarity: AchievementRarity
  category: AchievementCategory
  sort_order: number
}

export default function AchievementsView() {
  const ctx = useGamificationContext()
  const [catalog, setCatalog] = useState<CatalogRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('achievements_catalog')
        .select('key, name, description, xp_reward, icon_name, rarity, category, sort_order')
        .order('category')
        .order('sort_order')
      if (!cancelled) {
        if (!error && data) setCatalog(data as CatalogRow[])
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const unlockedSet = ctx?.unlockedKeys ?? new Set<string>()

  const grouped = useMemo(() => {
    const map = new Map<string, CatalogRow[]>()
    for (const row of catalog) {
      const arr = map.get(row.category) ?? []
      arr.push(row)
      map.set(row.category, arr)
    }
    return Array.from(map.entries())
  }, [catalog])

  const unlockedCount = catalog.filter((c) => unlockedSet.has(c.key)).length
  const totalCount = catalog.length

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-fg-primary">Odznaki</h2>
          <p className="mt-0.5 text-sm text-fg-secondary">
            Zdobywaj za aktywność. Każde odblokowanie = bonus XP.
          </p>
        </div>
        <div className="rounded-full border border-violet-400/30 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 px-3 py-1.5 text-xs font-bold text-violet-700 dark:text-violet-200">
          {unlockedCount} / {totalCount}
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100/60 dark:border-white/10 dark:bg-white/[0.04]"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([cat, items]) => (
            <section key={cat} className="space-y-2.5">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-fg-secondary">
                {CATEGORY_LABEL[cat] ?? cat}
              </h3>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                {items.map((it, idx) => {
                  const unlocked = unlockedSet.has(it.key)
                  const Icon = ICON_MAP[it.icon_name] ?? Award
                  return (
                    <motion.div
                      key={it.key}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.22, delay: idx * 0.02 }}
                      className={[
                        'group relative overflow-hidden rounded-2xl border p-3 transition-colors',
                        unlocked
                          ? 'border-violet-300/30 bg-gradient-to-br from-white to-violet-50/40 dark:border-white/15 dark:from-white/[0.05] dark:to-violet-500/[0.06]'
                          : 'border-zinc-200/80 bg-zinc-50/50 dark:border-white/10 dark:bg-white/[0.02]',
                      ].join(' ')}
                      title={it.description}
                    >
                      <div
                        className={[
                          'mx-auto flex h-12 w-12 items-center justify-center rounded-full',
                          unlocked
                            ? `bg-gradient-to-br ${RARITY_TONE[it.rarity]} text-white shadow-md`
                            : 'bg-zinc-200/70 text-zinc-400 dark:bg-white/[0.06] dark:text-zinc-500',
                        ].join(' ')}
                      >
                        {unlocked ? (
                          <Icon size={22} strokeWidth={1.9} />
                        ) : (
                          <Lock size={18} strokeWidth={2.25} />
                        )}
                      </div>
                      <p
                        className={[
                          'mt-2 truncate text-center text-[12.5px] font-bold',
                          unlocked ? 'text-fg-primary' : 'text-zinc-500 dark:text-zinc-400',
                        ].join(' ')}
                      >
                        {it.name}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-center text-[10.5px] leading-snug text-fg-secondary">
                        {it.description}
                      </p>
                      <div className="mt-1.5 text-center">
                        <span
                          className={[
                            'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider',
                            unlocked
                              ? 'bg-violet-500/15 text-violet-700 dark:text-violet-200'
                              : 'bg-zinc-200/80 text-zinc-500 dark:bg-white/[0.06] dark:text-zinc-500',
                          ].join(' ')}
                        >
                          {unlocked ? `+${it.xp_reward} XP` : `${it.xp_reward} XP`}
                        </span>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
