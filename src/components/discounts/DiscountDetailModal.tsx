/**
 * UJverse — DiscountDetailModal: szczegóły zniżki + reviews + report.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Sekcje:
 *   - Hero: business_name + headline + use_count + verified badge
 *   - Opis + warunki + valid_until
 *   - Adres + link "Otwórz w Google Maps" (lat/lng → `?q=<lat>,<lng>`)
 *   - Reviews list (max 50) + form "Oceń (1-5)" gdy user zalogowany
 *   - Report dropdown ("Zgłoś że nie działa")
 *   - "Wziąłem!" CTA u dołu (large)
 */
import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  BadgeCheck,
  Calendar,
  Check,
  ExternalLink,
  Flag,
  Globe,
  Loader2,
  MapPin,
  Star,
  Users,
  X,
} from 'lucide-react'
import { theme } from '../../styles/theme'
import {
  DISCOUNT_CATEGORY_META,
  DISCOUNT_REPORT_REASON_LABELS,
  type DiscountReportReason,
  type DiscountReview,
  type StudentDiscount,
} from '../../types/discounts'
import { DiscountsService } from '../../services/DiscountsService'

type Props = {
  discount: StudentDiscount
  myUserId: string | null
  isTaken: boolean
  onClose: () => void
  onMarkUse: (id: string) => void
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function fmtValidUntil(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return null
  return d.toLocaleDateString('pl-PL', { day: '2-digit', month: 'long', year: 'numeric' })
}

function StarRow({
  value,
  onChange,
  size = 18,
}: {
  value: number
  onChange?: (v: number) => void
  size?: number
}) {
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange?.(n)}
          disabled={!onChange}
          className={`p-0.5 ${onChange ? 'cursor-pointer' : 'cursor-default'} transition-transform ${onChange ? 'hover:scale-110' : ''}`}
          aria-label={`${n} z 5`}
        >
          <Star
            size={size}
            className={n <= value ? 'fill-amber-400 text-amber-500' : 'text-zinc-300 dark:text-zinc-600'}
            strokeWidth={1.6}
          />
        </button>
      ))}
    </div>
  )
}

export default function DiscountDetailModal({
  discount,
  myUserId,
  isTaken,
  onClose,
  onMarkUse,
}: Props) {
  const shouldReduceMotion = useReducedMotion()
  const meta = DISCOUNT_CATEGORY_META[discount.category]
  const [reviews, setReviews] = useState<DiscountReview[]>([])
  const [loadingReviews, setLoadingReviews] = useState(true)

  const [myRating, setMyRating] = useState<number>(0)
  const [myComment, setMyComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)

  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState<DiscountReportReason>('nie_dziala')
  const [reportComment, setReportComment] = useState('')
  const [reportSent, setReportSent] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)

  const validUntilLabel = fmtValidUntil(discount.valid_until)

  const refreshReviews = useCallback(async () => {
    setLoadingReviews(true)
    const { data, error } = await DiscountsService.listReviews(discount.id)
    setLoadingReviews(false)
    if (error) return
    setReviews(data)

    if (myUserId) {
      const my = data.find((r) => r.user_id === myUserId)
      if (my) {
        setMyRating(my.rating)
        setMyComment(my.comment ?? '')
      }
    }
  }, [discount.id, myUserId])

  useEffect(() => { void refreshReviews() }, [refreshReviews])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSubmitReview = async () => {
    if (!myUserId || myRating === 0) return
    setSubmittingReview(true)
    setReviewError(null)
    const { error } = await DiscountsService.upsertMyReview({
      discountId: discount.id,
      userId: myUserId,
      rating: myRating,
      comment: myComment.trim() || null,
    })
    setSubmittingReview(false)
    if (error) {
      setReviewError(error.message)
      return
    }
    void refreshReviews()
  }

  const handleSubmitReport = async () => {
    if (!myUserId) return
    setReportError(null)
    const { error } = await DiscountsService.report({
      discountId: discount.id,
      userId: myUserId,
      reason: reportReason,
      comment: reportComment.trim() || null,
    })
    if (error) {
      setReportError(error.message)
      return
    }
    setReportSent(true)
    setTimeout(() => {
      setReportOpen(false)
      setReportSent(false)
      setReportComment('')
    }, 1400)
  }

  const mapsUrl = (() => {
    if (discount.lat != null && discount.lng != null) {
      return `https://www.google.com/maps/search/?api=1&query=${discount.lat},${discount.lng}`
    }
    if (discount.address) {
      const q = encodeURIComponent(`${discount.address}, ${discount.city}`)
      return `https://www.google.com/maps/search/?api=1&query=${q}`
    }
    return null
  })()

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${discount.business_name} — szczegóły`}
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <motion.div
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 40 }}
        animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl dark:bg-bg-app"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-white/10">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.tint}`}>
                {meta.label}
              </span>
              {discount.verified_at && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                  <BadgeCheck size={13} strokeWidth={2.2} />
                  potwierdzone
                </span>
              )}
            </div>
            <h2 className={`mt-1 truncate text-xl font-bold ${theme.text.primary}`}>{discount.business_name}</h2>
            <p className={`mt-0.5 text-[14px] font-semibold leading-snug text-brand-gold dark:text-brand-gold-bright`}>
              {discount.discount_headline}
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Meta facts */}
          <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] ${theme.text.muted}`}>
            <span className="inline-flex items-center gap-1.5">
              <Users size={13} />
              <span className="tabular-nums">{discount.use_count}</span> osób wzięło
            </span>
            {discount.avg_rating != null && (
              <span className="inline-flex items-center gap-1.5">
                <Star size={13} className="fill-amber-400 text-amber-500" strokeWidth={0} />
                <span className="tabular-nums">{discount.avg_rating.toFixed(1)}</span>
                <span className={theme.text.muted}>· {discount.review_count} ocen</span>
              </span>
            )}
            {discount.requires_uj_id && (
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:bg-white/[0.06] dark:text-zinc-200">
                wymaga legitymacji UJ
              </span>
            )}
            {validUntilLabel && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={13} />
                ważne do <span className="font-medium">{validUntilLabel}</span>
              </span>
            )}
          </div>

          {/* Opis */}
          {discount.description && (
            <p className={`mt-4 text-[13.5px] leading-relaxed ${theme.text.primary}`}>{discount.description}</p>
          )}

          {/* Adres + maps */}
          {(discount.address || mapsUrl) && (
            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.04]">
              <div className={`flex items-start gap-2 text-[13px] ${theme.text.primary}`}>
                <MapPin size={14} className="mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{discount.address ?? discount.city}</p>
                  <p className={`text-[11.5px] ${theme.text.muted}`}>{discount.city}</p>
                </div>
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-gold/15 px-2.5 py-1 text-[11.5px] font-semibold text-brand-gold transition-colors hover:bg-brand-gold/25 dark:bg-brand-gold-bright/15 dark:text-brand-gold-bright dark:hover:bg-brand-gold-bright/25"
                  >
                    <ExternalLink size={11} /> Mapa
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Website */}
          {discount.website_url && (
            <a
              href={discount.website_url}
              target="_blank"
              rel="noreferrer noopener"
              className={`mt-3 inline-flex items-center gap-2 text-[12.5px] font-medium text-brand-gold underline-offset-2 hover:underline dark:text-brand-gold-bright`}
            >
              <Globe size={13} /> Strona biznesu
            </a>
          )}

          {/* Reviews */}
          <div className="mt-6">
            <h3 className={`text-[11px] font-bold uppercase tracking-[0.18em] ${theme.text.sectionHeader}`}>
              Opinie
            </h3>

            {/* Form */}
            {myUserId && (
              <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[12px] font-semibold ${theme.text.primary}`}>Twoja ocena</span>
                  <StarRow value={myRating} onChange={setMyRating} />
                </div>
                <textarea
                  value={myComment}
                  onChange={(e) => setMyComment(e.target.value.slice(0, 500))}
                  placeholder="Komentarz (opcjonalnie, max 500 znaków)"
                  rows={2}
                  className={`mt-2 block w-full resize-none rounded-lg border border-zinc-200 bg-white/70 px-2.5 py-1.5 text-[12.5px] ${theme.text.primary} placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-brand-gold dark:border-white/10 dark:bg-white/[0.03] dark:placeholder:text-zinc-500`}
                />
                {reviewError && <p className="mt-1.5 text-[11px] text-red-600 dark:text-red-300">{reviewError}</p>}
                <div className="mt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleSubmitReview}
                    disabled={myRating === 0 || submittingReview}
                    className="inline-flex items-center gap-1.5 rounded-full bg-brand-gold px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm transition-colors hover:bg-brand-gold/90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-gold-bright dark:text-zinc-900"
                  >
                    {submittingReview && <Loader2 size={12} className="animate-spin" />}
                    Zapisz ocenę
                  </button>
                </div>
              </div>
            )}

            {/* List */}
            <div className="mt-3 space-y-2">
              {loadingReviews ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-14 animate-pulse rounded-xl bg-black/[0.05] dark:bg-white/[0.04]" />
                  ))}
                </div>
              ) : reviews.length === 0 ? (
                <p className={`rounded-lg border border-dashed border-zinc-200 px-3 py-3 text-center text-[12px] dark:border-white/10 ${theme.text.muted}`}>
                  Brak opinii. Bądź pierwszy!
                </p>
              ) : (
                reviews.map((r) => (
                  <div key={r.id} className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[12px] font-semibold ${theme.text.primary}`}>
                        {r.author?.full_name ?? r.author?.username ?? 'Anonim'}
                      </span>
                      <StarRow value={r.rating} size={13} />
                    </div>
                    {r.comment && <p className={`mt-1 text-[12.5px] leading-relaxed ${theme.text.muted}`}>{r.comment}</p>}
                    <p className={`mt-1 text-[10.5px] ${theme.text.muted}`}>{fmtDate(r.created_at)}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Report */}
          <div className="mt-6">
            {!reportOpen ? (
              <button
                type="button"
                onClick={() => setReportOpen(true)}
                className={`inline-flex items-center gap-1.5 text-[11.5px] font-medium ${theme.text.muted} hover:underline`}
              >
                <Flag size={11} /> Zgłoś że nie działa / zamknięte
              </button>
            ) : (
              <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.03]">
                {reportSent ? (
                  <p className="inline-flex items-center gap-1.5 text-[12.5px] text-emerald-700 dark:text-emerald-300">
                    <Check size={13} strokeWidth={2.5} /> Dzięki! Sprawdzimy.
                  </p>
                ) : (
                  <>
                    <p className={`text-[12px] font-semibold ${theme.text.primary}`}>Co jest nie tak?</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(Object.entries(DISCOUNT_REPORT_REASON_LABELS) as Array<[DiscountReportReason, string]>).map(([slug, label]) => (
                        <button
                          key={slug}
                          type="button"
                          onClick={() => setReportReason(slug)}
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                            reportReason === slug
                              ? 'border-brand-gold bg-brand-gold/15 text-brand-gold dark:border-brand-gold-bright dark:bg-brand-gold-bright/15 dark:text-brand-gold-bright'
                              : `border-zinc-200 ${theme.text.muted} hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-white/[0.05]`
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={reportComment}
                      onChange={(e) => setReportComment(e.target.value.slice(0, 500))}
                      placeholder="Więcej szczegółów (opcjonalnie)"
                      rows={2}
                      className={`mt-2 block w-full resize-none rounded-lg border border-zinc-200 bg-white/70 px-2.5 py-1.5 text-[12px] ${theme.text.primary} placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-brand-gold dark:border-white/10 dark:bg-white/[0.03] dark:placeholder:text-zinc-500`}
                    />
                    {reportError && <p className="mt-1.5 text-[11px] text-red-600 dark:text-red-300">{reportError}</p>}
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setReportOpen(false)}
                        className={`rounded-full px-3 py-1 text-[11.5px] font-medium ${theme.text.muted}`}
                      >
                        Anuluj
                      </button>
                      <button
                        type="button"
                        onClick={handleSubmitReport}
                        className="rounded-full bg-red-600 px-3 py-1 text-[11.5px] font-semibold text-white hover:bg-red-700 dark:bg-red-500"
                      >
                        Wyślij zgłoszenie
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer CTA */}
        <div className="border-t border-zinc-200 bg-white px-5 py-3 dark:border-white/10 dark:bg-bg-app">
          <button
            type="button"
            onClick={() => onMarkUse(discount.id)}
            disabled={isTaken}
            className={`flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[13.5px] font-bold transition-colors ${
              isTaken
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200 cursor-default'
                : 'bg-brand-gold text-white hover:bg-brand-gold/90 dark:bg-brand-gold-bright dark:text-zinc-900 dark:hover:bg-brand-gold-bright/90'
            }`}
          >
            {isTaken ? (
              <>
                <Check size={14} strokeWidth={2.8} />
                Już skorzystałeś — dzięki!
              </>
            ) : (
              <>Wziąłem zniżkę!</>
            )}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  )
}
