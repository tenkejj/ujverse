/**
 * UJverse — DiscountFormModal: formularz dodawania nowej zniżki.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Minimalna walidacja front-side (oprócz natywnej DB CHECK):
 *   - business_name 2-80
 *   - discount_headline 3-120
 *   - description ≤1000
 *   - category z fixed listy
 *
 * Geo (lat/lng) NA RAZIE pomijamy — user wpisuje samo `address`. W phase 2
 * dodamy reverse geocoding (Google Geocoding API lub Nominatim).
 */
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Loader2, X } from 'lucide-react'
import { theme } from '../../styles/theme'
import {
  DISCOUNT_CATEGORIES,
  DISCOUNT_CATEGORY_META,
  type DiscountCategory,
} from '../../types/discounts'
import { DiscountsService } from '../../services/DiscountsService'

type Props = {
  userId: string
  onClose: () => void
  /** Opcjonalne `discountId` po sukcesie — caller używa np. do gamifikacji idempotency. */
  onCreated: (discountId?: string) => void
}

export default function DiscountFormModal({ userId, onClose, onCreated }: Props) {
  const shouldReduceMotion = useReducedMotion()
  const [businessName, setBusinessName] = useState('')
  const [headline, setHeadline] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<DiscountCategory>('jedzenie')
  const [address, setAddress] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [requiresUjId, setRequiresUjId] = useState(true)
  const [validUntil, setValidUntil] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit =
    businessName.trim().length >= 2 &&
    businessName.trim().length <= 80 &&
    headline.trim().length >= 3 &&
    headline.trim().length <= 120 &&
    !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    const { data: created, error: err } = await DiscountsService.create({
      createdBy: userId,
      businessName: businessName.trim(),
      discountHeadline: headline.trim(),
      description: description.trim() || null,
      category,
      address: address.trim() || null,
      websiteUrl: websiteUrl.trim() || null,
      sourceUrl: sourceUrl.trim() || null,
      requiresUjId,
      validUntil: validUntil || null,
    })
    setSubmitting(false)
    if (err) {
      setError(err.message)
      return
    }
    onCreated(created?.id)
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Dodaj zniżkę"
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <motion.div
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 40 }}
        animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="relative flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl dark:bg-bg-app"
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-white/10">
          <div className="min-w-0 flex-1">
            <h2 className={`text-lg font-bold ${theme.text.primary}`}>Dodaj zniżkę</h2>
            <p className={`mt-0.5 text-[12px] ${theme.text.muted}`}>
              Pomagasz innym studentom — dziękujemy! Sprawdzimy i oznaczymy jako potwierdzone.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-full p-1.5 ${theme.text.muted} hover:bg-zinc-100 dark:hover:bg-white/10`}
            aria-label="Zamknij"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* Business name */}
          <div>
            <label className={`text-[12px] font-semibold ${theme.text.primary}`}>
              Nazwa biznesu / miejsca <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value.slice(0, 80))}
              placeholder="np. Pizza Manzana"
              className={`mt-1 block w-full rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 text-[13px] ${theme.text.primary} placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-brand-gold dark:border-white/10 dark:bg-white/[0.03] dark:placeholder:text-zinc-500`}
            />
          </div>

          {/* Headline */}
          <div>
            <label className={`text-[12px] font-semibold ${theme.text.primary}`}>
              Nagłówek zniżki <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value.slice(0, 120))}
              placeholder="np. -15% z legitymacją UJ"
              className={`mt-1 block w-full rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 text-[13px] ${theme.text.primary} placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-brand-gold dark:border-white/10 dark:bg-white/[0.03] dark:placeholder:text-zinc-500`}
            />
          </div>

          {/* Category */}
          <div>
            <label className={`text-[12px] font-semibold ${theme.text.primary}`}>Kategoria</label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {DISCOUNT_CATEGORIES.map((cat) => {
                const meta = DISCOUNT_CATEGORY_META[cat]
                const active = category === cat
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`rounded-full border px-3 py-1 text-[11.5px] font-semibold transition-colors ${
                      active
                        ? 'border-brand-gold bg-brand-gold/15 text-brand-gold dark:border-brand-gold-bright dark:bg-brand-gold-bright/15 dark:text-brand-gold-bright'
                        : `border-zinc-200 ${theme.text.muted} hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-white/[0.05]`
                    }`}
                  >
                    {meta.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={`text-[12px] font-semibold ${theme.text.primary}`}>
              Opis / warunki <span className={theme.text.muted}>(opcjonalnie)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
              placeholder="Jakie są szczegóły? Wymagania? Wyjątki?"
              rows={3}
              className={`mt-1 block w-full resize-none rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 text-[13px] ${theme.text.primary} placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-brand-gold dark:border-white/10 dark:bg-white/[0.03] dark:placeholder:text-zinc-500`}
            />
            <p className={`mt-0.5 text-[10.5px] ${theme.text.muted}`}>{description.length} / 1000</p>
          </div>

          {/* Address */}
          <div>
            <label className={`text-[12px] font-semibold ${theme.text.primary}`}>
              Adres <span className={theme.text.muted}>(opcjonalnie)</span>
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value.slice(0, 200))}
              placeholder="np. ul. Karmelicka 28, Kraków"
              className={`mt-1 block w-full rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 text-[13px] ${theme.text.primary} placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-brand-gold dark:border-white/10 dark:bg-white/[0.03] dark:placeholder:text-zinc-500`}
            />
          </div>

          {/* Links */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={`text-[12px] font-semibold ${theme.text.primary}`}>Strona www</label>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value.slice(0, 400))}
                placeholder="https://..."
                className={`mt-1 block w-full rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 text-[13px] ${theme.text.primary} placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-brand-gold dark:border-white/10 dark:bg-white/[0.03] dark:placeholder:text-zinc-500`}
              />
            </div>
            <div>
              <label className={`text-[12px] font-semibold ${theme.text.primary}`}>Źródło informacji</label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value.slice(0, 400))}
                placeholder="https://... (regulamin/post FB)"
                className={`mt-1 block w-full rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 text-[13px] ${theme.text.primary} placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-brand-gold dark:border-white/10 dark:bg-white/[0.03] dark:placeholder:text-zinc-500`}
              />
            </div>
          </div>

          {/* Misc */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={`flex items-start gap-2 text-[12px] ${theme.text.primary}`}>
              <input
                type="checkbox"
                checked={requiresUjId}
                onChange={(e) => setRequiresUjId(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-brand-gold focus:ring-brand-gold dark:border-white/20"
              />
              <span>Wymagana legitymacja UJ</span>
            </label>
            <div>
              <label className={`text-[12px] font-semibold ${theme.text.primary}`}>Ważne do</label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className={`mt-1 block w-full rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 text-[13px] ${theme.text.primary} focus:outline-none focus:ring-1 focus:ring-brand-gold dark:border-white/10 dark:bg-white/[0.03]`}
              />
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700 dark:bg-red-500/15 dark:text-red-200">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-white px-5 py-3 dark:border-white/10 dark:bg-bg-app">
          <button
            type="button"
            onClick={onClose}
            className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${theme.text.muted}`}
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-gold px-4 py-1.5 text-[12.5px] font-semibold text-white shadow-sm transition-colors hover:bg-brand-gold/90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-gold-bright dark:text-zinc-900"
          >
            {submitting && <Loader2 size={12} className="animate-spin" />}
            Dodaj zniżkę
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  )
}
