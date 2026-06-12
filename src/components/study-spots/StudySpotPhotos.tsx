/**
 * UJverse — StudySpotPhotos: galeria + uploader zdjęć miejsca.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * - Galeria grid (thumb 96×96) + lightbox-overlay na klik (prosta wersja).
 * - Upload: tylko zalogowany (RLS po stronie storage); UI ogranicza do
 *   MAX_PHOTOS_PER_SPOT (6) i waliduje MIME/size lokalnie przed wrzuceniem.
 * - Delete: tylko właściciel zdjęcia (RLS po segmencie ścieżki user_id).
 *   Klient nie zna kto wrzucił dane zdjęcie, więc DELETE jest "opcjonalnie
 *   widoczny" — błąd RLS jest cicho ignorowany w UI (popup z reason).
 */
import { useCallback, useRef, useState } from 'react'
import { Camera, Loader2, Plus, X } from 'lucide-react'
import {
  MAX_PHOTOS_PER_SPOT,
  PHOTO_ACCEPT_ATTR,
  validatePhoto,
} from '../../lib/studySpotUpload'

type Props = {
  spotId: string
  photos: string[]
  canUpload: boolean
  onUpload: (file: File) => Promise<{ publicUrl: string | null; error: string | null }>
  onRemove: (photoUrl: string) => Promise<{ error: string | null }>
}

export default function StudySpotPhotos({
  photos,
  canUpload,
  onUpload,
  onRemove,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const atLimit = photos.length >= MAX_PHOTOS_PER_SPOT

  const handlePick = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      setError(null)
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return

      const v = validatePhoto(file)
      if (!v.ok) {
        setError(v.reason)
        return
      }
      setBusy(true)
      const result = await onUpload(file)
      setBusy(false)
      if (result.error) setError(result.error)
    },
    [onUpload],
  )

  const handleRemove = useCallback(
    async (url: string) => {
      if (busy) return
      if (!confirm('Usunąć to zdjęcie?')) return
      setBusy(true)
      const result = await onRemove(url)
      setBusy(false)
      if (result.error) setError(result.error)
    },
    [busy, onRemove],
  )

  if (photos.length === 0 && !canUpload) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
          <Camera size={11} strokeWidth={2.4} aria-hidden />
          Zdjęcia
          {photos.length > 0 && (
            <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums text-zinc-700 dark:bg-white/10 dark:text-zinc-300">
              {photos.length}/{MAX_PHOTOS_PER_SPOT}
            </span>
          )}
        </h3>
        {canUpload && !atLimit && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide text-zinc-700 transition-colors hover:border-emerald-500 hover:text-emerald-700 disabled:opacity-50 dark:border-white/15 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:border-emerald-400/50 dark:hover:text-emerald-300"
          >
            {busy ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Plus size={11} strokeWidth={2.6} />
            )}
            Dodaj
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={PHOTO_ACCEPT_ATTR}
        onChange={handlePick}
        className="hidden"
        aria-label="Wybierz zdjęcie do uploadu"
      />

      {photos.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((url) => (
            <li
              key={url}
              className="relative aspect-square overflow-hidden rounded-xl border border-zinc-200/70 bg-zinc-100 dark:border-white/10 dark:bg-white/[0.04]"
            >
              <button
                type="button"
                onClick={() => setLightbox(url)}
                className="block h-full w-full"
                aria-label="Powiększ"
              >
                <img
                  src={url}
                  alt="Zdjęcie miejsca"
                  className="h-full w-full object-cover transition-transform hover:scale-105"
                  loading="lazy"
                />
              </button>
              {canUpload && (
                <button
                  type="button"
                  onClick={() => handleRemove(url)}
                  disabled={busy}
                  className="absolute right-1 top-1 rounded-full bg-black/55 p-1 text-white opacity-0 transition-opacity hover:bg-red-500 group-hover:opacity-100 focus:opacity-100"
                  aria-label="Usuń zdjęcie"
                  title="Usuń (tylko jeśli to twoje zdjęcie)"
                  style={{ opacity: 1 }}
                >
                  <X size={11} strokeWidth={2.6} />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : canUpload ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50/60 px-4 py-6 text-[12px] font-semibold text-zinc-500 hover:border-emerald-400 hover:bg-emerald-50/40 hover:text-emerald-700 dark:border-white/15 dark:bg-white/[0.02] dark:text-zinc-400 dark:hover:border-emerald-400/50 dark:hover:bg-emerald-500/5"
        >
          {busy ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Wgrywam…
            </>
          ) : (
            <>
              <Camera size={14} strokeWidth={2.2} />
              Dodaj pierwsze zdjęcie
            </>
          )}
        </button>
      ) : null}

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-[11.5px] text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-200 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="Zdjęcie powiększone"
            className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white backdrop-blur-md hover:bg-white/25"
            aria-label="Zamknij"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>
      )}
    </div>
  )
}
