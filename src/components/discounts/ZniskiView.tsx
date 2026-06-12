/**
 * UJverse — ZniskiView: "Couponek UJ" - katalog zniżek studenckich.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Sekcje:
 *   1. Hero header z CTA "Dodaj zniżkę" + przycisk geo "Pokaż wokół mnie"
 *   2. "Trending dziś" (top 5 z ostatnich 7 dni, RPC `trending_discounts`)
 *   3. Kategoria filter pills + search input + sort dropdown + verified toggle
 *   4. Grid responsive 1/2/3 col z DiscountCard
 *
 * Realtime:
 *   - nowe zniżki prependują się (gdy w category filter), bumpują "trending"
 *     z realtime hookowym subscription już w useDiscounts.
 */
import { useCallback, useMemo, useState } from 'react'
import {
  BookOpen,
  Bus,
  Clapperboard,
  Coffee,
  Compass,
  Dumbbell,
  Filter,
  Loader2,
  MapPin,
  Music2,
  Pizza,
  Plus,
  Scissors,
  Search,
  Shirt,
  Sparkles,
  Tag,
  TrendingUp,
  X,
} from 'lucide-react'
import { theme } from '../../styles/theme'
import { widgetGoldCls } from '../../lib/sidePanelStyles'
import DiscountCard from './DiscountCard'
import DiscountDetailModal from './DiscountDetailModal'
import DiscountFormModal from './DiscountFormModal'
import { useDiscounts } from '../../hooks/useDiscounts'
import {
  DISCOUNT_CATEGORIES,
  DISCOUNT_CATEGORY_META,
  type DiscountCategory,
  type DiscountFilter,
  type StudentDiscount,
} from '../../types/discounts'

type Props = {
  userId: string | null
}

const ICON_MAP = {
  Pizza,
  Coffee,
  Music2,
  Clapperboard,
  Dumbbell,
  BookOpen,
  Scissors,
  Bus,
  Shirt,
  Tag,
} as const

const SORT_LABELS: Record<DiscountFilter['sort'], string> = {
  use: 'Najpopularniejsze',
  created: 'Najnowsze',
  rating: 'Najlepiej oceniane',
}

export default function ZniskiView({ userId }: Props) {
  const {
    filter,
    setFilter,
    discounts,
    trending,
    myUsedIds,
    loading,
    trendingLoading,
    error,
    refresh,
    refreshTrending,
    markUse,
    geo,
    geoStatus,
    requestGeo,
  } = useDiscounts({ userId })

  const [detailDiscount, setDetailDiscount] = useState<StudentDiscount | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  const handleOpenDetail = useCallback(
    (id: string) => {
      const found = discounts.find((d) => d.id === id)
      if (found) setDetailDiscount(found)
    },
    [discounts],
  )

  const handleCreated = useCallback(() => {
    setFormOpen(false)
    void refresh()
    void refreshTrending()
  }, [refresh, refreshTrending])

  const hasGeo = geoStatus === 'ok' && geo != null

  // Gdy mamy geo i sortujemy "use" → dodatkowo sortujemy po dystansie (gdy istnieje)
  const sortedDiscounts = useMemo(() => {
    if (!hasGeo) return discounts
    return [...discounts].sort((a, b) => {
      if (a.distanceMeters == null && b.distanceMeters == null) return 0
      if (a.distanceMeters == null) return 1
      if (b.distanceMeters == null) return -1
      return a.distanceMeters - b.distanceMeters
    })
  }, [discounts, hasGeo])

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-3 pb-32 pt-4 sm:gap-6 sm:px-4 sm:pt-6">
      {/* Hero */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${theme.text.sectionHeader}`}>
            Couponek UJ
          </p>
          <h1 className={`text-2xl font-bold leading-tight ${theme.text.primary} sm:text-3xl`}>
            Zniżki dla studentów <span className="text-brand-gold dark:text-brand-gold-bright">w Krakowie</span>
          </h1>
          <p className={`mt-1 text-[13px] ${theme.text.muted}`}>
            Pokaż legitymację UJ i oszczędź. Społeczność dodaje co znajdzie.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          disabled={!userId}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-gold px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-brand-gold/90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-gold-bright dark:text-zinc-900 dark:hover:bg-brand-gold-bright/90"
        >
          <Plus size={14} strokeWidth={2.5} />
          Dodaj zniżkę
        </button>
      </div>

      {/* Trending */}
      {(trending.length > 0 || trendingLoading) && (
        <div className="rounded-2xl border border-brand-gold/30 bg-gradient-to-br from-brand-gold/[0.08] to-transparent p-4 dark:border-brand-gold-bright/30 dark:from-brand-gold-bright/[0.08]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className={widgetGoldCls} strokeWidth={2.2} />
              <span className={`text-[11px] font-bold uppercase tracking-[0.18em] ${theme.text.sectionHeader}`}>
                Trending w tym tygodniu
              </span>
            </div>
          </div>
          {trendingLoading ? (
            <div className="flex gap-2 overflow-x-auto">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 w-56 shrink-0 animate-pulse rounded-xl bg-black/[0.05] dark:bg-white/[0.04]" />
              ))}
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {trending.map((t, idx) => {
                const meta = DISCOUNT_CATEGORY_META[t.category]
                const Icon = ICON_MAP[meta.icon]
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleOpenDetail(t.id)}
                    className="group flex w-64 shrink-0 flex-col items-start gap-1 rounded-xl border border-zinc-200 bg-white/80 px-3 py-2.5 text-left transition-colors hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide ${meta.tint}`}>
                        <Icon size={10} strokeWidth={2.3} />
                        {meta.label}
                      </span>
                      <span className="text-[10px] font-bold tabular-nums text-brand-gold dark:text-brand-gold-bright">
                        #{idx + 1}
                      </span>
                    </div>
                    <p className={`line-clamp-1 text-[13px] font-bold ${theme.text.primary}`}>{t.business_name}</p>
                    <p className={`line-clamp-1 text-[11.5px] font-semibold text-brand-gold dark:text-brand-gold-bright`}>
                      {t.discount_headline}
                    </p>
                    <p className={`text-[10.5px] ${theme.text.muted}`}>
                      <span className="tabular-nums">{t.recentUses}</span> wzięli w 7 dni
                    </p>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-col gap-3">
        {/* Search + sort + verified */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={filter.search}
              onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
              placeholder="Szukaj: pizza, fryzjer, kawa..."
              className={`block w-full rounded-full border border-zinc-200 bg-white/70 py-1.5 pl-9 pr-3 text-[12.5px] ${theme.text.primary} placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-brand-gold dark:border-white/10 dark:bg-white/[0.03] dark:placeholder:text-zinc-500`}
            />
            {filter.search && (
              <button
                type="button"
                onClick={() => setFilter((f) => ({ ...f, search: '' }))}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                aria-label="Wyczyść"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="relative">
            <Filter size={13} className={`absolute left-3 top-1/2 -translate-y-1/2 ${theme.text.muted}`} />
            <select
              value={filter.sort}
              onChange={(e) => setFilter((f) => ({ ...f, sort: e.target.value as DiscountFilter['sort'] }))}
              className={`appearance-none rounded-full border border-zinc-200 bg-white/70 py-1.5 pl-8 pr-7 text-[12px] font-medium ${theme.text.primary} focus:outline-none focus:ring-1 focus:ring-brand-gold dark:border-white/10 dark:bg-white/[0.03]`}
            >
              {(Object.entries(SORT_LABELS) as Array<[DiscountFilter['sort'], string]>).map(([slug, label]) => (
                <option key={slug} value={slug}>{label}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setFilter((f) => ({ ...f, verifiedOnly: !f.verifiedOnly }))}
            className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
              filter.verifiedOnly
                ? 'border-emerald-500 bg-emerald-100 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-500/15 dark:text-emerald-200'
                : `border-zinc-200 ${theme.text.muted} hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-white/[0.05]`
            }`}
            title="Pokaż tylko zweryfikowane przez admina"
          >
            potwierdzone
          </button>

          <button
            type="button"
            onClick={requestGeo}
            disabled={geoStatus === 'pending'}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
              hasGeo
                ? 'border-brand-gold bg-brand-gold/15 text-brand-gold dark:border-brand-gold-bright dark:bg-brand-gold-bright/15 dark:text-brand-gold-bright'
                : `border-zinc-200 ${theme.text.muted} hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-white/[0.05]`
            }`}
            title="Sortuj wg odległości od Twojej lokalizacji"
          >
            {geoStatus === 'pending' ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Compass size={12} />
            )}
            {hasGeo ? 'Wokół mnie' : 'Pokaż wokół mnie'}
          </button>
        </div>

        {/* Categories pills */}
        <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
          <button
            type="button"
            onClick={() => setFilter((f) => ({ ...f, category: 'all' }))}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
              filter.category === 'all'
                ? 'bg-brand-gold text-white dark:bg-brand-gold-bright dark:text-zinc-900'
                : `bg-zinc-100 ${theme.text.muted} hover:bg-zinc-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.08]`
            }`}
          >
            Wszystko
          </button>
          {DISCOUNT_CATEGORIES.map((cat) => {
            const meta = DISCOUNT_CATEGORY_META[cat]
            const Icon = ICON_MAP[meta.icon]
            const active = filter.category === cat
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setFilter((f) => ({ ...f, category: cat as DiscountCategory }))}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                  active
                    ? 'bg-brand-gold text-white dark:bg-brand-gold-bright dark:text-zinc-900'
                    : `bg-zinc-100 ${theme.text.muted} hover:bg-zinc-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.08]`
                }`}
              >
                <Icon size={12} strokeWidth={2.3} />
                {meta.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Geo hint */}
      {hasGeo && (
        <p className={`flex items-center gap-1 text-[11px] ${theme.text.muted}`}>
          <MapPin size={11} className="text-emerald-600 dark:text-emerald-400" />
          Posortowane wg odległości od Ciebie (≤ 500m podświetlone na zielono)
        </p>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-700 dark:bg-red-500/15 dark:text-red-200">
          {error}
        </p>
      )}

      {/* Grid */}
      {loading && sortedDiscounts.length === 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-black/[0.05] dark:bg-white/[0.04]" />
          ))}
        </div>
      ) : sortedDiscounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-200 px-6 py-12 text-center dark:border-white/10">
          <Sparkles size={32} className="text-zinc-400 dark:text-zinc-500" strokeWidth={1.5} />
          <p className={`text-[15px] font-semibold ${theme.text.primary}`}>Brak zniżek</p>
          <p className={`max-w-[320px] text-[12.5px] leading-relaxed ${theme.text.muted}`}>
            {filter.search || filter.category !== 'all' || filter.verifiedOnly
              ? 'Spróbuj zmienić filtry albo wyszukać czegoś innego.'
              : 'Bądź pierwszy — dodaj zniżkę którą znasz i pomóż reszcie rocznika.'}
          </p>
          {userId && (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-brand-gold px-4 py-1.5 text-[13px] font-semibold text-white dark:bg-brand-gold-bright dark:text-zinc-900"
            >
              <Plus size={13} strokeWidth={2.5} />
              Dodaj zniżkę
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sortedDiscounts.map((d) => (
            <DiscountCard
              key={d.id}
              discount={d}
              taken={myUsedIds.has(d.id)}
              onOpenDetail={handleOpenDetail}
              onMarkUse={markUse}
            />
          ))}
        </div>
      )}

      {/* Detail modal */}
      {detailDiscount && (
        <DiscountDetailModal
          discount={detailDiscount}
          myUserId={userId}
          isTaken={myUsedIds.has(detailDiscount.id)}
          onClose={() => setDetailDiscount(null)}
          onMarkUse={(id) => {
            void markUse(id)
            // Sync local detail state z optimistic counterem
            setDetailDiscount((prev) =>
              prev && prev.id === id ? { ...prev, use_count: prev.use_count + (myUsedIds.has(id) ? 0 : 1) } : prev,
            )
          }}
        />
      )}

      {/* Form modal */}
      {formOpen && userId && (
        <DiscountFormModal
          userId={userId}
          onClose={() => setFormOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}
